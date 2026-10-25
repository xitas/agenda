import type { AgendaEvent } from '@agenda/core';
import { describe, expect, it } from 'vitest';
import { allDay, makeTestApp, timed } from './helpers.js';
import type { ErrorResponse } from './helpers.js';

interface Page {
  events: AgendaEvent[];
  nextCursor: string | null;
}

/** The Karachi (UTC+5) day `date` as a [from, to) query string. */
function karachiDay(date: string): string {
  const from = new Date(`${date}T00:00:00+05:00`).toISOString();
  const to = new Date(new Date(from).getTime() + 24 * 60 * 60 * 1000).toISOString();
  return `from=${from}&to=${to}&tz=Asia/Karachi`;
}

async function titles(
  request: Awaited<ReturnType<typeof makeTestApp>>['request'],
  query: string,
): Promise<string[]> {
  const res = await request<Page>('GET', `/events?${query}`);
  expect(res.status).toBe(200);
  return res.body.events.map((event) => event.title);
}

describe('GET /events range queries', () => {
  it('shows an all-day event on the 24th for the Karachi day of the 24th only', async () => {
    const { request, create } = await makeTestApp();
    await create(allDay('Birthday', '2026-10-24'));

    expect(await titles(request, karachiDay('2026-10-24'))).toEqual(['Birthday']);
    expect(await titles(request, karachiDay('2026-10-23'))).toEqual([]);
    expect(await titles(request, karachiDay('2026-10-25'))).toEqual([]);
  });

  it('uses the tz parameter to decide which day an all-day event covers', async () => {
    const { request, create } = await makeTestApp();
    await create(allDay('Birthday', '2026-10-24'));
    // 2026-10-23T18:00Z–23:59Z is 03:00–08:59 on the 24th in Tokyo but still the 23rd in UTC.
    const range = 'from=2026-10-23T18:00:00.000Z&to=2026-10-23T23:59:00.000Z';
    expect(await titles(request, `${range}&tz=Asia/Tokyo`)).toEqual(['Birthday']);
    expect(await titles(request, `${range}&tz=UTC`)).toEqual([]);
  });

  it('treats the all-day end as exclusive for multi-day events', async () => {
    const { request, create } = await makeTestApp();
    await create(allDay('Conference', '2026-11-03', '2026-11-06'));

    expect(await titles(request, karachiDay('2026-11-03'))).toEqual(['Conference']);
    expect(await titles(request, karachiDay('2026-11-05'))).toEqual(['Conference']);
    expect(await titles(request, karachiDay('2026-11-06'))).toEqual([]);
    expect(await titles(request, karachiDay('2026-11-02'))).toEqual([]);
  });

  it('shows a timed event that crosses midnight on both days', async () => {
    const { request, create } = await makeTestApp();
    // 23:00 on the 24th to 01:00 on the 25th in Karachi.
    await create(timed('Late flight', '2026-10-24T18:00:00.000Z', '2026-10-24T20:00:00.000Z'));

    expect(await titles(request, karachiDay('2026-10-24'))).toEqual(['Late flight']);
    expect(await titles(request, karachiDay('2026-10-25'))).toEqual(['Late flight']);
    expect(await titles(request, karachiDay('2026-10-26'))).toEqual([]);
  });

  it('uses a half-open range for timed events', async () => {
    const { request, create } = await makeTestApp();
    const from = '2026-10-23T19:00:00.000Z'; // Karachi midnight starting the 24th
    await create(timed('Ends at from', '2026-10-23T18:00:00.000Z', from));
    await create(timed('Point at from', from));
    await create(timed('Point at to', '2026-10-24T19:00:00.000Z'));

    expect(await titles(request, karachiDay('2026-10-24'))).toEqual(['Point at from']);
  });

  it('accepts from and to with an offset', async () => {
    const { request, create } = await makeTestApp();
    await create(timed('Dentist', '2026-10-24T11:00:00.000Z'));
    const query = 'from=2026-10-24T00:00:00%2B05:00&to=2026-10-25T00:00:00%2B05:00&tz=Asia/Karachi';
    expect(await titles(request, query)).toEqual(['Dentist']);
  });
});

