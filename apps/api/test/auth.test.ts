import { describe, expect, it } from 'vitest';
import type { Session } from '../src/auth/sessions.js';
import { makeTestApp, NOW, PASSWORD, WEB_ORIGIN } from './helpers.js';
import type { ErrorResponse } from './helpers.js';

const DAY = 24 * 60 * 60 * 1000;
const at = (ms: number) => new Date(NOW.getTime() + ms);

interface SessionList {
  sessions: (Session & { current: boolean })[];
}

/** Logs in as a browser and returns the cookie pair to send back, plus the raw header. */
async function browserLogin(request: Awaited<ReturnType<typeof makeTestApp>>['request']) {
  const res = await request<{ session: Session }>(
    'POST',
    '/auth/login',
    { password: PASSWORD, client: 'browser' },
    { auth: false, headers: { Origin: WEB_ORIGIN } },
  );
  const setCookie = res.headers.get('Set-Cookie') ?? '';
  return { res, setCookie, cookie: setCookie.split(';')[0] ?? '' };
}

describe('POST /auth/login', () => {
  it('rejects a wrong password with 401', async () => {
    const { request } = await makeTestApp();
    const res: ErrorResponse = await request(
      'POST',
      '/auth/login',
      { password: 'wrong password!', client: 'token' },
      { auth: false },
    );
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'invalid_credentials', message: 'Wrong password' } });
  });

  it('validates the body', async () => {
    const { request } = await makeTestApp();
    const res: ErrorResponse = await request(
      'POST',
      '/auth/login',
      { password: '', client: 'phone' },
      { auth: false },
    );
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.fields ?? {}).sort()).toEqual(['client', 'password']);
  });

  it('returns a token for client: token, with a default label', async () => {
    const { request } = await makeTestApp();
    const res = await request<{ token: string; session: Session }>(
      'POST',
      '/auth/login',
      { password: PASSWORD, client: 'token' },
      { auth: false },
    );
    expect(res.status).toBe(200);
    expect(res.body.token).toMatch(/^[\w-]{43}$/);
    expect(res.body.session).toMatchObject({
      label: 'app',
      createdAt: NOW.toISOString(),
      lastUsedAt: NOW.toISOString(),
      expiresAt: at(30 * DAY).toISOString(),
    });
    expect(res.headers.get('Set-Cookie')).toBeNull();
  });

  it('stores only a hash of the token', async () => {
    const { login, db } = await makeTestApp();
    const token = await login('chrome');
    const { sessions } = await import('../src/db/schema.js');
    const [row] = await db.select().from(sessions);
    expect(row?.label).toBe('chrome');
    expect(row?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(token);
  });
});

describe('cookie sessions', () => {
  it('sets an HttpOnly, Secure, SameSite=Lax __Host- cookie and no token in the body', async () => {
    const { request } = await makeTestApp();
    const { res, setCookie } = await browserLogin(request);
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('token');
    expect(res.body.session.label).toBe('web');
    expect(setCookie).toMatch(/^__Host-agenda_session=[\w-]{43};/);
    for (const part of ['Max-Age=2592000', 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax']) {
      expect(setCookie).toContain(part);
    }
    expect(setCookie).not.toContain('Domain');
  });

  it('uses a plain cookie without Secure in development', async () => {
    const { request } = await makeTestApp({ auth: { secureCookies: false } });
    const { setCookie } = await browserLogin(request);
    expect(setCookie).toMatch(/^agenda_session=/);
    expect(setCookie).not.toContain('Secure');
  });

  it('authenticates requests and logs out with the cookie', async () => {
    const { request } = await makeTestApp();
    const { cookie } = await browserLogin(request);
    const asBrowser = { auth: false, headers: { Cookie: cookie, Origin: WEB_ORIGIN } };

    expect((await request('GET', '/events', undefined, asBrowser)).status).toBe(200);
    const me = await request<{ session: Session }>('GET', '/auth/me', undefined, asBrowser);
    expect(me.body.session.label).toBe('web');

    const out = await request('POST', '/auth/logout', undefined, asBrowser);
    expect(out.status).toBe(204);
    expect(out.headers.get('Set-Cookie')).toMatch(/^__Host-agenda_session=;.*Max-Age=0/);
    expect((await request('GET', '/events', undefined, asBrowser)).status).toBe(401);
  });

  it('ignores a cookie without the __Host- prefix when cookies are secure', async () => {
    const { request } = await makeTestApp();
    const { cookie } = await browserLogin(request);
    const unprefixed = cookie.replace('__Host-', '');
    const res = await request('GET', '/events', undefined, {
      auth: false,
      headers: { Cookie: unprefixed },
    });
    expect(res.status).toBe(401);
  });
});

describe('bearer sessions', () => {
  it('authenticates with Authorization: Bearer and logs out', async () => {
    const { request, login } = await makeTestApp();
    const token = await login('android');
    expect((await request('GET', '/events', undefined, { auth: token })).status).toBe(200);

    const me = await request<{ session: Session }>('GET', '/auth/me', undefined, { auth: token });
    expect(me.body.session.label).toBe('android');

    const out = await request('POST', '/auth/logout', undefined, { auth: token });
    expect(out.status).toBe(204);
    expect(out.headers.get('Set-Cookie')).toBeNull();
    expect((await request('GET', '/events', undefined, { auth: token })).status).toBe(401);
  });

  it('rejects a malformed Authorization header even with a valid cookie', async () => {
    const { request } = await makeTestApp();
    const { cookie } = await browserLogin(request);
    for (const header of ['Bearer', 'Basic dXNlcjpwYXNz', 'Bearer short', 'bearer x'.repeat(5)]) {
      const res = await request('GET', '/events', undefined, {
        auth: false,
        headers: { Authorization: header, Cookie: cookie },
      });
      expect(res.status).toBe(401);
    }
  });

  it('rejects an unknown token', async () => {
    const { request } = await makeTestApp();
    const res: ErrorResponse = await request('GET', '/events', undefined, {
      auth: 'A'.repeat(43),
    });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'unauthorized', message: 'Log in to continue' } });
  });
});

