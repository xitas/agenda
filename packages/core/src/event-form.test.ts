import { describe, expect, it } from 'vitest';
import {
  EVENT_FORM_MESSAGES,
  eventFromForm,
  formatDateInput,
  formFromEvent,
  localDateTimeToUtc,
  newEventForm,
  parseDateInput,
  REMINDER_CHOICES,
  utcToLocalDateTime,
} from './event-form.js';
import type { EventForm } from './event-form.js';

const KARACHI = 'Asia/Karachi';

const form = (fields: Partial<EventForm> = {}): EventForm => ({
  title: 'Dentist',
  allDay: false,
  startDate: '2026-10-28',
  startTime: '16:00',
  endDate: '2026-10-28',
  endTime: '17:00',
  color: 'blue',
  reminders: [],
  location: '',
  notes: '',
  ...fields,
});

describe('local date and time conversion', () => {
  it('reads wall-clock time in the given zone', () => {
    expect(localDateTimeToUtc('2026-10-28', '16:00', KARACHI)).toBe('2026-10-28T11:00:00.000Z');
    expect(utcToLocalDateTime('2026-10-28T11:00:00.000Z', KARACHI)).toEqual({
      date: '2026-10-28',
      time: '16:00',
    });
  });

  it('follows DST', () => {
    expect(localDateTimeToUtc('2026-03-29', '03:30', 'Europe/Berlin')).toBe(
      '2026-03-29T01:30:00.000Z',
    );
    expect(localDateTimeToUtc('2026-03-28', '03:30', 'Europe/Berlin')).toBe(
      '2026-03-28T02:30:00.000Z',
    );
  });
});

describe('newEventForm and formFromEvent', () => {
  it('starts a new event at the given time, an hour long', () => {
    expect(newEventForm(new Date('2026-10-28T13:30:00.000Z'), KARACHI)).toMatchObject({
      title: '',
      allDay: false,
      startDate: '2026-10-28',
      startTime: '18:30',
      endDate: '2026-10-28',
      endTime: '19:30',
      color: 'blue',
      reminders: [],
    });
    // Ending after midnight moves the end date.
    expect(newEventForm(new Date('2026-10-28T18:30:00.000Z'), KARACHI, 90)).toMatchObject({
      startDate: '2026-10-28',
      startTime: '23:30',
      endDate: '2026-10-29',
      endTime: '01:00',
    });
  });

  const stored = {
    title: 'Dentist',
    start: '2026-10-28T11:00:00.000Z',
    end: '2026-10-28T12:30:00.000Z',
    allDay: false,
    color: 'red' as const,
    reminders: [60, 10],
    location: null,
    notes: 'Bring the card',
  };

  it('fills the form from a timed event, in the viewer zone', () => {
    expect(formFromEvent(stored, KARACHI)).toEqual({
      title: 'Dentist',
      allDay: false,
      startDate: '2026-10-28',
      startTime: '16:00',
      endDate: '2026-10-28',
      endTime: '17:30',
      color: 'red',
      reminders: [10, 60],
      location: '',
      notes: 'Bring the card',
    });
    expect(formFromEvent({ ...stored, end: null }, KARACHI)).toMatchObject({ endTime: '17:00' });
  });

  it('shows an all-day end as the last day', () => {
    const conference = {
      ...stored,
      allDay: true,
      start: '2026-11-03',
      end: '2026-11-06',
      location: 'Hall B',
    };
    expect(formFromEvent(conference, KARACHI)).toMatchObject({
      allDay: true,
      startDate: '2026-11-03',
      endDate: '2026-11-05',
      location: 'Hall B',
    });
    expect(formFromEvent({ ...conference, end: null }, KARACHI)).toMatchObject({
      endDate: '2026-11-03',
    });
  });

  it('round-trips through eventFromForm', () => {
    const result = eventFromForm(formFromEvent(stored, KARACHI), KARACHI);
    expect(result).toEqual({
      ok: true,
      value: {
        title: 'Dentist',
        notes: 'Bring the card',
        start: '2026-10-28T11:00:00.000Z',
        end: '2026-10-28T12:30:00.000Z',
        allDay: false,
        timezone: KARACHI,
        location: null,
        color: 'red',
        reminders: [10, 60],
        rrule: null,
      },
    });
  });
});

