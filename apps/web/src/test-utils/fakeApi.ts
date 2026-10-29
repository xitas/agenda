import { ApiError, DEFAULT_SETTINGS } from '@agenda/core';
import type { AgendaEvent, Session } from '@agenda/core';
import { vi } from 'vitest';
import type { WebApi } from '../app/api';

type Fn = (...args: never[]) => unknown;
type Mocked<T> = { [K in keyof T]: T[K] extends Fn ? ReturnType<typeof vi.fn<T[K]>> : never };

export interface FakeApi {
  api: WebApi;
  auth: Mocked<WebApi['auth']>;
  events: Mocked<WebApi['events']>;
  settings: Mocked<WebApi['settings']>;
}

export const SESSION: Session = {
  id: '0190f5a2-0000-7000-8000-0000000000aa',
  label: 'web',
  createdAt: '2026-10-27T05:00:00.000Z',
  lastUsedAt: '2026-10-27T05:00:00.000Z',
  expiresAt: '2026-11-26T05:00:00.000Z',
};

export const unauthorized = () => new ApiError(401, 'unauthorized', 'Log in to continue');

const notMocked = (name: string) => () => Promise.reject(new Error(`fakeApi: ${name} not mocked`));

/**
 * A client whose every method is a vi.fn. Like the real client, a 401 "unauthorized"
 * from any method calls onUnauthorized before the error reaches the caller.
 * By default the user is logged in and there are no events.
 */
export function fakeApi(onUnauthorized: () => void = () => undefined): FakeApi {
  const auth = {
    login: vi.fn<WebApi['auth']['login']>(notMocked('auth.login')),
    logout: vi.fn<WebApi['auth']['logout']>(() => Promise.resolve()),
    me: vi.fn<WebApi['auth']['me']>(() => Promise.resolve(SESSION)),
    sessions: vi.fn<WebApi['auth']['sessions']>(notMocked('auth.sessions')),
    revokeSession: vi.fn<WebApi['auth']['revokeSession']>(notMocked('auth.revokeSession')),
    revokeOtherSessions: vi.fn<WebApi['auth']['revokeOtherSessions']>(
      notMocked('auth.revokeOtherSessions'),
    ),
  };
  // Settings start at the defaults and are remembered when saved, like the API.
  let savedSettings = DEFAULT_SETTINGS;
  const settings = {
    get: vi.fn<WebApi['settings']['get']>(() => Promise.resolve(savedSettings)),
    update: vi.fn<WebApi['settings']['update']>((value) => {
      savedSettings = value;
      return Promise.resolve(value);
    }),
  };
  const events = {
    list: vi.fn<WebApi['events']['list']>(notMocked('events.list')),
    listAll: vi.fn<WebApi['events']['listAll']>(() => Promise.resolve([] as AgendaEvent[])),
    get: vi.fn<WebApi['events']['get']>(notMocked('events.get')),
    create: vi.fn<WebApi['events']['create']>(notMocked('events.create')),
    update: vi.fn<WebApi['events']['update']>(notMocked('events.update')),
    remove: vi.fn<WebApi['events']['remove']>(() => Promise.resolve()),
    restore: vi.fn<WebApi['events']['restore']>(notMocked('events.restore')),
    importEvents: vi.fn<WebApi['events']['importEvents']>(notMocked('events.importEvents')),
    exportJson: vi.fn<WebApi['events']['exportJson']>(notMocked('events.exportJson')),
    exportIcs: vi.fn<WebApi['events']['exportIcs']>(notMocked('events.exportIcs')),
  };

  const guard =
    <F extends Fn>(fn: F) =>
    async (...args: Parameters<F>) => {
      try {
        return (await fn(...args)) as Awaited<ReturnType<F>>;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401 && error.code === 'unauthorized') {
          onUnauthorized();
        }
        throw error;
      }
    };
  const wrapAll = <T extends Record<string, Fn>>(group: T) =>
    Object.fromEntries(
      Object.entries(group).map(([name, fn]) => [name, guard(fn)]),
    ) as unknown as T;

  // The wrapped methods have the client's exact signatures; the cast only restores the
  // names that Object.fromEntries loses.
  const api = {
    auth: wrapAll(auth),
    events: wrapAll(events),
    settings: wrapAll(settings),
  } as unknown as WebApi;
  return { api, auth, events, settings };
}
