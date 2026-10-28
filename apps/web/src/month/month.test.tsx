import { NetworkError } from '@agenda/core';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../test-utils/axe';
import { makeEvent } from '../test-utils/events';
import { renderApp } from '../test-utils/renderApp';
import { parseMonth, viewPath } from '../views/paths';

// NOW is Tuesday 27 October 2026, 14:00 in Karachi (UTC+5).
const path = (app: ReturnType<typeof renderApp>) => app.router.state.location.pathname;
const heading = (name: string) => screen.findByRole('heading', { level: 1, name });

const BUSY = ['A', 'B', 'C', 'D'].map((title, i) =>
  makeEvent({ title, start: `2026-10-28T0${String(i + 3)}:00:00.000Z` }),
);

describe('Month', () => {
  it('shows this month with its events, "+N more" opening the day', async () => {
    const app = renderApp('/month', {
      setup: (fake) => {
        fake.events.listAll.mockResolvedValue([
          ...BUSY,
          makeEvent({ title: 'Conference', start: '2026-11-03', end: '2026-11-06', allDay: true }),
        ]);
      },
    });
    expect(await heading('October 2026')).toBeDefined();
    expect(screen.getByText('This month')).toBeDefined();
    expect(await screen.findAllByRole('button', { name: /^Conference/ })).toHaveLength(3);
    expect(app.events.listAll).toHaveBeenCalledWith(
      {
        from: new Date('2026-09-27T19:00:00.000Z'),
        to: new Date('2026-11-08T19:00:00.000Z'),
        tz: 'Asia/Karachi',
      },
      expect.anything(),
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: '1 more on Wednesday, 28 October 2026' }));
    expect(path(app)).toBe('/day/2026-10-28');
  });

  it('opens events in the details dialog and days from their number', async () => {
    const app = renderApp('/month', {
      setup: (fake) => {
        fake.events.listAll.mockResolvedValue(BUSY);
      },
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^A/ }));
    const dialog = await screen.findByRole('dialog', { name: 'A' });
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await user.click(screen.getByRole('button', { name: /^Tuesday, 27 October 2026, today/ }));
    expect(path(app)).toBe('/');
  });

  it('moves by a month with the arrows, keys and Today', async () => {
    const app = renderApp('/month');
    const user = userEvent.setup();
    await heading('October 2026');
    await user.click(within(screen.getByRole('main')).getByRole('button', { name: 'Next month' }));
    expect(path(app)).toBe('/month/2026-11');
    expect(await heading('November 2026')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Month' }).getAttribute('aria-current')).toBe('page');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(path(app)).toBe('/month/2026-12');
    });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => {
      expect(path(app)).toBe('/month');
    });
    await user.click(
      within(screen.getByRole('main')).getByRole('button', { name: 'Previous month' }),
    );
    expect(path(app)).toBe('/month/2026-09');
    fireEvent.keyDown(window, { key: 't' });
    await waitFor(() => {
      expect(path(app)).toBe('/month');
    });
    await user.click(within(screen.getByRole('main')).getByRole('button', { name: 'Next month' }));
    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(path(app)).toBe('/month');
  });

  it('sends an invalid month to this month', async () => {
    const app = renderApp('/month/2026-13');
    await heading('October 2026');
    expect(path(app)).toBe('/month');
  });

  it('offers a retry when the events fail to load', async () => {
    const app = renderApp('/month', {
      setup: (fake) => {
        fake.events.listAll.mockRejectedValue(new NetworkError('network', 'offline'));
      },
    });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("Couldn't load this month.");
    app.events.listAll.mockResolvedValue([]);
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('has no axe violations', async () => {
    renderApp('/month', {
      setup: (fake) => {
        fake.events.listAll.mockResolvedValue(BUSY);
      },
    });
    await screen.findByRole('button', { name: /^A/ });
    await expectNoAxeViolations();
  });
});

describe('view paths', () => {
  it('uses short paths for the period with today', () => {
    expect(viewPath('day', '2026-10-27', '2026-10-27')).toBe('/');
    expect(viewPath('week', '2026-10-27', '2026-10-27')).toBe('/week');
    expect(viewPath('week', '2026-10-28', '2026-10-27')).toBe('/week/2026-10-28');
    expect(viewPath('month', '2026-10-05', '2026-10-27')).toBe('/month');
    expect(viewPath('month', '2026-11-05', '2026-10-27')).toBe('/month/2026-11');
  });

  it('parses only real months', () => {
    expect(parseMonth('2026-11')).toBe('2026-11-01');
    expect(parseMonth('2026-13')).toBeNull();
    expect(parseMonth('2026-1')).toBeNull();
    expect(parseMonth(undefined)).toBeNull();
  });
});
