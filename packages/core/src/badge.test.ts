import { describe, expect, it } from 'vitest';
import { badgeCount, badgeText, nextBadgeChange } from './badge.js';
import type { AgendaEvent } from './types.js';

// Monday 2 November 2026, 10:00 in Karachi (UTC+5).
const now = new Date('2026-11-02T05:00:00.000Z');
const options = { now, timezone: 'Asia/Karachi' };

let nextId = 0;
const event = (overrides: Partial<AgendaEvent>): AgendaEvent => ({
  id: `0190f5a2-0000-7000-8000-${String(++nextId).padStart(12, '0')}`,
  title: 'Event',
  notes: '',
  start: '2026-11-02T10:00:00.000Z',
  end: '2026-11-02T11:00:00.000Z',
  allDay: false,
  timezone: 'Asia/Karachi',
  location: null,
  color: 'blue',
  reminders: [],
  rrule: null,
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
  deletedAt: null,
  ...overrides,
});

describe('badgeCount', () => {
  it('counts today’s timed events that haven’t ended, in progress included', () => {
    const events = [
      event({ title: 'later today' }),
      event({
        title: 'in progress',
        start: '2026-11-02T04:30:00.000Z',
        end: '2026-11-02T05:30:00.000Z',
      }),
      event({ title: 'no end, still within 30 min', start: '2026-11-02T04:45:00.000Z', end: null }),
      event({ title: 'over', start: '2026-11-02T03:00:00.000Z', end: '2026-11-02T04:00:00.000Z' }),
      event({ title: 'all day', allDay: true, start: '2026-11-02', end: null }),
      event({
        title: 'tomorrow',
        start: '2026-11-03T05:00:00.000Z',
        end: '2026-11-03T06:00:00.000Z',
      }),
      event({ title: 'deleted', deletedAt: '2026-11-01T00:00:00.000Z' }),
    ];
    expect(badgeCount(events, options)).toBe(3);
  });

  it('counts an overnight event that is still going today', () => {
    const overnight = event({ start: '2026-11-01T20:00:00.000Z', end: '2026-11-02T06:00:00.000Z' });
    expect(badgeCount([overnight], options)).toBe(1);
  });

  it('uses the viewer’s day, not UTC’s', () => {
    // 23:30 in Karachi on the 2nd is still the 2nd there, though UTC says 18:30.
    const late = event({ start: '2026-11-02T18:30:00.000Z', end: '2026-11-02T18:45:00.000Z' });
    expect(badgeCount([late], options)).toBe(1);
    expect(badgeCount([late], { now, timezone: 'Asia/Tokyo' })).toBe(0);
  });
});

describe('badgeText', () => {
  it('is empty for nothing and stays one glyph wide', () => {
    expect(badgeText(0)).toBe('');
    expect(badgeText(3)).toBe('3');
    expect(badgeText(9)).toBe('9');
    expect(badgeText(12)).toBe('9+');
  });
});

describe('nextBadgeChange', () => {
  it('is the next end of a timed event today', () => {
    const events = [
      event({ end: '2026-11-02T11:00:00.000Z' }),
      event({ start: '2026-11-02T04:30:00.000Z', end: '2026-11-02T05:30:00.000Z' }),
      event({ start: '2026-11-02T06:00:00.000Z', end: null }),
      event({ allDay: true, start: '2026-11-02', end: null }),
    ];
    expect(nextBadgeChange(events, options).toISOString()).toBe('2026-11-02T05:30:00.000Z');
  });

  it('is the end of the day when nothing ends sooner', () => {
    const tomorrow = event({ start: '2026-11-03T05:00:00.000Z', end: '2026-11-03T06:00:00.000Z' });
    // Midnight in Karachi is 19:00 UTC the day before.
    expect(nextBadgeChange([tomorrow], options).toISOString()).toBe('2026-11-02T19:00:00.000Z');
    expect(nextBadgeChange([], options).toISOString()).toBe('2026-11-02T19:00:00.000Z');
  });
});
