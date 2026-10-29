import { getConnInfo } from '@hono/node-server/conninfo';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { requireAuth } from './auth/middleware.js';
import type { CookieConfig } from './auth/middleware.js';
import { createRateLimiter } from './auth/rate-limit.js';
import { authRoutes } from './auth/routes.js';
import { createSessionStore } from './auth/sessions.js';
import type { Db } from './db/client.js';
import { ApiError } from './errors.js';
import { createEventRepo } from './events/repo.js';
import { eventRoutes } from './events/routes.js';
import { createSettingsRepo } from './settings/repo.js';
import { settingsRoutes } from './settings/routes.js';

export interface AuthConfig {
  /** From AGENDA_PASSWORD_HASH; see src/auth/password.ts for the format. */
  passwordHash: string;
  /** Exact origins (scheme://host[:port]) of browser apps allowed to call the API. */
  corsOrigins: readonly string[];
  /** Secure, __Host- prefixed cookies; false only in development (plain http). */
  secureCookies: boolean;
}

export interface AppOptions {
  db: Db;
  auth: AuthConfig;
  /** The clock; tests pass a fixed one. */
  now?: () => Date;
  /** The caller's IP for login rate limiting; tests pass their own. */
  clientIp?: (c: Context) => string;
  /** Log each request (dev server only). The logger prints method, path and status only. */
  logRequests?: boolean;
}

export const COOKIE_NAME = 'agenda_session';
export const LOGIN_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 };

/**
 * The socket's remote address. X-Forwarded-For is deliberately ignored: any client can
 * send it, so it's only trustworthy behind our own proxy (TRUST_PROXY, Phase 3).
 */
function socketIp(c: Context): string {
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown'; // e.g. app.request() in tests, where there is no socket
  }
}

export function createApp(options: AppOptions) {
  const { db, auth, now = () => new Date(), clientIp = socketIp, logRequests = false } = options;
  const app = new Hono();
  if (logRequests) app.use(logger());

  // Browser apps on other origins may call the API (with cookies) only when listed.
  app.use(
    '/api/*',
    cors({
      origin: (origin) => (auth.corsOrigins.includes(origin) ? origin : null),
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  );

  const store = createSessionStore(db, now);
  const cookie: CookieConfig = { name: COOKIE_NAME, secure: auth.secureCookies };
  const signedIn = requireAuth(store, cookie, auth.corsOrigins);
  const limiter = createRateLimiter({ ...LOGIN_LIMIT, now });

  const api = new Hono();
  api.route(
    '/auth',
    authRoutes({
      store,
      passwordHash: auth.passwordHash,
      cookie,
      allowedOrigins: auth.corsOrigins,
      limiter,
      clientIp,
    }),
  );
  // Every events route needs a session (cookie or bearer token).
  api.use('/events', signedIn);
  api.use('/events/*', signedIn);
  api.route('/events', eventRoutes({ repo: createEventRepo(db), now }));
  api.use('/settings', signedIn);
  api.route('/settings', settingsRoutes({ repo: createSettingsRepo(db, now) }));
  app.route('/api/v1', api);

  app.notFound((c) =>
    c.json(
      new ApiError(404, 'not_found', `No route for ${c.req.method} ${c.req.path}`).toBody(),
      404,
    ),
  );

  app.onError((error, c) => {
    if (error instanceof ApiError) return c.json(error.toBody(), error.status, error.headers);
    console.error(error);
    return c.json(new ApiError(500, 'internal', 'Something went wrong').toBody(), 500);
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
