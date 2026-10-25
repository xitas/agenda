import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * One row per AgendaEvent. Instants are stored as `toISOString()` strings (always with
 * milliseconds) so that string comparison in SQL orders them correctly; all-day events
 * store plain `YYYY-MM-DD` dates in the same columns.
 */
export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    notes: text('notes').notNull().default(''),
    // `end` is a reserved word in SQL, hence the _at suffix on both.
    start: text('start_at').notNull(),
    end: text('end_at'),
    allDay: integer('all_day', { mode: 'boolean' }).notNull(),
    timezone: text('timezone').notNull(),
    location: text('location'),
    color: text('color').notNull(),
    reminders: text('reminders', { mode: 'json' }).$type<number[]>().notNull().default([]),
    rrule: text('rrule'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at'),
  },
  (table) => [
    index('events_deleted_start_idx').on(table.deletedAt, table.start),
    // Sync (Phase 7) asks for everything changed since a cursor.
    index('events_updated_idx').on(table.updatedAt),
  ],
);

export type EventRow = typeof events.$inferSelect;
