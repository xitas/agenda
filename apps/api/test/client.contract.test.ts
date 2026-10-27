// Contract test: the real API (createApp with an in-memory database) driven through the
// real client from @agenda/core. app.request stands in for the network, so no port is
// opened, but routing, validation, serialisation and error shapes are all the real ones.
import { readFileSync } from 'node:fs';
import { ApiError, createApiClient } from '@agenda/core';
import type { ApiClient, FetchLike } from '@agenda/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { makeTestApp, PASSWORD, WEB_ORIGIN } from './helpers.js';

const BASE = 'http://agenda.test';
type App = Awaited<ReturnType<typeof makeTestApp>>['app'];

const v0Export: unknown = JSON.parse(
  readFileSync(new URL('./fixtures/AgendaData.v0.built.json', import.meta.url), 'utf8'),
);

/** Hono's in-process request function, shaped like fetch. */
function appFetch(app: App): FetchLike {
  return async (url, init) => app.request(url, init);
}

/** Plays the browser for cookie mode: keeps the cookie and adds the Origin header. */
function browserFetch(app: App): FetchLike {
  let cookie: string | undefined;
  return async (url, init) => {
    const headers = {
      ...(init.headers as Record<string, string>),
      Origin: WEB_ORIGIN,
      ...(cookie === undefined ? {} : { Cookie: cookie }),
    };
    const res = await app.request(url, { ...init, headers });
    const set = res.headers.get('Set-Cookie');
    if (set !== null) {
      const pair = set.split(';')[0] ?? '';
      cookie = pair.endsWith('=') ? undefined : pair; // Max-Age=0 clears it
    }
    return res;
  };
}

// Every client method the tests call, to prove the contract covers the whole client.
const called = new Set<string>();
const exposed = new Set<string>();

