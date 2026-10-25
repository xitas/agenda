import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plainDateInTz } from '@agenda/core';
import { sql } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { openMigratedDb } from '../src/db/open.js';
import { buildSeedEvents } from '../src/db/seed-data.js';
import { loadDbEnv, loadServerEnv } from '../src/env.js';
import { ApiError } from '../src/errors.js';
import { createEventRepo } from '../src/events/repo.js';
import { makeTestApp, NOW, PASSWORD, testAuthConfig } from './helpers.js';
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
    const { request, login, db } = await makeTestApp();
    const token = await login();
    // Break the database after logging in, so the events query itself fails.
    await db.run(sql`DROP TABLE events`);
    const res: ErrorResponse = await request('GET', '/events', undefined, { auth: token });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'internal', message: 'Something went wrong' } });
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it('logs requests without passwords or tokens, using the real clock by default', async () => {
    const logged: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(' '));
    });
    const db = openDb(':memory:');
    await runMigrations(db);
    const app = createApp({ db, auth: await testAuthConfig(), logRequests: true });
    const json = { 'Content-Type': 'application/json' };

    const login = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ password: PASSWORD, client: 'token' }),
    });
    const { token } = (await login.json()) as { token: string };
    const auth = { ...json, Authorization: `Bearer ${token}` };
    const created = await app.request('/api/v1/events', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ title: 'Now', start: '2026-10-24', allDay: true, timezone: 'UTC' }),
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as { createdAt: string };
    expect(Math.abs(Date.parse(body.createdAt) - Date.now())).toBeLessThan(60_000);
    await app.request('/api/v1/auth/logout', { method: 'POST', headers: auth });

    expect(logged.length).toBeGreaterThanOrEqual(6); // incoming + outgoing line per request
    const output = logged.join('\n');
    expect(output).toContain('POST /api/v1/auth/login');
    expect(output).not.toContain(PASSWORD);
    expect(output).not.toContain(token);
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

describe('environment', () => {
  it('needs only DATABASE_URL for the database scripts', () => {
    expect(loadDbEnv({})).toEqual({ DATABASE_URL: 'file:./data/agenda.db' });
  });

  it('reads and validates the server settings, secure by default', async () => {
    const hash = (await testAuthConfig()).passwordHash;
    expect(loadServerEnv({ AGENDA_PASSWORD_HASH: hash })).toEqual({
      DATABASE_URL: 'file:./data/agenda.db',
      PORT: 4001,
      NODE_ENV: 'production',
      AGENDA_PASSWORD_HASH: hash,
      CORS_ORIGINS: [],
    });
    expect(
      loadServerEnv({
        AGENDA_PASSWORD_HASH: hash,
        PORT: '8080',
        NODE_ENV: 'development',
        CORS_ORIGINS: ' http://localhost:5173 , https://agenda.example ',
      }),
    ).toMatchObject({
      PORT: 8080,
      NODE_ENV: 'development',
      CORS_ORIGINS: ['http://localhost:5173', 'https://agenda.example'],
    });
  });

  it.each([
    ['a missing hash', () => ({}), 'AGENDA_PASSWORD_HASH is not set'],
    ['an empty hash', () => ({ AGENDA_PASSWORD_HASH: '' }), 'AGENDA_PASSWORD_HASH is not set'],
    ['a plain-text password', () => ({ AGENDA_PASSWORD_HASH: 'hunter2' }), 'is not a valid hash'],
    ['a bad port', (hash: string) => ({ AGENDA_PASSWORD_HASH: hash, PORT: 'eighty' }), 'PORT'],
    [
      'an origin with a path',
      (hash: string) => ({
        AGENDA_PASSWORD_HASH: hash,
        CORS_ORIGINS: 'https://agenda.example/app',
      }),
      'Expected an origin',
    ],
  ])('rejects %s', async (_name, source: (hash: string) => Record<string, string>, message) => {
    const hash = (await testAuthConfig()).passwordHash;
    expect(() => loadServerEnv(source(hash))).toThrow(message);
  });
});

describe('server startup', () => {
  const entry = fileURLToPath(new URL('../src/index.ts', import.meta.url));

  it('refuses to start without AGENDA_PASSWORD_HASH and says how to fix it', () => {
    const env: Record<string, string> = {};
    for (const key of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP']) {
      const value = process.env[key];
      if (value !== undefined) env[key] = value;
    }
    const result = spawnSync(process.execPath, ['--import', 'tsx', entry], {
      env: { ...env, DATABASE_URL: ':memory:' },
      encoding: 'utf8',
      timeout: 20_000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('AGENDA_PASSWORD_HASH is not set');
    expect(result.stderr).toContain('hash-password');
    expect(result.stdout).not.toContain('listening');
  }, 30_000);
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
