/**
 * The event editor's fields and their conversion to and from an event.
 *
 * The form holds what the user sees: plain dates (YYYY-MM-DD) and wall-clock times
 * (HH:mm) in the viewer's zone. eventFromForm turns them into the stored shape (UTC
 * instants, or plain dates with an exclusive end for all-day events) and checks it with
 * EventCreateSchema, so the editor and the API apply the same rules; the schema's
 * messages are replaced with friendly ones per field.
 */
import { TZDate } from '@date-fns/tz';
import * as chrono from 'chrono-node';
import { addDaysToPlainDate, plainDateInTz } from './dates.js';
import { DEFAULT_EVENT_COLOR, EventCreateSchema } from './schemas.js';
import type { AgendaEvent, EventColor, EventCreate } from './types.js';

export interface EventForm {
  title: string;
  allDay: boolean;
  startDate: string;
  /** HH:mm; ignored for all-day events. */
  startTime: string;
  /** Inclusive: the last day for all-day events. */
  endDate: string;
  endTime: string;
  color: EventColor;
  /** Minutes before the start. */
  reminders: number[];
  location: string;
  notes: string;
}

export type EventFormField = keyof EventForm;
export type EventFormErrors = Partial<Record<EventFormField, string>>;

export type EventFormResult =
  { ok: true; value: Omit<EventCreate, 'id'> } | { ok: false; errors: EventFormErrors };

/** The reminder choices offered by the editor, in minutes. */
export const REMINDER_CHOICES = [5, 10, 30, 60, 1440] as const;

export const EVENT_FORM_MESSAGES = {
  titleMissing: 'Add a title',
  titleTooLong: 'Keep the title to 200 characters or fewer',
  dateInvalid: 'Enter a date, like 27 Oct 2026',
  timeInvalid: 'Enter a time, like 14:30',
  endBeforeStart: 'End must be after start',
  endDayBeforeStart: "End date can't be before the start date",
} as const;

const MAX_TITLE = 200;
const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

const pad = (value: number) => String(value).padStart(2, '0');

function isPlainDate(value: string): boolean {
  if (!PLAIN_DATE.test(value)) return false;
  try {
    addDaysToPlainDate(value, 0);
    return true;
  } catch {
    return false;
  }
}

/** A wall-clock date and time in `timeZone` as a UTC ISO instant. */
export function localDateTimeToUtc(day: string, time: string, timeZone: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  return new Date(new TZDate(y, m - 1, d, hh, mm, timeZone).getTime()).toISOString();
}

/** An instant as the wall-clock date and time (HH:mm) seen in `timeZone`. */
export function utcToLocalDateTime(iso: string, timeZone: string): { date: string; time: string } {
  const local = new TZDate(Date.parse(iso), timeZone);
  return {
    date: plainDateInTz(new Date(iso), timeZone),
    time: `${pad(local.getHours())}:${pad(local.getMinutes())}`,
  };
}

const ONE_HOUR = 60 * 60_000;

/** An empty form for a new timed event starting at `start` (one hour long). */
export function newEventForm(start: Date, timeZone: string, minutes = 60): EventForm {
  const from = utcToLocalDateTime(start.toISOString(), timeZone);
  const to = utcToLocalDateTime(
    new Date(start.getTime() + minutes * 60_000).toISOString(),
    timeZone,
  );
  return {
    title: '',
    allDay: false,
    startDate: from.date,
    startTime: from.time,
    endDate: to.date,
    endTime: to.time,
    color: DEFAULT_EVENT_COLOR,
    reminders: [],
    location: '',
    notes: '',
  };
}

type Editable = Pick<
  AgendaEvent,
  'title' | 'start' | 'end' | 'allDay' | 'color' | 'reminders' | 'location' | 'notes'
>;

/** The form for editing an existing event. */
export function formFromEvent(event: Editable, timeZone: string): EventForm {
  const common = {
    title: event.title,
    allDay: event.allDay,
    color: event.color,
    reminders: [...event.reminders].sort((a, b) => a - b),
    location: event.location ?? '',
    notes: event.notes,
  };
  if (event.allDay) {
    const last = event.end === null ? event.start : addDaysToPlainDate(event.end, -1);
    // Times are kept for when the user switches all-day off.
    return {
      ...common,
      startDate: event.start,
      startTime: '09:00',
      endDate: last,
      endTime: '10:00',
    };
  }
  const from = utcToLocalDateTime(event.start, timeZone);
  const endIso = event.end ?? new Date(Date.parse(event.start) + ONE_HOUR).toISOString();
  const to = utcToLocalDateTime(endIso, timeZone);
  return {
    ...common,
    startDate: from.date,
    startTime: from.time,
    endDate: to.date,
    endTime: to.time,
  };
}

