import { readFileSync } from 'node:fs';
import type { AgendaEvent } from '@agenda/core';
import { describe, expect, it } from 'vitest';
import { allDay, makeTestApp, NOW, timed } from './helpers.js';
import type { ErrorResponse } from './helpers.js';

interface ImportReport {
  imported: number;
  skipped: { index: number; reason: string }[];
}

interface Page {
  events: AgendaEvent[];
}

const v0Export: unknown = JSON.parse(
  readFileSync(new URL('./fixtures/AgendaData.v0.built.json', import.meta.url), 'utf8'),
);

describe('POST /events/import', () => {
  it('imports a v0 AgendaData.json export end to end', async () => {
    const { request } = await makeTestApp();
    const res = await request<ImportReport>('POST', '/events/import?tz=Asia/Karachi', v0Export);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ imported: 5, skipped: [] });

    const { events } = (await request<Page>('GET', '/events')).body;
    expect(events.map((event) => [event.title, event.start, event.notes])).toEqual([
      // The v0 date picker stored local midnight in Karachi, i.e. 19:00Z the day before.
      ['Doctor appointment', '2022-06-10', 'Bring the reports'],
      ['Team lunch', '2022-06-15', ''],
      ['Pay electricity bill', '2022-06-20', ''],
      ['Meeting', '2026-10-24', expect.stringContaining('Lorem ipsum') as unknown],
      ['Vacation', '2026-10-26', expect.stringContaining('Lorem ipsum') as unknown],
    ]);
    expect(events.every((event) => event.allDay && event.end === null)).toBe(true);
    expect(events.every((event) => event.createdAt === NOW.toISOString())).toBe(true);

    const ids = events.map((event) => event.id);
    expect(ids).toContain('f3c9a1d2-8b4e-4c6f-9a2d-7e1b5c3d9f0a'); // UUIDs are kept
    expect(ids).not.toContain('V1StGXR8_Z5jdHi6B-myT'); // nanoid ids are replaced
  });

  it('changes nothing when the same file is imported again', async () => {
    const { request } = await makeTestApp();
    await request('POST', '/events/import?tz=Asia/Karachi', v0Export);
    const again = await request<ImportReport>('POST', '/events/import?tz=Asia/Karachi', v0Export);

    expect(again.body.imported).toBe(0);
    expect(again.body.skipped).toEqual(
      [0, 1, 2, 3, 4].map((index) => ({ index, reason: 'Already exists' })),
    );
    expect((await request<Page>('GET', '/events')).body.events).toHaveLength(5);
  });

  it('round-trips a v1 export.json, merging skipped rows in input order', async () => {
    const source = await makeTestApp();
    await source.create(timed('Dentist', '2026-10-24T11:00:00.000Z'));
    await source.create(allDay('Trip', '2026-11-03', '2026-11-06'));
    const exported = (await source.request<AgendaEvent[]>('GET', '/events/export.json')).body;

    const target = await makeTestApp();
    await target.request('POST', '/events/import?tz=UTC', [exported[0]]);
    const res = await target.request<ImportReport>('POST', '/events/import?tz=UTC', [
      ...exported,
      { title: 'Bad date', date: 'soon' },
    ]);
    expect(res.body).toEqual({
      imported: 1,
      skipped: [
        { index: 0, reason: 'Already exists' },
        { index: 2, reason: "The date can't be read" },
      ],
    });
    expect((await target.request<Page>('GET', '/events')).body.events).toEqual(exported);
  });

  it.each([
    ['tz is missing', '/events/import', [], 400, 'invalid_query'],
    ['tz is invalid', '/events/import?tz=Nowhere', [], 400, 'invalid_query'],
    ['the body is not JSON', '/events/import?tz=UTC', '[{', 400, 'invalid_json'],
    ['the body is not an array', '/events/import?tz=UTC', { events: [] }, 422, 'validation_failed'],
  ])('rejects the request when %s', async (_name, path, body, status, code) => {
    const { request } = await makeTestApp();
    const res: ErrorResponse = await request('POST', path, body);
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
  });

  it('returns 413 for a body over 5 MB', async () => {
    const { app, login } = await makeTestApp();
    const token = await login();
    const body = JSON.stringify([{ title: 'x'.repeat(6 * 1024 * 1024), date: '2026-10-24' }]);
    const res = await app.request('/api/v1/events/import?tz=UTC', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(body.length),
        Authorization: `Bearer ${token}`,
      },
      body,
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({
      error: { code: 'payload_too_large', message: 'Import files can be at most 5 MB' },
    });
  });
});

describe('exports', () => {
  it('exports active events as v1 JSON for download', async () => {
    const { request, create } = await makeTestApp();
    const kept = await create(timed('Dentist', '2026-10-24T11:00:00.000Z'));
    const gone = await create(timed('Cancelled', '2026-10-24T12:00:00.000Z'));
    await request('DELETE', `/events/${gone.id}`);

    const res = await request<AgendaEvent[]>('GET', '/events/export.json');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toBe(
      'attachment; filename="agenda-export.json"',
    );
    expect(res.body).toEqual([kept]);
  });

  it('exports an iCalendar file with all-day dates as VALUE=DATE', async () => {
    const { request, create } = await makeTestApp();
    await create({ ...timed('Dentist', '2026-10-24T11:00:00.000Z'), reminders: [30] });
    await create(allDay('Trip', '2026-11-03', '2026-11-06'));

    const res = await request('GET', '/events/export.ics');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/calendar; charset=utf-8');
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="agenda.ics"');

    const lines = res.text.split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('DTSTART:20261024T110000Z');
    expect(lines).toContain('TRIGGER:-PT30M');
    expect(lines).toContain('DTSTART;VALUE=DATE:20261103');
    expect(lines).toContain('DTEND;VALUE=DATE:20261106');
    expect(lines.filter((line) => line === 'BEGIN:VEVENT')).toHaveLength(2);
  });
});
