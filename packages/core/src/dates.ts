import { tz } from '@date-fns/tz';
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns';
import type { Locale } from 'date-fns';
import type { AgendaEvent } from './types.js';

export type CalendarView = 'day' | 'week' | 'month';

/** A half-open range of instants: `start` is included, `end` is not. */
export interface DateRange {
  start: Date;
  end: Date;
}

const DATE_FORMAT = 'EEE, d MMM';
const TIME_FORMAT = 'p';

// date-fns returns TZDate objects in the requested zone; callers get plain Dates.
function toDate(date: Date): Date {
  return new Date(date.getTime());
}

/** The instant at which the local day containing `date` starts in `timeZone`. */
export function startOfDayInTz(date: Date, timeZone: string): Date {
  return toDate(startOfDay(date, { in: tz(timeZone) }));
}

/** The calendar date (`YYYY-MM-DD`) that `date` falls on in `timeZone`. */
export function plainDateInTz(date: Date, timeZone: string): string {
  return format(date, 'yyyy-MM-dd', { in: tz(timeZone) });
}

/** The range of instants a day, week (Monday first) or month view covers in `timeZone`. */
export function rangeForView(view: CalendarView, date: Date, timeZone: string): DateRange {
  const options = { in: tz(timeZone) };
  switch (view) {
    case 'day': {
      const start = startOfDay(date, options);
      return { start: toDate(start), end: toDate(addDays(start, 1, options)) };
    }
    case 'week': {
      const start = startOfWeek(date, { ...options, weekStartsOn: 1 });
      return { start: toDate(start), end: toDate(addWeeks(start, 1, options)) };
    }
    case 'month': {
      const start = startOfMonth(date, options);
      return { start: toDate(start), end: toDate(addMonths(start, 1, options)) };
    }
  }
}

// Plain dates are zone-free, so they are read and formatted in UTC to keep the same day.
const utc = { in: tz('UTC') };

function fromPlainDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A plain date `days` later (or earlier, if negative): `2026-10-31` + 1 = `2026-11-01`. */
export function addDaysToPlainDate(day: string, days: number): string {
  // A round trip: V8 rolls 2026-02-30 over to 2 March instead of rejecting it.
  const parsed = fromPlainDate(day);
  if (
    !PLAIN_DATE.test(day) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== day
  ) {
    throw new RangeError(`Expected a date like 2026-10-24, got ${day}`);
  }
  const next = fromPlainDate(day);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/**
 * The same day number `months` later, clamped to that month's length:
 * `2026-01-31` + 1 month = `2026-02-28`.
 */
export function addMonthsToPlainDate(day: string, months: number): string {
  const start = fromPlainDate(addDaysToPlainDate(day, 0));
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const target = new Date(Date.UTC(year, month, Math.min(start.getUTCDate(), lastDay)));
  return target.toISOString().slice(0, 10);
}

/**
 * The 42 plain dates of a month calendar (6 weeks, Monday first) for the month that
 * contains `day`. Calendar math on a plain date needs no time zone, so it runs in UTC.
 */
export function monthGrid(day: string): string[] {
  const month = rangeForView('month', fromPlainDate(addDaysToPlainDate(day, 0)), 'UTC');
  const firstWeek = rangeForView('week', month.start, 'UTC');
  const first = plainDateInTz(firstWeek.start, 'UTC');
  return Array.from({ length: 42 }, (_, i) => addDaysToPlainDate(first, i));
}

/**
 * A short, locale-aware time label for an event as seen from `timeZone`:
 * "16:00 – 17:30", "Thu, 16 Oct, 16:00 – Fri, 17 Oct, 09:00", "All day", or
 * "Thu, 16 Oct – Sat, 18 Oct" for a multi-day all-day event.
 */
export function formatEventTime(
  event: Pick<AgendaEvent, 'start' | 'end' | 'allDay'>,
  timeZone: string,
  locale: Locale,
): string {
  if (event.allDay) {
    const first = fromPlainDate(event.start);
    // The all-day end is exclusive, so the last day shown is the day before it.
    const last = event.end === null ? first : subDays(fromPlainDate(event.end), 1, utc);
    if (isSameDay(first, last, utc)) return 'All day';
    const dateOptions = { ...utc, locale };
    return `${format(first, DATE_FORMAT, dateOptions)} – ${format(last, DATE_FORMAT, dateOptions)}`;
  }

  const options = { in: tz(timeZone), locale };
  const start = new Date(event.start);
  const startTime = format(start, TIME_FORMAT, options);
  if (event.end === null) return startTime;

  const end = new Date(event.end);
  const endTime = format(end, TIME_FORMAT, options);
  if (isSameDay(start, end, options)) return `${startTime} – ${endTime}`;

  const startDate = format(start, DATE_FORMAT, options);
  const endDate = format(end, DATE_FORMAT, options);
  return `${startDate}, ${startTime} – ${endDate}, ${endTime}`;
}
