import { enGB, enUS } from 'date-fns/locale';
import { describe, expect, it } from 'vitest';
import {
  addDaysToPlainDate,
  addMonthsToPlainDate,
  formatEventTime,
  monthGrid,
  plainDateInTz,
  rangeForView,
  startOfDayInTz,
  startOfWeekPlain,
} from './dates.js';

const iso = (date: Date) => date.toISOString();

describe('test environment', () => {
  it('runs in UTC+14, so code that leaks the host time zone fails', () => {
    expect(new Date('2026-10-24T00:00:00.000Z').getTimezoneOffset()).toBe(-14 * 60);
  });
});

describe('startOfDayInTz', () => {
  // 23:30 in Karachi (UTC+5) is 18:30Z, which is already the next day in Tokyo.
  const lateEvening = new Date('2026-10-24T18:30:00.000Z');
  // 00:30 in Karachi is 19:30Z on the previous UTC day.
  const justAfterMidnight = new Date('2026-10-24T19:30:00.000Z');

  it('puts 23:30 Asia/Karachi on that local day', () => {
    expect(iso(startOfDayInTz(lateEvening, 'Asia/Karachi'))).toBe('2026-10-23T19:00:00.000Z');
    expect(plainDateInTz(lateEvening, 'Asia/Karachi')).toBe('2026-10-24');
  });

  it('puts 00:30 Asia/Karachi on the next local day, not the UTC one', () => {
    expect(plainDateInTz(justAfterMidnight, 'Asia/Karachi')).toBe('2026-10-25');
    expect(plainDateInTz(justAfterMidnight, 'UTC')).toBe('2026-10-24');
  });

  it('gives a different day for the same instant in another zone', () => {
    expect(plainDateInTz(lateEvening, 'Asia/Tokyo')).toBe('2026-10-25');
    expect(iso(startOfDayInTz(lateEvening, 'Asia/Tokyo'))).toBe('2026-10-24T15:00:00.000Z');
  });

  it('returns a plain Date', () => {
    expect(startOfDayInTz(lateEvening, 'Asia/Karachi').constructor).toBe(Date);
  });
});

describe('rangeForView', () => {
  it('covers one local day in Karachi, including a 23:30 event', () => {
    const event = new Date('2026-10-24T18:30:00.000Z');
    const range = rangeForView('day', event, 'Asia/Karachi');
    expect(iso(range.start)).toBe('2026-10-23T19:00:00.000Z');
    expect(iso(range.end)).toBe('2026-10-24T19:00:00.000Z');
    expect(event >= range.start && event < range.end).toBe(true);
  });

  it('starts weeks on Monday and crosses a month boundary', () => {
    // Wednesday 1 July 2026, morning in Karachi.
    const range = rangeForView('week', new Date('2026-07-01T06:00:00.000Z'), 'Asia/Karachi');
    expect(iso(range.start)).toBe('2026-06-28T19:00:00.000Z'); // Mon 29 Jun 00:00 local
    expect(iso(range.end)).toBe('2026-07-05T19:00:00.000Z'); // Mon 6 Jul 00:00 local
  });

  it('treats a Sunday as the end of its week', () => {
    // Sunday 5 July 2026, 23:00 in Karachi.
    const range = rangeForView('week', new Date('2026-07-05T18:00:00.000Z'), 'Asia/Karachi');
    expect(iso(range.start)).toBe('2026-06-28T19:00:00.000Z');
  });

  it('covers a calendar month across a year boundary', () => {
    const range = rangeForView('month', new Date('2026-12-15T12:00:00.000Z'), 'Asia/Karachi');
    expect(iso(range.start)).toBe('2026-11-30T19:00:00.000Z'); // 1 Dec 00:00 local
    expect(iso(range.end)).toBe('2026-12-31T19:00:00.000Z'); // 1 Jan 2027 00:00 local
  });

  it('handles a 23-hour day when clocks go forward', () => {
    // Europe/Berlin switches to summer time on 29 March 2026.
    const range = rangeForView('day', new Date('2026-03-29T12:00:00.000Z'), 'Europe/Berlin');
    expect(iso(range.start)).toBe('2026-03-28T23:00:00.000Z');
    expect(iso(range.end)).toBe('2026-03-29T22:00:00.000Z');
    expect(range.end.getTime() - range.start.getTime()).toBe(23 * 60 * 60 * 1000);
  });
});

