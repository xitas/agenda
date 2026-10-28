import { NetworkError } from '@agenda/core';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../test-utils/axe';
import { makeEvent } from '../test-utils/events';
import { mockMatchMedia } from '../test-utils/media';
import { renderApp } from '../test-utils/renderApp';

// NOW is Tuesday 27 October 2026, 14:00 in Karachi (UTC+5).
const path = (app: ReturnType<typeof renderApp>) => app.router.state.location.pathname;
/** Intl.formatRange puts thin spaces (U+2009) around the dash: "26 Oct – 1 Nov 2026". */
const THIN = String.fromCharCode(0x2009);
const heading = (name: string) =>
  screen.findByRole('heading', { level: 1, name: name.replace(/ ?– ?/, `${THIN}–${THIN}`) });
const dayHeaders = () =>
  screen
    .getAllByRole('button', { name: /^\w+day, \d+ \w+ \d{4}/ })
    .filter((button) => button.className.includes('ag-timegrid__day'))
    .map((button) => button.getAttribute('aria-label'));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Week', () => {
  it('shows this week, Monday first, with its events', async () => {
    const app = renderApp('/week', {
      setup: (fake) => {
        fake.events.listAll.mockResolvedValue([
          makeEvent({
            title: 'Dentist',
            start: '2026-10-28T11:00:00.000Z',
            end: '2026-10-28T12:00:00.000Z',
          }),
          makeEvent({ title: 'Conference', start: '2026-10-29', end: '2026-10-31', allDay: true }),
        ]);
      },
    });
    expect(await heading('26 Oct – 1 Nov 2026')).toBeDefined();
    expect(screen.getByText('This week')).toBeDefined();
    expect(dayHeaders()).toHaveLength(7);
    expect(dayHeaders()[0]).toBe('Monday, 26 October 2026');
    expect(dayHeaders()[1]).toBe('Tuesday, 27 October 2026, today');
    expect(await screen.findByRole('button', { name: /^Dentist/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Conference/ })).toBeDefined();
    expect(app.events.listAll).toHaveBeenCalledWith(
      {
        from: new Date('2026-10-25T19:00:00.000Z'),
        to: new Date('2026-11-01T19:00:00.000Z'),
        tz: 'Asia/Karachi',
      },
      expect.anything(),
    );
    expect(screen.getByRole('link', { name: 'Week' }).getAttribute('aria-current')).toBe('page');
  });

  it('opens an event in the details dialog', async () => {
    renderApp('/week', {
      setup: (fake) => {
        fake.events.listAll.mockResolvedValue([
          makeEvent({ title: 'Dentist', start: '2026-10-28T11:00:00.000Z' }),
        ]);
      },
    });
    await userEvent.setup().click(await screen.findByRole('button', { name: /^Dentist/ }));
    expect(await screen.findByRole('dialog', { name: 'Dentist' })).toBeDefined();
  });

  it('moves by a week with the arrows and comes back with Today', async () => {
    const app = renderApp('/week');
    const user = userEvent.setup();
    await heading('26 Oct – 1 Nov 2026');
    expect(screen.getByRole('button', { name: 'Today' })).toHaveProperty('disabled', true);

    await user.click(screen.getByRole('button', { name: 'Next week' }));
    expect(path(app)).toBe('/week/2026-11-02');
    expect(await heading('2 – 8 Nov 2026')).toBeDefined();
    expect(screen.queryByText('This week')).toBeNull();
    expect(screen.getByRole('link', { name: 'Week' }).getAttribute('aria-current')).toBe('page');

    await user.click(screen.getByRole('button', { name: 'Previous week' }));
    await user.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(path(app)).toBe('/week/2026-10-19');
    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(path(app)).toBe('/week');
  });

  it('follows ←, → and T, and keeps any date in the URL', async () => {
    const app = renderApp('/week/2026-12-31');
    expect(await heading('28 Dec 2026 – 3 Jan 2027')).toBeDefined();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(path(app)).toBe('/week/2027-01-04');
    });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => {
      expect(path(app)).toBe('/week/2026-12-28');
    });
    fireEvent.keyDown(window, { key: 't' });
    await waitFor(() => {
      expect(path(app)).toBe('/week');
    });
  });

  it('opens a day from its header', async () => {
    const app = renderApp('/week');
    await heading('26 Oct – 1 Nov 2026');
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Thursday, 29 October 2026' }));
    expect(path(app)).toBe('/day/2026-10-29');
  });

  it('sends an invalid date to this week', async () => {
    const app = renderApp('/week/2026-13-01');
    await heading('26 Oct – 1 Nov 2026');
    expect(path(app)).toBe('/week');
  });

  it('offers a retry when the events fail to load', async () => {
    const app = renderApp('/week', {
      setup: (fake) => {
        fake.events.listAll.mockRejectedValue(new NetworkError('network', 'offline'));
      },
    });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("Couldn't load this week.");
    app.events.listAll.mockResolvedValue([]);
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('has no axe violations', async () => {
    renderApp('/week', {
      setup: (fake) => {
        fake.events.listAll.mockResolvedValue([
          makeEvent({ title: 'Dentist', start: '2026-10-28T11:00:00.000Z' }),
          makeEvent({ title: 'Conference', start: '2026-10-29', end: '2026-10-31', allDay: true }),
        ]);
      },
    });
    await screen.findByRole('button', { name: /^Dentist/ });
    await expectNoAxeViolations();
  });
});

describe('Week on phones', () => {
  it('shows 3 days from the date and moves by 3', async () => {
    mockMatchMedia(true);
    const app = renderApp('/week');
    expect(await heading('27 – 29 Oct 2026')).toBeDefined();
    expect(dayHeaders()).toEqual([
      'Tuesday, 27 October 2026, today',
      'Wednesday, 28 October 2026',
      'Thursday, 29 October 2026',
    ]);
    expect(screen.queryByText('This week')).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next 3 days' }));
    expect(path(app)).toBe('/week/2026-10-30');
  });

  it('moves with a horizontal touch swipe, not with a mouse drag or a scroll', async () => {
    mockMatchMedia(true);
    const app = renderApp('/week/2026-10-30');
    const grid = (await heading('30 Oct – 1 Nov 2026'))
      .closest('section')
      ?.querySelector('.week__grid');
    if (!(grid instanceof HTMLElement)) throw new Error('No grid');
    const swipe = (from: number, to: number, pointerType = 'touch', dy = 0) => {
      fireEvent.pointerDown(grid, { pointerType, clientX: from, clientY: 200 });
      fireEvent.pointerUp(grid, { pointerType, clientX: to, clientY: 200 + dy });
    };
    swipe(300, 100);
    expect(path(app)).toBe('/week/2026-11-02');
    swipe(100, 300);
    await waitFor(() => {
      expect(path(app)).toBe('/week/2026-10-30');
    });
    swipe(300, 100, 'mouse');
    swipe(300, 260);
    swipe(300, 150, 'touch', 400);
    fireEvent.pointerUp(grid, { pointerType: 'touch', clientX: 0 });
    expect(path(app)).toBe('/week/2026-10-30');
  });

  it('switches layout when the screen narrows', async () => {
    const narrow = mockMatchMedia(false);
    renderApp('/week');
    await heading('26 Oct – 1 Nov 2026');
    act(() => {
      narrow(true);
    });
    expect(await heading('27 – 29 Oct 2026')).toBeDefined();
  });
});
