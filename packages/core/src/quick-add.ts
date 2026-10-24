/**
 * Quick add: turns "Dentist tomorrow 4pm #red" into an EventCreate draft.
 *
 * Rules (also the answers to "what did the user mean?"):
 * - Time zone: phrases are read in `timezone`, never the machine's zone. chrono's own
 *   timezone option still mixes in the machine's zone when forward-dating, so chrono only
 *   ever sees wall-clock time: it gets a reference Date whose machine-local fields equal
 *   `now` in `timezone`, and the wall-clock parts it returns are turned into an instant
 *   with TZDate, so DST on the target date is correct. (Relative phrases like "in 2 hours"
 *   that cross a DST change can be an hour off; that is accepted.)
 * - No time given ("dentist tomorrow") → an all-day event on a plain date. A date range
 *   ("3-5 nov") → a multi-day all-day event with an exclusive end (6 Nov).
 * - A time with no duration → `end` is null. "for 90 min" / "for 2h" / "for 3 days" or a
 *   range ("3-5pm", "10pm-2am" ends the next day) set the end. A range beats a duration.
 *   An hour duration on an all-day event is ignored with a warning.
 * - Past times move forward: when the day was implied ("meeting 9am" at 14:00, "fri 1pm"
 *   on a Friday afternoon) the next occurrence is used. A stated day is kept even if it
 *   is in the past ("today 9am"). Dates without a year that have passed this year move
 *   to next year ("24 Dec" typed in January means this December; "3 Jan" means next).
 * - A weekday with no time that is today ("dinner fri" on a Friday) means today.
 * - "tonight" with no time means 20:00 local; "next friday" is the coming Friday.
 * - Ambiguous numeric dates ("3/4") are day-first (3 April) unless the locale's region is
 *   US ("en-US"), which reads them month-first (4 March). Only English is parsed.
 * - "#red" style tags set the color; only the 8 EventColor names count, the first wins.
 *   Unknown tags stay in the title and produce a warning.
 * - Recurrence words ("every Monday", "daily", "weekdays") produce a warning; the event
 *   is created for the first occurrence ("weekdays" skips Saturday and Sunday).
 * - Only the first date phrase is used; later ones stay in the title with a warning.
 * - No date found → all-day today plus a warning. A date but no title → the whole text
 *   becomes the title, the date is kept, plus a warning. Empty text throws.
 */
import { TZDate } from '@date-fns/tz';
import * as chrono from 'chrono-node';
import type { ParsedComponents, ParsedResult } from 'chrono-node';
import { plainDateInTz } from './dates.js';
import { EVENT_COLORS, EventCreateSchema, TimeZoneSchema } from './schemas.js';
import type { EventColor, EventCreate } from './types.js';

export interface QuickAddOptions {
  /** The moment the user is typing; relative words ("tomorrow") are based on it. */
  now: Date;
  /** IANA zone the phrase is read in, e.g. "Asia/Karachi". */
  timezone: string;
  /** BCP 47 tag; only decides day-first vs month-first numeric dates. Default day-first. */
  locale?: string;
}

export type QuickAddMatchKind = 'date' | 'duration' | 'tag' | 'recurrence';

export interface QuickAddMatch {
  text: string;
  index: number;
  kind: QuickAddMatchKind;
}

export interface QuickAddResult {
  /** Always valid for EventCreateSchema, with every default filled in. */
  draft: EventCreate;
  /** Recognised parts of the text, in order, so the UI can highlight them. */
  matched: QuickAddMatch[];
  warnings: string[];
}

export const QUICK_ADD_WARNINGS = {
  noDate: 'No date found, so this was added for today',
  noTitle: 'Add a title',
  recurring: "Recurring events aren't supported yet",
  titleTooLong: 'Title was shortened to 200 characters',
} as const;

const MAX_TITLE = 200;
const TONIGHT_HOUR = 20;
const MINUTES = { minute: 1, hour: 60, day: 24 * 60 } as const;

const DURATION = /\bfor\s+(?:(an?)|(\d+(?:\.\d+)?))\s*(minutes?|mins?|m|hours?|hrs?|h|days?|d)\b/gi;
const TAG = /(^|\s)(#[a-z][\w-]*)/gi;
const RECURRENCE =
  /\bevery\s+(?:other\s+)?(?:day|weekday|week|month|year)s?\b|\bevery\b(?=\s+(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\b)|\b(?:daily|weekly|monthly|yearly|annually|weekdays)\b/gi;
const BARE_WEEKDAY = /^(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?$/i;
// Leftover joining words at either end of the title, e.g. "Dentist at" once "4pm" is removed.
const EDGE_CONNECTORS =
  /^(?:(?:at|on|from|for|by|and)\b|[-–,;:])\s*|\s*(?:\b(?:at|on|from|for|by|and)|[-–,;:])$/i;

interface Span {
  index: number;
  length: number;
}

function defined<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`quick-add: missing ${what}`);
  return value;
}

function unitMinutes(unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith('d')) return MINUTES.day;
  if (u.startsWith('h')) return MINUTES.hour;
  return MINUTES.minute;
}

