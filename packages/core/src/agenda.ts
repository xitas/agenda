import { addDaysToPlainDate, plainDateInTz } from './dates.js';
import type { DateRange } from './dates.js';
import type { AgendaEvent } from './types.js';

type Timing = Pick<AgendaEvent, 'start' | 'end' | 'allDay'>;

export interface DayAgenda<E extends Timing> {
  /** All-day events, by start date then title. */
  allDay: E[];
  /** Timed events, by start then end then title. */
  timed: E[];
  /**
   * Where the "now" marker goes in `timed`: before the first event that hasn't started
   * yet (so events in progress count as past). Null when no `now` is given.
   */
  nowIndex: number | null;
}

const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title);
const instant = (iso: string) => Date.parse(iso);

/** Orders one day's events for the Today view: all-day first, then by time. */
export function dayAgenda<E extends Timing & { title: string }>(
  events: readonly E[],
  now?: Date,
): DayAgenda<E> {
  const allDay = events
    .filter((event) => event.allDay)
    .sort((a, b) => a.start.localeCompare(b.start) || byTitle(a, b));
  const timed = events
    .filter((event) => !event.allDay)
    .sort(
      (a, b) =>
        instant(a.start) - instant(b.start) ||
        instant(a.end ?? a.start) - instant(b.end ?? b.start) ||
        byTitle(a, b),
    );
  let nowIndex: number | null = null;
  if (now !== undefined) {
    const upcoming = timed.findIndex((event) => instant(event.start) > now.getTime());
    nowIndex = upcoming === -1 ? timed.length : upcoming;
  }
  return { allDay, timed, nowIndex };
}

/**
 * Whether an event overlaps the half-open range [start, end) as seen from `timeZone`,
 * with the same rules as the API's range query: all-day events cover whole local days
 * (exclusive end); timed events overlap if they start before the end and end after the
 * start (or, with no end, start inside the range).
 */
export function eventOverlapsRange(event: Timing, range: DateRange, timeZone: string): boolean {
  if (event.allDay) {
    const from = plainDateInTz(range.start, timeZone);
    const to = addDaysToPlainDate(plainDateInTz(new Date(range.end.getTime() - 1), timeZone), 1);
    const end = event.end ?? addDaysToPlainDate(event.start, 1);
    return event.start < to && end > from;
  }
  const start = instant(event.start);
  if (start >= range.end.getTime()) return false;
  return event.end === null
    ? start >= range.start.getTime()
    : instant(event.end) > range.start.getTime();
}

/** Longest stretch one event marks, so a bad end date can't loop for ages. */
const MAX_DAYS = 366;

/** The local days (YYYY-MM-DD in `timeZone`) that any of the events touch, e.g. for dots. */
export function eventDays(events: readonly Timing[], timeZone: string): Set<string> {
  const days = new Set<string>();
  for (const event of events) {
    let first: string;
    let last: string;
    if (event.allDay) {
      first = event.start;
      last = addDaysToPlainDate(event.end ?? addDaysToPlainDate(event.start, 1), -1);
    } else {
      first = plainDateInTz(new Date(event.start), timeZone);
      // An event ending exactly at midnight doesn't touch the next day.
      const end =
        event.end === null
          ? instant(event.start)
          : Math.max(instant(event.start), instant(event.end) - 1);
      last = plainDateInTz(new Date(end), timeZone);
    }
    for (
      let day = first, n = 0;
      day <= last && n < MAX_DAYS;
      day = addDaysToPlainDate(day, 1), n++
    ) {
      days.add(day);
    }
  }
  return days;
}
