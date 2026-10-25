import ICAL from 'ical.js';
import { describe, expect, it } from 'vitest';
import { toICalendar } from './ics.js';
import type { AgendaEvent } from './types.js';

const now = new Date('2026-10-23T09:00:00.000Z');

const base: AgendaEvent = {
  id: '0190f5a2-0000-7000-8000-000000000001',
  title: 'Dentist',
  notes: '',
  start: '2026-10-24T11:00:00.000Z',
  end: '2026-10-24T12:30:00.000Z',
  allDay: false,
  timezone: 'Asia/Karachi',
  location: null,
  color: 'teal',
  reminders: [],
  rrule: null,
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-02T09:00:00.000Z',
  deletedAt: null,
};

const trip: AgendaEvent = {
  ...base,
  id: '0190f5a2-0000-7000-8000-000000000002',
  title: 'Trip',
  allDay: true,
  start: '2026-11-03',
  end: '2026-11-06',
};

function parse(ics: string) {
  const calendar = ICAL.Component.fromString(ics);
  return calendar.getAllSubcomponents('vevent').map((vevent) => new ICAL.Event(vevent));
}

describe('toICalendar', () => {
  it('produces a calendar that an iCalendar parser accepts', () => {
    const events = parse(toICalendar([base, trip], { now }));
    expect(events.map((event) => event.uid)).toEqual([base.id, trip.id]);
    expect(events.map((event) => event.summary)).toEqual(['Dentist', 'Trip']);
  });

  it('writes timed events as UTC date-times', () => {
    const [event] = parse(toICalendar([base], { now }));
    expect(event?.startDate.isDate).toBe(false);
    expect(event?.startDate.toJSDate().toISOString()).toBe(base.start);
    expect(event?.endDate.toJSDate().toISOString()).toBe(base.end);
  });

  it('writes all-day events as VALUE=DATE with the exclusive end unchanged', () => {
    const ics = toICalendar([trip], { now });
    expect(ics).toContain('DTSTART;VALUE=DATE:20261103\r\n');
    expect(ics).toContain('DTEND;VALUE=DATE:20261106\r\n');

    const [event] = parse(ics);
    expect(event?.startDate.isDate).toBe(true);
    expect(event?.startDate.toString()).toBe('2026-11-03');
    expect(event?.endDate.toString()).toBe('2026-11-06');
  });

  it('gives a single all-day event a one-day DTEND', () => {
    const ics = toICalendar([{ ...trip, end: null }], { now });
    expect(ics).toContain('DTEND;VALUE=DATE:20261104\r\n');
  });

  it('leaves out DTEND for a point-in-time event', () => {
    const ics = toICalendar([{ ...base, end: null }], { now });
    expect(ics).not.toContain('DTEND');
  });

  it('adds one display alarm per reminder', () => {
    const ics = toICalendar([{ ...base, reminders: [10, 60] }], { now });
    const calendar = ICAL.Component.fromString(ics);
    const alarms = calendar.getFirstSubcomponent('vevent')?.getAllSubcomponents('valarm') ?? [];
    const seconds = alarms.map((alarm) => {
      const trigger = alarm.getFirstPropertyValue('trigger');
      return trigger instanceof ICAL.Duration ? trigger.toSeconds() : null;
    });
    expect(seconds).toEqual([-600, -3600]);
  });

  it('escapes text and keeps notes and location', () => {
    const tricky = {
      ...base,
      title: 'Lunch; with, Sara\\Ali',
      notes: 'Line 1\nLine 2',
      location: 'Cafe, Main St',
    };
    const [event] = parse(toICalendar([tricky], { now }));
    expect(event?.summary).toBe('Lunch; with, Sara\\Ali');
    expect(event?.description).toBe('Line 1\nLine 2');
    expect(event?.location).toBe('Cafe, Main St');
  });

  it('folds long lines at 75 octets without splitting characters', () => {
    // 2-byte, 3-byte (€) and 4-byte (emoji) characters must never be split across lines.
    const title = `${'é'.repeat(60)} meeting ${'€'.repeat(30)} ${'🎉'.repeat(20)}`;
    const ics = toICalendar([{ ...base, title }], { now });
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(parse(ics)[0]?.summary).toBe(title);
  });

  it('uses CRLF line endings, a stamp and calendar metadata', () => {
    const ics = toICalendar([base], { now, name: 'Work' });
    expect(
      ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Agenda//Agenda//EN\r\n'),
    ).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTAMP:20261023T090000Z\r\n');
    expect(ics).toContain('X-WR-CALNAME:Work\r\n');
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/\n/);
  });

  it('skips soft-deleted events and handles an empty list', () => {
    const deleted = { ...base, deletedAt: '2026-10-22T00:00:00.000Z' };
    expect(parse(toICalendar([deleted], { now }))).toEqual([]);
    expect(parse(toICalendar([], { now }))).toEqual([]);
  });
});
