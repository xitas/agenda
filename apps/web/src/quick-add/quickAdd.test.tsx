import { ApiError, NetworkError, eventOverlapsRange } from '@agenda/core';
import type { AgendaEvent } from '@agenda/core';
import { fireEvent, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../test-utils/axe';
import type { FakeApi } from '../test-utils/fakeApi';
import { NOW, TEST_ENV, renderApp } from '../test-utils/renderApp';
import { findToastAction } from '../test-utils/toast';
import { colorName, previewWhen } from './preview';

/** A tiny in-memory server: listAll returns what create saved. */
function withServer(fake: FakeApi) {
  const saved: AgendaEvent[] = [];
  fake.events.listAll.mockImplementation((params) =>
    Promise.resolve(
      saved.filter((event) =>
        eventOverlapsRange(
          event,
          { start: new Date(params?.from ?? 0), end: new Date(params?.to ?? 0) },
          params?.tz ?? 'UTC',
        ),
      ),
    ),
  );
  fake.events.create.mockImplementation((input) => {
    const event = {
      ...input,
      id: input.id ?? 'missing',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      deletedAt: null,
    } as AgendaEvent;
    saved.push(event);
    return Promise.resolve(event);
  });
  return saved;
}

const field = () => screen.getByRole('textbox', { name: 'Quick add' });
const path = (app: ReturnType<typeof renderApp>) => app.router.state.location.pathname;

async function ready() {
  await screen.findByText('Nothing today. Enjoy the space.');
  return userEvent.setup();
}

describe('QuickAdd preview', () => {
  it('shows what will be created while typing', async () => {
    renderApp('/');
    const user = await ready();
    await user.type(field(), 'Dentist tomorrow 4pm #red');
    const preview = document.getElementById(field().getAttribute('aria-describedby') ?? '');
    expect(preview?.textContent).toContain('Dentist');
    expect(preview?.textContent).toContain('Wed 28 Oct · 16:00');
    expect(preview?.textContent).toContain('Red');
    expect(preview?.querySelector('[data-event-color="red"]')).not.toBeNull();
  });

  it('shows the parser warnings', async () => {
    renderApp('/');
    const user = await ready();
    await user.type(field(), 'Call the bank');
    expect(screen.getByText('No date found, so this was added for today')).toBeDefined();
  });

  it('has no preview while empty, and no axe violations with one', async () => {
    renderApp('/');
    const user = await ready();
    expect(field().getAttribute('aria-describedby')).toBeNull();
    await user.type(field(), 'Standup every Monday 9am');
    expect(screen.getByText("Recurring events aren't supported yet")).toBeDefined();
    await expectNoAxeViolations();
  });
});

describe('QuickAdd create', () => {
  it('adds the event to the page at once and clears the field', async () => {
    const app = renderApp('/', { setup: withServer });
    // Never answers, so only the optimistic copy can be on screen.
    app.events.create.mockImplementation(() => new Promise(() => undefined));
    const user = await ready();
    await user.type(field(), 'Lunch with Sara today 1pm #green{Enter}');

    expect(field()).toHaveProperty('value', '');
    const list = await screen.findByRole('list', { name: /^Events,/ });
    expect(within(list).getByText('Lunch with Sara')).toBeDefined();
    expect(app.events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown,
        title: 'Lunch with Sara',
        start: '2026-10-27T08:00:00.000Z',
        allDay: false,
        color: 'green',
        timezone: 'Asia/Karachi',
      }),
    );
  });

  it('says where an event for another day went, and shows that day', async () => {
    const app = renderApp('/', { setup: withServer });
    const user = await ready();
    await user.type(field(), 'Lunch with Sara tomorrow 1pm{Enter}');
    expect(await screen.findByText('Event added for Wed 28 Oct.')).toBeDefined();

    await user.click(await findToastAction('Show'));
    expect(path(app)).toBe('/day/2026-10-28');
    const list = await screen.findByRole('list', { name: /^Events,/ });
    expect(within(list).getByText('Lunch with Sara')).toBeDefined();
  });

  it('adds all-day and multi-day events', async () => {
    const app = renderApp('/', { setup: withServer });
    const user = await ready();
    await user.type(field(), 'Team offsite today{Enter}');
    await user.type(field(), 'Conference 3-5 nov{Enter}');
    expect(await screen.findByText('Team offsite')).toBeDefined();
    expect(app.events.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'Conference',
        start: '2026-11-03',
        end: '2026-11-06',
        allDay: true,
      }),
    );
  });

  it('rolls back, explains and gives the text back when the API says no', async () => {
    const app = renderApp('/', { setup: withServer });
    app.events.create.mockRejectedValue(new ApiError(422, 'validation_failed', 'Invalid event'));
    const user = await ready();
    await user.type(field(), 'Lunch today 1pm{Enter}');

    expect(await screen.findByText('Couldn\'t add "Lunch". Try again.')).toBeDefined();
    expect(await screen.findByText('Nothing today. Enjoy the space.')).toBeDefined();
    expect(field()).toHaveProperty('value', 'Lunch today 1pm');
  });

  it('says when the server is unreachable', async () => {
    const app = renderApp('/');
    app.events.create.mockRejectedValue(new NetworkError('network', 'offline'));
    const user = await ready();
    await user.type(field(), 'Lunch today 1pm{Enter}');
    expect(
      await screen.findByText(`Couldn't reach the server, so "Lunch" wasn't added. Try again.`),
    ).toBeDefined();
  });

  it('does nothing for an empty field', async () => {
    const app = renderApp('/');
    const user = await ready();
    await user.type(field(), '   {Enter}');
    expect(app.events.create).not.toHaveBeenCalled();
  });
});

