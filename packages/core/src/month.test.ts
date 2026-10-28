import { describe, expect, it } from 'vitest';
import { eventsByDay } from './month.js';

const event = (title: string, start: string, end: string | null, allDay: boolean) => ({
  title,
  start,
  end,
  allDay,
});

describe('eventsByDay', () => {
  const days = ['2026-10-26', '2026-10-27', '2026-10-28'];

  it('lists multi-day events on each day, all-day first, then by time', () => {
    const byDay = eventsByDay(
      [
        event('Lunch', '2026-10-27T08:00:00.000Z', null, false),
        event('Conference', '2026-10-27', '2026-10-29', true),
        event('Standup', '2026-10-27T05:00:00.000Z', null, false),
        event('Party', '2026-10-26T18:00:00.000Z', '2026-10-26T20:00:00.000Z', false),
      ],
      days,
      'Asia/Karachi',
    );
    const titles = (day: string) => byDay.get(day)?.map((e) => e.title);
    // 18:00Z on the 26th is 23:00 in Karachi, so the party ends on the 27th (01:00).
    expect(titles('2026-10-26')).toEqual(['Party']);
    expect(titles('2026-10-27')).toEqual(['Conference', 'Party', 'Standup', 'Lunch']);
    expect(titles('2026-10-28')).toEqual(['Conference']);
  });

  it('has an empty list for days without events', () => {
    expect(eventsByDay([], days, 'UTC').get('2026-10-27')).toEqual([]);
  });
});