function tracked<C extends ApiClient>(client: C): C {
  for (const group of ['auth', 'events'] as const) {
    for (const name of Object.keys(client[group])) exposed.add(`${group}.${name}`);
  }
  const wrap = <T extends object>(group: string, target: T): T =>
    new Proxy(target, {
      get(object, name, receiver) {
        if (typeof name === 'string') called.add(`${group}.${name}`);
        return Reflect.get(object, name, receiver) as unknown;
      },
    });
  return { ...client, auth: wrap('auth', client.auth), events: wrap('events', client.events) };
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe('API client against the real API (token mode)', () => {
  it('logs in, runs a full event lifecycle, imports, exports and manages sessions', async () => {
    const { app } = await makeTestApp();
    let token: string | null = null;
    const onUnauthorized = vi.fn();
    const api = tracked(
      createApiClient({
        baseUrl: BASE,
        auth: { kind: 'token', getToken: () => token, onUnauthorized },
        fetch: appFetch(app),
      }),
    );

    // Auth
    const wrong = await rejection(api.auth.login('not the password'));
    expect(wrong).toMatchObject({ status: 401, code: 'invalid_credentials' });
    expect(onUnauthorized).not.toHaveBeenCalled();

    const login = await api.auth.login(PASSWORD, { label: 'contract' });
    token = login.token;
    expect(login.session.label).toBe('contract');
    expect((await api.auth.me()).id).toBe(login.session.id);
    expect(await api.auth.sessions()).toEqual([{ ...login.session, current: true }]);

    // Create (timed, multi-day all-day, client id) and the 409 conflict
    const dentist = await api.events.create({
      title: 'Dentist',
      start: '2026-10-24T11:00:00Z',
      end: '2026-10-24T12:00:00Z',
      timezone: 'Asia/Karachi',
      reminders: [30],
    });
    expect(dentist.start).toBe('2026-10-24T11:00:00.000Z');
    const trip = await api.events.create({
      title: 'Trip',
      start: '2026-10-24',
      end: '2026-10-27',
      allDay: true,
      timezone: 'Asia/Karachi',
    });
    const lunchInput = {
      id: '0190f5a2-7c3e-7b1a-9d4e-1a2b3c4d5e6f',
      title: 'Lunch with Sara',
      start: '2026-10-25T08:00:00.000Z',
      timezone: 'Asia/Karachi',
    };
    const lunch = await api.events.create(lunchInput);
    expect(lunch.id).toBe(lunchInput.id);
    expect(await rejection(api.events.create(lunchInput))).toMatchObject({
      status: 409,
      code: 'conflict',
    });

    // Read and update, including a PATCH that breaks the timing rules
    expect(await api.events.get(dentist.id)).toEqual(dentist);
    const red = await api.events.update(dentist.id, { color: 'red', notes: 'Bring the form' });
    expect(red).toMatchObject({ color: 'red', notes: 'Bring the form' });
    const badPatch = await rejection(
      api.events.update(dentist.id, { start: '2026-10-24T13:00:00Z' }),
    );
    expect(badPatch).toMatchObject({
      status: 422,
      code: 'validation_failed',
      fields: { end: ['End must be after start'] },
    });

    // List: Karachi day of the 24th, search, paging and listAll
    const day = await api.events.list({
      from: new Date('2026-10-23T19:00:00.000Z'),
      to: new Date('2026-10-24T19:00:00.000Z'),
      tz: 'Asia/Karachi',
    });
    expect(day.events.map((e) => e.title).sort()).toEqual(['Dentist', 'Trip']);
    expect((await api.events.list({ q: 'sara' })).events.map((e) => e.id)).toEqual([lunch.id]);
    const first = await api.events.list({ limit: 2 });
    expect(first.events).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const rest = await api.events.list({ limit: 2, cursor: first.nextCursor ?? '' });
    expect(rest.nextCursor).toBeNull();
    expect((await api.events.listAll({ limit: 1 })).map((e) => e.title)).toEqual(
      [...first.events, ...rest.events].map((e) => e.title),
    );
    const missingTz = await rejection(
      api.events.list({ from: '2026-10-23T19:00:00Z', to: '2026-10-24T19:00:00Z' }),
    );
    expect(missingTz).toMatchObject({
      status: 400,
      code: 'invalid_query',
      fields: { tz: expect.any(Array) as unknown },
    });

    // Remove (soft delete), then 404
    await api.events.remove(trip.id);
    expect(await rejection(api.events.get(trip.id))).toMatchObject({
      status: 404,
      code: 'not_found',
    });

    // Undo the delete; a second restore finds nothing deleted. Then delete it again.
    const restored = await api.events.restore(trip.id);
    expect(restored).toMatchObject({ id: trip.id, title: 'Trip', deletedAt: null });
    expect((await api.events.get(trip.id)).id).toBe(trip.id);
    expect(await rejection(api.events.restore(trip.id))).toMatchObject({
      status: 404,
      code: 'not_found',
    });
    await api.events.remove(trip.id);

    // Import twice (the second changes nothing), then export
    expect(await api.events.importEvents(v0Export, { tz: 'Asia/Karachi' })).toEqual({
      imported: 5,
      skipped: [],
    });
    const again = await api.events.importEvents(v0Export, { tz: 'Asia/Karachi' });
    expect(again.imported).toBe(0);
    expect(again.skipped.map((row) => row.reason)).toEqual(Array(5).fill('Already exists'));

    const exported = await api.events.exportJson();
    expect(exported).toHaveLength(7); // dentist, lunch and the 5 imported
    expect(exported.find((e) => e.id === dentist.id)).toEqual(red);
    const ics = await api.events.exportIcs();
    expect(ics.split('\r\n').filter((line) => line === 'BEGIN:VEVENT')).toHaveLength(7);
    expect(ics).toContain('TRIGGER:-PT30M'); // the dentist reminder
    expect(ics).toContain('DTSTART;VALUE=DATE:20220610'); // an imported v0 all-day event

    // A second device, revoked from this one
    let phoneToken: string | null = null;
    const phoneUnauthorized = vi.fn();
    const phone = tracked(
      createApiClient({
        baseUrl: BASE,
        auth: { kind: 'token', getToken: () => phoneToken, onUnauthorized: phoneUnauthorized },
        fetch: appFetch(app),
      }),
    );
    const phoneLogin = await phone.auth.login(PASSWORD, { label: 'android' });
    phoneToken = phoneLogin.token;
    expect((await api.auth.sessions()).map((s) => [s.label, s.current])).toEqual([
      ['contract', true],
      ['android', false],
    ]);
    await api.auth.revokeSession(phoneLogin.session.id);
    expect(await rejection(phone.auth.me())).toMatchObject({ status: 401, code: 'unauthorized' });
    expect(phoneUnauthorized).toHaveBeenCalledOnce();
    expect(await rejection(api.auth.revokeSession(phoneLogin.session.id))).toMatchObject({
      status: 404,
    });

    // Log out: the token stops working and onUnauthorized fires
    await api.auth.logout();
    expect(await rejection(api.events.list())).toMatchObject({ status: 401, code: 'unauthorized' });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});

describe('API client against the real API (cookie mode)', () => {
  it('logs in as a browser, writes with the cookie and logs out', async () => {
    const { app } = await makeTestApp();
    const onUnauthorized = vi.fn();
    const api = tracked(
      createApiClient({
        baseUrl: BASE,
        auth: { kind: 'cookie', onUnauthorized },
        fetch: browserFetch(app),
      }),
    );

    const login = await api.auth.login(PASSWORD);
    expect(login).toEqual({ session: expect.objectContaining({ label: 'web' }) as unknown });
    expect(login).not.toHaveProperty('token');
    expect((await api.auth.me()).label).toBe('web');

    const created = await api.events.create({
      title: 'From the browser',
      start: '2026-10-25',
      allDay: true,
      timezone: 'Asia/Karachi',
    });
    expect((await api.events.list()).events.map((e) => e.id)).toEqual([created.id]);

    await api.auth.logout();
    expect(await rejection(api.auth.me())).toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});

describe('contract coverage', () => {
  afterAll(() => {
    called.clear();
  });

  it('exercises every method the client exposes', () => {
    expect([...exposed].sort()).toEqual([
      'auth.login',
      'auth.logout',
      'auth.me',
      'auth.revokeSession',
      'auth.sessions',
      'events.create',
      'events.exportIcs',
      'events.exportJson',
      'events.get',
      'events.importEvents',
      'events.list',
      'events.listAll',
      'events.remove',
      'events.restore',
      'events.update',
    ]);
    expect([...exposed].filter((name) => !called.has(name))).toEqual([]);
  });

  it('accepts the platform fetch as FetchLike', () => {
    // Compile-time check: Node's (and the browser's) global fetch fits the structural type.
    const platformFetch: FetchLike = globalThis.fetch;
    expect(typeof platformFetch).toBe('function');
  });
});
