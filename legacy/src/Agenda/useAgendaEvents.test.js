import { renderHook, act, waitFor } from '@testing-library/react';
import useAgendaEvents from './useAgendaEvents';

const jsonResponse = (status, body) => Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
});

beforeEach(() => {
    global.fetch = jest.fn();
});

afterEach(() => {
    jest.resetAllMocks();
});

test('loads events on mount and parses dates', async () => {
    fetch.mockResolvedValueOnce(jsonResponse(200, [
        { id: '1', title: 'Standup', description: '', date: '2026-08-01T00:00:00.000Z' },
    ]));

    const { result } = renderHook(() => useAgendaEvents());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].date).toBeInstanceOf(Date);
});

test('addEvent posts and appends the created event', async () => {
    fetch.mockResolvedValueOnce(jsonResponse(200, []));
    const { result } = renderHook(() => useAgendaEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetch.mockResolvedValueOnce(jsonResponse(201, {
        id: '2', title: 'New event', description: '', date: '2026-08-05T00:00:00.000Z',
    }));

    let outcome;
    await act(async () => {
        outcome = await result.current.addEvent({ title: 'New event', description: '', date: '2026-08-05T00:00:00.000Z' });
    });

    expect(outcome.ok).toBe(true);
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].title).toBe('New event');
});

test('deleteEvent removes the event on success', async () => {
    fetch.mockResolvedValueOnce(jsonResponse(200, [
        { id: '1', title: 'Standup', description: '', date: '2026-08-01T00:00:00.000Z' },
    ]));
    const { result } = renderHook(() => useAgendaEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetch.mockResolvedValueOnce({ ok: true, status: 204, json: () => Promise.resolve(null), text: () => Promise.resolve('') });

    await act(async () => {
        await result.current.deleteEvent('1');
    });

    expect(result.current.events).toHaveLength(0);
});

test('surfaces a server error message instead of throwing', async () => {
    fetch.mockResolvedValueOnce(jsonResponse(200, []));
    const { result } = renderHook(() => useAgendaEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetch.mockResolvedValueOnce(jsonResponse(400, { error: 'title is required' }));

    let outcome;
    await act(async () => {
        outcome = await result.current.addEvent({ title: '', date: '' });
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.error).toBe('title is required');
    expect(result.current.events).toHaveLength(0);
});
