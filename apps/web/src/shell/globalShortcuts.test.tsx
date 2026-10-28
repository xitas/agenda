import type { AgendaEvent } from '@agenda/core';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../test-utils/axe';
import { makeEvent } from '../test-utils/events';
import type { FakeApi } from '../test-utils/fakeApi';
import { renderApp } from '../test-utils/renderApp';
import { findToastAction } from '../test-utils/toast';
import { dateOnScreen } from '../views/paths';

// NOW is Tuesday 27 October 2026, 14:00 in Karachi (UTC+5).
const path = (app: ReturnType<typeof renderApp>) => app.router.state.location.pathname;
const press = (key: string, target: Element | Window = window) => {
  fireEvent.keyDown(target, { key });
};

const LUNCH = makeEvent({ title: 'Lunch', start: '2026-10-27T08:00:00.000Z' });

/** Deletes and restores for real, so refetches show the true state. */
function withServer(fake: FakeApi) {
  let events: AgendaEvent[] = [LUNCH];
  fake.events.listAll.mockImplementation(() => Promise.resolve(events));
  fake.events.remove.mockImplementation((id) => {
    events = events.filter((event) => event.id !== id);
    return Promise.resolve();
  });
  fake.events.restore.mockImplementation(() => {
    events = [LUNCH];
    return Promise.resolve(LUNCH);
  });
}

describe('view shortcuts', () => {
  it('switches views with D, W and M, keeping the date on screen', async () => {
    const app = renderApp('/day/2026-10-30');
    await screen.findByRole('heading', { level: 1, name: 'Friday 30 October' });
    press('w');
    await waitFor(() => {
      expect(path(app)).toBe('/week/2026-10-30');
    });
    press('m');
    await waitFor(() => {
      expect(path(app)).toBe('/month');
    });
    press('d');
    await waitFor(() => {
      expect(path(app)).toBe('/');
    });
  });

  it('opens Search with / and the field ready to type', async () => {
    const app = renderApp('/');
    await screen.findByText('Nothing today. Enjoy the space.');
    press('/');
    await waitFor(() => {
      expect(path(app)).toBe('/search');
    });
    expect(document.activeElement).toBe(
      await screen.findByRole('searchbox', { name: 'Search events' }),
    );
  });

  it('leaves the keys alone while typing', async () => {
    const app = renderApp('/');
    const user = userEvent.setup();
    const field = await screen.findByRole('textbox', { name: 'Quick add' });
    await user.type(field, 'wdm/');
    expect(field).toHaveProperty('value', 'wdm/');
    expect(path(app)).toBe('/');
  });
});

describe('event shortcuts', () => {
  it('edits the focused event with E', async () => {
    renderApp('/', { setup: withServer });
    const card = await screen.findByRole('button', { name: /^Lunch/ });
    card.focus();
    press('e', card);
    const editor = await screen.findByRole('dialog', { name: 'Edit event' });
    expect(within(editor).getByLabelText<HTMLInputElement>('Title').value).toBe('Lunch');
  });

  it('deletes the focused event with Delete, with the same Undo toast', async () => {
    const app = renderApp('/', { setup: withServer });
    const card = await screen.findByRole('button', { name: /^Lunch/ });
    card.focus();
    press('Delete', card);
    expect(await screen.findByText('Event deleted.')).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Lunch/ })).toBeNull();
    });
    expect(app.events.remove).toHaveBeenCalledWith(LUNCH.id);

    await userEvent.setup().click(await findToastAction('Undo'));
    expect(await screen.findByRole('button', { name: /^Lunch/ })).toBeDefined();
    expect(app.events.restore).toHaveBeenCalledWith(LUNCH.id);
  });

  it('does nothing without a focused event', async () => {
    const app = renderApp('/', { setup: withServer });
    await screen.findByRole('button', { name: /^Lunch/ });
    press('e');
    press('Delete');
    // The QuickAdd field is focusable but is no event.
    const quickAdd = screen.getByRole('textbox', { name: 'Quick add' });
    quickAdd.blur();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(app.events.remove).not.toHaveBeenCalled();
  });

  it('ignores a focused event that is no longer cached', async () => {
    const app = renderApp('/', { setup: withServer });
    const card = await screen.findByRole('button', { name: /^Lunch/ });
    card.focus();
    app.queryClient.clear();
    press('e', card);
    press('Delete', card);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(app.events.remove).not.toHaveBeenCalled();
  });
});

describe('shortcut help', () => {
  it('opens with ? or the button, lists every shortcut, and has no axe violations', async () => {
    renderApp('/');
    await screen.findByText('Nothing today. Enjoy the space.');
    press('?');
    const help = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    const rows = within(help)
      .getAllByRole('definition')
      .map((dd) => dd.textContent);
    expect(rows).toEqual([
      'Add an event with QuickAdd (⌘K on a Mac)',
      'Go to today',
      'Day, week or month view',
      'Previous or next day, week or month',
      'Search',
      'Edit the focused event',
      'Delete the focused event (with Undo)',
      'Save in the editor (⌘Enter on a Mac)',
      'Close a dialog or clear QuickAdd',
      'Show these shortcuts',
    ]);
    expect(within(help).getAllByRole('term')[0]?.textContent).toBe('N or Ctrl+K');
    await expectNoAxeViolations();

    const user = userEvent.setup();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await user.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
    expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBeDefined();
  });
});

describe('dateOnScreen', () => {
  const today = '2026-10-27';
  it.each([
    ['/', today],
    ['/day/2026-10-30', '2026-10-30'],
    ['/day/2026-02-30', today],
    ['/week', today],
    ['/week/2026-11-04', '2026-11-04'],
    ['/month', today],
    ['/month/2026-10', today],
    ['/month/2026-12', '2026-12-01'],
    ['/month/2026-13', today],
    ['/search', today],
  ])('%s → %s', (pathname, expected) => {
    expect(dateOnScreen(pathname, today)).toBe(expected);
  });
});
