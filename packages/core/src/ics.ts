import type { AgendaEvent } from './types.js';

export interface ICalendarOptions {
  /** Written as DTSTAMP, the time the calendar file was created. */
  now: Date;
  /** Shown as the calendar's name by apps that support X-WR-CALNAME. */
  name?: string;
}

const MAX_LINE_OCTETS = 75;

/** UTF-8 length of one character (code point), without relying on TextEncoder. */
function utf8Length(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  if (code < 0x80) return 1;
  if (code < 0x800) return 2;
  return code < 0x10000 ? 3 : 4;
}

/** `2026-10-24T11:00:00.000Z` → `20261024T110000Z` (UTC date-time form). */
function utcDateTime(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** `2026-10-24` → `20261024` (DATE form). */
function plainDate(date: string): string {
  return date.replace(/-/g, '');
}

function nextDay(date: string): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/** TEXT escaping from RFC 5545 §3.3.11. */
function text(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Folds a content line to at most 75 octets per physical line (RFC 5545 §3.1). Each
 * continuation line starts with one space, and multi-byte characters are never split.
 */
function fold(line: string): string {
  const parts: string[] = [];
  let current = '';
  let octets = 0;
  for (const char of line) {
    const size = utf8Length(char);
    if (octets + size > MAX_LINE_OCTETS) {
      parts.push(current);
      current = ` ${char}`;
      octets = 1 + size;
    } else {
      current += char;
      octets += size;
    }
  }
  parts.push(current);
  return parts.join('\r\n');
}

function eventLines(event: AgendaEvent, stamp: string): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.id}`,
    `DTSTAMP:${stamp}`,
    `CREATED:${utcDateTime(event.createdAt)}`,
    `LAST-MODIFIED:${utcDateTime(event.updatedAt)}`,
    `SUMMARY:${text(event.title)}`,
  ];

  if (event.allDay) {
    // DTEND is exclusive in iCalendar too, so the stored end maps across unchanged.
    lines.push(`DTSTART;VALUE=DATE:${plainDate(event.start)}`);
    lines.push(`DTEND;VALUE=DATE:${plainDate(event.end ?? nextDay(event.start))}`);
  } else {
    lines.push(`DTSTART:${utcDateTime(event.start)}`);
    // A date-time DTSTART with no DTEND is a point in time, matching end = null.
    if (event.end !== null) lines.push(`DTEND:${utcDateTime(event.end)}`);
  }

  if (event.notes !== '') lines.push(`DESCRIPTION:${text(event.notes)}`);
  if (event.location !== null && event.location !== '') {
    lines.push(`LOCATION:${text(event.location)}`);
  }
  lines.push(`CATEGORIES:${event.color}`);

  for (const minutes of event.reminders) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${text(event.title)}`,
      `TRIGGER:-PT${String(minutes)}M`,
      'END:VALARM',
    );
  }

  lines.push('END:VEVENT');
  return lines;
}

/**
 * Serialises events as an iCalendar (RFC 5545) file. Timed events use UTC date-times;
 * all-day events use VALUE=DATE with an exclusive DTEND. Soft-deleted events are left out.
 */
export function toICalendar(events: readonly AgendaEvent[], options: ICalendarOptions): string {
  const stamp = utcDateTime(options.now.toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Agenda//Agenda//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${text(options.name ?? 'Agenda')}`,
    ...events.filter((event) => event.deletedAt === null).flatMap((e) => eventLines(e, stamp)),
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
