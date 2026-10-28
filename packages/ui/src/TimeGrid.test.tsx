import type { AgendaEvent } from '@agenda/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { enGB, enUS } from 'date-fns/locale';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimeGrid } from './TimeGrid.js';
import type { TimeGridProps } from './TimeGrid.js';
import { expectNoAxeViolations } from './test-utils/axe.js';

type GridEvent = Pick<
  AgendaEvent,
  'id' | 'title' | 'start' | 'end' | 'allDay' | 'color' | 'location'
>;

let next = 0;
const event = (
  title: string,
  start: string,
  end: string | null,
  fields: Partial<GridEvent> = {},
): GridEvent => {
  next += 1;
  return {
    id: `id-${String(next)}`,
    title,
    start,
    end,
    allDay: false,
    color: 'blue',
    location: null,
    ...fields,
  };
};

const WEEK = [
  '2026-10-26',
  '2026-10-27',
  '2026-10-28',
  '2026-10-29',
  '2026-10-30',
  '2026-10-31',
  '2026-11-01',
];
// Tuesday 27 October, 14:00 UTC.
const NOW = new Date('2026-10-27T14:00:00.000Z');

function setup(props: Partial<TimeGridProps<GridEvent>> = {}) {
  const handlers = { onSelectEvent: vi.fn(), onSelectSlot: vi.fn(), onSelectDay: vi.fn() };
  const view = render(
    <TimeGrid
      days={WEEK}
      events={[]}
      timezone="UTC"
      locale={enGB}
      today="2026-10-27"
      now={NOW}
      {...handlers}
      {...props}
    />,
  );
  return { ...view, ...handlers, user: userEvent.setup() };
}

