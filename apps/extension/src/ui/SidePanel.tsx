import {
  addDaysToPlainDate,
  eventsByDay,
  formatShortDate,
  plainDateInTz,
  startOfWeekPlain,
} from '@agenda/core';
import type { AgendaEvent } from '@agenda/core';
import { useExtension, usePreferences } from './context';
import { EventList } from './EventList';
import { useDaysEvents } from './events';
import { SessionGate } from './SessionGate';

/** The side panel: this week as a vertical list, one section per day (DESIGN.md §4). */
export function SidePanel() {
  return (
    <main className="ext-panel">
      <SessionGate>
        <Week />
      </SessionGate>
    </main>
  );
}

function Week() {
  const { env } = useExtension();
  const { preferences, hour12 } = usePreferences();
  const today = plainDateInTz(env.now(), env.timezone);
  const first = startOfWeekPlain(today, preferences?.weekStart ?? 'monday');
  const days = Array.from({ length: 7 }, (_, i) => addDaysToPlainDate(first, i));
  const events = useDaysEvents(first, 7);
  const groupDays = (list: readonly AgendaEvent[]) => [...eventsByDay(list, days, env.timezone)];

  return (
    <>
      <h1 className="ext-panel__title">
        {formatShortDate(first, env.locale.code)} –{' '}
        {formatShortDate(days[6] ?? first, env.locale.code)}
      </h1>
      {events.data === undefined ? (
        <p className="ext-message" role="status">
          Loading…
        </p>
      ) : (
        groupDays(events.data).map(([day, dayEvents]) => {
          return (
            <section
              key={day}
              className="ext-panel__day"
              aria-label={formatShortDate(day, env.locale.code)}
            >
              <h2 className={day === today ? 'ext-heading ext-heading--today' : 'ext-heading'}>
                {day === today
                  ? `Today · ${formatShortDate(day, env.locale.code)}`
                  : formatShortDate(day, env.locale.code)}
              </h2>
              <EventList
                events={dayEvents}
                day={day}
                today={today}
                hour12={hour12}
                empty="Nothing planned."
              />
            </section>
          );
        })
      )}
    </>
  );
}
