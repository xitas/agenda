import { z } from 'zod';
import { plainDateInTz } from './dates.js';
import { newId } from './ids.js';
import {
  AgendaEventSchema,
  DEFAULT_EVENT_COLOR,
  PlainDateSchema,
  TimeZoneSchema,
} from './schemas.js';
import type { AgendaEvent } from './types.js';

/** The v0 export row: `{ id, title, description, date }`, with `date` usually a UTC instant. */
export const V0EventSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  description: z.string().nullish(),
  date: z.union([z.iso.datetime({ offset: true }), z.iso.date()]),
});

export type V0Event = z.infer<typeof V0EventSchema>;

export interface ImportOptions {
  /** The zone the v0 app ran in. v0 dates become all-day events on the local day there. */
  timezone: string;
  /** Used for `createdAt` and `updatedAt`. Defaults to the current time. */
  now?: Date;
  /** Makes ids for rows without a valid UUID. Defaults to `newId`. */
  newId?: () => string;
}

export interface SkippedRow {
  index: number;
  reason: string;
}

export interface ImportResult {
  events: AgendaEvent[];
  skipped: SkippedRow[];
}

/** The import file is not a list of events at all, so there are no rows to report. */
export class ImportFormatError extends Error {
  override name = 'ImportFormatError';
}

type ResolvedOptions = Required<ImportOptions>;

function resolveOptions(options: ImportOptions): ResolvedOptions {
  if (!TimeZoneSchema.safeParse(options.timezone).success) {
    throw new RangeError(`Invalid time zone: ${options.timezone}`);
  }
  return {
    timezone: options.timezone,
    now: options.now ?? new Date(),
    newId: options.newId ?? newId,
  };
}

function v0Candidate(v0: V0Event, options: ResolvedOptions): Record<string, unknown> {
  const timestamp = options.now.toISOString();
  // v0 stored a picked date as the UTC instant of local midnight, so the
  // calendar day has to be read in the zone the app ran in.
  const start = PlainDateSchema.safeParse(v0.date).success
    ? v0.date
    : plainDateInTz(new Date(v0.date), options.timezone);

  return {
    id: z.uuid().safeParse(v0.id).success ? v0.id : options.newId(),
    title: v0.title,
    notes: v0.description ?? '',
    start,
    end: null,
    allDay: true,
    timezone: options.timezone,
    location: null,
    color: DEFAULT_EVENT_COLOR,
    reminders: [],
    rrule: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
}

/**
 * Converts a v0 row into an all-day AgendaEvent. Keeps the v0 id when it is a UUID
 * (the v0 server used UUIDs; older clients used nanoid). Throws a ZodError if the
 * result is not a valid event, e.g. an empty title.
 */
export function fromV0(v0: V0Event, options: ImportOptions): AgendaEvent {
  return AgendaEventSchema.parse(v0Candidate(v0, resolveOptions(options)));
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) =>
      issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
    )
    .join('; ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRow(row: unknown, options: ResolvedOptions): AgendaEvent | string {
  if (!isRecord(row)) return 'Not an event object';

  if ('start' in row) {
    const event = AgendaEventSchema.safeParse(row);
    return event.success ? event.data : describeIssues(event.error);
  }

  if ('date' in row) {
    const v0 = V0EventSchema.safeParse(row);
    if (!v0.success) return `v0 ${describeIssues(v0.error)}`;
    const event = AgendaEventSchema.safeParse(v0Candidate(v0.data, options));
    return event.success ? event.data : describeIssues(event.error);
  }

  return 'Unrecognized event format';
}

/**
 * Parses an import file that may mix v0 rows (`date`) and v1 rows (`start`).
 * Invalid, duplicate and deleted rows are skipped with their index and a reason.
 */
export function parseImport(input: unknown, options: ImportOptions): ImportResult {
  if (!Array.isArray(input)) throw new ImportFormatError('Expected an array of events');
  const rows: unknown[] = input;
  const resolved = resolveOptions(options);

  const events: AgendaEvent[] = [];
  const skipped: SkippedRow[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const result = parseRow(row, resolved);
    if (typeof result === 'string') {
      skipped.push({ index, reason: result });
    } else if (result.deletedAt !== null) {
      skipped.push({ index, reason: 'Deleted event' });
    } else if (seen.has(result.id)) {
      skipped.push({ index, reason: `Duplicate id ${result.id}` });
    } else {
      seen.add(result.id);
      events.push(result);
    }
  });

  return { events, skipped };
}
