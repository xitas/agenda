import { addDaysToPlainDate, eventsByDay, monthGrid } from '@agenda/core';
import type { AgendaEvent, Locale } from '@agenda/core';
import { useMemo } from 'react';
import { cx } from './cx.js';
import { EventCard } from './EventCard.js';

type MonthEvent = Pick<
  AgendaEvent,
  'id' | 'title' | 'start' | 'end' | 'allDay' | 'color' | 'location'
>;

export interface MonthGridProps<E extends MonthEvent> {
  /** Any day in the month to show; the grid is the 6 weeks around it, Monday first. */
  month: string;
  events: readonly E[];
  timezone: string;
  locale: Locale;
  /** Today as a plain date: ringed; earlier days look muted. */
  today: string;
  now: Date;
  /** A day's number or its "+N more" was clicked. */
  onSelectDay: (day: string) => void;
  onSelectEvent: (event: E) => void;
  /** Events listed per cell before "+N more" (DESIGN.md §3: 3). */
  maxPerDay?: number;
}

const atNoonUtc = (day: string) => new Date(`${day}T12:00:00.000Z`);
const MINUTE = 60_000;

/**
 * The Month view (DESIGN.md §3 MonthGrid): 6 weeks of days, each listing up to
 * `maxPerDay` compact events and then "+N more", which opens the day. Multi-day events
 * appear on every day they touch.
 */
export function MonthGrid<E extends MonthEvent>({
  month,
  events,
  timezone,
  locale,
  today,
  now,
  onSelectDay,
  onSelectEvent,
  maxPerDay = 3,
}: MonthGridProps<E>) {
  const days = useMemo(() => monthGrid(month), [month]);
  const byDay = useMemo(() => eventsByDay(events, days, timezone), [events, days, timezone]);
  const formats = useMemo(
    () => ({
      weekday: new Intl.DateTimeFormat(locale.code, { weekday: 'short', timeZone: 'UTC' }),
      full: new Intl.DateTimeFormat(locale.code, { dateStyle: 'full', timeZone: 'UTC' }),
    }),
    [locale.code],
  );
  const shownMonth = month.slice(0, 7);
  const isPast = (event: E) =>
    event.allDay
      ? (event.end === null ? event.start : addDaysToPlainDate(event.end, -1)) < today
      : (event.end === null ? Date.parse(event.start) + 30 * MINUTE : Date.parse(event.end)) <=
        now.getTime();

  return (
    <div className="ag-monthgrid">
      <div className="ag-monthgrid__weekdays" aria-hidden="true">
        {days.slice(0, 7).map((day) => (
          <span key={day}>{formats.weekday.format(atNoonUtc(day))}</span>
        ))}
      </div>
      <ol className="ag-monthgrid__days">
        {days.map((day) => {
          const list = byDay.get(day) ?? [];
          const shown = list.slice(0, maxPerDay);
          const hidden = list.length - shown.length;
          const fullDate = formats.full.format(atNoonUtc(day));
          const count =
            list.length === 0
              ? 'no events'
              : `${String(list.length)} event${list.length === 1 ? '' : 's'}`;
          return (
            <li
              key={day}
              className={cx(
                'ag-monthgrid__cell',
                day.slice(0, 7) !== shownMonth && 'ag-monthgrid__cell--outside',
                day < today && 'ag-monthgrid__cell--past',
                day === today && 'ag-monthgrid__cell--today',
              )}
            >
              <button
                type="button"
                className="ag-monthgrid__date"
                aria-label={`${fullDate}${day === today ? ', today' : ''}, ${count}`}
                {...(day === today ? { 'aria-current': 'date' as const } : {})}
                onClick={() => {
                  onSelectDay(day);
                }}
              >
                {Number(day.slice(8))}
              </button>
              {shown.length > 0 && (
                <ul className="ag-monthgrid__events">
                  {shown.map((event) => (
                    <li key={event.id} data-event-id={event.id}>
                      <EventCard
                        event={event}
                        timezone={timezone}
                        locale={locale}
                        variant="compact"
                        past={isPast(event)}
                        onSelect={() => {
                          onSelectEvent(event);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
              {hidden > 0 && (
                <button
                  type="button"
                  className="ag-monthgrid__more"
                  aria-label={`${String(hidden)} more on ${fullDate}`}
                  onClick={() => {
                    onSelectDay(day);
                  }}
                >
                  +{hidden} more
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
