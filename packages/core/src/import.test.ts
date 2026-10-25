import { v5 } from 'uuid';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import seed from './__fixtures__/v0-seed.json' with { type: 'json' };
import { fromV0, ImportFormatError, parseImport, V0_ID_NAMESPACE } from './import.js';
import type { AgendaEvent } from './types.js';

const now = new Date('2026-11-01T08:00:00.000Z');
const generatedId = '0190f5a2-7c3e-7b1a-9d4e-1a2b3c4d5e6f';
const options = { timezone: 'Asia/Karachi', now, newId: () => generatedId };

const v1Event: AgendaEvent = {
  id: '0190f5a2-0000-7000-8000-000000000001',
  title: 'Dentist',
  notes: 'Bring the form',
  start: '2026-10-28T11:00:00.000Z',
  end: '2026-10-28T11:30:00.000Z',
  allDay: false,
  timezone: 'Asia/Karachi',
  location: 'Clinic',
  color: 'teal',
  reminders: [30],
  rrule: null,
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-02T09:00:00.000Z',
  deletedAt: null,
};

describe('fromV0', () => {
  it('converts the legacy seed events into all-day events', () => {
    const [meeting] = seed.map((row) => fromV0(row, options));
    expect(meeting).toEqual({
      id: '5f0c7a9e-2b1d-4c3e-9a8f-1d2e3f4a5b6c',
      title: 'Meeting',
      notes: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Debitis, repellat.',
      start: '2026-10-24',
      end: null,
      allDay: true,
      timezone: 'Asia/Karachi',
      location: null,
      color: 'blue',
      reminders: [],
      rrule: null,
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-01T08:00:00.000Z',
      deletedAt: null,
    });
  });

  it('maps each seed date to its local day in the given zone', () => {
    // The seed timestamps are 23:30 in Karachi, which is already the next day in Tokyo.
    const starts = (timezone: string) =>
      seed.map((row) => fromV0(row, { ...options, timezone }).start);
    expect(starts('Asia/Karachi')).toEqual(['2026-10-24', '2026-10-26', '2026-10-31']);
    expect(starts('Asia/Tokyo')).toEqual(['2026-10-25', '2026-10-27', '2026-11-01']);
  });

  it('reads a date picked at local midnight as that day, not the UTC day before', () => {
    // The v0 date picker stored midnight 24 Oct in Karachi as 19:00Z on the 23rd.
    const event = fromV0({ title: 'Picked', date: '2026-10-23T19:00:00.000Z' }, options);
    expect(event.start).toBe('2026-10-24');
  });

  it('keeps a plain v0 date as it is', () => {
    expect(fromV0({ title: 'Plain', date: '2026-10-24' }, options).start).toBe('2026-10-24');
  });

  it('maps a nanoid to the same UUID v5 every time, so re-imports match', () => {
    const row = { id: 'V1StGXR8_Z5jdHi6B-myT', title: 'Old', date: '2022-06-10T19:00:00.000Z' };
    const first = fromV0(row, options).id;
    expect(first).toBe(v5(row.id, V0_ID_NAMESPACE));
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5/);
    expect(fromV0(row, { ...options, newId: () => 'unused' }).id).toBe(first);
  });

  it('makes a new id for a row with no id', () => {
    expect(fromV0({ title: 'No id', date: '2026-10-24' }, options).id).toBe(generatedId);
    expect(fromV0({ id: '', title: 'Empty id', date: '2026-10-24' }, options).id).toBe(generatedId);
  });

  it('turns a missing or null description into empty notes', () => {
    expect(fromV0({ title: 'A', date: '2026-10-24', description: null }, options).notes).toBe('');
  });

  it('uses the current time and a v7 id when none are injected', () => {
    const event = fromV0({ title: 'Defaults', date: '2026-10-24' }, { timezone: 'UTC' });
    expect(event.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
    expect(Date.parse(event.createdAt)).toBeGreaterThan(Date.parse('2026-01-01T00:00:00Z'));
  });

  it('throws a ZodError when the result is not a valid event', () => {
    expect(() => fromV0({ title: '  ', date: '2026-10-24' }, options)).toThrow(ZodError);
  });

  it('rejects an invalid time zone option', () => {
    expect(() => fromV0({ title: 'A', date: '2026-10-24' }, { timezone: 'Nowhere' })).toThrow(
      'Invalid time zone: Nowhere',
    );
  });
});

describe('parseImport', () => {
  it('imports a mixed v0 and v1 file and reports skipped rows', () => {
    const input = [
      seed[0], // 0: v0, valid
      v1Event, // 1: v1, valid
      { title: 'x'.repeat(201), date: '2026-10-24' }, // 2: v0, title too long
      { ...v1Event, id: '0190f5a2-0000-7000-8000-000000000002', start: 'tomorrow' }, // 3
      42, // 4: not an object
      { name: 'Party', when: 'Friday' }, // 5: neither shape
      { ...v1Event, title: 'Copy' }, // 6: same id as row 1
      { ...v1Event, id: '0190f5a2-0000-7000-8000-000000000003', deletedAt: now.toISOString() }, // 7
      { title: 'Bad date', date: 'next week' }, // 8: v0, unparseable date
      seed[1], // 9: v0, valid
    ];

    const result = parseImport(input, options);

    expect(result.events.map((event) => event.title)).toEqual(['Meeting', 'Dentist', 'Vacation']);
    expect(result.indexes).toEqual([0, 1, 9]);
    expect(result.skipped).toEqual([
      { index: 2, reason: 'title: Too big: expected string to have <=200 characters' },
      { index: 3, reason: 'start: Expected a UTC ISO datetime' },
      { index: 4, reason: 'Not an event object' },
      { index: 5, reason: 'Unrecognized event format' },
      { index: 6, reason: 'Duplicate id 0190f5a2-0000-7000-8000-000000000001' },
      { index: 7, reason: 'Deleted event' },
      { index: 8, reason: 'v0 date: Invalid input' },
    ]);
  });

  it('passes v1 events through unchanged', () => {
    expect(parseImport([v1Event], options).events).toEqual([v1Event]);
  });

  it('skips a second v0 row with the same UUID', () => {
    const result = parseImport([seed[0], seed[0]], options);
    expect(result.events).toHaveLength(1);
    expect(result.skipped).toEqual([
      { index: 1, reason: 'Duplicate id 5f0c7a9e-2b1d-4c3e-9a8f-1d2e3f4a5b6c' },
    ]);
  });

  it('returns nothing for an empty file', () => {
    expect(parseImport([], options)).toEqual({ events: [], indexes: [], skipped: [] });
  });

  it('throws ImportFormatError when the file is not an array', () => {
    expect(() => parseImport({ events: [] }, options)).toThrow(ImportFormatError);
    expect(() => parseImport(null, options)).toThrow('Expected an array of events');
  });
});