function isColor(name: string): name is EventColor {
  return (EVENT_COLORS as readonly string[]).includes(name);
}

function inside(spans: Span[], index: number): boolean {
  return spans.some((span) => index >= span.index && index < span.index + span.length);
}

/**
 * Replaces each span with one space for chrono (long runs of spaces confuse its patterns)
 * and returns, for every character of the result, its index in the original text.
 */
function maskForChrono(text: string, spans: Span[]): { masked: string; toOriginal: number[] } {
  const sorted = [...spans].sort((a, b) => a.index - b.index);
  let masked = '';
  const toOriginal: number[] = [];
  let cursor = 0;
  const copyUntil = (end: number) => {
    for (; cursor < end; cursor++) {
      masked += text.charAt(cursor);
      toOriginal.push(cursor);
    }
  };
  for (const { index, length } of sorted) {
    copyUntil(index);
    masked += ' ';
    toOriginal.push(index);
    cursor = Math.max(cursor, index + length);
  }
  copyUntil(text.length);
  return { masked, toOriginal };
}

/** The same moment as `now`, as a Date whose machine-local fields read `now` in `timezone`. */
function wallClockReference(now: Date, timezone: string): Date {
  const local = new TZDate(now.getTime(), timezone);
  return new Date(
    local.getFullYear(),
    local.getMonth(),
    local.getDate(),
    local.getHours(),
    local.getMinutes(),
    local.getSeconds(),
  );
}

/** Replaces spans with spaces, keeping indexes, so they drop out of the title. */
function blank(text: string, spans: Span[]): string {
  let out = text;
  for (const { index, length } of spans) {
    out = out.slice(0, index) + ' '.repeat(length) + out.slice(index + length);
  }
  return out;
}

function tidyTitle(text: string): string {
  let title = text.replace(/\s+/g, ' ').trim();
  for (let previous = ''; previous !== title;) {
    previous = title;
    title = title.replace(EDGE_CONNECTORS, '').trim();
  }
  return title;
}

function part(c: ParsedComponents, key: 'year' | 'month' | 'day' | 'hour' | 'minute'): number {
  return defined(c.get(key), key);
}

