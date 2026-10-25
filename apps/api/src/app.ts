import { Hono } from 'hono';
import { logger } from 'hono/logger';
import type { Db } from './db/client.js';
import { ApiError } from './errors.js';
import { createEventRepo } from './events/repo.js';
import { eventRoutes } from './events/routes.js';

export interface AppOptions {
  db: Db;
  /** The clock; tests pass a fixed one. */
  now?: () => Date;
  /** Log each request (dev server only). */
  logRequests?: boolean;
}

export function createApp({ db, now = () => new Date(), logRequests = false }: AppOptions) {
  const app = new Hono();
  if (logRequests) app.use(logger());

  const api = new Hono();
  // Step 1.4: authentication goes here, before the routes: api.use('*', requireAuth)
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
