import type { Locale } from 'date-fns';
import { hasEnded } from './agenda.js';
import { addDaysToPlainDate, formatEventTime, plainDateInTz } from './dates.js';
import { localDateTimeToUtc } from './event-form.js';
import type { TrayItem } from './platform.js';
import type { AgendaEvent } from './types.js';

/** DESIGN.md §4: the tray menu shows the next 5 events. */
export const TRAY_LIMIT = 5;
export const TRAY_EMPTY = 'Nothing today or tomorrow';
/** Before the app has a session (or when it can't reach the server). */
export const TRAY_SIGNED_OUT = 'Open Agenda to see your events';
const MAX_TITLE = 40;

export interface TrayOptions {
  now: Date;
  timezone: string;
  locale: Locale;
  hour12?: boolean;
  limit?: number;
}

function shorten(title: string): string {
  return title.length <= MAX_TITLE ? title : `${title.slice(0, MAX_TITLE - 1).trimEnd()}…`;
}

/**
 * The tray menu's event lines: what hasn't ended yet today and tomorrow, soonest first,
 * like "Today, 15:00 · Call Ali" or "Tomorrow · Holiday". Each opens its day.
 */
export function trayItems(
  events: readonly AgendaEvent[],
  { now, timezone, locale, hour12, limit = TRAY_LIMIT }: TrayOptions,
): TrayItem[] {
  const today = plainDateInTz(now, timezone);
  const tomorrow = addDaysToPlainDate(today, 1);
  const upcoming = events
    .filter((event) => event.deletedAt === null && !hasEnded(event, now, today))
    .map((event) => {
      const startDay = event.allDay ? event.start : plainDateInTz(new Date(event.start), timezone);
      // Something that started yesterday and is still going is today's.
      const day = startDay < today ? today : startDay;
      const sortAt = event.allDay
        ? Date.parse(localDateTimeToUtc(event.start, '00:00', timezone))
        : Date.parse(event.start);
      return { event, day, sortAt };
    })
    .filter(({ day }) => day <= tomorrow)
    .sort((a, b) => a.sortAt - b.sortAt || a.event.title.localeCompare(b.event.title))
    .slice(0, limit);

  if (upcoming.length === 0) return [{ label: TRAY_EMPTY }];
  return upcoming.map(({ event, day }) => {
    const dayLabel = day === today ? 'Today' : 'Tomorrow';
    const time = event.allDay
      ? ''
      : `, ${formatEventTime({ ...event, end: null }, timezone, locale, { hour12 })}`;
    return { label: `${dayLabel}${time} · ${shorten(event.title)}`, path: `/day/${day}` };
  });
}
