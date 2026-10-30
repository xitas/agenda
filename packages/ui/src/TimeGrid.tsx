import {
  MINUTES_PER_DAY,
  formatEventTime,
  hasEnded,
  layoutAllDay,
  layoutDay,
  wallClockMinutes,
} from '@agenda/core';
import type { AgendaEvent, Locale } from '@agenda/core';
import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { cx } from './cx.js';

type GridEvent = Pick<
  AgendaEvent,
  'id' | 'title' | 'start' | 'end' | 'allDay' | 'color' | 'location'
>;

export interface TimeGridProps<E extends GridEvent> {
  /** Consecutive plain dates (YYYY-MM-DD), one column each: 7 for a week, 3 on phones. */
  days: readonly string[];
  events: readonly E[];
  /** The viewer's zone; positions and times are read in it. */
  timezone: string;
  locale: Locale;
  /** Today as a plain date: its column gets the now line, earlier days look muted. */
  today: string;
  now: Date;
  onSelectEvent?: (event: E) => void;
  /** A click on empty time: the day and the minute of the day, snapped down to 30. */
  onSelectSlot?: (day: string, minutes: number) => void;
  /** A click on a day's header, e.g. to open that day. */
  onSelectDay?: (day: string) => void;
  /** Minutes from midnight to scroll to when the grid first shows. */
  scrollToMinutes?: number;
  /** Force a 12- (true) or 24-hour (false) clock; by default the locale decides. */
  hour12?: boolean | undefined;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const SLOT_MINUTES = 30;
/** Blocks shorter than this (36 px at 48 px an hour) put the time on the title's line. */
const SHORT_BLOCK_MINUTES = 45;
const atNoonUtc = (day: string) => new Date(`${day}T12:00:00.000Z`);
const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** CSS custom properties (numbers only); the stylesheet turns them into lengths. */
const vars = (values: Record<string, number>) =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [`--${key}`, value]),
  ) as CSSProperties;

/**
 * The Week view's grid (DESIGN.md §3): 24 hour rows, an all-day strip on top, events
 * placed by core's layoutDay/layoutAllDay, and the now line on today's column.
 */
