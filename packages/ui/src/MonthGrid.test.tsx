import type { AgendaEvent } from '@agenda/core';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { enGB } from 'date-fns/locale';
import { describe, expect, it, vi } from 'vitest';
import { EventCard } from './EventCard.js';
import { MonthGrid } from './MonthGrid.js';
import type { MonthGridProps } from './MonthGrid.js';
import { expectNoAxeViolations } from './test-utils/axe.js';

type MonthEvent = Pick<
  AgendaEvent,
  'id' | 'title' | 'start' | 'end' | 'allDay' | 'color' | 'location'
>;

let next = 0;
const event = (
  title: string,
  start: string,
  end: string | null = null,
  allDay = false,
): MonthEvent => {
  next += 1;
  return { id: `id-${String(next)}`, title, start, end, allDay, color: 'blue', location: null };
};

// Tuesday 27 October 2026, 14:00 UTC.
const NOW = new Date('2026-10-27T14:00:00.000Z');

function setup(props: Partial<MonthGridProps<MonthEvent>> = {}) {
  const onSelectDay = vi.fn();
  const onSelectEvent = vi.fn();
  const view = render(
    <MonthGrid
      month="2026-10-01"
      events={[]}
      timezone="UTC"
      locale={enGB}
      today="2026-10-27"
      now={NOW}
      onSelectDay={onSelectDay}
      onSelectEvent={onSelectEvent}
      {...props}
    />,
  );
  return { ...view, onSelectDay, onSelectEvent, user: userEvent.setup() };
}

const cell = (fullDate: string) => {
  const button = screen.getByRole('button', { name: new RegExp(`^${fullDate}`) });
  const li = button.closest('li');
  if (li === null) throw new Error(`No cell for ${fullDate}`);
  return li;
};

describe('MonthGrid', () => {
  it('shows 6 Monday-first weeks around the month', () => {
    setup();
    const dates = screen.getAllByRole('button', { name: /, (no events|\d+ events?)$/ });
    expect(dates).toHaveLength(42);
    expect(dates[0]?.getAttribute('aria-label')).toBe('Monday, 28 September 2026, no events');
    expect(dates[41]?.getAttribute('aria-label')).toBe('Sunday, 8 November 2026, no events');
    expect(cell('Monday, 28 September 2026').className).toContain('--outside');
  });

  it('rings today and mutes past days', () => {
    setup();
    const today = screen.getByRole('button', {
      name: 'Tuesday, 27 October 2026, today, no events',
    });
    expect(today.getAttribute('aria-current')).toBe('date');
    expect(cell('Tuesday, 27 October 2026').className).toContain('--today');
    expect(cell('Monday, 26 October 2026').className).toContain('--past');
    expect(cell('Wednesday, 28 October 2026').className).not.toContain('--past');
  });

  it('lists up to 3 events, then "+N more" that opens the day', async () => {
    const busy = ['A', 'B', 'C', 'D', 'E'].map((title, i) =>
      event(title, `2026-10-28T0${String(i + 1)}:00:00.000Z`),
    );
    const { onSelectDay, user } = setup({ events: busy });
    const wednesday = cell('Wednesday, 28 October 2026');
    expect(
      within(wednesday)
        .getAllByRole('listitem')
        .map((li) => li.textContent.charAt(0)),
    ).toEqual(['A', 'B', 'C']);
    const more = within(wednesday).getByRole('button', {
      name: '2 more on Wednesday, 28 October 2026',
    });
    expect(more.textContent).toBe('+2 more');
    await user.click(more);
    expect(onSelectDay).toHaveBeenCalledWith('2026-10-28');
    expect(
      screen.getByRole('button', { name: 'Wednesday, 28 October 2026, 5 events' }),
    ).toBeDefined();
  });

  it('respects a different limit', () => {
    setup({
      events: [event('A', '2026-10-28T01:00:00.000Z'), event('B', '2026-10-28T02:00:00.000Z')],
      maxPerDay: 1,
    });
    expect(within(cell('Wednesday, 28 October 2026')).getByText('+1 more')).toBeDefined();
  });

  it('shows a multi-day event on each of its days', () => {
    setup({ events: [event('Conference', '2026-11-03', '2026-11-06', true)] });
    for (const day of [
      'Tuesday, 3 November 2026',
      'Wednesday, 4 November 2026',
      'Thursday, 5 November 2026',
    ]) {
      expect(within(cell(day)).getByText('Conference')).toBeDefined();
    }
    expect(within(cell('Friday, 6 November 2026')).queryByText('Conference')).toBeNull();
    expect(screen.getByRole('button', { name: 'Tuesday, 3 November 2026, 1 event' })).toBeDefined();
  });

  it('opens events and days, and marks ended events and their ids', async () => {
    const done = event('Done', '2026-10-27T09:00:00.000Z', '2026-10-27T10:00:00.000Z');
    const later = event('Later', '2026-10-27T15:00:00.000Z');
    const holiday = event('Holiday', '2026-10-26', null, true);
    const { onSelectDay, onSelectEvent, user } = setup({ events: [done, later, holiday] });
    await user.click(screen.getByRole('button', { name: /^Later/ }));
    expect(onSelectEvent).toHaveBeenCalledWith(later);
    await user.click(screen.getByRole('button', { name: /^Monday, 26 October 2026/ }));
    expect(onSelectDay).toHaveBeenCalledWith('2026-10-26');
    expect(screen.getByRole('button', { name: /^Done/ }).className).toContain(
      'ag-event-card--past',
    );
    expect(screen.getByRole('button', { name: /^Holiday/ }).className).toContain(
      'ag-event-card--past',
    );
    expect(screen.getByRole('button', { name: /^Later/ }).className).not.toContain('--past');
    expect(
      screen
        .getByRole('button', { name: /^Later/ })
        .closest('[data-event-id]')
        ?.getAttribute('data-event-id'),
    ).toBe(later.id);
  });

  it('has no axe violations', async () => {
    const { container } = setup({
      events: [
        event('Standup', '2026-10-27T09:00:00.000Z'),
        event('Trip', '2026-10-28', '2026-10-31', true),
      ],
    });
    await expectNoAxeViolations(container);
  });
});

describe('EventCard past', () => {
  it('mutes an ended event without changing its content', () => {
    const { container } = render(
      <EventCard
        event={event('Done', '2026-10-27T09:00:00.000Z')}
        timezone="UTC"
        locale={enGB}
        past
      />,
    );
    expect(container.firstElementChild?.className).toContain('ag-event-card--past');
    expect(screen.getByText('Done')).toBeDefined();
  });
});
