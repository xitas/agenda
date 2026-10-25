import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { plainDateInTz } from '@agenda/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { openMigratedDb } from '../src/db/open.js';
import { buildSeedEvents } from '../src/db/seed-data.js';
import { loadEnv } from '../src/env.js';
import { ApiError } from '../src/errors.js';
import { createEventRepo } from '../src/events/repo.js';
import { makeTestApp, NOW } from './helpers.js';
import type { ErrorResponse } from './helpers.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('app', () => {
  it('returns the error shape for unknown routes', async () => {
    const { request } = await makeTestApp();
    const res: ErrorResponse = await request('GET', '/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'not_found', message: 'No route for GET /api/v1/nope' },
    });
  });

  it('hides unexpected errors behind a 500', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // No migrations, so the events table does not exist.
    const { request } = await makeTestApp({ migrate: false });
    const res: ErrorResponse = await request('GET', '/events');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'internal', message: 'Something went wrong' } });
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it('can log requests, and uses the real clock by default', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const db = openDb(':memory:');
    await runMigrations(db);
    const res = await createApp({ db, logRequests: true }).request('/api/v1/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Now', start: '2026-10-24', allDay: true, timezone: 'UTC' }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { createdAt: string };
    expect(Math.abs(Date.parse(body.createdAt) - Date.now())).toBeLessThan(60_000);
    expect(consoleLog).toHaveBeenCalled();
  });

  it('applies migrations only once', async () => {
    const db = openDb(':memory:');
    await runMigrations(db);
    await expect(runMigrations(db)).resolves.toBeUndefined();
  });
});

describe('openMigratedDb', () => {
  it('creates the folder for a local file and migrates it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agenda-api-'));
    try {
      const file = join(dir, 'nested', 'agenda.db').replace(/\\/g, '/');
      const db = await openMigratedDb(`file:${file}`);
      expect(existsSync(file)).toBe(true);
      expect(await createEventRepo(db).all()).toEqual([]);
      db.$client.close();
    } finally {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // On Windows the libSQL driver can keep the file locked after close(); the folder
        // is in the OS temp directory, so leaving it behind is harmless.
      }
    }
  });

  it('opens a non-file URL as is', async () => {
    const db = await openMigratedDb(':memory:');
    expect(await createEventRepo(db).all()).toEqual([]);
  });
});

describe('repo.insert', () => {
  const event = {
    id: '0190f5a2-0000-7000-8000-000000000042',
    title: 'Race',
    notes: '',
    start: '2026-10-24',
    end: null,
    allDay: true,
    timezone: 'UTC',
    location: null,
    color: 'blue' as const,
    reminders: [],
    rrule: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    deletedAt: null,
  };

  it('turns a duplicate id that slips past the check into a 409', async () => {
    const db = openDb(':memory:');
    await runMigrations(db);
    const repo = createEventRepo(db);
    await repo.insert(event);
    await expect(repo.insert(event)).rejects.toMatchObject({ status: 409, code: 'conflict' });
  });

  it('rethrows other database errors', async () => {
    const repo = createEventRepo(openDb(':memory:')); // no tables
    await expect(repo.insert(event)).rejects.not.toBeInstanceOf(ApiError);
  });
});

describe('loadEnv', () => {
  it('uses dev defaults', () => {
    expect(loadEnv({})).toEqual({ DATABASE_URL: 'file:./data/agenda.db', PORT: 4001 });
  });

  it('reads and validates values', () => {
    expect(loadEnv({ DATABASE_URL: 'file:/tmp/x.db', PORT: '8080' })).toEqual({
      DATABASE_URL: 'file:/tmp/x.db',
      PORT: 8080,
    });
    expect(() => loadEnv({ PORT: 'eighty' })).toThrow('Invalid environment');
  });
});

describe('seed data', () => {
  it('builds valid sample events around today, including one past midnight', async () => {
    const seed = buildSeedEvents(NOW, 'Asia/Karachi');
    expect(seed).toHaveLength(8);

    const db = openDb(':memory:');
    await runMigrations(db);
    const repo = createEventRepo(db);
    await repo.insertMany(seed);
    expect(await repo.all()).toHaveLength(8);

    // NOW is 23 Oct in Karachi; the standup and lunch are on that local day.
    const today = await repo.list({
      range: {
        from: new Date('2026-10-22T19:00:00.000Z'),
        to: new Date('2026-10-23T19:00:00.000Z'),
        timezone: 'Asia/Karachi',
      },
      limit: 50,
    });
    expect(today.events.map((event) => event.title)).toEqual(['Standup', 'Lunch with Sara']);

    const late = seed.find((event) => event.title === 'Late flight');
    // 23:30 to 01:30 in Karachi: the same UTC date, but two local days.
    const day = (iso: string | null | undefined) =>
      plainDateInTz(new Date(iso ?? ''), 'Asia/Karachi');
    expect(day(late?.end)).not.toBe(day(late?.start));
  });

  it('inserts nothing for an empty list', async () => {
    const db = openDb(':memory:');
    await runMigrations(db);
    const repo = createEventRepo(db);
    await repo.insertMany([]);
    expect(await repo.all()).toEqual([]);
  });
});
