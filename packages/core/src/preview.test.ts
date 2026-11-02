import { enGB, enUS } from 'date-fns/locale';
import { describe, expect, it } from 'vitest';
import {
  eventColorName,
  eventStartDay,
  formatShortDate,
  previewWhen,
  quickAddPreview,
} from './preview.js';
import { parseQuickAdd } from './quick-add.js';

const karachi = { timezone: 'Asia/Karachi', locale: enGB, hour12: false };

describe('previewWhen', () => {
  it('prefixes the day for single-day events', () => {
    expect(previewWhen({ start: '2026-10-27', end: null, allDay: true }, karachi)).toBe(
      'Tue 27 Oct · All day',
    );
    expect(previewWhen({ start: '2026-10-27', end: '2026-10-28', allDay: true }, karachi)).toBe(
      'Tue 27 Oct · All day',
    );
    expect(
      previewWhen(
        { start: '2026-10-27T10:00:00.000Z', end: '2026-10-27T11:00:00.000Z', allDay: false },
        karachi,
      ),
    ).toBe('Tue 27 Oct · 15:00 – 16:00');
  });

  it('shows the full range for events that span days', () => {
    expect(previewWhen({ start: '2026-11-03', end: '2026-11-06', allDay: true }, karachi)).toBe(
      'Tue, 3 Nov – Thu, 5 Nov',
    );
    expect(
      previewWhen(
        { start: '2026-10-27T17:00:00.000Z', end: '2026-10-27T21:00:00.000Z', allDay: false },
        karachi,
      ),
    ).toBe('Tue, 27 Oct, 22:00 – Wed, 28 Oct, 02:00');
  });

  it('follows the locale and the clock', () => {
    const us = { timezone: 'Asia/Karachi', locale: enUS, hour12: true };
    expect(previewWhen({ start: '2026-10-27T10:00:00.000Z', end: null, allDay: false }, us)).toBe(
      'Tue, Oct 27 · 3:00 PM',
    );
  });
});

describe('preview parts', () => {
  it('finds the start day in the viewer’s zone, keeping all-day dates as they are', () => {
    expect(
      eventStartDay({ start: '2026-10-27T20:00:00.000Z', allDay: false }, 'Asia/Karachi'),
    ).toBe('2026-10-28');
    expect(eventStartDay({ start: '2026-10-27', allDay: true }, 'Pacific/Kiritimati')).toBe(
      '2026-10-27',
    );
  });

  it('writes short dates and color names', () => {
    expect(formatShortDate('2026-10-27', 'en-GB')).toBe('Tue 27 Oct');
    expect(formatShortDate('2026-10-27', 'en-US')).toBe('Tue, Oct 27');
    expect(eventColorName('teal')).toBe('Teal');
  });
});

describe('quickAddPreview', () => {
  it('turns a parse result into the chip: title, when, color and warnings', () => {
    const parsed = parseQuickAdd('Dentist 4pm #red', {
      now: new Date('2026-10-27T05:00:00.000Z'),
      timezone: 'Asia/Karachi',
      locale: 'en-GB',
    });
    expect(quickAddPreview(parsed, karachi)).toEqual({
      title: 'Dentist',
      when: 'Tue 27 Oct · 16:00',
      color: 'red',
      colorName: 'Red',
      warnings: [],
    });
  });
});
