import { z } from 'zod';

export const EVENT_COLORS = [
  'slate',
  'blue',
  'green',
  'amber',
  'red',
  'violet',
  'pink',
  'teal',
] as const;

export const DEFAULT_EVENT_COLOR = 'blue';

export const EventColorSchema = z.enum(EVENT_COLORS);

/** ISO 8601 instant in UTC, e.g. `2026-10-24T18:30:00.000Z`. Offsets are rejected. */
export const UtcInstantSchema = z.iso.datetime();

/** Calendar date without a time or zone, e.g. `2026-10-24`. */
export const PlainDateSchema = z.iso.date();

function isTimeZone(value: string): boolean {
  // Intl also accepts raw offsets like "+05:00"; we want IANA names only.
  if (/^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const TimeZoneSchema = z
  .string()
  .refine(isTimeZone, { message: 'Expected an IANA time zone such as "Asia/Karachi"' });

const eventFields = {
  title: z.string().trim().min(1).max(200),
  notes: z.string(),
  start: z.string(),
  end: z.string().nullable(),
  allDay: z.boolean(),
  timezone: TimeZoneSchema,
  location: z.string().trim().nullable(),
  color: EventColorSchema,
  reminders: z.array(z.int().min(0)).refine((minutes) => new Set(minutes).size === minutes.length, {
    message: 'Reminders must be unique',
  }),
  rrule: z.string().nullable(),
};

export interface EventTiming {
  start: string;
  end: string | null;
  allDay: boolean;
}

export interface TimingIssue {
  path: ['start' | 'end'];
  message: string;
}

/**
 * Rules that compare fields: all-day events use plain dates with an exclusive end
 * (like iCal), timed events use UTC instants, and `end` must come after `start`.
 * Exported so the API can re-check an event after merging a patch into it.
 */
export function checkEventTiming({ start, end, allDay }: EventTiming): TimingIssue[] {
  const format = allDay ? PlainDateSchema : UtcInstantSchema;
  const expected = allDay ? 'a date (YYYY-MM-DD) for all-day events' : 'a UTC ISO datetime';
  const issues: TimingIssue[] = [];

  if (!format.safeParse(start).success) {
    issues.push({ path: ['start'], message: `Expected ${expected}` });
  }
  if (end !== null) {
    if (!format.safeParse(end).success) {
      issues.push({ path: ['end'], message: `Expected ${expected}` });
    } else if (issues.length === 0 && Date.parse(end) <= Date.parse(start)) {
      issues.push({ path: ['end'], message: 'End must be after start' });
    }
  }
  return issues;
}

function refineTiming(value: EventTiming, ctx: z.RefinementCtx): void {
  for (const issue of checkEventTiming(value)) {
    ctx.addIssue({ code: 'custom', ...issue });
  }
}

export const AgendaEventSchema = z
  .object({
    id: z.uuid(),
    ...eventFields,
    createdAt: UtcInstantSchema,
    updatedAt: UtcInstantSchema,
    deletedAt: UtcInstantSchema.nullable(),
  })
  .superRefine(refineTiming);

/** What a client sends to create an event. `id` is optional; the server fills it if missing. */
export const EventCreateSchema = z
  .object({
    id: z.uuid().optional(),
    title: eventFields.title,
    notes: eventFields.notes.default(''),
    start: eventFields.start,
    end: eventFields.end.default(null),
    allDay: eventFields.allDay.default(false),
    timezone: eventFields.timezone,
    location: eventFields.location.default(null),
    color: eventFields.color.default(DEFAULT_EVENT_COLOR),
    reminders: eventFields.reminders.default(() => []),
    rrule: eventFields.rrule.default(null),
  })
  .superRefine(refineTiming);

/**
 * A partial update. Timing rules span several fields, so they are checked with
 * `checkEventTiming` after the patch is merged into the stored event.
 */
export const EventPatchSchema = z
  .object(eventFields)
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'A patch must change at least one field',
  });
