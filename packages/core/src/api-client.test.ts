import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient, NetworkError } from './api-client.js';
import type { AuthStrategy } from './api-client.js';
import type { AbortSignalLike, ResponseLike } from './http.js';
import type { AgendaEvent } from './types.js';

const BASE = 'https://api.agenda.test';

const event: AgendaEvent = {
  id: '0190f5a2-0000-7000-8000-000000000001',
  title: 'Dentist',
  notes: '',
  start: '2026-10-24T11:00:00.000Z',
  end: null,
  allDay: false,
  timezone: 'Asia/Karachi',
  location: null,
  color: 'teal',
  reminders: [],
  rrule: null,
  createdAt: '2026-10-23T09:00:00.000Z',
  updatedAt: '2026-10-23T09:00:00.000Z',
  deletedAt: null,
};

const session = {
  id: '0190f5a2-0000-7000-8000-0000000000aa',
  label: 'app',
  createdAt: '2026-10-23T09:00:00.000Z',
  lastUsedAt: '2026-10-23T09:00:00.000Z',
  expiresAt: '2026-11-22T09:00:00.000Z',
};

interface Call {
  url: string;
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    credentials: string;
    signal: AbortSignalLike;
  };
}

function reply(
  status: number,
  body: unknown = '',
  contentType = 'application/json',
  extraHeaders: Record<string, string> = {},
): ResponseLike {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const headers = new Map(
    Object.entries({ 'content-type': contentType, ...extraHeaders }).map(([k, v]) => [
      k.toLowerCase(),
      v,
    ]),
  );
  return {
    status,
    headers: { get: (name) => headers.get(name.toLowerCase()) ?? null },
    text: () => Promise.resolve(text),
  };
}

