import { addDaysToPlainDate, formatEventTime, plainDateInTz } from '@agenda/core';
import type { AppEnv } from '../app/env';

/** Today as a plain date in the viewer's zone. */
export function todayIn(env: AppEnv): string {
  return plainDateInTz(env.now(), env.timezone);
}

/** Today lives at "/", every other day at /day/YYYY-MM-DD. */
export function dayPath(day: string, today: string): string {
  return day === today ? '/' : `/day/${day}`;
}

/** A real plain date, or null for anything else in the URL. */
export function parseDay(value: string | undefined): string | null {
  if (value === undefined) return null;
  try {
    return addDaysToPlainDate(value, 0);
  } catch {
    return null;
  }
}

const atNoonUtc = (day: string) => new Date(`${day}T12:00:00.000Z`);

/** "Tuesday 27 October", with the year when it isn't this year. */
export function dayHeading(day: string, today: string, localeCode: string | undefined): string {
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat(localeCode, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(atNoonUtc(day));
}

/** "Today", "Tomorrow", "Yesterday", or nothing for other days. */
export function relativeDay(day: string, today: string): string | undefined {
  if (day === today) return 'Today';
  if (day === addDaysToPlainDate(today, 1)) return 'Tomorrow';
  if (day === addDaysToPlainDate(today, -1)) return 'Yesterday';
  return undefined;
}

/** A short time of day ("14:05" or "2:05 PM") in the viewer's zone, on their clock. */
export function timeOfDay(date: Date, env: AppEnv): string {
  return formatEventTime(
    { start: date.toISOString(), end: null, allDay: false },
    env.timezone,
    env.locale,
    {
      hour12: env.hour12,
    },
  );
}

/** "Wed, 28 Oct": a short date for previews and toasts. */
export function shortDate(day: string, localeCode: string | undefined): string {
  return new Intl.DateTimeFormat(localeCode, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(atNoonUtc(day));
}
