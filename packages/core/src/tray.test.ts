import { enGB } from 'date-fns/locale';
import { describe, expect, it } from 'vitest';
import { TRAY_EMPTY, trayItems } from './tray.js';
import type { AgendaEvent } from './types.js';

// Monday 2 November 2026, 10:00 in Karachi (UTC+5).
const now = new Date('2026-11-02T05:00:00.000Z');
const options = { now, timezone: 'Asia/Karachi', locale: enGB, hour12: false };

let nextId = 0;
const event = (overrides: Partial<AgendaEvent>): AgendaEvent => ({
  id: `0190f5a2-0000-7000-8000-${String(++nextId).padStart(12, '0')}`,
  title: 'Event',
  notes: '',
  start: '2026-11-02T10:00:00.000Z',
  end: null,
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

describe('trayItems', () => {
  it('lists what has not ended today and tomorrow, soonest first, each opening its day', () => {
    const items = trayItems(
      [
        event({ title: 'Call Ali', start: '2026-11-03T10:00:00.000Z' }),
        event({ title: 'Lunch', start: '2026-11-02T08:00:00.000Z' }),
        event({
          title: 'Standup',
          start: '2026-11-02T03:00:00.000Z',
          end: '2026-11-02T03:15:00.000Z',
        }),
        event({ title: 'Holiday', allDay: true, start: '2026-11-03', end: '2026-11-04' }),
        event({ title: 'Next week', start: '2026-11-09T10:00:00.000Z' }),
        event({ title: 'Gone', start: '2026-11-02T09:00:00.000Z', deletedAt: now.toISOString() }),
      ],
      options,
    );
    expect(items).toEqual([
      { label: 'Today, 13:00 · Lunch', path: '/day/2026-11-02' },
      { label: 'Tomorrow · Holiday', path: '/day/2026-11-03' },
      { label: 'Tomorrow, 15:00 · Call Ali', path: '/day/2026-11-03' },
    ]);
  });

  it('counts an event still going since yesterday as today’s', () => {
    const overnight = event({
      title: 'Flight',
      start: '2026-11-01T20:00:00.000Z',
      end: '2026-11-02T08:00:00.000Z',
    });
    expect(trayItems([overnight], options)).toEqual([
      { label: 'Today, 01:00 · Flight', path: '/day/2026-11-02' },
    ]);
  });

  it('shows at most five, and shortens long titles', () => {
    const many = Array.from({ length: 7 }, (_, i) =>
      event({ title: `Meeting ${String(i)}`, start: `2026-11-02T1${String(i)}:00:00.000Z` }),
    );
    expect(trayItems(many, options)).toHaveLength(5);
    const long = event({ title: 'A very long title that keeps going well past forty characters' });
    expect(trayItems([long], { ...options, hour12: true })[0]?.label).toBe(
      'Today, 3:00 PM · A very long title that keeps going well…',
    );
  });

  it('orders events at the same time by title', () => {
    const items = trayItems(
      [event({ title: 'Zoom call' }), event({ title: 'Agenda review' })],
      options,
    );
    expect(items.map((item) => item.label)).toEqual([
      'Today, 15:00 · Agenda review',
      'Today, 15:00 · Zoom call',
    ]);
  });

  it('says so when there is nothing', () => {
    expect(trayItems([], options)).toEqual([{ label: TRAY_EMPTY }]);
  });
});
