import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createRateLimiter } from '../src/auth/rate-limit.js';
import { openDb } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { makeTestApp, NOW, PASSWORD, testAuthConfig, timed, WEB_ORIGIN } from './helpers.js';
import type { ErrorResponse } from './helpers.js';

const MINUTE = 60 * 1000;
const EVIL_ORIGIN = 'https://evil.example';

type TestApp = Awaited<ReturnType<typeof makeTestApp>>;

const wrongLogin = (request: TestApp['request']): Promise<ErrorResponse> =>
  request(
    'POST',
    '/auth/login',
    { password: 'not the password', client: 'token' },
    { auth: false },
  );
const rightLogin = (request: TestApp['request']): Promise<ErrorResponse> =>
  request('POST', '/auth/login', { password: PASSWORD, client: 'token' }, { auth: false });

describe('login rate limit', () => {
  it('refuses the 6th attempt after 5 failures with 429 and Retry-After', async () => {
    const { request } = await makeTestApp();
    for (let i = 0; i < 5; i++) expect((await wrongLogin(request)).status).toBe(401);

    const blocked = await wrongLogin(request);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBe('900');
    expect(blocked.body.error).toEqual({
      code: 'rate_limited',
      message: 'Too many failed logins; try again later',
    });
    // Even the right password is refused while blocked.
    expect((await rightLogin(request)).status).toBe(429);
  });

  it('counts down Retry-After and lets the client in once the window has passed', async () => {
    const { request, setNow } = await makeTestApp();
    for (let i = 0; i < 5; i++) await wrongLogin(request);

    setNow(new Date(NOW.getTime() + 5 * MINUTE));
    expect((await rightLogin(request)).headers.get('Retry-After')).toBe('600');

    setNow(new Date(NOW.getTime() + 15 * MINUTE));
    expect((await rightLogin(request)).status).toBe(200);
  });

  it('only counts failures, and a success clears them', async () => {
    const { request } = await makeTestApp();
    for (let i = 0; i < 4; i++) await wrongLogin(request);
    expect((await rightLogin(request)).status).toBe(200);
    for (let i = 0; i < 4; i++) await wrongLogin(request);
    expect((await wrongLogin(request)).status).toBe(401); // the 5th failure since the success
    expect((await wrongLogin(request)).status).toBe(429);
  });

  it('limits each IP separately', async () => {
    const { request, setIp } = await makeTestApp();
    for (let i = 0; i < 5; i++) await wrongLogin(request);
    expect((await rightLogin(request)).status).toBe(429);
    setIp('198.51.100.20');
    expect((await rightLogin(request)).status).toBe(200);
  });

  it('falls back to one shared key when there is no socket', async () => {
    // app.request() has no socket, so the default IP lookup can't find an address.
    const db = openDb(':memory:');
    await runMigrations(db);
    const app = createApp({ db, auth: await testAuthConfig(), now: () => NOW });
    const attempt = () =>
      app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'not the password', client: 'token' }),
      });
    for (let i = 0; i < 5; i++) expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(429);
  });

  it('forgets the least recently failed keys beyond its size limit', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: MINUTE, now: () => NOW, maxKeys: 2 });
    limiter.fail('a');
    limiter.fail('b');
    limiter.fail('c');
    expect(limiter.size).toBe(2);
    expect(limiter.check('a')).toEqual({ allowed: true });
    expect(limiter.check('c')).toEqual({ allowed: false, retryAfterSeconds: 60 });
  });
});

describe('CSRF: Origin check for cookie sessions', () => {
  async function withCookie() {
    const testApp = await makeTestApp();
    const res = await testApp.request(
      'POST',
      '/auth/login',
      { password: PASSWORD, client: 'browser' },
      { auth: false, headers: { Origin: WEB_ORIGIN } },
    );
    const cookie = (res.headers.get('Set-Cookie') ?? '').split(';')[0] ?? '';
    return { ...testApp, cookie };
  }

  it.each([
    ['no Origin', {}],
    ['an unknown Origin', { Origin: EVIL_ORIGIN }],
    ['a same-site but different origin', { Origin: 'http://localhost:6666' }],
    ['the string "null"', { Origin: 'null' }],
  ])('rejects a cookie-authenticated write with %s', async (_name, headers) => {
    const { request, cookie } = await withCookie();
    const res: ErrorResponse = await request(
      'POST',
      '/events',
      timed('Forged', '2026-10-24T11:00:00Z'),
      {
        auth: false,
        headers: { ...headers, Cookie: cookie },
      },
    );
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: { code: 'csrf_rejected', message: 'This request must come from an allowed origin' },
    });
  });

  it('accepts a cookie-authenticated write from an allowed origin', async () => {
    const { request, cookie } = await withCookie();
    const res = await request('POST', '/events', timed('Real', '2026-10-24T11:00:00Z'), {
      auth: false,
      headers: { Cookie: cookie, Origin: WEB_ORIGIN },
    });
    expect(res.status).toBe(201);
  });

  it('does not require an Origin for safe methods or for bearer tokens', async () => {
    const { request, cookie } = await withCookie();
    const read = await request('GET', '/events', undefined, {
      auth: false,
      headers: { Cookie: cookie },
    });
    expect(read.status).toBe(200);
    // Bearer tokens are never attached automatically, so a forged request can't carry one.
    expect((await request('POST', '/events', timed('Script', '2026-10-24T11:00:00Z'))).status).toBe(
      201,
    );
  });

  it('checks the Origin of a browser login but not of a token login', async () => {
    const { request } = await makeTestApp();
    const browser = (headers: Record<string, string>) =>
      request(
        'POST',
        '/auth/login',
        { password: PASSWORD, client: 'browser' },
        { auth: false, headers },
      );

    const forged = await browser({ Origin: EVIL_ORIGIN });
    expect(forged.status).toBe(403);
    expect(forged.headers.get('Set-Cookie')).toBeNull();
    expect((await browser({})).status).toBe(403);
    expect((await browser({ Origin: WEB_ORIGIN })).status).toBe(200);
    expect((await rightLogin(request)).status).toBe(200);
  });
});

describe('CORS', () => {
  async function preflight(origin: string) {
    const { app } = await makeTestApp();
    return app.request('/api/v1/events', {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type, authorization',
      },
    });
  }

  it('answers a preflight from an allowed origin, with credentials', async () => {
    const res = await preflight(WEB_ORIGIN);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(WEB_ORIGIN);
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET,POST,PATCH,DELETE');
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type,Authorization');
    expect(res.headers.get('Access-Control-Max-Age')).toBe('600');
  });

  it('gives an unknown origin no CORS headers, so the browser blocks it', async () => {
    const res = await preflight(EVIL_ORIGIN);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('adds the CORS headers to real responses for allowed origins only', async () => {
    const { request } = await makeTestApp();
    const allowed = await request('GET', '/events', undefined, { headers: { Origin: WEB_ORIGIN } });
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(WEB_ORIGIN);
    expect(allowed.headers.get('Vary')).toContain('Origin');
    const unknown = await request('GET', '/events', undefined, {
      headers: { Origin: EVIL_ORIGIN },
    });
    expect(unknown.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('allows no origins when CORS_ORIGINS is empty', async () => {
    const { app } = await makeTestApp({ auth: { corsOrigins: [] } });
    const res = await app.request('/api/v1/events', {
      method: 'OPTIONS',
      headers: { Origin: WEB_ORIGIN, 'Access-Control-Request-Method': 'GET' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
