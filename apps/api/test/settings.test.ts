import { DEFAULT_SETTINGS } from '@agenda/core';
import type { Settings } from '@agenda/core';
import { describe, expect, it } from 'vitest';
import { settings } from '../src/db/schema.js';
import { createSettingsRepo } from '../src/settings/repo.js';
import { NOW, makeTestApp } from './helpers.js';
import type { TestResponse } from './helpers.js';

type ErrorResponse = TestResponse<{ error: { code: string; fields?: Record<string, string[]> } }>;

describe('GET/PUT /settings', () => {
  it('starts with the defaults', async () => {
    const { request } = await makeTestApp();
    const res = await request<Settings>('GET', '/settings');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(DEFAULT_SETTINGS);
  });

  it('saves the whole object, shared by every session', async () => {
    const { request, login } = await makeTestApp();
    const value: Settings = { theme: 'dark', weekStart: 'sunday', timeFormat: '24h' };
    const put = await request<Settings>('PUT', '/settings', value);
    expect(put.status).toBe(200);
    expect(put.body).toEqual(value);
    // Another device sees the same settings.
    const phone = await login('android');
    expect((await request<Settings>('GET', '/settings', undefined, { auth: phone })).body).toEqual(
      value,
    );
    // A second save replaces the first.
    const next: Settings = { ...value, theme: 'light' };
    await request('PUT', '/settings', next);
    expect((await request<Settings>('GET', '/settings')).body).toEqual(next);
  });

  it('rejects partial or unknown values with field errors', async () => {
    const { request } = await makeTestApp();
    const partial: ErrorResponse = await request('PUT', '/settings', { theme: 'dark' });
    expect(partial.status).toBe(422);
    expect(Object.keys(partial.body.error.fields ?? {})).toEqual(['weekStart', 'timeFormat']);
    const unknown: ErrorResponse = await request('PUT', '/settings', {
      ...DEFAULT_SETTINGS,
      weekStart: 'saturday',
    });
    expect(unknown.status).toBe(422);
    expect(Object.keys(unknown.body.error.fields ?? {})).toEqual(['weekStart']);
  });

  it('falls back to defaults for a stored value it cannot read', async () => {
    const { db } = await makeTestApp();
    const repo = createSettingsRepo(db, () => NOW);
    // An older row missing a newer preference keeps what it has.
    await db
      .insert(settings)
      .values({ id: 1, value: { theme: 'dark' }, updatedAt: NOW.toISOString() });
    expect(await repo.get()).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark' });
    await db.update(settings).set({ value: { theme: 'neon' } });
    expect(await repo.get()).toEqual(DEFAULT_SETTINGS);
    await db.update(settings).set({ value: 'garbage' });
    expect(await repo.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('allows PUT in CORS preflights from the web app', async () => {
    const { app } = await makeTestApp();
    const res = await app.request('/api/v1/settings', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'PUT',
      },
    });
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('PUT');
  });
});

describe('POST /auth/sessions/revoke-others', () => {
  it('logs out every other device and keeps this one', async () => {
    const { request, login } = await makeTestApp();
    const phone = await login('android');
    const tablet = await login('ipad');
    const laptop = await login('web');
    const res = await request<{ revoked: number }>(
      'POST',
      '/auth/sessions/revoke-others',
      {},
      { auth: laptop },
    );
    expect(res.status).toBe(200);
    // The phone and the tablet.
    expect(res.body).toEqual({ revoked: 2 });
    expect((await request('GET', '/events', undefined, { auth: phone })).status).toBe(401);
    expect((await request('GET', '/events', undefined, { auth: tablet })).status).toBe(401);
    expect((await request('GET', '/events', undefined, { auth: laptop })).status).toBe(200);

    const again = await request<{ revoked: number }>(
      'POST',
      '/auth/sessions/revoke-others',
      {},
      { auth: laptop },
    );
    expect(again.body).toEqual({ revoked: 0 });
  });
});
