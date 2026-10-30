import { SettingsSchema } from '@agenda/core';
import { Hono } from 'hono';
import { validationFailed } from '../errors.js';
import { readJson } from '../http.js';
import type { SettingsRepo } from './repo.js';

/** GET and PUT /settings: the whole preferences object (it is small; no partial updates). */
export function settingsRoutes({ repo }: { repo: SettingsRepo }) {
  const routes = new Hono();

  routes.get('/', async (c) => c.json(await repo.get()));

  routes.put('/', async (c) => {
    const result = SettingsSchema.safeParse(await readJson(c));
    if (!result.success) throw validationFailed(result.error.issues);
    return c.json(await repo.put(result.data));
  });

  return routes;
}
