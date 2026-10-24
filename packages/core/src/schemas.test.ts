import { describe, expect, it } from 'vitest';
import {
  AgendaEventSchema,
  checkEventTiming,
  EventColorSchema,
  EventCreateSchema,
  EventPatchSchema,
  TimeZoneSchema,
} from './schemas.js';
import type { AgendaEvent, EventCreateInput } from './types.js';

const validEvent: AgendaEvent = {
  id: '0190f5a2-7c3e-7b1a-9d4e-1a2b3c4d5e6f',
  title: 'Dentist',
  notes: '',
  start: '2026-10-24T11:00:00.000Z',
  end: '2026-10-24T12:00:00.000Z',
  allDay: false,
  timezone: 'Asia/Karachi',
  location: null,
  color: 'teal',
  reminders: [10, 60],
  rrule: null,
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
  deletedAt: null,
};

function issuesFor(input: unknown): string[] {
  const result = AgendaEventSchema.safeParse(input);
  return result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

describe('AgendaEventSchema', () => {
  it('accepts a valid timed event', () => {
    expect(AgendaEventSchema.parse(validEvent)).toEqual(validEvent);
  });

  it('accepts an all-day event with plain dates and an exclusive end', () => {
    const event = { ...validEvent, allDay: true, start: '2026-10-24', end: '2026-10-27' };
    expect(AgendaEventSchema.safeParse(event).success).toBe(true);
  });

  it('accepts a point-in-time event with no end', () => {
    expect(AgendaEventSchema.safeParse({ ...validEvent, end: null }).success).toBe(true);
  });

  it('trims the title and drops unknown keys', () => {
    const parsed = AgendaEventSchema.parse({ ...validEvent, title: '  Dentist  ', extra: 1 });
    expect(parsed.title).toBe('Dentist');
    expect(parsed).not.toHaveProperty('extra');
  });

  it.each([
    ['an empty title', { title: '   ' }, 'title'],
    ['a title over 200 characters', { title: 'x'.repeat(201) }, 'title'],
    ['a non-UUID id', { id: 'V1StGXR8_Z5jdHi6B-myT' }, 'id'],
    ['an unknown color', { color: 'orange' }, 'color'],
    ['an offset instead of UTC', { start: '2026-10-24T16:00:00+05:00' }, 'start'],
    ['a date-only start on a timed event', { start: '2026-10-24' }, 'start'],
    ['a negative reminder', { reminders: [-5] }, 'reminders.0'],
    ['a fractional reminder', { reminders: [1.5] }, 'reminders.0'],
    ['duplicate reminders', { reminders: [10, 10] }, 'reminders'],
    ['a raw offset as time zone', { timezone: '+05:00' }, 'timezone'],
    ['an unknown time zone', { timezone: 'Mars/Olympus' }, 'timezone'],
    ['a bad deletedAt', { deletedAt: 'yesterday' }, 'deletedAt'],
  ])('rejects %s', (_name, override, path) => {
    const issues = issuesFor({ ...validEvent, ...override });
    expect(issues.some((issue) => issue.startsWith(`${path}:`))).toBe(true);
  });

  it('rejects a missing required field', () => {
    const withoutTitle: Partial<AgendaEvent> = { ...validEvent };
    delete withoutTitle.title;
    expect(issuesFor(withoutTitle)).toEqual([
      'title: Invalid input: expected string, received undefined',
    ]);
  });
});

describe('checkEventTiming', () => {
  it('requires end after start for timed events', () => {
    expect(
      checkEventTiming({
        allDay: false,
        start: '2026-10-24T12:00:00.000Z',
        end: '2026-10-24T12:00:00.000Z',
      }),
    ).toEqual([{ path: ['end'], message: 'End must be after start' }]);
  });

  it('treats the all-day end as exclusive, so it must be a later date', () => {
    expect(checkEventTiming({ allDay: true, start: '2026-10-24', end: '2026-10-24' })).toEqual([
      { path: ['end'], message: 'End must be after start' },
    ]);
    expect(checkEventTiming({ allDay: true, start: '2026-10-24', end: '2026-10-25' })).toEqual([]);
  });

  it('rejects instants on all-day events and impossible dates', () => {
    expect(
      checkEventTiming({ allDay: true, start: '2026-10-24T00:00:00.000Z', end: '2026-02-30' }),
    ).toEqual([
      { path: ['start'], message: 'Expected a date (YYYY-MM-DD) for all-day events' },
      { path: ['end'], message: 'Expected a date (YYYY-MM-DD) for all-day events' },
    ]);
  });

  it('skips the order check when start is already invalid', () => {
    expect(
      checkEventTiming({ allDay: false, start: 'soon', end: '2026-10-24T12:00:00.000Z' }),
    ).toEqual([{ path: ['start'], message: 'Expected a UTC ISO datetime' }]);
  });
});

describe('EventCreateSchema', () => {
  it('fills defaults so only title, start and timezone are required', () => {
    const input: EventCreateInput = {
      title: 'Standup',
      start: '2026-10-26T04:00:00.000Z',
      timezone: 'Asia/Karachi',
    };
    expect(EventCreateSchema.parse(input)).toEqual({
      title: 'Standup',
      notes: '',
      start: '2026-10-26T04:00:00.000Z',
      end: null,
      allDay: false,
      timezone: 'Asia/Karachi',
      location: null,
      color: 'blue',
      reminders: [],
      rrule: null,
    });
  });

  it('keeps a client-generated id', () => {
    const id = '0190f5a2-7c3e-7b1a-9d4e-1a2b3c4d5e6f';
    const parsed = EventCreateSchema.parse({
      id,
      title: 'Lunch',
      start: '2026-10-25',
      allDay: true,
      timezone: 'Asia/Karachi',
    });
    expect(parsed.id).toBe(id);
  });

  it('gives each parse its own reminders array', () => {
    const input = { title: 'A', start: '2026-10-26T04:00:00.000Z', timezone: 'UTC' };
    const first = EventCreateSchema.parse(input);
    const second = EventCreateSchema.parse(input);
    expect(first.reminders).not.toBe(second.reminders);
  });

  it('applies the timing rules', () => {
    const result = EventCreateSchema.safeParse({
      title: 'Trip',
      start: '2026-10-24',
      timezone: 'Asia/Karachi',
    });
    expect(result.success).toBe(false);
  });
});

describe('EventPatchSchema', () => {
  it('accepts a single field', () => {
    expect(EventPatchSchema.parse({ color: 'red' })).toEqual({ color: 'red' });
  });

  it('rejects an empty patch, including one with only unknown keys', () => {
    expect(EventPatchSchema.safeParse({}).success).toBe(false);
    expect(EventPatchSchema.safeParse({ id: 'x', createdAt: 'y' }).success).toBe(false);
  });

  it('validates the fields it contains', () => {
    expect(EventPatchSchema.safeParse({ title: '' }).success).toBe(false);
  });
});

describe('EventColorSchema and TimeZoneSchema', () => {
  it('lists the eight category colors', () => {
    expect(EventColorSchema.options).toEqual([
      'slate',
      'blue',
      'green',
      'amber',
      'red',
      'violet',
      'pink',
      'teal',
    ]);
  });

  it('accepts IANA names and UTC', () => {
    expect(TimeZoneSchema.safeParse('Asia/Karachi').success).toBe(true);
    expect(TimeZoneSchema.safeParse('UTC').success).toBe(true);
  });
});
