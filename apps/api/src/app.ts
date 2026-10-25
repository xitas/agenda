import { Hono } from 'hono';
import type { Context } from 'hono';
import { logger } from 'hono/logger';
import { requireAuth } from './auth/middleware.js';
import type { CookieConfig } from './auth/middleware.js';
import { authRoutes } from './auth/routes.js';
import { createSessionStore } from './auth/sessions.js';
import type { Db } from './db/client.js';
import { ApiError } from './errors.js';
import { createEventRepo } from './events/repo.js';
import { eventRoutes } from './events/routes.js';

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

export function createApp({ db, auth, now = () => new Date(), logRequests = false }: AppOptions) {
  const app = new Hono();
  if (logRequests) app.use(logger());

  const store = createSessionStore(db, now);
  const cookie: CookieConfig = { name: COOKIE_NAME, secure: auth.secureCookies };
  const signedIn = requireAuth(store, cookie);

  const api = new Hono();
  api.route('/auth', authRoutes({ store, passwordHash: auth.passwordHash, cookie }));
  // Every events route needs a session (cookie or bearer token).
  api.use('/events', signedIn);
  api.use('/events/*', signedIn);
  api.route('/events', eventRoutes({ repo: createEventRepo(db), now }));
  app.route('/api/v1', api);

  app.notFound((c) =>
    c.json(
      new ApiError(404, 'not_found', `No route for ${c.req.method} ${c.req.path}`).toBody(),
      404,
    ),
  );

  app.onError((error, c) => {
    if (error instanceof ApiError) return c.json(error.toBody(), error.status);
    console.error(error);
    return c.json(new ApiError(500, 'internal', 'Something went wrong').toBody(), 500);
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
