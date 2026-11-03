import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './api-client.js';
import { createApiEventRepository, SEARCH_LIMIT } from './repository.js';
import type { AgendaEvent } from './types.js';

const dentist = { id: 'e1', title: 'Dentist' } as AgendaEvent;

/** The client's event methods as spies, answering like the API. */
function fakeEvents() {
  return {
    list: vi.fn(() => Promise.resolve({ events: [dentist], nextCursor: null })),
    listAll: vi.fn(() => Promise.resolve([dentist])),
    get: vi.fn(() => Promise.resolve(dentist)),
    create: vi.fn(() => Promise.resolve(dentist)),
    update: vi.fn(() => Promise.resolve(dentist)),
    remove: vi.fn(() => Promise.resolve()),
    restore: vi.fn(() => Promise.resolve(dentist)),
  };
}

describe('createApiEventRepository', () => {
  it('reads ranges with the zone, and searches with the page limit', async () => {
    const events = fakeEvents();
    const repo = createApiEventRepository({ events } as unknown as Pick<ApiClient, 'events'>);
    const signal = new AbortController().signal;
    const range = {
      start: new Date('2026-11-01T19:00:00Z'),
      end: new Date('2026-11-02T19:00:00Z'),
    };

    expect(await repo.listRange(range, 'Asia/Karachi', { signal })).toEqual([dentist]);
    expect(events.listAll).toHaveBeenCalledWith(
      { from: range.start, to: range.end, tz: 'Asia/Karachi' },
      { signal },
    );
    expect(await repo.search('dent')).toEqual([dentist]);
    expect(events.list).toHaveBeenCalledWith({ q: 'dent', limit: SEARCH_LIMIT }, undefined);
  });

  it('passes writes, deletes and Undo through to the API', async () => {
    const events = fakeEvents();
    const repo = createApiEventRepository({ events } as unknown as Pick<ApiClient, 'events'>);
    const input = { title: 'Dentist', start: '2026-11-02T11:00:00.000Z', timezone: 'Asia/Karachi' };
    expect(await repo.get('e1')).toBe(dentist);
    expect(await repo.create(input)).toBe(dentist);
    expect(await repo.update('e1', { title: 'Dentist (moved)' })).toBe(dentist);
    await repo.remove('e1');
    expect(await repo.restore('e1')).toBe(dentist);
    expect(events.get).toHaveBeenCalledWith('e1', undefined);
    expect(events.create).toHaveBeenCalledWith(input, undefined);
    expect(events.update).toHaveBeenCalledWith('e1', { title: 'Dentist (moved)' }, undefined);
    expect(events.remove).toHaveBeenCalledWith('e1', undefined);
    expect(events.restore).toHaveBeenCalledWith('e1', undefined);
  });
});
