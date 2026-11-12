import { DEFAULT_SETTINGS } from '@agenda/core';
import type { AgendaEvent, EventRepository, Settings } from '@agenda/core';
import { render } from '@testing-library/react-native';
import { enGB } from 'date-fns/locale';
import type { ReactElement } from 'react';
import type { MobileApi } from '../api';
import type { AppContextValue } from '../context';
import { AppProviders, createQueryClient } from '../providers';
import { secureTokens } from '../storage';

/** Monday 2 November 2026, 10:00 in Karachi (UTC+5). */
export const NOW = new Date('2026-11-02T05:00:00.000Z');
export const TEST_ENV = { timezone: 'Asia/Karachi', locale: enGB, now: () => NOW };

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

export const SESSION = {
  id: '0190f5a2-0000-7000-8000-0000000000aa',
  label: 'Android phone',
  createdAt: '2026-11-01T05:00:00.000Z',
  lastUsedAt: '2026-11-01T05:00:00.000Z',
  expiresAt: '2026-12-01T05:00:00.000Z',
};

/**
 * An in-memory repository with the API's overlap rule kept simple (same day or range),
 * and an API whose methods are jest.fn: what screens see, without a network.
 */
export function fakeBackend(initial: AgendaEvent[] = []) {
  const store = [...initial];
  let settings: Settings = DEFAULT_SETTINGS;
  const byId = (id: string): AgendaEvent => {
    const found = store.find((e) => e.id === id);
    if (found === undefined) throw new Error(`fakeBackend: no event ${id}`);
    return found;
  };
  const events: jest.Mocked<EventRepository> = {
    listRange: jest.fn<
      ReturnType<EventRepository['listRange']>,
      Parameters<EventRepository['listRange']>
    >((range) =>
      Promise.resolve(
        store.filter((e) => {
          if (e.deletedAt !== null) return false;
          const start = Date.parse(e.allDay ? `${e.start}T00:00:00Z` : e.start);
          return start < range.end.getTime() && start >= range.start.getTime() - 86_400_000;
        }),
      ),
    ),
    search: jest.fn<ReturnType<EventRepository['search']>, Parameters<EventRepository['search']>>(
      (q) =>
        Promise.resolve(
          store.filter(
            (e) => e.deletedAt === null && e.title.toLowerCase().includes(q.toLowerCase()),
          ),
        ),
    ),
    get: jest.fn<ReturnType<EventRepository['get']>, Parameters<EventRepository['get']>>((id) =>
      Promise.resolve(byId(id)),
    ),
    create: jest.fn<ReturnType<EventRepository['create']>, Parameters<EventRepository['create']>>(
      (input) => {
        const created = event({ ...(input as Partial<AgendaEvent>), id: input.id ?? 'new' });
        store.push(created);
        return Promise.resolve(created);
      },
    ),
    update: jest.fn<ReturnType<EventRepository['update']>, Parameters<EventRepository['update']>>(
      (id, patch) => {
        const updated = Object.assign(byId(id), patch);
        return Promise.resolve(updated);
      },
    ),
    remove: jest.fn<ReturnType<EventRepository['remove']>, Parameters<EventRepository['remove']>>(
      (id) => {
        byId(id).deletedAt = NOW.toISOString();
        return Promise.resolve();
      },
    ),
    restore: jest.fn<
      ReturnType<EventRepository['restore']>,
      Parameters<EventRepository['restore']>
    >((id) => {
      const found = byId(id);
      found.deletedAt = null;
      return Promise.resolve(found);
    }),
  };
  const api = {
    auth: {
      me: jest.fn(() => Promise.resolve(SESSION)),
      login: jest.fn(() => Promise.resolve({ token: 'a'.repeat(43), session: SESSION })),
      logout: jest.fn(() => Promise.resolve()),
      sessions: jest.fn(() =>
        Promise.resolve([
          { ...SESSION, current: true },
          { ...SESSION, id: 'other', label: 'Chrome on Windows', current: false },
        ]),
      ),
      revokeOtherSessions: jest.fn(() => Promise.resolve({ revoked: 1 })),
    },
    settings: {
      get: jest.fn(() => Promise.resolve(settings)),
      update: jest.fn((next: Settings) => {
        settings = next;
        return Promise.resolve(next);
      }),
    },
  };
  return { store, events, api };
}

export type FakeBackend = ReturnType<typeof fakeBackend>;

/** A screen inside the real providers, with the fake backend and a fixed clock. */
export async function renderScreen(
  screen: ReactElement,
  {
    backend = fakeBackend(),
    changeServer = jest.fn(() => Promise.resolve()),
    serverUrl = 'http://192.168.1.20:4001',
  } = {},
) {
  const queryClient = createQueryClient();
  // No retries (fail fast) and no garbage-collection timers left running after a test.
  queryClient.setDefaultOptions({ queries: { retry: false, staleTime: 30_000, gcTime: Infinity } });
  const value: AppContextValue = {
    api: backend.api as unknown as MobileApi,
    events: backend.events,
    tokens: secureTokens,
    env: TEST_ENV,
    serverUrl,
    changeServer,
  };
  const view = await render(
    <AppProviders value={value} queryClient={queryClient}>
      {screen}
    </AppProviders>,
  );
  return { ...view, backend, queryClient, changeServer };
}
