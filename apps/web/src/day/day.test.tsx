import { NetworkError } from '@agenda/core';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { enUS } from 'date-fns/locale';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../test-utils/axe';
import { makeEvent } from '../test-utils/events';
import { NOW, renderApp } from '../test-utils/renderApp';
import { dayHeading, dayPath, parseDay, relativeDay, shortDate, timeOfDay } from './dayFormat';

// NOW is Tuesday 27 October 2026, 14:00 in Karachi (UTC+5).
const TODAY_EVENTS = [
  makeEvent({
    title: 'Review',
    start: '2026-10-27T11:00:00.000Z',
    end: '2026-10-27T12:00:00.000Z',
  }),
  makeEvent({ title: 'Standup', start: '2026-10-27T05:00:00.000Z' }),
  makeEvent({ title: 'Holiday', start: '2026-10-27', allDay: true, color: 'green' }),
  makeEvent({ title: 'Lunch', start: '2026-10-27T08:00:00.000Z', end: '2026-10-27T09:00:00.000Z' }),
];

const path = (app: ReturnType<typeof renderApp>) => app.router.state.location.pathname;

afterEach(() => {
  vi.useRealTimers();
});

async function dayList() {
  return screen.findByRole('list', { name: /^Events,/ });
}

describe('Today', () => {
  it('lists all-day events first, then timed ones in order, with a now marker', async () => {
    renderApp('/', {
      setup: (fake) => {
        fake.events.listAll.mockResolvedValue(TODAY_EVENTS);
      },
    });
    const items = within(await dayList()).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Holiday'),
      expect.stringContaining('Standup'),
      expect.stringContaining('Lunch'),
      'Now · 14:00',
      expect.stringContaining('Review'),
    ]);
    expect(screen.getByRole('heading', { level: 1, name: 'Tuesday 27 October' })).toBeDefined();
    expect(screen.getByText('Today', { selector: '.day__eyebrow' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Today' })).toHaveProperty('disabled', true);
  });

  it('asks for the day in the viewer zone', async () => {
    const app = renderApp('/');
    await screen.findByText('Nothing today. Enjoy the space.');
    expect(app.events.listAll).toHaveBeenCalledWith(
      {
        from: new Date('2026-10-26T19:00:00.000Z'),
        to: new Date('2026-10-27T19:00:00.000Z'),
        tz: 'Asia/Karachi',
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) as unknown }),
    );
  });

  it('shows an empty state with the quick-add hint', async () => {
    renderApp('/');
    expect(await screen.findByText('Nothing today. Enjoy the space.')).toBeDefined();
    expect(screen.getByText('Press N to add an event.')).toBeDefined();
  });

  it('has no axe violations', async () => {
    renderApp('/', {
      setup: (fake) => {
        fake.events.listAll.mockResolvedValue(TODAY_EVENTS);
      },
    });
    await dayList();
    await expectNoAxeViolations();
  });

  it('has no now marker on other days', async () => {
    renderApp('/day/2026-10-28', {
      setup: (fake) => {
        fake.events.listAll.mockResolvedValue([
          makeEvent({ title: 'Dentist', start: '2026-10-28T11:00:00.000Z' }),
        ]);
      },
    });
    await dayList();
    expect(screen.queryByText(/^Now ·/)).toBeNull();
    expect(screen.getByText('Tomorrow', { selector: '.day__eyebrow' })).toBeDefined();
  });

  it('moves the now marker as the clock goes on', async () => {
    let now = NOW;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderApp('/', {
      env: { now: () => now },
      setup: (fake) => {
        fake.events.listAll.mockResolvedValue(TODAY_EVENTS);
      },
    });
    expect(await screen.findByText('Now · 14:00')).toBeDefined();
    now = new Date('2026-10-27T11:30:00.000Z');
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    const items = within(await dayList()).getAllByRole('listitem');
    expect(items.at(-1)?.textContent).toBe('Now · 16:30');
  });

  it('shows a retry when the events fail to load', async () => {
    const app = renderApp('/', {
      setup: (fake) => {
        // Only the day's own request fails, once; the calendar's month request works.
        let failed = false;
        const dayStart = new Date('2026-10-26T19:00:00.000Z').getTime();
        fake.events.listAll.mockImplementation((params) => {
          const from = params?.from;
          if (failed || !(from instanceof Date) || from.getTime() !== dayStart) {
            return Promise.resolve([]);
          }
          failed = true;
          return Promise.reject(new NetworkError('network', 'offline'));
        });
      },
    });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("Couldn't load this day.");
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Nothing today. Enjoy the space.')).toBeDefined();
    expect(app.events.listAll).toHaveBeenCalledTimes(3); // day, month dots, retry
  });
});

