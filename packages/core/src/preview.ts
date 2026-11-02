import type { Locale } from 'date-fns';
import { addDaysToPlainDate, formatEventTime, plainDateInTz } from './dates.js';
import type { QuickAddResult } from './quick-add.js';
import type { EventColor, EventCreate } from './types.js';

/** What the preview needs to know about the viewer (the apps' AppEnv has these). */
export interface PreviewOptions {
  timezone: string;
  locale: Locale;
  hour12?: boolean;
}

/** The plain date an event starts on, as seen from the viewer's zone. */
export function eventStartDay(
  draft: Pick<EventCreate, 'start' | 'allDay'>,
  timezone: string,
): string {
  return draft.allDay ? draft.start : plainDateInTz(new Date(draft.start), timezone);
}

/** "Tue 27 Oct" (en-GB) or "Tue, Oct 27" (en-US) for a plain date. */
export function formatShortDate(day: string, localeCode: string | undefined): string {
  return new Intl.DateTimeFormat(localeCode, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00.000Z`));
}

/**
 * When a parsed event happens, for QuickAdd's preview chip: "Wed 28 Oct · 16:00",
 * "Tue 27 Oct · All day", or the full range when it spans days ("Tue, 3 Nov – Thu, 5 Nov").
 */
export function previewWhen(
  draft: Pick<EventCreate, 'start' | 'end' | 'allDay'>,
  { timezone, locale, hour12 }: PreviewOptions,
): string {
  const time = formatEventTime(draft, timezone, locale, { hour12 });
  const day = eventStartDay(draft, timezone);
  const oneDay =
    draft.end === null ||
    (draft.allDay
      ? draft.end === addDaysToPlainDate(draft.start, 1)
      : plainDateInTz(new Date(draft.end), timezone) === day);
  return oneDay ? `${formatShortDate(day, locale.code)} · ${time}` : time;
}

/** "Red": the category name, so color is never the only signal. */
export function eventColorName(color: string): string {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

/** What QuickAdd's preview chip shows for a parse result. */
export interface QuickAddPreview {
  title: string;
  when: string;
  color: EventColor;
  colorName: string;
  warnings: readonly string[];
}

export function quickAddPreview(
  { draft, warnings }: Pick<QuickAddResult, 'draft' | 'warnings'>,
  options: PreviewOptions,
): QuickAddPreview {
  return {
    title: draft.title,
    when: previewWhen(draft, options),
    color: draft.color,
    colorName: eventColorName(draft.color),
    warnings,
  };
}

/**
 * An event's time as one day of a list shows it: "16:00 – 17:00" for an event within the
 * day, "23:30 →" on the day an overnight event starts, "→ 01:30" on the day it ends, and
 * "All day" for all-day events and the days in between.
 */
export function timeOnDay(
  event: Pick<EventCreate, 'start' | 'end' | 'allDay'>,
  day: string,
  { timezone, locale, hour12 }: PreviewOptions,
): string {
  if (event.allDay) return 'All day';
  const at = (iso: string) =>
    formatEventTime({ start: iso, end: null, allDay: false }, timezone, locale, { hour12 });
  const first = plainDateInTz(new Date(event.start), timezone);
  // An end at midnight belongs to the day before.
  const last =
    event.end === null ? first : plainDateInTz(new Date(Date.parse(event.end) - 1), timezone);
  if (event.end === null) return at(event.start);
  if (first === last) return `${at(event.start)} – ${at(event.end)}`;
  if (day === first) return `${at(event.start)} →`;
  if (day === last) return `→ ${at(event.end)}`;
  return 'All day';
}
