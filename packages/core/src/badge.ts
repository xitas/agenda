import { eventOverlapsRange, hasEnded } from './agenda.js';
import { dayRangeInTz, plainDateInTz } from './dates.js';
import type { AgendaEvent } from './types.js';

/**
 * The extension's toolbar badge: today's timed events that haven't ended yet (one in
 * progress counts). All-day events don't, or they would sit on the badge all day.
 */
export function badgeCount(
  events: readonly AgendaEvent[],
  { now, timezone }: { now: Date; timezone: string },
): number {
  const today = plainDateInTz(now, timezone);
  const range = dayRangeInTz(today, timezone);
  return events.filter(
    (event) =>
      event.deletedAt === null &&
      !event.allDay &&
      eventOverlapsRange(event, range, timezone) &&
      !hasEnded(event, now, today),
  ).length;
}

/** The badge text: nothing for 0 (an empty badge), "9+" past 9 so it stays one glyph wide. */
export function badgeText(count: number): string {
  if (count <= 0) return '';
  return count > 9 ? '9+' : String(count);
}

/**
 * When the badge count can next change on its own: the next end of one of today's timed
 * events after `now` (an event with no end counts as 30 minutes, as in hasEnded), or
 * the end of the day, when tomorrow's count starts. Refreshes cover everything else.
 */
export function nextBadgeChange(
  events: readonly AgendaEvent[],
  { now, timezone }: { now: Date; timezone: string },
): Date {
  const today = plainDateInTz(now, timezone);
  const range = dayRangeInTz(today, timezone);
  let next = range.end.getTime();
  for (const event of events) {
    if (event.deletedAt !== null || event.allDay) continue;
    const start = Date.parse(event.start);
    const end = event.end === null ? start + 30 * 60_000 : Date.parse(event.end);
    if (end > now.getTime() && end < next) next = end;
  }
  return new Date(next);
}