/** A fetch that records each call and answers from a queue of responses. */
function fakeFetch(...responses: (ResponseLike | Error)[]) {
  const calls: Call[] = [];
  const fetch = vi.fn((url: string, init: Record<string, unknown>) => {
    calls.push({ url, init: init as unknown as Call['init'] });
    const next = responses.shift() ?? reply(200, {});
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
  return { fetch, calls };
}

const tokenAuth = (token: string | null = 'T'.repeat(43), onUnauthorized = vi.fn()) =>
  ({ kind: 'token', getToken: () => token, onUnauthorized }) satisfies AuthStrategy;

function client(responses: (ResponseLike | Error)[], auth: AuthStrategy = tokenAuth()) {
  const { fetch, calls } = fakeFetch(...responses);
  return { api: createApiClient({ baseUrl: `${BASE}/`, auth, fetch }), calls, fetch };
}

type Api = ReturnType<typeof client>['api'];

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('requests', () => {
  it.each<[string, (api: Api) => Promise<unknown>, string, string, unknown]>([
    ['me', (api) => api.auth.me(), 'GET', '/auth/me', { session }],
    ['sessions', (api) => api.auth.sessions(), 'GET', '/auth/sessions', { sessions: [] }],
    ['logout', (api) => api.auth.logout(), 'POST', '/auth/logout', null],
    [
      'revokeSession',
      (api) => api.auth.revokeSession('a/b'),
      'DELETE',
      '/auth/sessions/a%2Fb',
      null,
    ],
    [
      'revokeOtherSessions',
      (api) => api.auth.revokeOtherSessions(),
      'POST',
      '/auth/sessions/revoke-others',
      { revoked: 2 },
    ],
    [
      'settings.get',
      (api) => api.settings.get(),
      'GET',
      '/settings',
      { theme: 'dark', weekStart: 'sunday', timeFormat: '12h' },
    ],
    ['get', (api) => api.events.get(event.id), 'GET', `/events/${event.id}`, event],
    ['remove', (api) => api.events.remove(event.id), 'DELETE', `/events/${event.id}`, null],
    ['exportJson', (api) => api.events.exportJson(), 'GET', '/events/export.json', [event]],
    [
      'restore',
      (api) => api.events.restore(event.id),
      'POST',
      `/events/${event.id}/restore`,
      event,
    ],
  ])('%s sends %s %s', async (_name, run, method, path, body) => {
    const { api, calls } = client([body === null ? reply(204) : reply(200, body)]);
    await run(api);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${BASE}/api/v1${path}`);
    expect(calls[0]?.init.method).toBe(method);
    expect(calls[0]?.init.headers.Accept).toBe('application/json');
    expect(calls[0]?.init.body).toBeUndefined();
    expect(calls[0]?.init.headers['Content-Type']).toBeUndefined();
  });

  it('sends the settings as JSON with PUT, and returns the counts and values', async () => {
    const value = { theme: 'light', weekStart: 'monday', timeFormat: '24h' } as const;
    const { api, calls } = client([reply(200, value), reply(200, { revoked: 3 })]);
    expect(await api.settings.update(value)).toEqual(value);
    expect(await api.auth.revokeOtherSessions()).toBe(3);
    expect(calls[0]?.init.method).toBe('PUT');
    expect(JSON.parse(calls[0]?.init.body ?? '')).toEqual(value);
  });

  it('sends JSON bodies for create, update and import', async () => {
    const { api, calls } = client([
      reply(201, event),
      reply(200, event),
      reply(200, { imported: 1, skipped: [] }),
    ]);
    await api.events.create({ title: 'Dentist', start: event.start, timezone: 'Asia/Karachi' });
    await api.events.update(event.id, { color: 'red' });
    await api.events.importEvents([{ title: 'x', date: '2026-10-24' }], { tz: 'Asia/Karachi' });

    expect(calls.map((c) => [c.init.method, c.url.replace(BASE, '')])).toEqual([
      ['POST', '/api/v1/events'],
      ['PATCH', `/api/v1/events/${event.id}`],
      ['POST', '/api/v1/events/import?tz=Asia%2FKarachi'],
    ]);
    expect(calls.map((c) => c.init.headers['Content-Type'])).toEqual(
      Array(3).fill('application/json'),
    );
    expect(calls.map((c) => JSON.parse(c.init.body ?? '') as unknown)).toEqual([
      { title: 'Dentist', start: event.start, timezone: 'Asia/Karachi' },
      { color: 'red' },
      [{ title: 'x', date: '2026-10-24' }],
    ]);
  });

  it('encodes list queries and leaves out missing parameters', async () => {
    const { api, calls } = client([
      reply(200, { events: [], nextCursor: null }),
      reply(200, { events: [], nextCursor: null }),
    ]);
    await api.events.list({
      from: new Date('2026-10-23T19:00:00.000Z'),
      to: '2026-10-24T19:00:00+05:00',
      tz: 'Asia/Karachi',
      q: 'lunch & café + more',
      limit: 20,
      cursor: 'abc=',
    });
    await api.events.list();
    expect(calls[0]?.url).toBe(
      `${BASE}/api/v1/events?from=2026-10-23T19%3A00%3A00.000Z&to=2026-10-24T19%3A00%3A00%2B05%3A00` +
        '&tz=Asia%2FKarachi&q=lunch%20%26%20caf%C3%A9%20%2B%20more&limit=20&cursor=abc%3D',
    );
    expect(calls[1]?.url).toBe(`${BASE}/api/v1/events`);
  });

  it('asks for text/calendar and returns the .ics text', async () => {
    const ics = 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n';
    const { api, calls } = client([reply(200, ics, 'text/calendar; charset=utf-8')]);
    expect(await api.events.exportIcs()).toBe(ics);
    expect(calls[0]?.init.headers.Accept).toBe('text/calendar');
  });
});

describe('auth modes', () => {
  it('token mode sends the bearer token, omits cookies and logs in as "token"', async () => {
    const { api, calls } = client([reply(200, { token: 'N'.repeat(43), session })]);
    const result = await api.auth.login('secret password', { label: 'android' });
    expect(result).toEqual({ token: 'N'.repeat(43), session });
    expect(calls[0]?.init.credentials).toBe('omit');
    expect(calls[0]?.init.headers.Authorization).toBe(`Bearer ${'T'.repeat(43)}`);
    expect(JSON.parse(calls[0]?.init.body ?? '')).toEqual({
      password: 'secret password',
      client: 'token',
      label: 'android',
    });
  });

  it('token mode accepts an async getToken and sends no header without a token', async () => {
    const auth = { kind: 'token', getToken: () => Promise.resolve('A'.repeat(43)) } as const;
    const asyncClient = client([reply(200, { session })], auth);
    await asyncClient.api.auth.me();
    expect(asyncClient.calls[0]?.init.headers.Authorization).toBe(`Bearer ${'A'.repeat(43)}`);

    const anonymous = client([reply(200, { session })], tokenAuth(null));
    await anonymous.api.auth.me();
    expect(anonymous.calls[0]?.init.headers).not.toHaveProperty('Authorization');
  });

  it('cookie mode uses credentials: include, no Authorization, and logs in as "browser"', async () => {
    const { api, calls } = client([reply(200, { session })], { kind: 'cookie' });
    const result = await api.auth.login('secret password');
    expect(result).toEqual({ session });
    expect(calls[0]?.init.credentials).toBe('include');
    expect(calls[0]?.init.headers).not.toHaveProperty('Authorization');
    expect(JSON.parse(calls[0]?.init.body ?? '')).toEqual({
      password: 'secret password',
      client: 'browser',
    });
  });

  it('calls onUnauthorized when the session is gone, but not for a wrong password', async () => {
    const onUnauthorized = vi.fn();
    const { api } = client(
      [
        reply(401, { error: { code: 'invalid_credentials', message: 'Wrong password' } }),
        reply(401, { error: { code: 'unauthorized', message: 'Log in to continue' } }),
      ],
      tokenAuth('T'.repeat(43), onUnauthorized),
    );
    await expect(api.auth.login('nope')).rejects.toMatchObject({
      status: 401,
      code: 'invalid_credentials',
    });
    expect(onUnauthorized).not.toHaveBeenCalled();

    const error = await api.events.list().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledExactlyOnceWith(error);
  });

  it('cookie mode can be told about 401s too', async () => {
    const onUnauthorized = vi.fn();
    const { api } = client([reply(401, { error: { code: 'unauthorized', message: 'x' } })], {
      kind: 'cookie',
      onUnauthorized,
    });
    await expect(api.auth.me()).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});

describe('errors', () => {
  it('turns the API error shape into an ApiError with fields', async () => {
    const body = {
      error: {
        code: 'validation_failed',
        message: 'The event is invalid',
        fields: { title: ['Too small'] },
      },
    };
    const { api } = client([reply(422, body)]);
    const error = await api.events
      .create({ title: '', start: event.start, timezone: 'UTC' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: 'validation_failed',
      message: 'The event is invalid',
      fields: { title: ['Too small'] },
    });
  });

  it('reads Retry-After on a 429 as retryAfterSeconds', async () => {
    const body = { error: { code: 'rate_limited', message: 'Too many failed logins' } };
    const { api } = client([
      reply(429, body, 'application/json', { 'Retry-After': '840' }),
      reply(429, body, 'application/json', { 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' }),
      reply(429, body),
    ]);
    await expect(api.auth.login('x')).rejects.toMatchObject({
      status: 429,
      code: 'rate_limited',
      retryAfterSeconds: 840,
    });
    // Only whole seconds count; a date or a missing header leaves it undefined.
    const dated = await api.auth.login('x').catch((e: unknown) => e);
    expect((dated as ApiError).retryAfterSeconds).toBeUndefined();
    const missing = await api.auth.login('x').catch((e: unknown) => e);
    expect((missing as ApiError).retryAfterSeconds).toBeUndefined();
  });

  it('keeps codes it does not know yet', async () => {
    const { api } = client([reply(418, { error: { code: 'teapot', message: 'Short and stout' } })]);
    await expect(api.auth.me()).rejects.toMatchObject({ status: 418, code: 'teapot' });
  });

  it.each([
    [
      'a non-JSON error (e.g. a proxy page)',
      reply(502, '<html>Bad gateway</html>', 'text/html'),
      502,
    ],
    ['an error body of the wrong shape', reply(500, { message: 'flat' }), 500],
    ['a success that is not JSON', reply(200, 'OK', 'text/plain'), 200],
    ['a success of the wrong shape', reply(200, { events: 'nope' }), 200],
    [
      'an event missing a field',
      reply(200, { events: [{ ...event, title: undefined }], nextCursor: null }),
      200,
    ],
  ])('reports %s as invalid_response', async (_name, response, status) => {
    const { api } = client([response]);
    const error = await api.events.list().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status, code: 'invalid_response' });
    expect((error as ApiError).cause).toBeDefined();
  });

  it('requires an empty 204 where one is expected', async () => {
    const { api } = client([reply(200, { ok: true }), reply(204, 'surprise')]);
    await expect(api.events.remove(event.id)).rejects.toMatchObject({ code: 'invalid_response' });
    await expect(api.auth.logout()).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('rejects an .ics export that is not a calendar', async () => {
    const { api } = client([
      reply(200, 'BEGIN:VCALENDAR', 'text/plain'),
      reply(200, '<html>', 'text/calendar'),
    ]);
    await expect(api.events.exportIcs()).rejects.toMatchObject({ code: 'invalid_response' });
    await expect(api.events.exportIcs()).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('turns a fetch failure into NetworkError("network")', async () => {
    const offline = new TypeError('Failed to fetch');
    const { api } = client([offline]);
    const error = await api.auth.me().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NetworkError);
    expect(error).toMatchObject({
      kind: 'network',
      message: "Couldn't reach the server",
      cause: offline,
    });
  });
});

describe('timeouts and aborts', () => {
  /** A fetch that never answers on its own and rejects when its signal aborts. */
  function hangingFetch() {
    return vi.fn(
      (_url: string, init: Record<string, unknown>) =>
        new Promise<ResponseLike>((_resolve, reject) => {
          const signal = init.signal as AbortSignalLike;
          if (signal.aborted) {
            reject(new Error('already aborted'));
            return;
          }
          signal.addEventListener('abort', () => {
            reject(new Error('aborted by signal'));
          });
        }),
    );
  }

  it('times out after the default 15 seconds', async () => {
    vi.useFakeTimers();
    const api = createApiClient({ baseUrl: BASE, auth: tokenAuth(), fetch: hangingFetch() });
    const pending = api.auth.me().catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await pending).toMatchObject({
      name: 'NetworkError',
      kind: 'timeout',
      message: 'No response within 15000 ms',
    });
  });

  it('uses the client and per-call timeouts', async () => {
    vi.useFakeTimers();
    const api = createApiClient({
      baseUrl: BASE,
      auth: tokenAuth(),
      fetch: hangingFetch(),
      timeoutMs: 500,
    });
    const byClient = api.auth.me().catch((e: unknown) => e);
    const byCall = api.auth.me({ timeoutMs: 100 }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(100);
    expect(await byCall).toMatchObject({ kind: 'timeout', message: 'No response within 100 ms' });
    await vi.advanceTimersByTimeAsync(400);
    expect(await byClient).toMatchObject({ kind: 'timeout', message: 'No response within 500 ms' });
  });

  it('reports a caller abort during the request as NetworkError("aborted")', async () => {
    const controller = new AbortController();
    const fetch = hangingFetch();
    const api = createApiClient({ baseUrl: BASE, auth: tokenAuth(), fetch });
    const pending = api.events.list({}, { signal: controller.signal }).catch((e: unknown) => e);
    // Abort only once the request is really in flight.
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce();
    });
    controller.abort();
    expect(await pending).toMatchObject({ name: 'NetworkError', kind: 'aborted' });
  });

  it('does not call fetch at all when the signal is already aborted', async () => {
    const fetch = hangingFetch();
    const api = createApiClient({ baseUrl: BASE, auth: tokenAuth(), fetch });
    const controller = new AbortController();
    controller.abort();
    await expect(api.auth.me({ signal: controller.signal })).rejects.toMatchObject({
      kind: 'aborted',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('clears its timer once a response arrives', async () => {
    vi.useFakeTimers();
    const { api } = client([reply(200, { session })]);
    await api.auth.me();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('listAll', () => {
  const page = (titles: string[], nextCursor: string | null) =>
    reply(200, {
      events: titles.map((title, i) => ({
        ...event,
        id: `0190f5a2-0000-7000-8000-${String(i).padStart(12, '0')}`,
        title,
      })),
      nextCursor,
    });

  it('follows nextCursor until the last page, 200 per page by default', async () => {
    const { api, calls } = client([page(['a', 'b'], 'c1'), page(['c'], 'c2'), page([], null)]);
    const all = await api.events.listAll({ q: 'x' });
    expect(all.map((e) => e.title)).toEqual(['a', 'b', 'c']);
    expect(calls.map((c) => c.url.replace(`${BASE}/api/v1/events`, ''))).toEqual([
      '?q=x&limit=200',
      '?q=x&limit=200&cursor=c1',
      '?q=x&limit=200&cursor=c2',
    ]);
  });

  it('stops when the server repeats a cursor', async () => {
    const { api } = client([page(['a'], 'same'), page(['b'], 'same')]);
    await expect(api.events.listAll()).rejects.toMatchObject({
      code: 'invalid_response',
      message: 'The API repeated a page cursor',
    });
  });

  it('gives up after 1000 pages', async () => {
    let n = 0;
    const fetch = vi.fn(() =>
      Promise.resolve(reply(200, { events: [], nextCursor: `c${String(n++)}` })),
    );
    const api = createApiClient({ baseUrl: BASE, auth: tokenAuth(), fetch });
    await expect(api.events.listAll()).rejects.toMatchObject({
      message: 'Stopped after 1000 pages',
    });
    expect(fetch).toHaveBeenCalledTimes(1000);
  });
});

describe('fetch injection', () => {
  it('uses the global fetch by default, called with globalThis as `this`', async () => {
    const seen: unknown[] = [];
    vi.stubGlobal('fetch', function (this: unknown) {
      seen.push(this);
      return Promise.resolve(reply(200, { session }));
    });
    const api = createApiClient({ baseUrl: BASE, auth: tokenAuth() });
    await api.auth.me();
    expect(seen).toEqual([globalThis]);
  });

  it('explains what to do when there is no global fetch', () => {
    vi.stubGlobal('fetch', undefined);
    expect(() => createApiClient({ baseUrl: BASE, auth: tokenAuth() })).toThrow(
      'No global fetch here; pass `fetch` to createApiClient',
    );
  });
});