const block = (title: string) => screen.getByRole('button', { name: new RegExp(`^${title}`) });
const cssVar = (element: HTMLElement, name: string) => element.style.getPropertyValue(`--${name}`);
/** The element, or a test failure that says what was missing. */
function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${what}`);
  return value;
}
const column = (container: HTMLElement, day: string) =>
  required(
    container.querySelector<HTMLElement>(`.ag-timegrid__column[data-day="${day}"]`),
    `column ${day}`,
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TimeGrid', () => {
  it('heads each day with its full date, today marked', async () => {
    const { onSelectDay, user } = setup();
    const today = screen.getByRole('button', { name: 'Tuesday, 27 October 2026, today' });
    expect(today.getAttribute('aria-current')).toBe('date');
    expect(screen.getByRole('button', { name: 'Monday, 26 October 2026' }).className).toContain(
      '--past',
    );
    await user.click(today);
    expect(onSelectDay).toHaveBeenCalledWith('2026-10-27');
  });

  it('places events by their wall-clock minutes, overlapping ones side by side', () => {
    setup({
      events: [
        event('Standup', '2026-10-27T09:00:00.000Z', '2026-10-27T10:00:00.000Z'),
        event('Review', '2026-10-27T09:30:00.000Z', '2026-10-27T11:00:00.000Z'),
        event('Lunch', '2026-10-27T12:00:00.000Z', null, { color: 'green' }),
      ],
    });
    const standup = block('Standup');
    expect([
      cssVar(standup, 'top'),
      cssVar(standup, 'height'),
      cssVar(standup, 'col'),
      cssVar(standup, 'cols'),
    ]).toEqual(['540', '60', '0', '2']);
    expect([cssVar(block('Review'), 'col'), cssVar(block('Review'), 'cols')]).toEqual(['1', '2']);
    // A separate cluster: full width; no end means 30 minutes.
    expect([cssVar(block('Lunch'), 'cols'), cssVar(block('Lunch'), 'height')]).toEqual(['1', '30']);
    expect(block('Lunch').getAttribute('data-event-color')).toBe('green');
    expect(block('Lunch').textContent).toContain('Category: Green');
  });

  it('spans multi-day and 24-hour events across the all-day strip', () => {
    setup({
      events: [
        event('Conference', '2026-10-27', '2026-10-30', { allDay: true }),
        event('Flight', '2026-10-29T10:00:00.000Z', '2026-10-30T12:00:00.000Z'),
      ],
    });
    // Column 1 is the hour gutter, so Tuesday (index 1) is grid column 3.
    expect([
      cssVar(block('Conference'), 'col'),
      cssVar(block('Conference'), 'span'),
      cssVar(block('Conference'), 'lane'),
    ]).toEqual(['3', '3', '1']);
    expect([
      cssVar(block('Flight'), 'col'),
      cssVar(block('Flight'), 'span'),
      cssVar(block('Flight'), 'lane'),
    ]).toEqual(['5', '2', '2']);
    expect(screen.getByText('All day')).toBeDefined();
  });

  it('has no all-day strip without all-day events', () => {
    setup({ events: [event('Standup', '2026-10-27T09:00:00.000Z', null)] });
    expect(screen.queryByText('All day')).toBeNull();
  });

  it('clips an event across midnight into both columns', () => {
    const { container } = setup({
      events: [event('Party', '2026-10-27T22:00:00.000Z', '2026-10-28T02:00:00.000Z')],
    });
    const parts = screen.getAllByRole('button', { name: /^Party/ });
    expect(
      parts.map((part) => [
        part.closest('[data-day]')?.getAttribute('data-day'),
        cssVar(part, 'top'),
        cssVar(part, 'height'),
      ]),
    ).toEqual([
      ['2026-10-27', '1320', '120'],
      ['2026-10-28', '0', '120'],
    ]);
    expect(within(column(container, '2026-10-28')).getAllByRole('button')).toHaveLength(1);
  });

  it('keeps wall-clock rows on a DST day', () => {
    // Berlin, 29 March 2026: 02:00 jumps to 03:00. 03:30 CEST is 01:30Z.
    setup({
      days: ['2026-03-29'],
      today: '2026-03-29',
      now: new Date('2026-03-29T01:00:00.000Z'),
      timezone: 'Europe/Berlin',
      events: [event('Early run', '2026-03-29T01:30:00.000Z', '2026-03-29T02:30:00.000Z')],
    });
    expect([cssVar(block('Early run'), 'top'), cssVar(block('Early run'), 'height')]).toEqual([
      '210',
      '60',
    ]);
  });

  it('draws the now line on today only, and mutes ended events', () => {
    const { container } = setup({
      events: [
        event('Done', '2026-10-27T09:00:00.000Z', '2026-10-27T10:00:00.000Z'),
        event('Later', '2026-10-27T15:00:00.000Z', '2026-10-27T16:00:00.000Z'),
        event('Yesterday', '2026-10-26', null, { allDay: true }),
        event('All week', '2026-10-26', '2026-11-02', { allDay: true }),
      ],
    });
    const lines = container.querySelectorAll<HTMLElement>('.ag-timegrid__now');
    expect(lines).toHaveLength(1);
    expect(lines[0]?.closest('[data-day]')?.getAttribute('data-day')).toBe('2026-10-27');
    expect(cssVar(required(lines[0], 'now line'), 'top')).toBe('840');
    expect(block('Done').className).toContain('ag-timegrid__event--past');
    expect(block('Later').className).not.toContain('--past');
    expect(block('Yesterday').className).toContain('ag-timegrid__allday--past');
    expect(block('All week').className).not.toContain('--past');
    expect(column(container, '2026-10-26').className).toContain('--past');
  });

  it('labels hours per locale', () => {
    const { rerender } = setup();
    expect(screen.getByText('08:00')).toBeDefined();
    rerender(
      <TimeGrid
        days={WEEK}
        events={[]}
        timezone="UTC"
        locale={enUS}
        today="2026-10-27"
        now={NOW}
      />,
    );
    expect(screen.getByText('8:00 AM')).toBeDefined();
  });

  it('opens an event, and reports empty-slot clicks snapped to 30 minutes', async () => {
    const standup = event('Standup', '2026-10-27T09:00:00.000Z', null);
    const { container, onSelectEvent, onSelectSlot, user } = setup({ events: [standup] });
    await user.click(block('Standup'));
    expect(onSelectEvent).toHaveBeenCalledWith(standup);
    expect(onSelectSlot).not.toHaveBeenCalled();

    const wednesday = column(container, '2026-10-28');
    vi.spyOn(wednesday, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      height: 1152,
    } as DOMRect);
    // 600 px down a 1152 px day is 12:30; snapped to 12:30.
    fireEvent.click(wednesday, { clientY: 700 });
    expect(onSelectSlot).toHaveBeenCalledWith('2026-10-28', 750);
    fireEvent.click(wednesday, { clientY: 99_999 });
    expect(onSelectSlot).toHaveBeenLastCalledWith('2026-10-28', 1410);
    // No layout (jsdom): the top of the day.
    vi.spyOn(wednesday, 'getBoundingClientRect').mockReturnValue({ top: 0, height: 0 } as DOMRect);
    fireEvent.click(wednesday, { clientY: 10 });
    expect(onSelectSlot).toHaveBeenLastCalledWith('2026-10-28', 0);
  });

  it('works without handlers: plain headers, no slot clicks', () => {
    const { container } = render(
      <TimeGrid
        days={WEEK}
        events={[]}
        timezone="UTC"
        locale={enGB}
        today="2026-10-27"
        now={NOW}
      />,
    );
    expect(screen.queryByRole('button', { name: /Tuesday/ })).toBeNull();
    expect(
      container.querySelector('[aria-label="Tuesday, 27 October 2026, today"]'),
    ).not.toBeNull();
    fireEvent.click(column(container, '2026-10-28'));
  });

  it('scrolls to the given time once', () => {
    let scrolled = -1;
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1152);
    vi.spyOn(HTMLElement.prototype, 'scrollTop', 'set').mockImplementation((value: number) => {
      scrolled = value;
    });
    const { rerender } = setup({ scrollToMinutes: 8 * 60 });
    expect(scrolled).toBe(384);
    scrolled = -1;
    rerender(
      <TimeGrid
        days={WEEK}
        events={[]}
        timezone="UTC"
        locale={enGB}
        today="2026-10-27"
        now={NOW}
        scrollToMinutes={600}
      />,
    );
    expect(scrolled).toBe(-1);
  });

  it('has no axe violations', async () => {
    const { container } = setup({
      events: [
        event('Standup', '2026-10-27T09:00:00.000Z', null),
        event('Conference', '2026-10-27', '2026-10-30', { allDay: true }),
      ],
    });
    await expectNoAxeViolations(container);
  });
});
