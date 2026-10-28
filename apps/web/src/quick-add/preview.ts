import { addDaysToPlainDate, formatEventTime, plainDateInTz } from '@agenda/core';
import type { EventCreate } from '@agenda/core';
import type { AppEnv } from '../app/env';
import { shortDate } from '../day/dayFormat';

/** The plain date an event starts on, as seen from the viewer's zone. */
export function startDay(draft: Pick<EventCreate, 'start' | 'allDay'>, timezone: string): string {
  return draft.allDay ? draft.start : plainDateInTz(new Date(draft.start), timezone);
}

/**
 * When the parsed event happens, for the preview chip: "Wed 28 Oct · 16:00",
 * "Tue 27 Oct · All day", or the full range when it spans days ("Tue, 3 Nov – Thu, 5 Nov").
 */
export function previewWhen(
  draft: Pick<EventCreate, 'start' | 'end' | 'allDay'>,
  env: AppEnv,
): string {
  const time = formatEventTime(draft, env.timezone, env.locale);
  const day = startDay(draft, env.timezone);
  const oneDay =
    draft.end === null ||
    (draft.allDay
      ? draft.end === addDaysToPlainDate(draft.start, 1)
      : plainDateInTz(new Date(draft.end), env.timezone) === day);
  return oneDay ? `${shortDate(day, env.locale.code)} · ${time}` : time;
}

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** "Red": the category name, so color is never the only signal. */
export const colorName = (color: string) => capitalise(color);