export function TimeGrid<E extends GridEvent>({
  days,
  events,
  timezone,
  locale,
  today,
  now,
  onSelectEvent,
  onSelectSlot,
  onSelectDay,
  scrollToMinutes,
  hour12,
}: TimeGridProps<E>) {
  const body = useRef<HTMLDivElement>(null);
  const formats = useMemo(
    () => ({
      weekday: new Intl.DateTimeFormat(locale.code, { weekday: 'short', timeZone: 'UTC' }),
      full: new Intl.DateTimeFormat(locale.code, { dateStyle: 'full', timeZone: 'UTC' }),
    }),
    [locale.code],
  );
  // The same time format as the event blocks ("08:00" or "8:00 AM").
  const hourLabels = useMemo(
    () =>
      HOURS.map((hour) =>
        formatEventTime(
          { start: new Date(Date.UTC(2026, 0, 1, hour)).toISOString(), end: null, allDay: false },
          'UTC',
          locale,
          { hour12 },
        ),
      ),
    [locale, hour12],
  );
  const strip = useMemo(() => layoutAllDay(events, days, timezone), [events, days, timezone]);
  const columns = useMemo(
    () => days.map((day) => ({ day, blocks: layoutDay(events, day, timezone) })),
    [events, days, timezone],
  );

  // Scroll once, when the grid first shows; later data loads must not move the page.
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current || scrollToMinutes === undefined || body.current === null) return;
    scrolled.current = true;
    const hourHeight = body.current.scrollHeight / 24;
    body.current.scrollTop = Math.max(0, (scrollToMinutes / 60) * hourHeight);
  }, [scrollToMinutes]);

  const nowMinutes = wallClockMinutes(now, timezone);
  const isPast = (event: GridEvent) => hasEnded(event, now, today);

  const pickSlot = (day: string) => (click: MouseEvent<HTMLDivElement>) => {
    if (onSelectSlot === undefined || click.target !== click.currentTarget) return;
    const rect = click.currentTarget.getBoundingClientRect();
    const fraction = rect.height > 0 ? (click.clientY - rect.top) / rect.height : 0;
    const minutes = Math.floor((fraction * MINUTES_PER_DAY) / SLOT_MINUTES) * SLOT_MINUTES;
    onSelectSlot(day, Math.min(Math.max(minutes, 0), MINUTES_PER_DAY - SLOT_MINUTES));
  };

  /** "Dentist, Wednesday, 28 October 2026, 16:00 – 17:00, Red": everything a block shows. */
  const describe = (event: E, day: string | null) => {
    const time = formatEventTime(event, timezone, locale, { hour12 });
    const when =
      day !== null
        ? `${formats.full.format(atNoonUtc(day))}, ${time}`
        : time === 'All day'
          ? `${formats.full.format(atNoonUtc(event.start))}, all day`
          : time;
    return { time, label: `${event.title}, ${when}, ${capitalise(event.color)}` };
  };

  const eventButton = (
    event: E,
    className: string,
    style: CSSProperties,
    extra = '',
    short = false,
    day: string | null = null,
  ) => {
    const { time, label } = describe(event, day);
    return (
      <button
        key={`${event.id}${extra}`}
        type="button"
        className={cx(
          className,
          isPast(event) && `${className}--past`,
          short && `${className}--short`,
        )}
        style={style}
        data-event-color={event.color}
        data-event-id={event.id}
        // The full name, since a narrow block hides its time; the tooltip shows the same.
        aria-label={label}
        title={`${event.title}
${time}`}
        onClick={() => onSelectEvent?.(event)}
      >
        <span className="ag-timegrid__event-title">{event.title}</span>
        <time className="ag-timegrid__event-time" dateTime={event.start}>
          {time}
        </time>
      </button>
    );
  };

  return (
    <div className="ag-timegrid" style={vars({ days: days.length })}>
      <div className="ag-timegrid__head" role="presentation">
        <span className="ag-timegrid__corner" />
        {days.map((day) => {
          const label = `${formats.full.format(atNoonUtc(day))}${day === today ? ', today' : ''}`;
          const content = (
            <>
              <span className="ag-timegrid__weekday">{formats.weekday.format(atNoonUtc(day))}</span>
              <span className="ag-timegrid__date">{Number(day.slice(8))}</span>
            </>
          );
          const className = cx(
            'ag-timegrid__day',
            day === today && 'ag-timegrid__day--today',
            day < today && 'ag-timegrid__day--past',
          );
          return onSelectDay === undefined ? (
            <span key={day} className={className} aria-label={label}>
              {content}
            </span>
          ) : (
            <button
              key={day}
              type="button"
              className={className}
              aria-label={label}
              {...(day === today ? { 'aria-current': 'date' as const } : {})}
              onClick={() => {
                onSelectDay(day);
              }}
            >
              {content}
            </button>
          );
        })}
      </div>

      {strip.lanes > 0 && (
        <div className="ag-timegrid__strip" style={vars({ lanes: strip.lanes })}>
          <span className="ag-timegrid__strip-label">All day</span>
          {strip.blocks.map((block) =>
            eventButton(
              block.event,
              'ag-timegrid__allday',
              vars({ col: block.startIndex + 2, span: block.span, lane: block.lane + 1 }),
            ),
          )}
        </div>
      )}

      <div className="ag-timegrid__body" ref={body}>
        <div className="ag-timegrid__hours" aria-hidden="true">
          {HOURS.map((hour) => (
            <span key={hour} className="ag-timegrid__hour" style={vars({ hour })}>
              {hour === 0 ? '' : hourLabels[hour]}
            </span>
          ))}
        </div>
        {columns.map(({ day, blocks }) => (
          // A mouse shortcut to create an event at a time; keyboard users have New event.
          <div
            key={day}
            className={cx('ag-timegrid__column', day < today && 'ag-timegrid__column--past')}
            data-day={day}
            onClick={pickSlot(day)}
          >
            {blocks.map((block) =>
              eventButton(
                block.event,
                'ag-timegrid__event',
                vars({
                  top: block.top,
                  height: block.height,
                  col: block.column,
                  cols: block.columns,
                }),
                `@${day}`,
                // Too short for two lines: title and time share one.
                block.height < SHORT_BLOCK_MINUTES,
                day,
              ),
            )}
            {day === today && (
              <span
                className="ag-timegrid__now"
                style={vars({ top: nowMinutes })}
                aria-hidden="true"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
