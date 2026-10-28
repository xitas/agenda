import { describe, expect, it } from 'vitest';
import {
  daysFrom,
  inAllDayStrip,
  layoutAllDay,
  layoutDay,
  startOfWeekPlain,
  wallClockMinutes,
} from './time-grid.js';

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

/** Layout in UTC, summarised as "title top+height col/cols". */
const summary = (events: ReturnType<typeof timed>[], day = '2026-10-27', tz = 'UTC') =>
  layoutDay(events, day, tz).map(
    (b) =>
      `${b.event.title} ${String(b.top)}+${String(b.height)} ${String(b.column)}/${String(b.columns)}`,
  );

describe('layoutDay', () => {
  it('gives a lone event the full width', () => {
    expect(
      summary([timed('Dentist', '2026-10-27T16:00:00.000Z', '2026-10-27T17:00:00.000Z')]),
    ).toEqual(['Dentist 960+60 0/1']);
  });

  it('puts overlapping events side by side, chained ones in one cluster', () => {
    expect(
      summary([
        timed('C', '2026-10-27T10:15:00.000Z', '2026-10-27T11:00:00.000Z'),
        timed('A', '2026-10-27T09:00:00.000Z', '2026-10-27T10:00:00.000Z'),
        timed('B', '2026-10-27T09:30:00.000Z', '2026-10-27T10:30:00.000Z'),
        timed('Later', '2026-10-27T14:00:00.000Z', '2026-10-27T15:00:00.000Z'),
      ]),
    ).toEqual([
      'A 540+60 0/2',
      'B 570+60 1/2',
      // A has ended by 10:15, so C reuses its column; the cluster is still 2 wide.
      'C 615+45 0/2',
      // A separate cluster keeps the full width.
      'Later 840+60 0/1',
    ]);
  });

  it('puts the longer of two same-start events first, then sorts by title', () => {
    expect(
      summary([
        timed('Short', '2026-10-27T09:00:00.000Z', '2026-10-27T09:30:00.000Z'),
        timed('Long', '2026-10-27T09:00:00.000Z', '2026-10-27T11:00:00.000Z'),
        timed('Also short', '2026-10-27T09:00:00.000Z', '2026-10-27T09:30:00.000Z'),
      ]),
    ).toEqual(['Long 540+120 0/3', 'Also short 540+30 1/3', 'Short 540+30 2/3']);
  });

  it('draws events with no end as 30 minutes, and tiny ones at least 15', () => {
    expect(
      summary([
        timed('Call', '2026-10-27T08:00:00.000Z'),
        timed('Ping', '2026-10-27T12:00:00.000Z', '2026-10-27T12:00:00.000Z'),
      ]),
    ).toEqual(['Call 480+30 0/1', 'Ping 720+15 0/1']);
  });

  it('clips an event that crosses midnight into both days', () => {
    const late = [timed('Party', '2026-10-27T22:00:00.000Z', '2026-10-28T02:00:00.000Z')];
    const first = layoutDay(late, '2026-10-27', 'UTC')[0];
    const second = layoutDay(late, '2026-10-28', 'UTC')[0];
    expect(first).toMatchObject({
      top: 1320,
      height: 120,
      continuesBefore: false,
      continuesAfter: true,
    });
    expect(second).toMatchObject({
      top: 0,
      height: 120,
      continuesBefore: true,
      continuesAfter: false,
    });
  });

  it('ends an event at midnight at the bottom without spilling into the next day', () => {
    const event = [timed('Late shift', '2026-10-27T20:00:00.000Z', '2026-10-28T00:00:00.000Z')];
    expect(layoutDay(event, '2026-10-27', 'UTC')[0]).toMatchObject({ top: 1200, height: 240 });
    expect(layoutDay(event, '2026-10-28', 'UTC')).toEqual([]);
  });

  it('leaves all-day and 24-hour events to the strip', () => {
    expect(
      summary([
        allDay('Holiday', '2026-10-27'),
        timed('Flight', '2026-10-26T12:00:00.000Z', '2026-10-27T12:00:00.000Z'),
        timed('Gone', '2026-10-26T09:00:00.000Z', '2026-10-26T10:00:00.000Z'),
      ]),
    ).toEqual([]);
  });

  it('uses the viewer zone, not UTC', () => {
    // 04:00Z is 09:00 in Karachi.
    expect(
      summary([timed('Standup', '2026-10-27T04:00:00.000Z')], '2026-10-27', 'Asia/Karachi'),
    ).toEqual(['Standup 540+30 0/1']);
  });

  describe('on DST days (wall-clock positions)', () => {
    it('spring forward: 01:30–03:30 spans the missing hour on the clock', () => {
      // Berlin, 29 March 2026: 02:00 CET jumps to 03:00 CEST. 00:30Z–01:30Z is one real hour.
      expect(
        summary(
          [timed('Night train', '2026-03-29T00:30:00.000Z', '2026-03-29T01:30:00.000Z')],
          '2026-03-29',
          'Europe/Berlin',
        ),
      ).toEqual(['Night train 90+120 0/1']);
    });

    it('fall back: the repeated hour overlaps itself and stays visible', () => {
      // Berlin, 25 October 2026: 03:00 CEST goes back to 02:00 CET, so 02:30 happens twice.
      expect(
        summary(
          [
            timed('First 02:30', '2026-10-25T00:30:00.000Z', '2026-10-25T01:30:00.000Z'),
            timed('Breakfast', '2026-10-25T07:00:00.000Z', '2026-10-25T08:00:00.000Z'),
          ],
          '2026-10-25',
          'Europe/Berlin',
        ),
      ).toEqual(['First 02:30 150+15 0/1', 'Breakfast 480+60 0/1']);
    });

    it('covers the whole 25-hour day for an event that spans it', () => {
      const event = timed('Shift', '2026-10-24T20:00:00.000Z', '2026-10-25T21:00:00.000Z');
      // Over 24 hours long, so it belongs to the strip.
      expect(inAllDayStrip(event)).toBe(true);
      const shorter = timed('Shift', '2026-10-24T23:00:00.000Z', '2026-10-25T22:00:00.000Z');
      // 01:00 to 23:00 on the clock: 22 hours drawn, although 23 real hours pass.
      expect(summary([shorter], '2026-10-25', 'Europe/Berlin')).toEqual(['Shift 60+1320 0/1']);
    });
  });
});

