import { dayAgenda, eventOverlapsRange } from './agenda.js';
import { dayRangeInTz } from './dates.js';
import type { AgendaEvent } from './types.js';

type Listed = Pick<AgendaEvent, 'start' | 'end' | 'allDay' | 'title'>;

/**
 * The events on each of `days` (plain dates), for the Month view. A multi-day event is
 * listed under every day it touches. Each day is ordered like the Today view: all-day
 * events first, then timed ones by start.
 */
export function eventsByDay<E extends Listed>(
  events: readonly E[],
  days: readonly string[],
  timeZone: string,
): Map<string, E[]> {
  const byDay = new Map<string, E[]>();
  for (const day of days) {
    const range = dayRangeInTz(day, timeZone);
    const { allDay, timed } = dayAgenda(
      events.filter((event) => eventOverlapsRange(event, range, timeZone)),
    );
    byDay.set(day, [...allDay, ...timed]);
  }
  return byDay;
}
