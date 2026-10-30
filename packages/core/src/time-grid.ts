/**
 * Layout for the Week view's time grid (DESIGN.md §3: DayColumn / TimeGrid).
 *
 * Rules:
 * - Vertical positions are local wall-clock minutes (0–1440) in the viewer's zone, so on a
 *   DST day 02:30 still sits in the 02:00 row: the spring-forward hour is just empty and
 *   the repeated autumn hour overlaps itself.
 * - Timed events shorter than 24 hours go in the grid. One that crosses midnight is
 *   clipped into each day it touches. Events with no end are drawn as 30 minutes.
 * - All-day events and timed events of 24 hours or more go in the all-day strip instead,
 *   spanning their days.
 * - Overlaps: events are grouped into clusters (chains of events that overlap, directly or
 *   through another one); inside a cluster each event takes the first free column, and
 *   every event in the cluster gets the cluster's column count. An event alone keeps the
 *   full width even when another part of the day is crowded.
 */
import { TZDate } from '@date-fns/tz';
import { addDaysToPlainDate, dayRangeInTz, plainDateInTz } from './dates.js';
import type { AgendaEvent } from './types.js';

type Timing = Pick<AgendaEvent, 'start' | 'end' | 'allDay'>;
type Sortable = Timing & { title: string };

export const MINUTES_PER_DAY = 24 * 60;
/** How long an event with no end is drawn. */
export const DEFAULT_DURATION_MINUTES = 30;
/** The shortest block drawn, so very short events stay visible and clickable. */
export const MIN_BLOCK_MINUTES = 15;

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const endInstant = (event: Timing) =>
  event.end === null
    ? Date.parse(event.start) + DEFAULT_DURATION_MINUTES * MINUTE
    : Date.parse(event.end);

/** True for events that belong in the all-day strip rather than the hour grid. */
export function inAllDayStrip(event: Timing): boolean {
  if (event.allDay) return true;
  return event.end !== null && Date.parse(event.end) - Date.parse(event.start) >= DAY;
}

/** Minutes since local midnight, by the wall clock in `timeZone` (for the now line too). */
export function wallClockMinutes(date: Date, timeZone: string): number {
  const local = new TZDate(date.getTime(), timeZone);
  return local.getHours() * 60 + local.getMinutes();
}

export interface TimedBlock<E> {
  event: E;
  /** Wall-clock minutes from the top of the day. */
  top: number;
  /** Minutes; at least MIN_BLOCK_MINUTES. */
  height: number;
  column: number;
  columns: number;
  /** The event started on an earlier day (it is clipped at midnight). */
  continuesBefore: boolean;
  /** The event ends on a later day. */
  continuesAfter: boolean;
}

/** Positions one day's timed events (see the rules at the top of this file). */
export function layoutDay<E extends Sortable>(
  events: readonly E[],
  day: string,
  timeZone: string,
): TimedBlock<E>[] {
  const range = dayRangeInTz(day, timeZone);
  const dayStart = range.start.getTime();
  const dayEnd = range.end.getTime();

  const blocks = events
    .filter((event) => !inAllDayStrip(event))
    .filter((event) => {
      const start = Date.parse(event.start);
      // A zero-length event at midnight still belongs to the day it starts on.
      return start < dayEnd && (endInstant(event) > dayStart || start === dayStart);
    })
    .map((event) => {
      const start = Date.parse(event.start);
      const end = endInstant(event);
      const continuesBefore = start < dayStart;
      const continuesAfter = end > dayEnd;
      const top = continuesBefore ? 0 : wallClockMinutes(new Date(start), timeZone);
      const bottom =
        continuesAfter || end === dayEnd
          ? MINUTES_PER_DAY
          : wallClockMinutes(new Date(end), timeZone);
      const height = Math.max(bottom - top, MIN_BLOCK_MINUTES);
      return { event, top, height, column: 0, columns: 1, continuesBefore, continuesAfter };
    })
    .sort(
      (a, b) => a.top - b.top || b.height - a.height || a.event.title.localeCompare(b.event.title),
    );

  let cluster: TimedBlock<E>[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -1;
  const closeCluster = () => {
    for (const block of cluster) block.columns = columnEnds.length;
    cluster = [];
    columnEnds = [];
  };
  for (const block of blocks) {
    if (block.top >= clusterEnd) closeCluster();
    const free = columnEnds.findIndex((end) => end <= block.top);
    block.column = free === -1 ? columnEnds.length : free;
    columnEnds[block.column] = block.top + block.height;
    clusterEnd = Math.max(clusterEnd, block.top + block.height);
    cluster.push(block);
  }
  closeCluster();
  return blocks;
}

export interface StripBlock<E> {
  event: E;
  /** Index into `days` of the first day shown. */
  startIndex: number;
  /** Number of days covered within `days`. */
  span: number;
  /** Row in the strip, from 0. */
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

export interface AllDayLayout<E> {
  blocks: StripBlock<E>[];
  lanes: number;
}

/** The first and last local date an all-day-strip event covers (both inclusive). */
function stripDays(event: Timing, timeZone: string): [string, string] {
  if (event.allDay) {
    const last = event.end === null ? event.start : addDaysToPlainDate(event.end, -1);
    return [event.start, last < event.start ? event.start : last];
  }
  const first = plainDateInTz(new Date(event.start), timeZone);
  // The end instant is exclusive: an event ending at midnight doesn't cover the next day.
  const last = plainDateInTz(new Date(endInstant(event) - 1), timeZone);
  return [first, last];
}

/**
 * Lays out the all-day strip over consecutive `days` (plain dates): each event spans the
 * days it covers and takes the first lane that is free for all of them.
 */
export function layoutAllDay<E extends Sortable>(
  events: readonly E[],
  days: readonly string[],
  timeZone: string,
): AllDayLayout<E> {
  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  if (firstDay === undefined || lastDay === undefined) return { blocks: [], lanes: 0 };

  const blocks = events
    .filter(inAllDayStrip)
    .map((event) => ({ event, covered: stripDays(event, timeZone) }))
    .filter(({ covered: [first, last] }) => first <= lastDay && last >= firstDay)
    .map(({ event, covered: [first, last] }) => {
      const startIndex = first < firstDay ? 0 : days.indexOf(first);
      const endIndex = last > lastDay ? days.length - 1 : days.indexOf(last);
      return {
        event,
        startIndex,
        span: endIndex - startIndex + 1,
        lane: 0,
        continuesBefore: first < firstDay,
        continuesAfter: last > lastDay,
      };
    })
    .sort(
      (a, b) =>
        a.startIndex - b.startIndex ||
        b.span - a.span ||
        a.event.title.localeCompare(b.event.title),
    );

  // laneEnds[lane] is the last day index taken in that lane.
  const laneEnds: number[] = [];
  for (const block of blocks) {
    const free = laneEnds.findIndex((end) => end < block.startIndex);
    block.lane = free === -1 ? laneEnds.length : free;
    laneEnds[block.lane] = block.startIndex + block.span - 1;
  }
  return { blocks, lanes: laneEnds.length };
}

/** `count` consecutive plain dates from `day`. */
export function daysFrom(day: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDaysToPlainDate(day, i));
}