describe('eventFromForm', () => {
  it('builds a timed event in UTC, keeping a given event zone', () => {
    const result = eventFromForm(
      form({ location: '  Clinic  ', reminders: [60, 10, 60] }),
      KARACHI,
      'Europe/Berlin',
    );
    expect(result).toMatchObject({
      ok: true,
      value: {
        start: '2026-10-28T11:00:00.000Z',
        end: '2026-10-28T12:00:00.000Z',
        timezone: 'Europe/Berlin',
        location: 'Clinic',
        reminders: [10, 60],
      },
    });
  });

  it('builds all-day events with an exclusive end, or none for one day', () => {
    expect(
      eventFromForm(form({ allDay: true, startTime: '', endTime: '' }), KARACHI),
    ).toMatchObject({
      ok: true,
      value: { allDay: true, start: '2026-10-28', end: null },
    });
    expect(eventFromForm(form({ allDay: true, endDate: '2026-10-30' }), KARACHI)).toMatchObject({
      ok: true,
      value: { start: '2026-10-28', end: '2026-10-31' },
    });
  });

  it.each([
    [{ title: '   ' }, { title: EVENT_FORM_MESSAGES.titleMissing }],
    [{ title: 'x'.repeat(201) }, { title: EVENT_FORM_MESSAGES.titleTooLong }],
    [{ startDate: '2026-02-30' }, { startDate: EVENT_FORM_MESSAGES.dateInvalid }],
    [{ endDate: '' }, { endDate: EVENT_FORM_MESSAGES.dateInvalid }],
    [{ startTime: '25:00' }, { startTime: EVENT_FORM_MESSAGES.timeInvalid }],
    [{ endTime: '' }, { endTime: EVENT_FORM_MESSAGES.timeInvalid }],
    [{ endTime: '16:00' }, { endTime: EVENT_FORM_MESSAGES.endBeforeStart }],
    [{ endDate: '2026-10-27', endTime: '18:00' }, { endDate: EVENT_FORM_MESSAGES.endBeforeStart }],
    [{ allDay: true, endDate: '2026-10-27' }, { endDate: EVENT_FORM_MESSAGES.endDayBeforeStart }],
  ])('rejects %o with a friendly message', (fields, errors) => {
    expect(eventFromForm(form(fields), KARACHI)).toEqual({ ok: false, errors });
  });

  it('reports several field errors at once', () => {
    expect(eventFromForm(form({ title: '', startTime: 'soon' }), KARACHI)).toEqual({
      ok: false,
      errors: {
        title: EVENT_FORM_MESSAGES.titleMissing,
        startTime: EVENT_FORM_MESSAGES.timeInvalid,
      },
    });
  });

  it('puts a schema error it did not foresee on a field', () => {
    expect(eventFromForm(form(), KARACHI, 'Not/AZone')).toEqual({
      ok: false,
      errors: { notes: 'Expected an IANA time zone such as "Asia/Karachi"' },
    });
  });

  it('offers the reminder choices from the design', () => {
    expect(REMINDER_CHOICES).toEqual([5, 10, 30, 60, 1440]);
  });
});

describe('date input', () => {
  const today = '2026-10-27';

  it('formats per locale', () => {
    expect(formatDateInput('2026-10-27', 'en-GB')).toBe('27 Oct 2026');
    expect(formatDateInput('2026-10-27', 'en-US')).toBe('Oct 27, 2026');
  });

  it.each([
    ['2026-11-03', 'en-GB', '2026-11-03'],
    ['27 Oct 2026', 'en-GB', '2026-10-27'],
    ['Oct 27, 2026', 'en-US', '2026-10-27'],
    ['3/4/2027', 'en-GB', '2027-04-03'],
    ['3/4/2027', 'en-US', '2027-03-04'],
    ['5 Nov', 'en-GB', '2026-11-05'],
    ['Tuesday 3 November 2026', 'en-GB', '2026-11-03'],
    ['tomorrow', 'en-GB', '2026-10-28'],
    ['  1 jan 2027 ', undefined, '2027-01-01'],
  ])('reads %s (%s) as %s', (text, locale, expected) => {
    expect(parseDateInput(text, { today, ...(locale === undefined ? {} : { locale }) })).toBe(
      expected,
    );
  });

  it.each(['', 'soon', '2026-02-30', '27 Oct and more', '31 Feb 2027'])('rejects %j', (text) => {
    expect(parseDateInput(text, { today, locale: 'en-GB' })).toBeNull();
  });

  it('reads back what it formats', () => {
    for (const locale of ['en-GB', 'en-US']) {
      expect(parseDateInput(formatDateInput('2027-02-28', locale), { today, locale })).toBe(
        '2027-02-28',
      );
    }
  });
});
