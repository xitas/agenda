// The three cases from the v0 app's server/db.test.js (tag legacy-agenda), ported to the v1 API.
import type { AgendaEvent } from '@agenda/core';
import { describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers.js';
import type { ErrorResponse } from './helpers.js';

interface Page {
  events: AgendaEvent[];
}

describe('ported from the v0 server/db.test.js', () => {
  it('rejects a missing title and a bad date', async () => {
    const { request } = await makeTestApp();
    const noTitle: ErrorResponse = await request('POST', '/events', {
      title: '',
      start: '2026-01-01',
      allDay: true,
      timezone: 'UTC',
    });
    expect(noTitle.status).toBe(422);
    expect(noTitle.body.error.fields).toHaveProperty('title');

    const badDate: ErrorResponse = await request('POST', '/events', {
      title: 'x',
      start: 'not-a-date',
      timezone: 'UTC',
    });
    expect(badDate.status).toBe(422);
    expect(badDate.body.error.fields).toHaveProperty('start');

    const valid = await request('POST', '/events', {
      title: 'x',
      start: '2026-01-01',
      allDay: true,
      timezone: 'UTC',
    });
    expect(valid.status).toBe(201);
  });

  it('runs the full CRUD lifecycle through the API', async () => {
    const { request } = await makeTestApp();

    expect((await request<Page>('GET', '/events')).body.events).toEqual([]);

    const created = await request<AgendaEvent>('POST', '/events', {
      title: 'Standup',
      notes: 'Daily sync',
      start: '2026-08-01T00:00:00.000Z',
      timezone: 'UTC',
    });
    expect(created.status).toBe(201);
    expect(created.body.title).toBe('Standup');
    const { id } = created.body;

    expect((await request<Page>('GET', '/events')).body.events).toHaveLength(1);

    const updated = await request<AgendaEvent>('PATCH', `/events/${id}`, {
      title: 'Standup (moved)',
      start: '2026-08-02T00:00:00.000Z',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe('Standup (moved)');

    const rejected = await request('PATCH', `/events/${id}`, { title: '' });
    expect(rejected.status).toBe(422);

    expect((await request('DELETE', `/events/${id}`)).status).toBe(204);
    expect((await request('DELETE', `/events/${id}`)).status).toBe(404);
    expect((await request<Page>('GET', '/events')).body.events).toEqual([]);
  });

  it('skips invalid import rows and gives non-UUID ids new ones', async () => {
    const { request } = await makeTestApp();
    const result = await request<{ imported: number; skipped: { index: number }[] }>(
      'POST',
      '/events/import?tz=UTC',
      [
        { id: 'dup', title: 'Valid one', date: '2026-08-01T00:00:00.000Z' },
        { id: 'dup', title: '', date: '2026-08-01T00:00:00.000Z' },
        { id: 'dup', title: 'Valid two', date: 'not-a-date' },
      ],
    );
    expect(result.status).toBe(200);
    expect(result.body.imported).toBe(1);
    expect(result.body.skipped.map((row) => row.index)).toEqual([1, 2]);

    const [event] = (await request<Page>('GET', '/events')).body.events;
    expect(event?.title).toBe('Valid one');
    expect(event?.id).not.toBe('dup');
  });
});
