import { AgendaEventSchema, plainDateInTz } from '@agenda/core';
import type { AgendaEvent } from '@agenda/core';
import { asc, eq, gt, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { events } from '../db/schema.js';
import type { EventRow } from '../db/schema.js';
import { ApiError } from '../errors.js';

/** SQLite allows a limited number of bound values per statement, so bulk work is chunked. */
const CHUNK = 500;

export interface ListRange {
  from: Date;
  to: Date;
  /** Zone used to decide which plain dates an all-day event must cover to overlap. */
  timezone: string;
}

export interface ListCursor {
  start: string;
  id: string;
}

export interface ListOptions {
  range?: ListRange;
  q?: string;
  limit: number;
  after?: ListCursor;
}

export interface ListPage {
  events: AgendaEvent[];
  next: ListCursor | null;
}

/**
 * Timed instants are stored in exactly one format (`toISOString()`), so that string
 * comparison in SQL matches time order; `…00Z` would otherwise sort after `…00.000Z`.
 */
export function normalizeEvent(event: AgendaEvent): AgendaEvent {
  const instant = (value: string) => new Date(value).toISOString();
  return {
    ...event,
    start: event.allDay ? event.start : instant(event.start),
    end: event.end === null || event.allDay ? event.end : instant(event.end),
    createdAt: instant(event.createdAt),
    updatedAt: instant(event.updatedAt),
    deletedAt: event.deletedAt === null ? null : instant(event.deletedAt),
  };
}

function toEvent(row: EventRow): AgendaEvent {
  // Parsing keeps the stored data honest: a corrupt row becomes a 500, not bad JSON.
  return AgendaEventSchema.parse(row);
}

function addDaysToPlain(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

// Drizzle's and()/or() may return undefined; these always build SQL from at least one part.
const allOf = (...parts: SQL[]): SQL => sql`(${sql.join(parts, sql` AND `)})`;
const anyOf = (...parts: SQL[]): SQL => sql`(${sql.join(parts, sql` OR `)})`;

/** Half-open overlap with [from, to): starts before `to` and ends after `from`. */
function overlaps(from: string, to: string): SQL {
  return allOf(
    lt(events.start, to),
    anyOf(gt(events.end, from), allOf(isNull(events.end), gte(events.start, from))),
  );
}

function rangeCondition({ from, to, timezone }: ListRange): SQL {
  // All-day events cover whole local days in `timezone`: every day from the one
  // containing `from` up to and including the one containing the last instant before `to`.
  const fromDate = plainDateInTz(from, timezone);
  const toDate = addDaysToPlain(plainDateInTz(new Date(to.getTime() - 1), timezone), 1);
  return anyOf(
    allOf(eq(events.allDay, false), overlaps(from.toISOString(), to.toISOString())),
    allOf(eq(events.allDay, true), overlaps(fromDate, toDate)),
  );
}

function searchCondition(q: string): SQL {
  // Escape LIKE's wildcards so "100%" and "snake_case" match literally.
  const pattern = `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  const like = (column: typeof events.title | typeof events.notes | typeof events.location) =>
    sql`${column} LIKE ${pattern} ESCAPE '\\'`;
  return anyOf(like(events.title), like(events.notes), like(events.location));
}

/** Drizzle wraps driver errors, so look through the whole cause chain. */
function isUniqueViolation(error: unknown): boolean {
  const messages: string[] = [];
  for (let current = error; current instanceof Error; current = current.cause) {
    messages.push(current.message);
  }
  return /UNIQUE constraint failed/i.test(messages.join(' '));
}

export function createEventRepo(db: Db) {
  return {
    /** Includes soft-deleted rows only when asked, e.g. to detect id conflicts. */
    async get(id: string, { includeDeleted = false } = {}): Promise<AgendaEvent | undefined> {
      const [row] = await db
        .select()
        .from(events)
        .where(
          includeDeleted ? eq(events.id, id) : allOf(eq(events.id, id), isNull(events.deletedAt)),
        );
      return row === undefined ? undefined : toEvent(row);
    },

    async insert(event: AgendaEvent): Promise<AgendaEvent> {
      const stored = normalizeEvent(event);
      try {
        await db.insert(events).values(stored);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ApiError(409, 'conflict', `An event with id ${event.id} already exists`);
        }
        throw error;
      }
      return stored;
    },

    /** Inserts all events atomically (one batch). */
    async insertMany(list: AgendaEvent[]): Promise<void> {
      const rows = list.map(normalizeEvent);
      const statements = [];
      for (let i = 0; i < rows.length; i += CHUNK) {
        statements.push(db.insert(events).values(rows.slice(i, i + CHUNK)));
      }
      const [first, ...rest] = statements;
      if (first !== undefined) await db.batch([first, ...rest]);
    },

    async update(event: AgendaEvent): Promise<AgendaEvent> {
      const stored = normalizeEvent(event);
      await db.update(events).set(stored).where(eq(events.id, event.id));
      return stored;
    },

    /** Ids from `ids` that already exist, including soft-deleted ones. */
    async existingIds(ids: readonly string[]): Promise<Set<string>> {
      const found = new Set<string>();
      for (let i = 0; i < ids.length; i += CHUNK) {
        const rows = await db
          .select({ id: events.id })
          .from(events)
          .where(inArray(events.id, ids.slice(i, i + CHUNK)));
        for (const row of rows) found.add(row.id);
      }
      return found;
    },

    async list({ range, q, limit, after }: ListOptions): Promise<ListPage> {
      const conditions: SQL[] = [isNull(events.deletedAt)];
      if (range) conditions.push(rangeCondition(range));
      if (q !== undefined) conditions.push(searchCondition(q));
      if (after) {
        conditions.push(
          anyOf(
            gt(events.start, after.start),
            allOf(eq(events.start, after.start), gt(events.id, after.id)),
          ),
        );
      }
      const rows = await db
        .select()
        .from(events)
        .where(allOf(...conditions))
        .orderBy(asc(events.start), asc(events.id))
        .limit(limit + 1);

      const page = rows.slice(0, limit).map(toEvent);
      const last = page.at(-1);
      const next = rows.length > limit && last ? { start: last.start, id: last.id } : null;
      return { events: page, next };
    },

    async all(): Promise<AgendaEvent[]> {
      const rows = await db
        .select()
        .from(events)
        .where(isNull(events.deletedAt))
        .orderBy(asc(events.start), asc(events.id));
      return rows.map(toEvent);
    },
  };
}

export type EventRepo = ReturnType<typeof createEventRepo>;