describe('QuickAdd keys', () => {
  it('clears on Esc, then leaves the field on a second Esc', async () => {
    renderApp('/');
    const user = await ready();
    await user.type(field(), 'Dentist');
    await user.keyboard('{Escape}');
    expect(field()).toHaveProperty('value', '');
    expect(document.activeElement).toBe(field());
    await user.keyboard('{Escape}');
    expect(document.activeElement).not.toBe(field());
  });

  it('is focused by N and Ctrl/Cmd+K, and N can still be typed', async () => {
    renderApp('/');
    const user = await ready();
    fireEvent.keyDown(window, { key: 'n' });
    expect(document.activeElement).toBe(field());
    await user.type(field(), 'Nap');
    expect(field()).toHaveProperty('value', 'Nap');

    field().blur();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(document.activeElement).toBe(field());
  });
});

describe('previewWhen', () => {
  it('prefixes the day for single-day events', () => {
    expect(previewWhen({ start: '2026-10-27', end: null, allDay: true }, TEST_ENV)).toBe(
      'Tue 27 Oct · All day',
    );
    expect(previewWhen({ start: '2026-10-27', end: '2026-10-28', allDay: true }, TEST_ENV)).toBe(
      'Tue 27 Oct · All day',
    );
    expect(
      previewWhen(
        { start: '2026-10-27T10:00:00.000Z', end: '2026-10-27T11:00:00.000Z', allDay: false },
        TEST_ENV,
      ),
    ).toBe('Tue 27 Oct · 15:00 – 16:00');
  });

  it('shows the full range for events that span days', () => {
    expect(previewWhen({ start: '2026-11-03', end: '2026-11-06', allDay: true }, TEST_ENV)).toBe(
      'Tue, 3 Nov – Thu, 5 Nov',
    );
    expect(
      previewWhen(
        { start: '2026-10-27T17:00:00.000Z', end: '2026-10-27T21:00:00.000Z', allDay: false },
        TEST_ENV,
      ),
    ).toBe('Tue, 27 Oct, 22:00 – Wed, 28 Oct, 02:00');
  });

  it('names colors', () => {
    expect(colorName('teal')).toBe('Teal');
  });
});