describe('day navigation', () => {
  it('goes to the next and previous day with the arrows and back with Today', async () => {
    const app = renderApp('/');
    const user = userEvent.setup();
    await screen.findByText('Nothing today. Enjoy the space.');

    await user.click(screen.getByRole('button', { name: 'Next day' }));
    expect(path(app)).toBe('/day/2026-10-28');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Wednesday 28 October' }),
    ).toBeDefined();
    expect(await screen.findByText('Nothing on this day.')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Previous day' }));
    await user.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(path(app)).toBe('/day/2026-10-26');
    expect(screen.getByText('Yesterday', { selector: '.day__eyebrow' })).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(path(app)).toBe('/');
  });

  it('follows ←, → and T', async () => {
    const app = renderApp('/day/2026-12-31');
    await screen.findByRole('heading', { level: 1, name: 'Thursday 31 December' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(path(app)).toBe('/day/2027-01-01');
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Friday, 1 January 2027' }),
    ).toBeDefined();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => {
      expect(path(app)).toBe('/day/2026-12-31');
    });
    fireEvent.keyDown(window, { key: 'T' });
    await waitFor(() => {
      expect(path(app)).toBe('/');
    });
  });

  it('sends an invalid date to Today', async () => {
    const app = renderApp('/day/2026-02-30');
    await screen.findByRole('heading', { level: 1, name: 'Tuesday 27 October' });
    expect(path(app)).toBe('/');
  });

  it('uses US formats for en-US', async () => {
    renderApp('/', {
      env: { locale: enUS },
      setup: (fake) => {
        fake.events.listAll.mockResolvedValue(TODAY_EVENTS);
      },
    });
    expect(await screen.findByText('Now · 2:00 PM')).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Tuesday, October 27' })).toBeDefined();
  });
});

describe('dayFormat', () => {
  it('keeps Today at / and other days at /day/…', () => {
    expect(dayPath('2026-10-27', '2026-10-27')).toBe('/');
    expect(dayPath('2026-10-28', '2026-10-27')).toBe('/day/2026-10-28');
  });

  it('parses only real dates', () => {
    expect(parseDay('2026-10-28')).toBe('2026-10-28');
    expect(parseDay('2026-02-30')).toBeNull();
    expect(parseDay('tomorrow')).toBeNull();
    expect(parseDay(undefined)).toBeNull();
  });

  it('names nearby days', () => {
    expect(relativeDay('2026-10-26', '2026-10-27')).toBe('Yesterday');
    expect(relativeDay('2026-10-29', '2026-10-27')).toBeUndefined();
  });

  it('formats headings, short dates and times', () => {
    expect(dayHeading('2027-01-01', '2026-10-27', 'en-GB')).toBe('Friday, 1 January 2027');
    expect(shortDate('2026-10-28', 'en-GB')).toBe('Wed 28 Oct');
    expect(
      timeOfDay(new Date('2026-10-27T11:05:00.000Z'), {
        timezone: 'Asia/Karachi',
        locale: enUS,
        now: () => NOW,
      }),
    ).toBe('4:05 PM');
  });
});