function plainDate(c: ParsedComponents): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(part(c, 'year'))}-${pad(part(c, 'month'))}-${pad(part(c, 'day'))}`;
}

function addDaysToPlain(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function instant(c: ParsedComponents, timezone: string, hour = part(c, 'hour')): Date {
  const local = new TZDate(
    part(c, 'year'),
    part(c, 'month') - 1,
    part(c, 'day'),
    hour,
    part(c, 'minute'),
    timezone,
  );
  return new Date(local.getTime());
}

/** Days to add so a date with this weekday (0 = Sunday) lands on Monday–Friday. */
function daysToWeekday(weekday: number): number {
  if (weekday === 6) return 2;
  if (weekday === 0) return 1;
  return 0;
}

function nextWeekdayPlain(date: string): string {
  return addDaysToPlain(date, daysToWeekday(new Date(`${date}T00:00:00.000Z`).getUTCDay()));
}

function nextWeekdayInstant(date: Date, timezone: string): Date {
  const local = new TZDate(date.getTime(), timezone);
  local.setDate(local.getDate() + daysToWeekday(local.getDay()));
  return new Date(local.getTime());
}

/**
 * Parses a quick-add phrase into an event draft. Throws a RangeError for empty text or
 * an invalid time zone; everything else produces a draft, with warnings if needed.
 */
export function parseQuickAdd(text: string, options: QuickAddOptions): QuickAddResult {
  if (text.trim() === '') throw new RangeError('Quick add text is empty');
  const { now, timezone } = options;
  if (!TimeZoneSchema.safeParse(timezone).success) {
    throw new RangeError(`Invalid time zone: ${timezone}`);
  }

  const matched: QuickAddMatch[] = [];
  const warnings: string[] = [];
  const tags: Span[] = []; // every #tag, known or not
  const hidden: Span[] = []; // removed from the title and from chrono's input

  let color: EventColor | undefined;
  for (const m of text.matchAll(TAG)) {
    const tag = defined(m[2], 'tag');
    const span = { index: m.index + defined(m[1], 'tag prefix').length, length: tag.length };
    tags.push(span);
    const name = tag.slice(1).toLowerCase();
    if (!isColor(name)) {
      warnings.push(`Unknown tag ${tag}`);
      continue;
    }
    matched.push({ text: tag, index: span.index, kind: 'tag' });
    hidden.push(span);
    if (color === undefined) color = name;
    else warnings.push(`Only the first color tag was used; ignored ${tag}`);
  }

  let durationMinutes: number | undefined;
  let durationText = '';
  for (const m of text.matchAll(DURATION)) {
    if (inside(tags, m.index)) continue;
    hidden.push({ index: m.index, length: m[0].length });
    matched.push({ text: m[0], index: m.index, kind: 'duration' });
    if (durationMinutes === undefined) {
      const amount = m[1] === undefined ? Number(m[2]) : 1;
      durationMinutes = Math.round(amount * unitMinutes(defined(m[3], 'unit')));
      durationText = m[0];
    }
  }

  let recurring = false;
  let weekdaysOnly = false;
  for (const m of text.matchAll(RECURRENCE)) {
    if (inside(tags, m.index)) continue;
    hidden.push({ index: m.index, length: m[0].length });
    matched.push({ text: m[0], index: m.index, kind: 'recurrence' });
    recurring = true;
    if (/weekday/i.test(m[0])) weekdaysOnly = true;
  }
  if (recurring) warnings.push(QUICK_ADD_WARNINGS.recurring);

  const parser = /-US$/i.test(options.locale ?? '') ? chrono.en.casual : chrono.en.GB;
  const { masked, toOriginal } = maskForChrono(text, [...tags, ...hidden]);
  const results: ParsedResult[] = parser.parse(masked, wallClockReference(now, timezone), {
    forwardDate: true,
  });
  // chrono's positions refer to the masked text; map them back to the original.
  const located = results.map((result) => {
    const index = defined(toOriginal[result.index], 'start index');
    const last = defined(toOriginal[result.index + result.text.length - 1], 'end index');
    return { result, index, text: text.slice(index, last + 1) };
  });
  const [first, ...extra] = located;
  if (extra.length > 0) {
    const kept = extra.map((r) => r.text).join('", "');
    warnings.push(`Only the first date was used; "${kept}" kept in the title`);
  }

  const today = plainDateInTz(now, timezone);
  let allDay = true;
  let start = today;
  let end: string | null = null;

  if (first === undefined) {
    warnings.push(QUICK_ADD_WARNINGS.noDate);
    if (weekdaysOnly) start = nextWeekdayPlain(start);
    if (durationMinutes !== undefined && durationMinutes % MINUTES.day === 0) {
      end = addDaysToPlain(start, durationMinutes / MINUTES.day);
    }
  } else {
    hidden.push({ index: first.index, length: first.text.length });
    matched.push({ text: first.text, index: first.index, kind: 'date' });
    const { start: from, end: to } = first.result;
    const tonight = /\btonight\b/i.test(first.text);

    if (!from.isCertain('hour') && !tonight) {
      start = plainDate(from);
      // chrono moves a bare weekday that is today to next week; "fri" on a Friday means today.
      if (BARE_WEEKDAY.test(first.text) && start === addDaysToPlain(today, 7)) start = today;
      if (weekdaysOnly) start = nextWeekdayPlain(start);
      if (to) {
        end = addDaysToPlain(plainDate(to), 1);
        if (durationMinutes !== undefined) {
          warnings.push(`Ignored "${durationText}" because a date range was given`);
        }
      } else if (durationMinutes !== undefined) {
        if (durationMinutes % MINUTES.day === 0) {
          end = addDaysToPlain(start, durationMinutes / MINUTES.day);
        } else {
          warnings.push(`Ignored "${durationText}" because no start time was given`);
        }
      }
    } else {
      allDay = false;
      const hour = from.isCertain('hour') ? part(from, 'hour') : TONIGHT_HOUR;
      let startAt = instant(from, timezone, hour);
      if (weekdaysOnly) startAt = nextWeekdayInstant(startAt, timezone);
      start = startAt.toISOString();
      if (to) {
        end = instant(to, timezone).toISOString();
        if (durationMinutes !== undefined) {
          warnings.push(`Ignored "${durationText}" because a time range was given`);
        }
      } else if (durationMinutes !== undefined) {
        end = new Date(startAt.getTime() + durationMinutes * 60_000).toISOString();
      }
    }
  }

  let title = tidyTitle(blank(text, hidden));
  if (title === '') {
    title = tidyTitle(text);
    warnings.push(QUICK_ADD_WARNINGS.noTitle);
  }
  if (title.length > MAX_TITLE) {
    title = title.slice(0, MAX_TITLE).trimEnd();
    warnings.push(QUICK_ADD_WARNINGS.titleTooLong);
  }

  const draft = EventCreateSchema.parse({
    title,
    start,
    end,
    allDay,
    timezone,
    ...(color === undefined ? {} : { color }),
  });

  return { draft, matched: matched.sort((a, b) => a.index - b.index), warnings };
}
