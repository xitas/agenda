import { NetworkError } from '@agenda/core';
import type { AgendaEvent } from '@agenda/core';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../test-utils/axe';
import { makeEvent } from '../test-utils/events';
import type { FakeApi } from '../test-utils/fakeApi';
import { renderApp } from '../test-utils/renderApp';
import { findToastAction } from '../test-utils/toast';
import { contains, highlight, snippet } from './highlight';

// NOW is Tuesday 27 October 2026, 14:00 in Karachi (UTC+5).
const DENTIST = makeEvent({ title: 'Dentist', start: '2026-10-28T11:00:00.000Z', color: 'red' });
const DENTIST_LAST_YEAR = makeEvent({
  title: 'Dentist check-up',
  start: '2025-11-03T06:00:00.000Z',
});
const CLEANING = makeEvent({
  title: 'Cleaning',
  start: '2026-11-10T05:00:00.000Z',
  location: 'Smile Dental Clinic',
});
const LUNCH = makeEvent({
  title: 'Lunch',
  start: '2026-10-27',
  allDay: true,
  notes: 'Ask Sara about the dentist she recommended last spring, and book it.',
});

/** list() filters a fixed set like the API: title, location or notes contain q. */
function withServer(initial: AgendaEvent[]) {
  return (fake: FakeApi) => {
    let events = initial;
    fake.events.remove.mockImplementation((id) => {
      events = events.filter((event) => event.id !== id);
      return Promise.resolve();
    });
    fake.events.list.mockImplementation((params) => {
      const q = (params?.q ?? '').toLowerCase();
      return Promise.resolve({
        events: events.filter((event) =>
          [event.title, event.location ?? '', event.notes].some((text) =>
            text.toLowerCase().includes(q),
          ),
        ),
        nextCursor: null,
      });
    });
  };
}

const field = () => screen.getByRole('searchbox', { name: 'Search events' });
const search = (app: ReturnType<typeof renderApp>) => app.router.state.location.search;

describe('Search', () => {
  it('waits for typing to pause, then searches once', async () => {
    const app = renderApp('/search', { setup: withServer([DENTIST]) });
    const user = userEvent.setup();
    expect(await screen.findByText('Find an event.')).toBeDefined();
    expect(document.activeElement).toBe(field());
    await user.type(field(), 'dent');
    expect(app.events.list).not.toHaveBeenCalled();
    expect(await screen.findByText('1 match')).toBeDefined();
    expect(app.events.list).toHaveBeenCalledTimes(1);
    expect(app.events.list).toHaveBeenCalledWith({ q: 'dent', limit: 200 }, expect.anything());
    expect(search(app)).toBe('?q=dent');
  });

  it('groups by day, upcoming soonest first then past, and highlights the match', async () => {
    renderApp('/search?q=dent', {
      setup: withServer([CLEANING, DENTIST_LAST_YEAR, LUNCH, DENTIST]),
    });
    expect(await screen.findByText('4 matches')).toBeDefined();
    expect(field()).toHaveProperty('value', 'dent');

    const upcoming = screen.getByRole('region', { name: 'Upcoming' });
    expect(
      within(upcoming)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual([
      'Today · Tuesday 27 October',
      'Tomorrow · Wednesday 28 October',
      'Tuesday 10 November',
    ]);
    const past = screen.getByRole('region', { name: 'Past' });
    expect(within(past).getByRole('heading', { level: 3 }).textContent).toBe(
      'Monday, 3 November 2025',
    );

    const dentist = screen.getByRole('button', { name: /^Dentist16:00/ });
    expect(within(dentist).getByText('Dent').tagName).toBe('MARK');
    // A match in the location shows the location, highlighted.
    const cleaning = screen.getByRole('button', { name: /^Cleaning/ });
    expect(within(cleaning).getByText('Dent').tagName).toBe('MARK');
    expect(cleaning.textContent).toContain('Smile Dental Clinic');
    // A match only in the notes shows a snippet around it.
    const lunch = screen.getByRole('button', { name: /^Lunch/ });
    expect(lunch.textContent).toContain('Ask Sara about the dentist she recommended last spring');
    expect(within(lunch).getByText('dent').tagName).toBe('MARK');
  });

  it('opens a result, and drops it from the list when it is deleted', async () => {
    renderApp('/search?q=dent', { setup: withServer([DENTIST]) });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^Dentist/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Dentist' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await findToastAction('Undo');
    expect(screen.queryByRole('button', { name: /^Dentist/ })).toBeNull();
  });

  it('says when nothing matches, and goes back to the start when cleared', async () => {
    const app = renderApp('/search', { setup: withServer([DENTIST]) });
    const user = userEvent.setup();
    await screen.findByRole('searchbox', { name: 'Search events' });
    await user.type(field(), 'zebra');
    expect(await screen.findByText('Nothing matches "zebra".')).toBeDefined();
    await user.clear(field());
    expect(await screen.findByText('Find an event.')).toBeDefined();
    await waitFor(() => {
      expect(search(app)).toBe('');
    });
  });

  it('notes when only the first 200 are shown', async () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      makeEvent({ title: `Standup ${String(i)}`, start: '2026-10-28T04:00:00.000Z' }),
    );
    renderApp('/search?q=standup', { setup: withServer(many) });
    expect(
      await screen.findByText('Showing the first 200 matches. Add a word to narrow it down.'),
    ).toBeDefined();
  });

  it('offers a retry when the search fails', async () => {
    const app = renderApp('/search?q=dent', {
      setup: (fake) => {
        withServer([DENTIST])(fake);
        fake.events.list.mockRejectedValueOnce(new NetworkError('network', 'offline'));
      },
    });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("Couldn't search.");
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('1 match')).toBeDefined();
    expect(app.events.list).toHaveBeenCalledTimes(2);
  });

  it('is current in the nav and has no axe violations', async () => {
    renderApp('/search?q=dent', { setup: withServer([DENTIST, CLEANING]) });
    await screen.findByText('2 matches');
    expect(screen.getByRole('link', { name: 'Search' }).getAttribute('aria-current')).toBe('page');
    await expectNoAxeViolations();
  });
});

describe('highlight helpers', () => {
  it('marks every match, case-insensitively and literally', () => {
    const { container } = render(<p>{highlight('Dentist and dentures (100%)', 'DENT')}</p>);
    expect([...container.querySelectorAll('mark')].map((m) => m.textContent)).toEqual([
      'Dent',
      'dent',
    ]);
    expect(container.textContent).toBe('Dentist and dentures (100%)');
    const literal = render(<p>{highlight('100% sure', '0%')}</p>);
    expect(literal.container.querySelector('mark')?.textContent).toBe('0%');
    expect(highlight('Plain', '  ')).toEqual(['Plain']);
  });

  it('finds text and cuts snippets around the match', () => {
    expect(contains(null, 'x')).toBe(false);
    expect(contains('Smile Dental', ' dental ')).toBe(true);
    expect(snippet('short note', 'note')).toBe('short note');
    const long = `${'a'.repeat(60)} dentist ${'b'.repeat(60)}`;
    expect(snippet(long, 'dentist', 10)).toBe(`…${'a'.repeat(9)} dentist ${'b'.repeat(9)}…`);
    expect(snippet('x'.repeat(100), 'zzz', 10)).toBe(`${'x'.repeat(20)}…`);
    expect(snippet('tiny', 'zzz')).toBe('tiny');
  });
});