describe('wallClockMinutes', () => {
  it('reads the local clock', () => {
    expect(wallClockMinutes(new Date('2026-10-27T09:05:00.000Z'), 'Asia/Karachi')).toBe(
      14 * 60 + 5,
    );
    expect(wallClockMinutes(new Date('2026-10-27T09:05:00.000Z'), 'Pacific/Kiritimati')).toBe(
      23 * 60 + 5,
    );
  });
});

describe('layoutAllDay', () => {
  const week = daysFrom('2026-10-26', 7);
  const summarise = (events: Parameters<typeof layoutAllDay>[0], tz = 'UTC') => {
    const { blocks, lanes } = layoutAllDay(events, week, tz);
    return {
      lanes,
      blocks: blocks.map(
        (b) =>
          `${b.event.title} @${String(b.startIndex)}x${String(b.span)} lane ${String(b.lane)}${b.continuesBefore ? ' <' : ''}${b.continuesAfter ? ' >' : ''}`,
      ),
    };
  };

  it('spans multi-day events and stacks overlapping ones in lanes', () => {
    expect(
      summarise([
        allDay('Birthday', '2026-10-28'),
        allDay('Conference', '2026-10-27', '2026-10-30'),
        allDay('Trip', '2026-10-30', '2026-11-01'),
        timed('Dentist', '2026-10-27T16:00:00.000Z'),
      ]),
    ).toEqual({
      lanes: 2,
      blocks: [
        'Conference @1x3 lane 0',
        'Birthday @2x1 lane 1',
        // Conference ends (exclusive) on the 30th, so lane 0 is free again on Friday.
        'Trip @4x2 lane 0',
      ],
    });
  });

  it('clips events that start before or end after the days shown', () => {
    expect(
      summarise([
        allDay('Holiday', '2026-10-20', '2026-10-28'),
        allDay('Retreat', '2026-11-01', '2026-11-05'),
        allDay('Long gone', '2026-10-01', '2026-10-02'),
      ]),
    ).toEqual({ lanes: 1, blocks: ['Holiday @0x2 lane 0 <', 'Retreat @6x1 lane 0 >'] });
  });

  it('places 24-hour timed events by their local days, with an exclusive end', () => {
    expect(
      summarise([
        timed('Flight', '2026-10-27T10:00:00.000Z', '2026-10-28T12:00:00.000Z'),
        timed('Two days', '2026-10-29T00:00:00.000Z', '2026-10-31T00:00:00.000Z'),
      ]),
    ).toEqual({ lanes: 1, blocks: ['Flight @1x2 lane 0', 'Two days @3x2 lane 0'] });
  });

  it('treats a missing or backwards all-day end as one day, and handles no days', () => {
    expect(summarise([allDay('Odd', '2026-10-27', '2026-10-27')]).blocks).toEqual([
      'Odd @1x1 lane 0',
    ]);
    expect(layoutAllDay([allDay('Any', '2026-10-27')], [], 'UTC')).toEqual({
      blocks: [],
      lanes: 0,
    });
  });
});

describe('week helpers', () => {
  it('finds the Monday of the week', () => {
    expect(startOfWeekPlain('2026-10-27')).toBe('2026-10-26');
    expect(startOfWeekPlain('2026-10-26')).toBe('2026-10-26');
    expect(startOfWeekPlain('2026-11-01')).toBe('2026-10-26');
    expect(startOfWeekPlain('2027-01-01')).toBe('2026-12-28');
  });

  it('lists consecutive days across a month end', () => {
    expect(daysFrom('2026-10-30', 3)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
  });

  it('rejects an invalid day', () => {
    expect(() => startOfWeekPlain('2026-02-30')).toThrow(RangeError);
  });
});