/**
 * Checks the form and builds the event to save. `timezone` is stored on the event: the
 * viewer's zone for a new event, the event's own zone when editing.
 */
export function eventFromForm(
  form: EventForm,
  viewerZone: string,
  timezone = viewerZone,
): EventFormResult {
  const errors: EventFormErrors = {};
  const title = form.title.trim();
  if (title === '') errors.title = EVENT_FORM_MESSAGES.titleMissing;
  else if (title.length > MAX_TITLE) errors.title = EVENT_FORM_MESSAGES.titleTooLong;
  if (!isPlainDate(form.startDate)) errors.startDate = EVENT_FORM_MESSAGES.dateInvalid;
  if (!isPlainDate(form.endDate)) errors.endDate = EVENT_FORM_MESSAGES.dateInvalid;
  if (!form.allDay) {
    if (!TIME.test(form.startTime)) errors.startTime = EVENT_FORM_MESSAGES.timeInvalid;
    if (!TIME.test(form.endTime)) errors.endTime = EVENT_FORM_MESSAGES.timeInvalid;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  let start: string;
  let end: string | null;
  if (form.allDay) {
    if (form.endDate < form.startDate) {
      return { ok: false, errors: { endDate: EVENT_FORM_MESSAGES.endDayBeforeStart } };
    }
    start = form.startDate;
    end = form.endDate === form.startDate ? null : addDaysToPlainDate(form.endDate, 1);
  } else {
    start = localDateTimeToUtc(form.startDate, form.startTime, viewerZone);
    end = localDateTimeToUtc(form.endDate, form.endTime, viewerZone);
    if (Date.parse(end) <= Date.parse(start)) {
      const field = form.endDate < form.startDate ? 'endDate' : 'endTime';
      return { ok: false, errors: { [field]: EVENT_FORM_MESSAGES.endBeforeStart } };
    }
  }

  const location = form.location.trim();
  const parsed = EventCreateSchema.safeParse({
    title,
    notes: form.notes,
    start,
    end,
    allDay: form.allDay,
    timezone,
    location: location === '' ? null : location,
    color: form.color,
    reminders: [...new Set(form.reminders)].sort((a, b) => a - b),
    rrule: null,
  });
  if (!parsed.success) {
    // The checks above cover what a user can get wrong; anything left is a bug, but it
    // still lands on a field instead of failing silently.
    const fallback: EventFormErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      const field: EventFormField =
        key === 'start'
          ? 'startDate'
          : key === 'end'
            ? 'endDate'
            : key === 'title'
              ? 'title'
              : 'notes';
      fallback[field] ??= issue.message;
    }
    return { ok: false, errors: fallback };
  }
  // No id was passed in, so the draft has none; the caller adds its own.
  const value: Omit<EventCreate, 'id'> = parsed.data;
  return { ok: true, value };
}

/** "27 Oct 2026" (en-GB) or "Oct 27, 2026" (en-US): how the editor shows a date. */
export function formatDateInput(day: string, localeCode: string | undefined): string {
  return new Intl.DateTimeFormat(localeCode, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00.000Z`));
}

/**
 * A typed date as a plain date, or null. Accepts ISO ("2026-10-27"), numeric dates
 * (day-first, or month-first for en-US), written ones ("27 Oct", "Oct 27, 2026",
 * "Tuesday 27 October") and relative words ("tomorrow"). A missing year means this year.
 * The whole text must be a date: "27 Oct and more" is rejected.
 */
export function parseDateInput(
  text: string,
  options: { today: string; locale?: string },
): string | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (PLAIN_DATE.test(trimmed)) return isPlainDate(trimmed) ? trimmed : null;

  const parser = /-US$/i.test(options.locale ?? '') ? chrono.en.casual : chrono.en.GB;
  const [y, m, d] = options.today.split('-').map(Number) as [number, number, number];
  // chrono reads the machine-local fields of the reference; noon keeps it on `today`.
  const [result] = parser.parse(trimmed, new Date(y, m - 1, d, 12), { forwardDate: false });
  if (result === undefined) return null;
  const rest = (
    trimmed.slice(0, result.index) + trimmed.slice(result.index + result.text.length)
  ).replace(/[\s,.]/g, '');
  if (rest !== '') return null;

  const { start } = result;
  const day = `${String(start.get('year') ?? y)}-${pad(start.get('month') ?? m)}-${pad(start.get('day') ?? d)}`;
  return isPlainDate(day) ? day : null;
}
