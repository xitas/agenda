import type { ApiClient, CallOptions } from './api-client.js';
import type { DateRange } from './dates.js';
import type { AgendaEvent, EventCreateInput, EventPatch } from './types.js';

/**
 * Every read and write of events, behind one small interface. Screens and hooks use
 * only this, so the store behind it can change: today the API
 * (createApiEventRepository); in Phase 7 a local SQLite store that syncs, which answers
 * from the device and works offline. Ids are made on the client (newId) and every event
 * has updatedAt, which is what such a store needs to merge changes.
 */
export interface EventRepository {
  /** Events overlapping [range.start, range.end), all-day ones by their days in `timezone`. */
  listRange: (range: DateRange, timezone: string, call?: CallOptions) => Promise<AgendaEvent[]>;
  /** Events whose title, location or notes contain `query`, across all dates. */
  search: (query: string, call?: CallOptions) => Promise<AgendaEvent[]>;
  get: (id: string, call?: CallOptions) => Promise<AgendaEvent>;
  create: (input: EventCreateInput, call?: CallOptions) => Promise<AgendaEvent>;
  update: (id: string, patch: EventPatch, call?: CallOptions) => Promise<AgendaEvent>;
  /** A soft delete: restore() brings it back (the Undo after a swipe). */
  remove: (id: string, call?: CallOptions) => Promise<void>;
  restore: (id: string, call?: CallOptions) => Promise<AgendaEvent>;
}

/** The most results a search returns (the API's page limit). */
export const SEARCH_LIMIT = 200;

/** The repository on top of the API client (any auth mode). */
export function createApiEventRepository(api: Pick<ApiClient, 'events'>): EventRepository {
  const { events } = api;
  return {
    listRange: (range, timezone, call) =>
      events.listAll({ from: range.start, to: range.end, tz: timezone }, call),
    search: async (query, call) =>
      (await events.list({ q: query, limit: SEARCH_LIMIT }, call)).events,
    get: (id, call) => events.get(id, call),
    create: (input, call) => events.create(input, call),
    update: (id, patch, call) => events.update(id, patch, call),
    remove: (id, call) => events.remove(id, call),
    restore: (id, call) => events.restore(id, call),
  };
}