describe('session lifetime', () => {
  it('expires a session 30 days after its last use', async () => {
    const { request, login, setNow } = await makeTestApp();
    const token = await login();
    setNow(at(30 * DAY - 1));
    expect((await request('GET', '/events', undefined, { auth: token })).status).toBe(200);
    // That use slid the expiry forward, so 30 days from the original login is still fine...
    setNow(at(30 * DAY + 1));
    expect((await request('GET', '/events', undefined, { auth: token })).status).toBe(200);
    // ...but 30 days without any use is not.
    setNow(at(61 * DAY));
    expect((await request('GET', '/events', undefined, { auth: token })).status).toBe(401);
  });

  it('records use at most once a minute', async () => {
    const { request, login, setNow } = await makeTestApp();
    const token = await login();
    const me = async () =>
      (await request<{ session: Session }>('GET', '/auth/me', undefined, { auth: token })).body
        .session;

    setNow(at(30_000));
    expect((await me()).lastUsedAt).toBe(NOW.toISOString());
    setNow(at(61_000));
    const touched = await me();
    expect(touched.lastUsedAt).toBe(at(61_000).toISOString());
    expect(touched.expiresAt).toBe(at(61_000 + 30 * DAY).toISOString());
  });
});

describe('managing sessions', () => {
  it('lists active sessions and marks the current one', async () => {
    const { request, login } = await makeTestApp();
    const phone = await login('android');
    const laptop = await login('web');
    const res = await request<SessionList>('GET', '/auth/sessions', undefined, { auth: laptop });
    expect(res.body.sessions.map((s) => [s.label, s.current])).toEqual([
      ['android', false],
      ['web', true],
    ]);
    expect(JSON.stringify(res.body)).not.toContain(phone);
  });

  it('revokes another device, which then gets 401', async () => {
    const { request, login } = await makeTestApp();
    const phone = await login('android');
    const laptop = await login('web');
    const list = await request<SessionList>('GET', '/auth/sessions', undefined, { auth: laptop });
    const phoneId = list.body.sessions.find((s) => s.label === 'android')?.id ?? '';

    const revoke = await request('DELETE', `/auth/sessions/${phoneId}`, undefined, {
      auth: laptop,
    });
    expect(revoke.status).toBe(204);
    expect((await request('GET', '/events', undefined, { auth: phone })).status).toBe(401);
    expect((await request('GET', '/events', undefined, { auth: laptop })).status).toBe(200);

    const again: ErrorResponse = await request('DELETE', `/auth/sessions/${phoneId}`, undefined, {
      auth: laptop,
    });
    expect(again.status).toBe(404);
    expect(again.body.error.message).toBe('Session not found');

    const after = await request<SessionList>('GET', '/auth/sessions', undefined, { auth: laptop });
    expect(after.body.sessions.map((s) => s.label)).toEqual(['web']);
  });
});

describe('requireAuth', () => {
  const ID = '0190f5a2-0000-7000-8000-000000000001';
  it.each([
    ['GET', '/events'],
    ['POST', '/events'],
    ['GET', `/events/${ID}`],
    ['PATCH', `/events/${ID}`],
    ['DELETE', `/events/${ID}`],
    ['POST', `/events/${ID}/restore`],
    ['POST', '/events/import?tz=UTC'],
    ['GET', '/events/export.json'],
    ['GET', '/events/export.ics'],
    ['POST', '/auth/logout'],
    ['GET', '/auth/me'],
    ['GET', '/auth/sessions'],
    ['DELETE', `/auth/sessions/${ID}`],
  ])('returns 401 for %s %s without a session', async (method, path) => {
    const { request } = await makeTestApp();
    const res: ErrorResponse = await request(method, path, method === 'GET' ? undefined : {}, {
      auth: false,
    });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'unauthorized', message: 'Log in to continue' } });
  });
});
