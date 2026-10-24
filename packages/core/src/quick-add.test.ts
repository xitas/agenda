import { describe, expect, it } from 'vitest';
import { parseQuickAdd, QUICK_ADD_WARNINGS } from './quick-add.js';
import { EventCreateSchema } from './schemas.js';

// Friday 23 October 2026, 14:00 in Karachi (UTC+5). Local HH:mm is (HH-5):mm in UTC.
const now = new Date('2026-10-23T09:00:00.000Z');
const karachi = { now, timezone: 'Asia/Karachi' };
const { noDate, noTitle, recurring } = QUICK_ADD_WARNINGS;

interface Expected {
  title: string;
  start: string;
  end?: string | null;
  color?: string;
  warnings?: string[];
}

const timed = (title: string, start: string, end: string | null = null) => ({
  title,
  start,
  end,
});
const allDay = (title: string, start: string, end: string | null = null) => ({
  title,
  start,
  end,
});

const cases: [string, Expected & { allDay: boolean }][] = [
  ['Dentist tomorrow 4pm', { ...timed('Dentist', '2026-10-24T11:00:00.000Z'), allDay: false }],
  ['Dentist tomorrow at 4pm', { ...timed('Dentist', '2026-10-24T11:00:00.000Z'), allDay: false }],
  [
    'lunch with Sara fri 1pm for 90 min',
    {
      // 1pm has passed today (a Friday), so the next Friday is used.
      ...timed('lunch with Sara', '2026-10-30T08:00:00.000Z', '2026-10-30T09:30:00.000Z'),
      allDay: false,
    },
  ],
  [
    'Flight 24 Dec 23:30 #blue',
    { ...timed('Flight', '2026-12-24T18:30:00.000Z'), allDay: false, color: 'blue' },
  ],
  [
    'standup every weekday 10am',
    {
      // 10am has passed and tomorrow is Saturday, so the first weekday is Monday.
      ...timed('standup', '2026-10-26T05:00:00.000Z'),
      allDay: false,
      warnings: [recurring],
    },
  ],
  [
    'workout daily 7am',
    { ...timed('workout', '2026-10-24T02:00:00.000Z'), allDay: false, warnings: [recurring] },
  ],
  [
    'gym every monday 6pm',
    { ...timed('gym', '2026-10-26T13:00:00.000Z'), allDay: false, warnings: [recurring] },
  ],
  ['pay rent', { ...allDay('pay rent', '2026-10-23'), allDay: true, warnings: [noDate] }],
  ['conference 3-5 nov', { ...allDay('conference', '2026-11-03', '2026-11-06'), allDay: true }],
  [
    'conference 3-5 nov for 2 days',
    {
      ...allDay('conference', '2026-11-03', '2026-11-06'),
      allDay: true,
      warnings: ['Ignored "for 2 days" because a date range was given'],
    },
  ],
  ['call mom tonight', { ...timed('call mom', '2026-10-23T15:00:00.000Z'), allDay: false }],
  ['call mom tonight 9pm', { ...timed('call mom', '2026-10-23T16:00:00.000Z'), allDay: false }],
  // 9am has already passed at 14:00, so the next 9am (tomorrow) is used.
  ['meeting 9am', { ...timed('meeting', '2026-10-24T04:00:00.000Z'), allDay: false }],
  ['meeting 4pm', { ...timed('meeting', '2026-10-23T11:00:00.000Z'), allDay: false }],
  // A stated day is kept even when the time is in the past.
  ['meeting today 9am', { ...timed('meeting', '2026-10-23T04:00:00.000Z'), allDay: false }],
  [
    'party #urgent sat 8pm',
    {
      ...timed('party #urgent', '2026-10-24T15:00:00.000Z'),
      allDay: false,
      warnings: ['Unknown tag #urgent'],
    },
  ],
  [
    'gym 6-7:30pm',
    { ...timed('gym', '2026-10-23T13:00:00.000Z', '2026-10-23T14:30:00.000Z'), allDay: false },
  ],
  [
    'gym 6-7pm for 2h',
    {
      ...timed('gym', '2026-10-23T13:00:00.000Z', '2026-10-23T14:00:00.000Z'),
      allDay: false,
      warnings: ['Ignored "for 2h" because a time range was given'],
    },
  ],
  [
    'party sat 10pm-2am',
    { ...timed('party', '2026-10-24T17:00:00.000Z', '2026-10-24T21:00:00.000Z'), allDay: false },
  ],
  // Day-first by default: 3 April. It has passed this year, so next year.
  ['dinner 3/4 7pm', { ...timed('dinner', '2027-04-03T14:00:00.000Z'), allDay: false }],
  ['trip next friday', { ...allDay('trip', '2026-10-30'), allDay: true }],
  ['dentist monday', { ...allDay('dentist', '2026-10-26'), allDay: true }],
  ['review in 2 hours', { ...timed('review', '2026-10-23T11:00:00.000Z'), allDay: false }],
  [
    'vacation tomorrow for 3 days',
    { ...allDay('vacation', '2026-10-24', '2026-10-27'), allDay: true },
  ],
  [
    'vacation for 2 days',
    { ...allDay('vacation', '2026-10-23', '2026-10-25'), allDay: true, warnings: [noDate] },
  ],
  [
    'Pay rent tomorrow for 2h',
    {
      ...allDay('Pay rent', '2026-10-24'),
      allDay: true,
      warnings: ['Ignored "for 2h" because no start time was given'],
    },
  ],
  [
    'lunch tomorrow 1pm for 1h with Ali',
    {
      ...timed('lunch with Ali', '2026-10-24T08:00:00.000Z', '2026-10-24T09:00:00.000Z'),
      allDay: false,
    },
  ],
  [
    'call for an hour tomorrow 3pm',
    { ...timed('call', '2026-10-24T10:00:00.000Z', '2026-10-24T11:00:00.000Z'), allDay: false },
  ],
  [
    'Call #RED office',
    { ...allDay('Call office', '2026-10-23'), allDay: true, color: 'red', warnings: [noDate] },
  ],
  [
    'lunch #red #blue tomorrow 1pm',
    {
      ...timed('lunch', '2026-10-24T08:00:00.000Z'),
      allDay: false,
      color: 'red',
      warnings: ['Only the first color tag was used; ignored #blue'],
    },
  ],
  [
    // A bare weekday that is today means today, not next week.
    'dinner fri or sat',
    {
      ...allDay('dinner or sat', '2026-10-23'),
      allDay: true,
      warnings: ['Only the first date was used; "sat" kept in the title'],
    },
  ],
  [
    'tomorrow 4pm',
    { ...timed('tomorrow 4pm', '2026-10-24T11:00:00.000Z'), allDay: false, warnings: [noTitle] },
  ],
];

