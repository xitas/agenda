import { DEFAULT_SETTINGS, eventOverlapsRange } from '@agenda/core';
import type { AgendaEvent, Settings } from '@agenda/core';
import { enGB } from 'date-fns/locale';
import { vi } from 'vitest';

/** Monday 2 November 2026, 10:00 in Karachi (UTC+5). */
export const NOW = new Date('2026-11-02T05:00:00.000Z');
export const TOKEN = 'a'.repeat(43);

export const TEST_ENV = {
  timezone: 'Asia/Karachi',
  locale: enGB,
  now: () => NOW,
};

export const SESSION = {
  id: '0190f5a2-0000-7000-8000-0000000000aa',
  label: 'Chrome extension',
  createdAt: '2026-11-01T05:00:00.000Z',
  lastUsedAt: '2026-11-01T05:00:00.000Z',
  expiresAt: '2026-12-01T05:00:00.000Z',
};

let nextId = 0;
export function event(overrides: Partial<AgendaEvent> = {}): AgendaEvent {
  return {
    id: `0190f5a2-0000-7000-8000-${String(++nextId).padStart(12, '0')}`,
    title: 'Dentist',
    notes: '',
    // 16:00 – 17:00 in Karachi.
    start: '2026-11-02T11:00:00.000Z',
    end: '2026-11-02T12:00:00.000Z',
    allDay: false,
    timezone: 'Asia/Karachi',
    location: null,
    color: 'teal',
    reminders: [],
    rrule: null,
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

export interface FakeServer {
  events: AgendaEvent[];
  settings: Settings;
  /** Every request: method and path with query. */
  requests: { method: string; url: string; authorization: string | null }[];
  /** null: answer normally; a status: answer every request with it; 'down': no answer. */
  failWith: number | 'down' | null;
  password: string;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * A tiny Agenda API behind the global fetch, enough for the extension: login, me, the
 * event list (with the API's overlap rule), create, and settings.
 */
export function fakeServer(initial: Partial<FakeServer> = {}): FakeServer {
  const server: FakeServer = {
    events: [],
    settings: DEFAULT_SETTINGS,
    requests: [],
    failWith: null,
    password: 'secret',
    ...initial,
  };
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init: RequestInit = {}) => {
      const url = new URL(input);
      const method = init.method ?? 'GET';
      const headers = new Headers(init.headers);
      server.requests.push({
        method,
        url: `${url.origin}${url.pathname}${url.search}`,
        authorization: headers.get('Authorization'),
      });
      if (server.failWith === 'down') throw new TypeError('Failed to fetch');
      if (server.failWith !== null) {
        return json(server.failWith, {
          error: { code: 'unauthorized', message: 'Log in to continue' },
        });
      }
      const path = url.pathname.replace('/api/v1', '');
      if (path === '/auth/login') {
        const body = JSON.parse(init.body as string) as { password: string };
        if (body.password !== server.password) {
          return json(401, { error: { code: 'invalid_credentials', message: 'Wrong password' } });
        }
        return json(200, { token: TOKEN, session: SESSION });
      }
      if (headers.get('Authorization') !== `Bearer ${TOKEN}`) {
        return json(401, { error: { code: 'unauthorized', message: 'Log in to continue' } });
      }
      if (path === '/auth/me') return json(200, { session: SESSION });
      if (path === '/auth/logout') return new Response(null, { status: 204 });
      if (path === '/settings') return json(200, server.settings);
      if (path === '/events' && method === 'GET') {
        const from = new Date(url.searchParams.get('from') ?? 0);
        const to = new Date(url.searchParams.get('to') ?? 0);
        const tz = url.searchParams.get('tz') ?? 'UTC';
        const events = server.events.filter(
          (e) => e.deletedAt === null && eventOverlapsRange(e, { start: from, end: to }, tz),
        );
        return json(200, { events, nextCursor: null });
      }
      if (path === '/events' && method === 'POST') {
        const input = JSON.parse(init.body as string) as AgendaEvent;
        const created = event({
          ...input,
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
        });
        server.events.push(created);
        return json(201, created);
      }
      return json(404, { error: { code: 'not_found', message: 'Not found' } });
    }),
  );
  return server;
}
