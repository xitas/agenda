import type { AgendaEvent } from '@agenda/core';
import { describe, expect, it } from 'vitest';
import { allDay, makeTestApp, NOW, timed } from './helpers.js';
import type { ErrorResponse } from './helpers.js';

const CLIENT_ID = '0190f5a2-7c3e-7b1a-9d4e-1a2b3c4d5e6f';
const MISSING_ID = '0190f5a2-0000-7000-8000-00000000dead';

describe('POST /events', () => {
  it('creates an event with defaults, timestamps and a Location header', async () => {
    const { request } = await makeTestApp();
    const res = await request<AgendaEvent>(
      'POST',
      '/events',
      timed('Dentist', '2026-10-24T11:00:00Z'),
    );

    expect(res.status).toBe(201);
    expect(res.headers.get('Location')).toBe(`/api/v1/events/${res.body.id}`);
    expect(res.body).toMatchObject({
      title: 'Dentist',
      // Stored in one exact format so SQL string comparison matches time order.
      start: '2026-10-24T11:00:00.000Z',
      end: null,
      allDay: false,
      color: 'blue',
      reminders: [],
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      deletedAt: null,
    });
  });

  it('keeps a client-generated id', async () => {
    const { request } = await makeTestApp();
    const res = await request<AgendaEvent>('POST', '/events', {
      ...allDay('Trip', '2026-11-03', '2026-11-06'),
      id: CLIENT_ID,
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(CLIENT_ID);
  });

  it('returns 409 when the id already exists, even if it was deleted', async () => {
    const { request } = await makeTestApp();
    const body = { ...allDay('Trip', '2026-11-03'), id: CLIENT_ID };
    await request('POST', '/events', body);

    const again: ErrorResponse = await request('POST', '/events', body);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('conflict');

    await request('DELETE', `/events/${CLIENT_ID}`);
    expect((await request('POST', '/events', body)).status).toBe(409);
  });

  it('returns 422 with field errors for invalid input', async () => {
    const { request } = await makeTestApp();
    const res: ErrorResponse = await request('POST', '/events', {
      title: 'x'.repeat(201),
      start: '2026-10-24',
      color: 'orange',
      timezone: 'Mars/Olympus',
    });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({
      code: 'validation_failed',
      message: 'The event is invalid',
    });
    // Zod runs the cross-field timing rules only once every field is valid on its own,
    // so the date-only start on a timed event is reported on a later attempt.
    expect(Object.keys(res.body.error.fields ?? {}).sort()).toEqual(['color', 'timezone', 'title']);

    const timing: ErrorResponse = await request('POST', '/events', timed('Ok', '2026-10-24'));
    expect(timing.status).toBe(422);
    expect(timing.body.error.fields).toEqual({ start: ['Expected a UTC ISO datetime'] });
  });

  it('returns 400 for a body that is not JSON', async () => {
    const { request } = await makeTestApp();
    const res: ErrorResponse = await request('POST', '/events', '{"title": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_json');
  });
});

describe('GET /events/:id', () => {
  it('returns the event', async () => {
    const { request, create } = await makeTestApp();
    const event = await create(timed('Dentist', '2026-10-24T11:00:00.000Z'));
    const res = await request<AgendaEvent>('GET', `/events/${event.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(event);
  });

  it('returns 404 for a missing or deleted event', async () => {
    const { request, create } = await makeTestApp();
    const missing: ErrorResponse = await request('GET', `/events/${MISSING_ID}`);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: { code: 'not_found', message: 'Event not found' } });

    const event = await create(timed('Dentist', '2026-10-24T11:00:00.000Z'));
    await request('DELETE', `/events/${event.id}`);
    expect((await request('GET', `/events/${event.id}`)).status).toBe(404);
  });
});

describe('PATCH /events/:id', () => {
  it('merges the patch and bumps updatedAt', async () => {
    const { request, create, setNow } = await makeTestApp();
    const event = await create({
      ...timed('Dentist', '2026-10-24T11:00:00.000Z'),
      reminders: [10],
    });

    const later = new Date('2026-10-23T10:00:00.000Z');
    setNow(later);
    const res = await request<AgendaEvent>('PATCH', `/events/${event.id}`, {
      color: 'red',
      end: '2026-10-24T12:00:00.000Z',
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ...event,
      color: 'red',
      end: '2026-10-24T12:00:00.000Z',
      updatedAt: later.toISOString(),
    });
    expect((await request<AgendaEvent>('GET', `/events/${event.id}`)).body).toEqual(res.body);
  });

  it('rejects a patch that breaks the timing rules once merged', async () => {
    const { request, create } = await makeTestApp();
    const event = await create(
      timed('Dentist', '2026-10-24T11:00:00.000Z', '2026-10-24T12:00:00.000Z'),
    );

    // Switching to all-day while start is still an instant.
    const toAllDay: ErrorResponse = await request('PATCH', `/events/${event.id}`, { allDay: true });
    expect(toAllDay.status).toBe(422);
    expect(toAllDay.body.error.fields).toEqual({
      start: ['Expected a date (YYYY-MM-DD) for all-day events'],
      end: ['Expected a date (YYYY-MM-DD) for all-day events'],
    });

    // Moving the start after the stored end.
    const afterEnd: ErrorResponse = await request('PATCH', `/events/${event.id}`, {
      start: '2026-10-24T13:00:00.000Z',
    });
    expect(afterEnd.status).toBe(422);
    expect(afterEnd.body.error.fields).toEqual({ end: ['End must be after start'] });

    // Nothing was saved.
    expect((await request<AgendaEvent>('GET', `/events/${event.id}`)).body).toEqual(event);
  });

  it('accepts a full switch to all-day when the dates change too', async () => {
    const { request, create } = await makeTestApp();
    const event = await create(timed('Dentist', '2026-10-24T11:00:00.000Z'));
    const res = await request<AgendaEvent>('PATCH', `/events/${event.id}`, {
      allDay: true,
      start: '2026-10-24',
      end: null,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ allDay: true, start: '2026-10-24', end: null });
  });

  it('returns 422 for an empty or invalid patch, 400 for bad JSON, 404 if missing', async () => {
    const { request, create } = await makeTestApp();
    const event = await create(timed('Dentist', '2026-10-24T11:00:00.000Z'));

    const empty: ErrorResponse = await request('PATCH', `/events/${event.id}`, {});
    expect(empty.status).toBe(422);
    expect(empty.body.error.fields).toEqual({ _: ['A patch must change at least one field'] });

    expect((await request('PATCH', `/events/${event.id}`, { color: 'orange' })).status).toBe(422);
    expect((await request('PATCH', `/events/${event.id}`, 'nope')).status).toBe(400);
    expect((await request('PATCH', `/events/${MISSING_ID}`, { color: 'red' })).status).toBe(404);
  });
});

describe('POST /events/:id/restore', () => {
  it('undoes a delete: clears deletedAt, bumps updatedAt, shows up again', async () => {
    const { request, create, setNow } = await makeTestApp();
    const event = await create(timed('Dentist', '2026-10-24T11:00:00.000Z'));
    await request('DELETE', `/events/${event.id}`);

    const later = new Date('2026-10-23T09:05:00.000Z');
    setNow(later);
    const res = await request<AgendaEvent>('POST', `/events/${event.id}/restore`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ...event, deletedAt: null, updatedAt: later.toISOString() });
    expect((await request<AgendaEvent>('GET', `/events/${event.id}`)).body).toEqual(res.body);
  });

  it('returns 404 for an event that is not deleted, or does not exist', async () => {
    const { request, create } = await makeTestApp();
    const event = await create(timed('Dentist', '2026-10-24T11:00:00.000Z'));
    const active: ErrorResponse = await request('POST', `/events/${event.id}/restore`);
    expect(active.status).toBe(404);
    expect(active.body.error).toEqual({ code: 'not_found', message: 'Deleted event not found' });
    expect((await request('POST', `/events/${MISSING_ID}/restore`)).status).toBe(404);
  });
});

describe('DELETE /events/:id', () => {
  it('soft-deletes: 204, then the row is a tombstone with deletedAt set', async () => {
    const { request, create, db } = await makeTestApp();
    const event = await create(timed('Dentist', '2026-10-24T11:00:00.000Z'));

    const res = await request('DELETE', `/events/${event.id}`);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');

    const { events } = await import('../src/db/schema.js');
    const rows = await db.select().from(events);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: event.id, deletedAt: NOW.toISOString() });
  });

  it('returns 404 for a missing event', async () => {
    const { request } = await makeTestApp();
    expect((await request('DELETE', `/events/${MISSING_ID}`)).status).toBe(404);
  });
});
