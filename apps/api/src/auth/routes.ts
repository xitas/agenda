import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { ApiError, notFound, validationFailed } from '../errors.js';
import { readJson } from '../http.js';
import { requireAuth } from './middleware.js';
import type { AuthEnv, CookieConfig } from './middleware.js';
import { verifyPassword } from './password.js';
import { SESSION_TTL_MS } from './sessions.js';
import type { SessionStore } from './sessions.js';

const LoginSchema = z.object({
  password: z.string().min(1).max(1024),
  client: z.enum(['browser', 'token']),
  label: z.string().trim().min(1).max(50).optional(),
});

const DEFAULT_LABEL = { browser: 'web', token: 'app' } as const;

export interface AuthRoutesOptions {
  store: SessionStore;
  passwordHash: string;
  cookie: CookieConfig;
}

export function authRoutes({ store, passwordHash, cookie }: AuthRoutesOptions) {
  const routes = new Hono<AuthEnv>();
  const auth = requireAuth(store, cookie);
  const prefix = cookie.secure ? 'host' : undefined;

  routes.post('/login', async (c) => {
    const body = LoginSchema.safeParse(await readJson(c));
    if (!body.success) throw validationFailed(body.error.issues);

    const { password, client, label = DEFAULT_LABEL[client] } = body.data;
    if (!(await verifyPassword(password, passwordHash))) {
      throw new ApiError(401, 'invalid_credentials', 'Wrong password');
    }

    const { token, session } = await store.create(label);
    if (client === 'token') return c.json({ token, session });

    setCookie(c, cookie.name, token, {
      httpOnly: true,
      secure: cookie.secure,
      sameSite: 'Lax',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
      ...(prefix === undefined ? {} : { prefix }),
    });
    return c.json({ session });
  });

  routes.post('/logout', auth, async (c) => {
    await store.revoke(c.get('session').id);
    if (c.get('authMethod') === 'cookie') {
      deleteCookie(c, cookie.name, {
        path: '/',
        secure: cookie.secure,
        ...(prefix ? { prefix } : {}),
      });
    }
    return c.body(null, 204);
  });

  routes.get('/me', auth, (c) => c.json({ session: c.get('session') }));

  routes.get('/sessions', auth, async (c) => {
    const current = c.get('session').id;
    const list = await store.listActive();
    return c.json({
      sessions: list.map((session) => ({ ...session, current: session.id === current })),
    });
  });

  routes.delete('/sessions/:id', auth, async (c) => {
    if (!(await store.revoke(c.req.param('id')))) throw notFound('Session');
    return c.body(null, 204);
  });

  return routes;
}
