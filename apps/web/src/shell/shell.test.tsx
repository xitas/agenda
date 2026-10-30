import { NetworkError } from '@agenda/core';
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../test-utils/axe';
import { makeEvent } from '../test-utils/events';
import { renderApp } from '../test-utils/renderApp';

const path = (app: ReturnType<typeof renderApp>) => app.router.state.location.pathname;

/** jsdom has no CSS, so the sidebar calendar is always in the document. */
const sidebarCalendar = () => screen.findByRole('grid', { name: 'October 2026' });

describe('app shell', () => {
  it('has the nav, with Today current on any day page', async () => {
    renderApp('/day/2026-10-30');
    const nav = await screen.findByRole('navigation', { name: 'Views' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Today',
      'Week',
      'Month',
      'Search',
      'Settings',
    ]);
    expect(within(nav).getByRole('link', { name: 'Today' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('sends unknown paths to Today', async () => {
    const app = renderApp('/nowhere');
    await screen.findByRole('heading', { level: 1, name: 'Tuesday 27 October' });
    expect(path(app)).toBe('/');
  });

  it('has no axe violations', async () => {
    renderApp('/');
    await screen.findByText('Nothing today. Enjoy the space.');
    await sidebarCalendar();
    await expectNoAxeViolations();
  });
});

describe('calendar', () => {
  it('marks days with events and opens the picked day', async () => {
    const app = renderApp('/', {
      setup: (fake) => {
        fake.events.listAll.mockResolvedValue([
          makeEvent({ title: 'Dentist', start: '2026-10-30T11:00:00.000Z' }),
        ]);
      },
    });
    const grid = await sidebarCalendar();
    const friday = await within(grid).findByRole('gridcell', {
      name: 'Friday, 30 October 2026, has events',
    });
    expect(within(grid).getByRole('gridcell', { name: 'Tuesday, 27 October 2026' })).toBeDefined();

    await userEvent.setup().click(friday);
    expect(path(app)).toBe('/day/2026-10-30');
    expect(friday.getAttribute('aria-selected')).toBe('true');
  });

  it('loads the dots for the whole grid of the month on screen', async () => {
    const app = renderApp('/');
    const grid = await sidebarCalendar();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next month' }));
    await within(grid).findByRole('gridcell', { name: 'Monday, 30 November 2026' });
    await waitFor(() => {
      // November's grid runs Mon 26 Oct to Sun 6 Dec, in Karachi time.
      expect(app.events.listAll).toHaveBeenCalledWith(
        {
          from: new Date('2026-10-25T19:00:00.000Z'),
          to: new Date('2026-12-06T19:00:00.000Z'),
          tz: 'Asia/Karachi',
        },
        expect.anything(),
      );
    });
  });

  it('follows the day being viewed', async () => {
    const app = renderApp('/day/2026-10-31');
    await sidebarCalendar();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next day' }));
    expect(path(app)).toBe('/day/2026-11-01');
    const grid = await screen.findByRole('grid', { name: 'November 2026' });
    expect(
      within(grid)
        .getByRole('gridcell', { name: 'Sunday, 1 November 2026' })
        .getAttribute('aria-selected'),
    ).toBe('true');
    await waitFor(() => {
      expect(app.events.listAll).toHaveBeenCalledWith(
        expect.objectContaining({ from: new Date('2026-10-25T19:00:00.000Z') }),
        expect.anything(),
      );
    });
  });

  it('opens in a dialog from the top bar and closes after a pick', async () => {
    const app = renderApp('/');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Calendar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Go to a day' });
    await user.click(within(dialog).getByRole('gridcell', { name: 'Wednesday, 28 October 2026' }));
    expect(path(app)).toBe('/day/2026-10-28');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});

describe('log out', () => {
  it('ends the session, forgets the cache and goes to /login', async () => {
    const app = renderApp('/');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Account' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Log out' }));
    await waitFor(() => {
      expect(path(app)).toBe('/login');
    });
    expect(app.auth.logout).toHaveBeenCalledOnce();
    expect(app.queryClient.getQueryData(['session'])).toBeUndefined();
  });

  it('says so when it fails', async () => {
    const app = renderApp('/', {
      setup: (fake) => {
        fake.auth.logout.mockRejectedValue(new NetworkError('network', 'offline'));
      },
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Account' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Log out' }));
    expect(
      await screen.findByText("Couldn't log out. Check your connection and try again."),
    ).toBeDefined();
    expect(path(app)).toBe('/');
  });
});