describe('formatEventTime', () => {
  const timed = {
    allDay: false,
    start: '2026-10-16T11:00:00.000Z',
    end: '2026-10-16T12:30:00.000Z',
  };

  it('shows a same-day time range in 24-hour or 12-hour form per locale', () => {
    expect(formatEventTime(timed, 'Asia/Karachi', enGB)).toBe('16:00 – 17:30');
    expect(formatEventTime(timed, 'Asia/Karachi', enUS)).toBe('4:00 PM – 5:30 PM');
  });

  it('shows only the start time when there is no end', () => {
    expect(formatEventTime({ ...timed, end: null }, 'Asia/Karachi', enGB)).toBe('16:00');
  });

  it('adds dates when the event spans local days', () => {
    const overnight = { ...timed, end: '2026-10-17T04:00:00.000Z' };
    expect(formatEventTime(overnight, 'Asia/Karachi', enGB)).toBe(
      'Fri, 16 Oct, 16:00 – Sat, 17 Oct, 09:00',
    );
  });

  it('uses the viewer time zone, so the same event can span days elsewhere', () => {
    // 09:30Z–10:30Z is 14:30–15:30 in Karachi but 23:30–00:30 in Kiritimati (UTC+14).
    const call = {
      allDay: false,
      start: '2026-10-16T09:30:00.000Z',
      end: '2026-10-16T10:30:00.000Z',
    };
    expect(formatEventTime(call, 'Asia/Karachi', enGB)).toBe('14:30 – 15:30');
    expect(formatEventTime(call, 'Pacific/Kiritimati', enGB)).toBe(
      'Fri, 16 Oct, 23:30 – Sat, 17 Oct, 00:30',
    );
  });

  it('shows "All day" for a single-day all-day event', () => {
    expect(formatEventTime({ allDay: true, start: '2026-10-16', end: null }, 'UTC', enGB)).toBe(
      'All day',
    );
    expect(
      formatEventTime({ allDay: true, start: '2026-10-16', end: '2026-10-17' }, 'UTC', enGB),
    ).toBe('All day');
  });

  it('shows the inclusive date range for a multi-day all-day event', () => {
    const trip = { allDay: true, start: '2026-10-16', end: '2026-10-19' };
    expect(formatEventTime(trip, 'Asia/Karachi', enGB)).toBe('Fri, 16 Oct – Sun, 18 Oct');
  });

  it('keeps all-day dates fixed whatever the viewer time zone', () => {
    const trip = { allDay: true, start: '2026-10-16', end: '2026-10-19' };
    expect(formatEventTime(trip, 'Pacific/Kiritimati', enGB)).toBe('Fri, 16 Oct – Sun, 18 Oct');
    expect(formatEventTime(trip, 'Pacific/Pago_Pago', enGB)).toBe('Fri, 16 Oct – Sun, 18 Oct');
  });
});

describe('monthGrid', () => {
  const weekday = (day: string) => new Date(`${day}T00:00:00.000Z`).getUTCDay();

  it('starts on the Monday on or before the 1st and has 6 full weeks', () => {
    const grid = monthGrid('2026-10-23'); // October 2026 starts on a Thursday
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe('2026-09-28');
    expect(grid[3]).toBe('2026-10-01');
    expect(grid[41]).toBe('2026-11-08');
    grid.forEach((day, i) => {
      expect(weekday(day)).toBe((i + 1) % 7); // Monday = 1 … Sunday = 0
    });
  });

  it('starts on the 1st when the month starts on a Monday', () => {
    expect(monthGrid('2026-06-17')[0]).toBe('2026-06-01');
  });

  it('crosses the year boundary', () => {
    const grid = monthGrid('2027-01-15'); // 1 January 2027 is a Friday
    expect(grid[0]).toBe('2026-12-28');
    expect(grid[4]).toBe('2027-01-01');
    expect(grid[41]).toBe('2027-02-07');
    expect(monthGrid('2026-12-31')[0]).toBe('2026-11-30');
  });

  it('handles February in common and leap years', () => {
    expect(monthGrid('2026-02-10')).toContain('2026-02-28');
    expect(monthGrid('2026-02-10')).not.toContain('2026-02-29');
    expect(monthGrid('2028-02-10')).toContain('2028-02-29');
  });

  it('is the same whatever the host zone (tests run in UTC+14)', () => {
    expect(monthGrid('2026-03-29')[0]).toBe('2026-02-23');
  });
});