describe('parseQuickAdd', () => {
  it.each(cases)('%s', (text, expected) => {
    const { draft, warnings } = parseQuickAdd(text, karachi);

    expect(draft).toMatchObject({
      title: expected.title,
      start: expected.start,
      end: expected.end ?? null,
      allDay: expected.allDay,
      timezone: 'Asia/Karachi',
      color: expected.color ?? 'blue',
    });
    expect(warnings).toEqual(expected.warnings ?? []);
    expect(EventCreateSchema.safeParse(draft).success).toBe(true);
  });

  describe('weekday recurrence', () => {
    // Saturday 24 October 2026, 14:00 in Karachi.
    const saturday = { now: new Date('2026-10-24T09:00:00.000Z'), timezone: 'Asia/Karachi' };

    it('keeps a time that is still ahead on a weekday', () => {
      expect(parseQuickAdd('standup weekdays 3pm', karachi).draft.start).toBe(
        '2026-10-23T10:00:00.000Z',
      );
    });

    it('skips Sunday as well as Saturday', () => {
      // 10am has passed on Saturday, so the next 10am is Sunday, which becomes Monday.
      expect(parseQuickAdd('standup weekdays 10am', saturday).draft.start).toBe(
        '2026-10-26T05:00:00.000Z',
      );
    });

    it('uses the first weekday for an all-day recurring event with no date', () => {
      const onFriday = parseQuickAdd('review every weekday', karachi);
      expect(onFriday.draft).toMatchObject({ title: 'review', start: '2026-10-23', allDay: true });
      expect(onFriday.warnings).toEqual([recurring, noDate]);
      expect(parseQuickAdd('review every weekday', saturday).draft.start).toBe('2026-10-26');
    });

    it('skips a weekend date given without a time', () => {
      expect(parseQuickAdd('report every weekday from sunday', karachi).draft.start).toBe(
        '2026-10-26',
      );
    });
  });

  it('does not read recurrence or durations inside a tag', () => {
    const { draft, warnings, matched } = parseQuickAdd('plan trip #weekly tomorrow', karachi);
    expect(draft).toMatchObject({ title: 'plan trip #weekly', start: '2026-10-24' });
    expect(warnings).toEqual(['Unknown tag #weekly']);
    expect(matched).toEqual([{ text: 'tomorrow', index: 18, kind: 'date' }]);
  });

  it('reads 3/4 month-first for a US locale', () => {
    const { draft } = parseQuickAdd('dinner 3/4 7pm', { ...karachi, locale: 'en-US' });
    expect(draft.start).toBe('2027-03-04T14:00:00.000Z');
  });

  it('uses the given zone, not the machine zone (tests run in UTC+14)', () => {
    const inKiritimati = parseQuickAdd('Dentist tomorrow 4pm', {
      now,
      timezone: 'Pacific/Kiritimati',
    });
    // 09:00Z is already 23:00 on 23 Oct in Kiritimati, so "tomorrow 4pm" is 24 Oct 16:00 there.
    expect(inKiritimati.draft.start).toBe('2026-10-24T02:00:00.000Z');
    expect(inKiritimati.draft.timezone).toBe('Pacific/Kiritimati');
    expect(parseQuickAdd('Dentist tomorrow 4pm', karachi).draft.start).toBe(
      '2026-10-24T11:00:00.000Z',
    );
  });

  it('uses the offset of the target date, not of now, across DST', () => {
    // Berlin is UTC+2 on 23 Oct but UTC+1 on 10 Jan.
    const { draft } = parseQuickAdd('brunch 10 jan 11am', { now, timezone: 'Europe/Berlin' });
    expect(draft.start).toBe('2027-01-10T10:00:00.000Z');
  });

  it('lists matched parts in text order with their kind', () => {
    expect(parseQuickAdd('lunch with Sara fri 1pm for 90 min #green', karachi).matched).toEqual([
      { text: 'fri 1pm', index: 16, kind: 'date' },
      { text: 'for 90 min', index: 24, kind: 'duration' },
      { text: '#green', index: 35, kind: 'tag' },
    ]);
    expect(parseQuickAdd('standup every weekday 10am', karachi).matched).toEqual([
      { text: 'every weekday', index: 8, kind: 'recurrence' },
      { text: '10am', index: 22, kind: 'date' },
    ]);
  });

  it('does not list unknown tags as matched', () => {
    expect(parseQuickAdd('party #urgent sat 8pm', karachi).matched).toEqual([
      { text: 'sat 8pm', index: 14, kind: 'date' },
    ]);
  });

  it('shortens a title over 200 characters', () => {
    const { draft, warnings } = parseQuickAdd(`${'x'.repeat(250)} tomorrow`, karachi);
    expect(draft.title).toHaveLength(200);
    expect(warnings).toEqual([QUICK_ADD_WARNINGS.titleTooLong]);
  });

  it('throws for empty text and invalid time zones', () => {
    expect(() => parseQuickAdd('   ', karachi)).toThrow('Quick add text is empty');
    expect(() => parseQuickAdd('lunch', { now, timezone: 'Nowhere' })).toThrow(
      'Invalid time zone: Nowhere',
    );
  });
});
