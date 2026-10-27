import { describe, expect, it } from 'vitest';
import { dayAgenda, eventDays, eventOverlapsRange } from './agenda.js';
import { dayRangeInTz } from './dates.js';

const timed = (title: string, start: string, end: string | null = null) => ({
  title,
  start,
  end,
  allDay: false,
});
const allDay = (title: string, start: string, end: string | null = null) => ({
  title,
  start,
  end,
  allDay: true,
});

describe('dayRangeInTz', () => {
  it('covers the local day, even where noon UTC is already the next day', () => {
    expect(dayRangeInTz('2026-10-24', 'Asia/Karachi')).toEqual({
      start: new Date('2026-10-23T19:00:00.000Z'),
      end: new Date('2026-10-24T19:00:00.000Z'),
    });
    expect(dayRangeInTz('2026-10-24', 'Pacific/Kiritimati')).toEqual({
      start: new Date('2026-10-23T10:00:00.000Z'),
      end: new Date('2026-10-24T10:00:00.000Z'),
    });
  });

  it('is 23 hours long when clocks go forward', () => {
    const { start, end } = dayRangeInTz('2026-03-29', 'Europe/Berlin');
    expect(end.getTime() - start.getTime()).toBe(23 * 60 * 60 * 1000);
  });

  it('rejects an invalid day', () => {
    expect(() => dayRangeInTz('2026-02-30', 'UTC')).toThrow(RangeError);
  });
});

describe('dayAgenda', () => {
  const events = [
    timed('Late', '2026-10-24T14:00:00.000Z', '2026-10-24T15:00:00.000Z'),
    allDay('Trip', '2026-10-22', '2026-10-26'),
    timed('Early', '2026-10-24T04:00:00.000Z'),
    allDay('Birthday', '2026-10-24'),
    timed('Same start, ends later', '2026-10-24T04:00:00.000Z', '2026-10-24T06:00:00.000Z'),
    timed('Same start, ends sooner', '2026-10-24T04:00:00.000Z', '2026-10-24T05:00:00.000Z'),
  ];

  it('puts all-day events first, then timed ones by start, end and title', () => {
    const { allDay: days, timed: times, nowIndex } = dayAgenda(events);
    expect(days.map((e) => e.title)).toEqual(['Trip', 'Birthday']);
    expect(times.map((e) => e.title)).toEqual([
      'Early',
      'Same start, ends sooner',
      'Same start, ends later',
      'Late',
    ]);
    expect(nowIndex).toBeNull();
  });

  it('places now before the first event that has not started', () => {
    expect(dayAgenda(events, new Date('2026-10-24T03:00:00.000Z')).nowIndex).toBe(0);
    // In progress at 04:30: the 04:00 events count as past.
    expect(dayAgenda(events, new Date('2026-10-24T04:30:00.000Z')).nowIndex).toBe(3);
    expect(dayAgenda(events, new Date('2026-10-24T23:00:00.000Z')).nowIndex).toBe(4);
    expect(dayAgenda([], new Date()).nowIndex).toBe(0);
  });

  it('breaks ties by title', () => {
    const tied = dayAgenda([
      allDay('Zoo', '2026-10-24'),
      allDay('Art', '2026-10-24'),
      timed('Yoga', '2026-10-24T04:00:00.000Z', '2026-10-24T05:00:00.000Z'),
      timed('Bank', '2026-10-24T04:00:00.000Z', '2026-10-24T05:00:00.000Z'),
      timed('Point B', '2026-10-24T06:00:00.000Z'),
      timed('Point A', '2026-10-24T06:00:00.000Z'),
    ]);
    expect(tied.allDay.map((e) => e.title)).toEqual(['Art', 'Zoo']);
    expect(tied.timed.map((e) => e.title)).toEqual(['Bank', 'Yoga', 'Point A', 'Point B']);
  });

  it('does not change the input order', () => {
    const input = [...events];
    dayAgenda(input);
    expect(input).toEqual(events);
  });
});

describe('eventOverlapsRange', () => {
  const day24 = dayRangeInTz('2026-10-24', 'Asia/Karachi');

  it('uses local days for all-day events, with an exclusive end', () => {
    expect(eventOverlapsRange(allDay('A', '2026-10-24'), day24, 'Asia/Karachi')).toBe(true);
    expect(eventOverlapsRange(allDay('B', '2026-10-23'), day24, 'Asia/Karachi')).toBe(false);
    expect(eventOverlapsRange(allDay('C', '2026-10-22', '2026-10-25'), day24, 'Asia/Karachi')).toBe(
      true,
    );
    expect(eventOverlapsRange(allDay('D', '2026-10-22', '2026-10-24'), day24, 'Asia/Karachi')).toBe(
      false,
    );
  });

  it('uses half-open instants for timed events', () => {
    const crossing = timed('Late flight', '2026-10-24T18:00:00.000Z', '2026-10-24T20:00:00.000Z');
    expect(eventOverlapsRange(crossing, day24, 'Asia/Karachi')).toBe(true);
    expect(
      eventOverlapsRange(crossing, dayRangeInTz('2026-10-25', 'Asia/Karachi'), 'Asia/Karachi'),
    ).toBe(true);
    const endsAtStart = timed(
      'Ends at midnight',
      '2026-10-23T18:00:00.000Z',
      '2026-10-23T19:00:00.000Z',
    );
    expect(eventOverlapsRange(endsAtStart, day24, 'Asia/Karachi')).toBe(false);
    expect(
      eventOverlapsRange(timed('Point', '2026-10-23T19:00:00.000Z'), day24, 'Asia/Karachi'),
    ).toBe(true);
    expect(
      eventOverlapsRange(timed('Point', '2026-10-24T19:00:00.000Z'), day24, 'Asia/Karachi'),
    ).toBe(false);
    expect(
      eventOverlapsRange(timed('Before', '2026-10-23T12:00:00.000Z'), day24, 'Asia/Karachi'),
    ).toBe(false);
  });
});

describe('eventDays', () => {
  it('marks every local day an event touches', () => {
    const days = eventDays(
      [
        allDay('Conference', '2026-11-03', '2026-11-06'),
        allDay('Birthday', '2026-10-24'),
        // 23:00 on the 24th to 01:00 on the 25th in Karachi
        timed('Late flight', '2026-10-24T18:00:00.000Z', '2026-10-24T20:00:00.000Z'),
        // Ends exactly at Karachi midnight: only the 26th.
        timed('Until midnight', '2026-10-26T15:00:00.000Z', '2026-10-26T19:00:00.000Z'),
        timed('Point', '2026-10-28T09:00:00.000Z'),
      ],
      'Asia/Karachi',
    );
    expect([...days].sort()).toEqual([
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-28',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
    ]);
  });

  it('stops after a year for a runaway range', () => {
    expect(eventDays([allDay('Forever', '2026-01-01', '2036-01-01')], 'UTC').size).toBe(366);
  });
});
