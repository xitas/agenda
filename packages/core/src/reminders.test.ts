import { enGB, enUS } from 'date-fns/locale';
import { describe, expect, it } from 'vitest';
import {
  dueReminders,
  nextReminderAt,
  pruneShown,
  REMINDER_GRACE_MS,
  REMINDER_KEEP_SHOWN_MS,
  reminderSchedule,
  reminderTime,
} from './reminders.js';
import type { AgendaEvent } from './types.js';

// Monday 2 November 2026, 10:00 in Karachi (UTC+5).
const now = new Date('2026-11-02T05:00:00.000Z');
const options = { now, timezone: 'Asia/Karachi', locale: enGB, hour12: false };

const event = (overrides: Partial<AgendaEvent> = {}): AgendaEvent => ({
  id: '0190f5a2-0000-7000-8000-000000000001',
  title: 'Dentist',
  notes: '',
  // 16:00 – 17:00 in Karachi.
  start: '2026-11-02T11:00:00.000Z',
  end: '2026-11-02T12:00:00.000Z',
  allDay: false,
  timezone: 'Asia/Karachi',
  location: null,
  color: 'blue',
  reminders: [30],
  rrule: null,
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
  deletedAt: null,
  ...overrides,
});

describe('reminderTime', () => {
  it('counts back from the start of a timed event', () => {
    expect(reminderTime(event(), 30, 'Asia/Karachi').toISOString()).toBe(
      '2026-11-02T10:30:00.000Z',
    );
  });

  it('counts back from 09:00 on the day of an all-day event, in the viewer’s zone', () => {
    const holiday = event({ allDay: true, start: '2026-11-03', end: '2026-11-04' });
    // 09:00 in Karachi is 04:00Z; an hour before is 08:00 local.
    expect(reminderTime(holiday, 60, 'Asia/Karachi').toISOString()).toBe(
      '2026-11-03T03:00:00.000Z',
    );
    expect(reminderTime(holiday, 0, 'America/New_York').toISOString()).toBe(
      '2026-11-03T14:00:00.000Z',
    );
  });
});

describe('reminderSchedule', () => {
  it('schedules each reminder with a title, a readable time and a stable key', () => {
    const dentist = event({ reminders: [30, 1440], location: 'Clinic' });
    expect(reminderSchedule([dentist], options)).toEqual([
      {
        key: `${dentist.id}:30:${dentist.start}`,
        atMs: Date.parse('2026-11-02T10:30:00.000Z'),
        title: 'Dentist',
        body: 'Today, 16:00 – 17:00 · Clinic',
      },
    ]);
  });

  it('says Tomorrow or the date when the event is on a later day', () => {
    // 12:00 tomorrow: the day-before reminder is at 12:00 today, the hour-before one tomorrow.
    const tomorrow = event({
      start: '2026-11-03T07:00:00.000Z',
      end: null,
      reminders: [1440, 60],
    });
    const later = event({
      id: '0190f5a2-0000-7000-8000-000000000002',
      start: '2026-11-04T04:00:00.000Z',
      end: null,
      reminders: [1440],
    });
    const bodies = reminderSchedule([tomorrow, later], options).map((r) => r.body);
    expect(bodies).toEqual(['Tomorrow, 12:00', 'Tomorrow, 09:00', 'Today, 12:00']);
    const us = reminderSchedule([later], { ...options, locale: enUS, horizonMs: 72 * 3_600_000 });
    expect(us.map((r) => r.body)).toEqual(['Tomorrow, 09:00']);
  });

  it('names a day further away by its date', () => {
    const trip = event({ allDay: true, start: '2026-11-05', end: null, reminders: [2 * 1440] });
    expect(reminderSchedule([trip], options)).toEqual([
      expect.objectContaining({
        body: 'Thu 5 Nov, All day',
        atMs: Date.parse('2026-11-03T04:00:00.000Z'),
      }),
    ]);
  });

  it('keeps reminders from the grace period up to the horizon, soonest first', () => {
    const justMissed = event({
      id: 'a',
      start: new Date(now.getTime() + 30 * 60_000 - REMINDER_GRACE_MS).toISOString(),
      end: null,
    });
    const tooLate = event({
      id: 'b',
      start: new Date(now.getTime() + 30 * 60_000 - REMINDER_GRACE_MS - 1).toISOString(),
      end: null,
    });
    const beyond = event({ id: 'c', start: '2026-11-04T06:00:00.000Z', end: null });
    const soon = event({ id: 'd', start: '2026-11-02T06:00:00.000Z', end: null, reminders: [5] });
    const keys = reminderSchedule([beyond, soon, tooLate, justMissed], options).map(
      (r) => r.key.split(':')[0],
    );
    expect(keys).toEqual(['a', 'd']);
  });

  it('skips deleted events, events without reminders and repeated offsets', () => {
    const list = reminderSchedule(
      [
        event({ id: 'deleted', deletedAt: '2026-11-01T00:00:00.000Z' }),
        event({ id: 'none', reminders: [] }),
        event({ id: 'twice', reminders: [30, 30] }),
      ],
      options,
    );
    expect(list.map((r) => r.key.split(':')[0])).toEqual(['twice']);
  });

  it('gives a moved event new keys, so its reminder fires again for the new time', () => {
    const before = reminderSchedule([event()], options)[0];
    const moved = reminderSchedule(
      [event({ start: '2026-11-02T12:00:00.000Z', end: '2026-11-02T13:00:00.000Z' })],
      options,
    )[0];
    expect(moved?.key).not.toBe(before?.key);
    // Building the schedule again gives the same keys: nothing fires twice.
    expect(reminderSchedule([event()], options)[0]?.key).toBe(before?.key);
  });

  it('follows the 12-hour clock setting', () => {
    const [reminder] = reminderSchedule([event()], { ...options, hour12: true });
    expect(reminder?.body).toBe('Today, 4:00 PM – 5:00 PM');
  });
});

describe('the shown-once rule', () => {
  const NOW = 1_793_000_000_000;
  const at = (key: string, atMs: number) => ({ key, atMs, title: 'Dentist', body: 'Today' });

  it('shows what is due, up to the grace period late, and never a key twice', () => {
    const schedule = [
      at('due-now', NOW),
      at('a-minute-late', NOW - 60_000),
      at('too-late', NOW - REMINDER_GRACE_MS - 1),
      at('later', NOW + 1),
      at('shown', NOW - 1_000),
    ];
    const due = dueReminders(schedule, { shown: NOW - 1_000 }, NOW);
    expect(due.map((r) => r.key)).toEqual(['due-now', 'a-minute-late']);
  });

  it('finds the next reminder not yet shown', () => {
    const schedule = [at('shown', NOW + 5_000), at('next', NOW + 10_000), at('last', NOW + 20_000)];
    expect(nextReminderAt(schedule, { shown: NOW + 5_000 }, NOW)).toBe(NOW + 10_000);
    expect(nextReminderAt([at('past', NOW - 1)], {}, NOW)).toBeNull();
  });

  it('forgets keys after two days', () => {
    const shown = { old: NOW - REMINDER_KEEP_SHOWN_MS - 1, recent: NOW - 1_000 };
    expect(pruneShown(shown, NOW)).toEqual({ recent: NOW - 1_000 });
  });
});
