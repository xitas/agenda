import type { AgendaEvent, EventCreateInput } from '@agenda/core';
import { createApp } from '../src/app.js';
import type { AuthConfig } from '../src/app.js';
import { hashPassword } from '../src/auth/password.js';
import { openDb } from '../src/db/client.js';
import type { Db } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import type { ErrorBody } from '../src/errors.js';

/** Friday 23 October 2026, 14:00 in Karachi. */
export const NOW = new Date('2026-10-23T09:00:00.000Z');
export const PASSWORD = 'correct horse battery staple';
export const WEB_ORIGIN = 'http://localhost:5173';
export const CLIENT_IP = '203.0.113.7';

// Hashing once with cheap parameters keeps the suite fast; the format records them.
const passwordHash = hashPassword(PASSWORD, { logN: 10, r: 8, p: 1 });

export async function testAuthConfig(overrides: Partial<AuthConfig> = {}): Promise<AuthConfig> {
  return {
    passwordHash: await passwordHash,
    corsOrigins: [WEB_ORIGIN],
    secureCookies: true,
    ...overrides,
  };
}

export interface TestResponse<T = unknown> {
  status: number;
  headers: Headers;
  body: T;
  text: string;
}

export interface RequestOptions {
  /** Send the default bearer token (true), none (false), or a specific token. */
  auth?: boolean | string;
  headers?: Record<string, string>;
}

export interface MakeTestAppOptions {
  migrate?: boolean;
  auth?: Partial<AuthConfig>;
}

export async function makeTestApp({ migrate = true, auth = {} }: MakeTestAppOptions = {}) {
  const db: Db = openDb(':memory:');
  if (migrate) await runMigrations(db);
  let clock = NOW;
  let ip = CLIENT_IP;
  const app = createApp({
    db,
    auth: await testAuthConfig(auth),
    now: () => clock,
    clientIp: () => ip,
  });
  /** Moves the fixed clock, e.g. to check that a PATCH bumps updatedAt. */
  const setNow = (date: Date) => {
    clock = date;
  };
  const setIp = (value: string) => {
    ip = value;
  };

  let defaultToken: string | undefined;

  async function request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<TestResponse<T>> {
    const headers: Record<string, string> = { ...options.headers };
    const auth = options.auth ?? true;
    if (auth !== false) {
      const token = typeof auth === 'string' ? auth : await getDefaultToken();
      headers.Authorization = `Bearer ${token}`;
    }
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    const res = await app.request(`/api/v1${path}`, init);
    const text = await res.text();
    const json: unknown =
      text !== '' && res.headers.get('Content-Type')?.includes('json') ? JSON.parse(text) : null;
    return { status: res.status, headers: res.headers, body: json as T, text };
  }

  /** Logs in with client: 'token' and returns the bearer token. */
  async function login(label?: string): Promise<string> {
    const res = await request<{ token: string }>(
      'POST',
      '/auth/login',
      { password: PASSWORD, client: 'token', ...(label === undefined ? {} : { label }) },
      { auth: false },
    );
    if (res.status !== 200) throw new Error(`login failed: ${String(res.status)} ${res.text}`);
    return res.body.token;
  }

  async function getDefaultToken(): Promise<string> {
    defaultToken ??= await login('tests');
    return defaultToken;
  }

  async function create(input: EventCreateInput): Promise<AgendaEvent> {
    const res = await request<AgendaEvent>('POST', '/events', input);
    if (res.status !== 201) throw new Error(`create failed: ${String(res.status)} ${res.text}`);
    return res.body;
  }

  return { app, db, request, create, login, setNow, setIp };
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