describe('addDaysToPlainDate', () => {
  it('adds and subtracts days across months and years', () => {
    expect(addDaysToPlainDate('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysToPlainDate('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDaysToPlainDate('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('rejects anything that is not a real plain date', () => {
    expect(() => addDaysToPlainDate('2026-13-01', 1)).toThrow('Expected a date like 2026-10-24');
    expect(() => addDaysToPlainDate('tomorrow', 1)).toThrow(RangeError);
    expect(() => addDaysToPlainDate('2026-02-30', 1)).toThrow(RangeError);
    expect(() => monthGrid('2026-10')).toThrow(RangeError);
  });
});

describe('addMonthsToPlainDate', () => {
  it('keeps the day number, clamped to the target month', () => {
    expect(addMonthsToPlainDate('2026-10-23', 1)).toBe('2026-11-23');
    expect(addMonthsToPlainDate('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToPlainDate('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonthsToPlainDate('2026-03-31', -1)).toBe('2026-02-28');
  });

  it('crosses year boundaries both ways', () => {
    expect(addMonthsToPlainDate('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonthsToPlainDate('2027-01-15', -1)).toBe('2026-12-15');
    expect(addMonthsToPlainDate('2026-10-23', -14)).toBe('2025-08-23');
  });

  it('rejects an invalid date', () => {
    expect(() => addMonthsToPlainDate('2026-02-30', 1)).toThrow(RangeError);
  });
});

describe('week start and clock options', () => {
  it('starts weeks on Sunday when asked', () => {
    expect(startOfWeekPlain('2026-10-28', 'sunday')).toBe('2026-10-25');
    expect(startOfWeekPlain('2026-10-25', 'sunday')).toBe('2026-10-25');
    expect(startOfWeekPlain('2026-10-28')).toBe('2026-10-26');
    // Across a year boundary.
    expect(startOfWeekPlain('2027-01-01', 'sunday')).toBe('2026-12-27');
  });

  it('builds Sunday-first month grids', () => {
    const grid = monthGrid('2026-11-15', 'sunday');
    expect(grid[0]).toBe('2026-11-01');
    expect(grid).toHaveLength(42);
    // November 2026 starts on a Sunday; Monday-first it starts on 26 Oct.
    expect(monthGrid('2026-11-15')[0]).toBe('2026-10-26');
    expect(monthGrid('2027-01-10', 'sunday')[0]).toBe('2026-12-27');
  });

  it('gives Sunday-first week ranges', () => {
    const range = rangeForView('week', new Date('2026-10-28T12:00:00.000Z'), 'UTC', 'sunday');
    expect(range.start.toISOString()).toBe('2026-10-25T00:00:00.000Z');
  });

  it('forces a 12- or 24-hour clock in event times', () => {
    const event = {
      start: '2026-10-28T16:00:00.000Z',
      end: '2026-10-28T17:30:00.000Z',
      allDay: false,
    };
    expect(formatEventTime(event, 'UTC', enGB, { hour12: true })).toBe('4:00 PM – 5:30 PM');
    expect(formatEventTime(event, 'UTC', enUS, { hour12: false })).toBe('16:00 – 17:30');
    expect(formatEventTime(event, 'UTC', enUS)).toBe('4:00 PM – 5:30 PM');
  });
});
