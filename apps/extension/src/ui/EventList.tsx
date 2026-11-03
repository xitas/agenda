import { dayAgenda, hasEnded, timeOnDay } from '@agenda/core';
import type { AgendaEvent } from '@agenda/core';
import { EventCard } from '@agenda/ui';
import { useExtension } from './context';

/** One day's events as compact cards: all-day first, then by time (DESIGN.md §3). */
export function EventList({
  events,
  day,
  today,
  hour12,
  empty,
}: {
  events: readonly AgendaEvent[];
  day: string;
  today: string;
  hour12: boolean | undefined;
  empty: string;
}) {
  const { env } = useExtension();
  const now = env.now();
  const { allDay, timed } = dayAgenda(events, now);
  const ordered = [...allDay, ...timed];
  if (ordered.length === 0) return <p className="ext-list__empty">{empty}</p>;
  return (
    <ul className="ext-list" aria-label={`Events on ${day}`}>
      {ordered.map((event) => (
        <li key={event.id}>
          <EventCard
            event={event}
            variant="compact"
            timezone={env.timezone}
            locale={env.locale}
            hour12={hour12}
            past={hasEnded(event, now, today)}
            // What happens on this day: an overnight event shows "23:30 →" or "→ 01:30".
            time={timeOnDay(event, day, {
              timezone: env.timezone,
              locale: env.locale,
              ...(hour12 === undefined ? {} : { hour12 }),
            })}
          />
        </li>
      ))}
    </ul>
  );
}
