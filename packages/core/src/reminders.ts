import type { Locale } from 'date-fns';
import { addDaysToPlainDate, formatEventTime, plainDateInTz } from './dates.js';
import { localDateTimeToUtc } from './event-form.js';
import type { ScheduledReminder } from './platform.js';
import type { AgendaEvent } from './types.js';

/** All-day events have no time, so their reminders count back from 09:00 that day. */
export const ALL_DAY_REMINDER_TIME = '09:00';
/** A reminder up to 5 minutes late still shows (the desktop app uses the same grace). */
export const REMINDER_GRACE_MS = 5 * 60_000;
/** How far ahead reminders are scheduled; the list is rebuilt long before it runs out. */
export const REMINDER_HORIZON_MS = 48 * 60 * 60_000;

export interface ReminderScheduleOptions {
  now: Date;
  /** The viewer's zone: all-day dates are days there. */
  timezone: string;
  locale: Locale;
  hour12?: boolean;
  horizonMs?: number;
}

/** When the reminder `minutes` before the event is due. */
export function reminderTime(
  event: Pick<AgendaEvent, 'start' | 'allDay'>,
  minutes: number,
  timezone: string,
): Date {
  const start = event.allDay
    ? localDateTimeToUtc(event.start, ALL_DAY_REMINDER_TIME, timezone)
    : event.start;
  return new Date(Date.parse(start) - minutes * 60_000);
}

/** "Today", "Tomorrow" or "Wed 4 Nov": the event's day as seen when the reminder shows. */
function dayWord(day: string, reminderDay: string, locale: Locale): string {
  if (day === reminderDay) return 'Today';
  if (day === addDaysToPlainDate(reminderDay, 1)) return 'Tomorrow';
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(locale.code, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(Date.UTC(y, m - 1, d));
}

/**
 * Every reminder due from REMINDER_GRACE_MS ago to `horizonMs` ahead, soonest first.
 * The desktop app replaces its whole schedule with this list whenever events change,
 * and shows each key once, so calling it again never repeats a reminder.
 */
export function reminderSchedule(
  events: readonly AgendaEvent[],
  { now, timezone, locale, hour12, horizonMs = REMINDER_HORIZON_MS }: ReminderScheduleOptions,
): ScheduledReminder[] {
  const from = now.getTime() - REMINDER_GRACE_MS;
  const to = now.getTime() + horizonMs;
  const reminders: ScheduledReminder[] = [];
  for (const event of events) {
    if (event.deletedAt !== null) continue;
    const day = event.allDay ? event.start : plainDateInTz(new Date(event.start), timezone);
    for (const minutes of new Set(event.reminders)) {
      const at = reminderTime(event, minutes, timezone);
      const atMs = at.getTime();
      if (atMs < from || atMs > to) continue;
      const when = formatEventTime(event, timezone, locale, { hour12 });
      const parts = [`${dayWord(day, plainDateInTz(at, timezone), locale)}, ${when}`];
      if (event.location !== null && event.location !== '') parts.push(event.location);
      reminders.push({
        key: `${event.id}:${String(minutes)}:${event.start}`,
        atMs,
        title: event.title,
        body: parts.join(' · '),
      });
    }
  }
  return reminders.sort((a, b) => a.atMs - b.atMs || a.key.localeCompare(b.key));
}

/** Shown reminder keys are forgotten after this long; their events are long past by then. */
export const REMINDER_KEEP_SHOWN_MS = 2 * 24 * 60 * 60_000;

/** The keys of reminders already shown, with the time each was due (ms since 1970). */
export type ShownReminders = Record<string, number>;

/**
 * The reminders to show at `nowMs`: due, at most REMINDER_GRACE_MS late, and not shown
 * before. The same rule as the desktop app's Rust core (src-tauri/src/reminders.rs), so
 * a reminder is never shown twice by one app, whatever restarts in between.
 */
export function dueReminders(
  schedule: readonly ScheduledReminder[],
  shown: ShownReminders,
  nowMs: number,
): ScheduledReminder[] {
  return schedule.filter(
    (r) => r.atMs <= nowMs && nowMs - r.atMs <= REMINDER_GRACE_MS && !(r.key in shown),
  );
}

/** When the next reminder not yet shown is due, or null when there is none. */
export function nextReminderAt(
  schedule: readonly ScheduledReminder[],
  shown: ShownReminders,
  nowMs: number,
): number | null {
  let next: number | null = null;
  for (const r of schedule) {
    if (r.atMs > nowMs && !(r.key in shown) && (next === null || r.atMs < next)) next = r.atMs;
  }
  return next;
}

/** `shown` without the keys due more than REMINDER_KEEP_SHOWN_MS ago. */
export function pruneShown(shown: ShownReminders, nowMs: number): ShownReminders {
  return Object.fromEntries(
    Object.entries(shown).filter(([, atMs]) => nowMs - atMs <= REMINDER_KEEP_SHOWN_MS),
  );
}
