import type { AgendaEvent, EventCreateInput } from '@agenda/core';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db/client.js';
import type { Db } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import type { ErrorBody } from '../src/errors.js';

/** Friday 23 October 2026, 14:00 in Karachi. */
export const NOW = new Date('2026-10-23T09:00:00.000Z');

export interface TestResponse<T = unknown> {
  status: number;
  headers: Headers;
  body: T;
  text: string;
}

export async function makeTestApp({ migrate = true }: { migrate?: boolean } = {}) {
  const db: Db = openDb(':memory:');
  if (migrate) await runMigrations(db);
  let clock = NOW;
  const app = createApp({ db, now: () => clock });
  /** Moves the fixed clock, e.g. to check that a PATCH bumps updatedAt. */
  const setNow = (date: Date) => {
    clock = date;
  };

  async function request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<TestResponse<T>> {
    const init: RequestInit = { method };
    if (body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    const res = await app.request(`/api/v1${path}`, init);
    const text = await res.text();
    const json: unknown =
      text !== '' && res.headers.get('Content-Type')?.includes('json') ? JSON.parse(text) : null;
    return { status: res.status, headers: res.headers, body: json as T, text };
  }

  async function create(input: EventCreateInput): Promise<AgendaEvent> {
    const res = await request<AgendaEvent>('POST', '/events', input);
    if (res.status !== 201) throw new Error(`create failed: ${String(res.status)} ${res.text}`);
    return res.body;
  }

  return { app, db, request, create, setNow };
}

export type ErrorResponse = TestResponse<ErrorBody>;

export const timed = (
  title: string,
  start: string,
  end: string | null = null,
): EventCreateInput => ({
  title,
  start,
  end,
  timezone: 'Asia/Karachi',
});

export const allDay = (
  title: string,
  start: string,
  end: string | null = null,
): EventCreateInput => ({
  title,
  start,
  end,
  allDay: true,
  timezone: 'Asia/Karachi',
});