describe('GET /events search, deletion and paging', () => {
  it('searches title, notes and location, case-insensitively', async () => {
    const { request, create } = await makeTestApp();
    await create({ ...timed('Dentist', '2026-10-24T11:00:00.000Z'), notes: 'Bring the FORM' });
    await create({ ...timed('Lunch', '2026-10-24T08:00:00.000Z'), location: 'Form cafe' });
    await create(timed('Formal dinner', '2026-10-24T15:00:00.000Z'));
    await create(timed('Gym', '2026-10-24T13:00:00.000Z'));

    expect(await titles(request, 'q=form')).toEqual(['Lunch', 'Dentist', 'Formal dinner']);
  });

  it('treats % and _ in q as plain characters', async () => {
    const { request, create } = await makeTestApp();
    await create(timed('100% done', '2026-10-24T11:00:00.000Z'));
    await create(timed('1000 done', '2026-10-24T12:00:00.000Z'));
    await create(timed('snake_case', '2026-10-24T13:00:00.000Z'));
    await create(timed('snakeXcase', '2026-10-24T14:00:00.000Z'));

    expect(await titles(request, 'q=%25')).toEqual(['100% done']);
    expect(await titles(request, 'q=e_c')).toEqual(['snake_case']);
  });

  it('combines a range with a search', async () => {
    const { request, create } = await makeTestApp();
    await create(timed('Dentist', '2026-10-24T11:00:00.000Z'));
    await create(timed('Dentist again', '2026-10-30T11:00:00.000Z'));
    expect(await titles(request, `${karachiDay('2026-10-24')}&q=dentist`)).toEqual(['Dentist']);
  });

  it('leaves out soft-deleted events', async () => {
    const { request, create } = await makeTestApp();
    const gone = await create(timed('Cancelled', '2026-10-24T11:00:00.000Z'));
    await create(timed('Kept', '2026-10-24T12:00:00.000Z'));
    await request('DELETE', `/events/${gone.id}`);

    expect(await titles(request, '')).toEqual(['Kept']);
    expect(await titles(request, karachiDay('2026-10-24'))).toEqual(['Kept']);
  });

  it('pages through results in start order with a cursor', async () => {
    const { request, create } = await makeTestApp();
    for (const hour of [15, 9, 11, 13, 10]) {
      await create(
        timed(`At ${String(hour)}`, `2026-10-24T${String(hour).padStart(2, '0')}:00:00.000Z`),
      );
    }

    const seen: string[] = [];
    let query = 'limit=2';
    for (let page = 0; page < 5; page++) {
      const res = await request<Page>('GET', `/events?${query}`);
      seen.push(...res.body.events.map((event) => event.title));
      if (res.body.nextCursor === null) break;
      query = `limit=2&cursor=${res.body.nextCursor}`;
    }
    expect(seen).toEqual(['At 9', 'At 10', 'At 11', 'At 13', 'At 15']);
  });

  it('pages correctly through events that share a start', async () => {
    const { request, create } = await makeTestApp();
    for (const name of ['A', 'B', 'C']) await create(allDay(name, '2026-10-24'));

    const first = await request<Page>('GET', '/events?limit=2');
    expect(first.body.events).toHaveLength(2);
    const second = await request<Page>(
      'GET',
      `/events?limit=2&cursor=${first.body.nextCursor ?? ''}`,
    );
    expect(second.body.events).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();
    const all = [...first.body.events, ...second.body.events].map((event) => event.title);
    expect(all.sort()).toEqual(['A', 'B', 'C']);
  });
});

describe('GET /events query validation', () => {
  it.each([
    ['from without to', 'from=2026-10-24T00:00:00Z&tz=UTC', 'from'],
    ['a range without tz', 'from=2026-10-24T00:00:00Z&to=2026-10-25T00:00:00Z', 'tz'],
    ['to before from', 'from=2026-10-25T00:00:00Z&to=2026-10-24T00:00:00Z&tz=UTC', 'to'],
    ['an invalid tz', 'from=2026-10-24T00:00:00Z&to=2026-10-25T00:00:00Z&tz=Nowhere', 'tz'],
    ['a date instead of an instant', 'from=2026-10-24&to=2026-10-25&tz=UTC', 'from'],
    ['limit 0', 'limit=0', 'limit'],
    ['limit over 200', 'limit=500', 'limit'],
    ['an empty q', 'q=%20', 'q'],
    ['a bad cursor', 'cursor=not-a-cursor', 'cursor'],
  ])('returns 400 for %s', async (_name, query, field) => {
    const { request } = await makeTestApp();
    const res: ErrorResponse = await request('GET', `/events?${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_query');
    expect(res.body.error.fields).toHaveProperty(field);
  });
});
