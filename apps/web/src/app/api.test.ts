import type { TokenStore } from '@agenda/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppApi } from './api';

const SESSION = {
  id: '0190f5a2-0000-7000-8000-0000000000aa',
  label: 'Desktop app on Windows',
  createdAt: '2026-10-27T05:00:00.000Z',
  lastUsedAt: '2026-10-27T05:00:00.000Z',
  expiresAt: '2026-11-26T05:00:00.000Z',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function stubFetch(response: () => Response) {
  const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(response()));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function memoryTokens(initial: string | null): TokenStore & { value: string | null } {
  const store = {
    value: initial,
    get: vi.fn(() => Promise.resolve(store.value)),
    set: vi.fn((token: string) => {
      store.value = token;
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      store.value = null;
      return Promise.resolve();
    }),
  };
  return store;
}

const TOKEN = 'a'.repeat(43);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createAppApi', () => {
  it('uses the cookie on the same origin in the browser', async () => {
    const fetch = stubFetch(() => json(200, { session: SESSION }));
    const api = createAppApi({ auth: { kind: 'cookie' }, apiBaseUrl: '' }, () => undefined);
    await api.auth.me();
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('/api/v1/auth/me');
    expect(init?.credentials).toBe('include');
    expect(new Headers(init?.headers).has('Authorization')).toBe(false);
  });

  it('sends the stored token to the configured server in the desktop app', async () => {
    const fetch = stubFetch(() => json(200, { session: SESSION }));
    const tokens = memoryTokens(TOKEN);
    const api = createAppApi(
      { auth: { kind: 'token', tokens }, apiBaseUrl: 'http://localhost:4001' },
      () => undefined,
    );
    await api.auth.me();
    const [url, init] = fetch.mock.calls[0] ?? [];
    // An absolute URL: no dev proxy between the app and the API.
    expect(url).toBe('http://localhost:4001/api/v1/auth/me');
    expect(init?.credentials).toBe('omit');
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${TOKEN}`);
  });

  it('logs in as a token client, which returns the token to store', async () => {
    const fetch = stubFetch(() => json(200, { token: TOKEN, session: SESSION }));
    const api = createAppApi(
      { auth: { kind: 'token', tokens: memoryTokens(null) }, apiBaseUrl: 'http://localhost:4001' },
      () => undefined,
    );
    const result = await api.auth.login('secret', { label: 'Desktop app on Windows' });
    expect(result).toEqual({ token: TOKEN, session: SESSION });
    const body = JSON.parse(fetch.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>;
    expect(body).toEqual({ password: 'secret', client: 'token', label: 'Desktop app on Windows' });
  });

  it('forgets the token and goes to login on a 401', async () => {
    stubFetch(() => json(401, { error: { code: 'unauthorized', message: 'Log in to continue' } }));
    const tokens = memoryTokens(TOKEN);
    const onUnauthorized = vi.fn();
    const api = createAppApi(
      { auth: { kind: 'token', tokens }, apiBaseUrl: 'http://localhost:4001' },
      onUnauthorized,
    );
    await expect(api.auth.me()).rejects.toMatchObject({ status: 401 });
    expect(tokens.clear).toHaveBeenCalledOnce();
    expect(tokens.value).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
