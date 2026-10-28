import { addDaysToPlainDate, dayAgenda, dayRangeInTz, plainDateInTz } from '@agenda/core';
import type { AgendaEvent } from '@agenda/core';
import { Button, EmptyState, EventCard, IconButton } from '@agenda/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useEnv } from '../app/env';
import { EventDetails } from '../events/EventDetails';
import { useDeleteEvent } from '../events/mutations';
import { useRangeEvents } from '../events/queries';
import { useShortcuts } from '../shortcuts';
import { dayHeading, dayPath, parseDay, relativeDay, timeOfDay } from './dayFormat';

/** The clock, refreshed every minute so the "now" marker (and "today") move on. */
function useMinuteClock(now: () => Date): Date {
  const [time, setTime] = useState(now);
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(now());
    }, 60_000);
    return () => {
      clearInterval(timer);
    };
  }, [now]);
  return time;
}

/** "/" and "/day/YYYY-MM-DD": one day's events, all-day first, with a "now" marker today. */
export function DayPage() {
  const env = useEnv();
  const navigate = useNavigate();
  const params = useParams();
  const headingId = useId();
  const now = useMinuteClock(env.now);
  const today = plainDateInTz(now, env.timezone);
  const parsed = params.date === undefined ? today : parseDay(params.date);
  const day = parsed ?? today;
  const isToday = day === today;

  const range = useMemo(() => dayRangeInTz(day, env.timezone), [day, env.timezone]);
  const events = useRangeEvents(range, env.timezone);
  const remove = useDeleteEvent();
  const [opened, setOpened] = useState<AgendaEvent | null>(null);

  const go = (target: string) => {
    void navigate(dayPath(target, today));
  };
  useShortcuts({
    ArrowLeft: () => {
      go(addDaysToPlainDate(day, -1));
    },
    ArrowRight: () => {
      go(addDaysToPlainDate(day, 1));
    },
    t: () => {
      go(today);
    },
  });

  if (parsed === null) return <Navigate to="/" replace />;

  const relative = relativeDay(day, today);
  const card = (event: AgendaEvent) => (
    <li key={event.id}>
      <EventCard
        event={event}
        timezone={env.timezone}
        locale={env.locale}
        onSelect={() => {
          setOpened(event);
        }}
      />
    </li>
  );

  let body: ReactNode;
  if (events.isPending) {
    body = (
      <p className="day__status" role="status">
        Loading…
      </p>
    );
  } else if (events.isError) {
    body = (
      <div className="day__status" role="alert">
        <p>Couldn&apos;t load this day. Check your connection and try again.</p>
        <Button
          variant="secondary"
          onClick={() => {
            void events.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  } else if (events.data.length === 0) {
    body = (
      <EmptyState
        title={isToday ? 'Nothing today. Enjoy the space.' : 'Nothing on this day.'}
        hint="Press N to add an event."
      />
    );
  } else {
    const agenda = dayAgenda(events.data, isToday ? now : undefined);
    const timed = agenda.timed.map(card);
    if (agenda.nowIndex !== null) {
      timed.splice(
        agenda.nowIndex,
        0,
        <li key="now" className="day__now">
          <span className="day__now-label">Now · {timeOfDay(now, env)}</span>
        </li>,
      );
    }
    body = (
      <ul className="day__list" aria-label={`Events, ${dayHeading(day, today, env.locale.code)}`}>
        {agenda.allDay.map(card)}
        {timed}
      </ul>
    );
  }

  return (
    <section className="day" aria-labelledby={headingId}>
      <header className="day__header">
        <div className="day__titles">
          {relative !== undefined && <p className="day__eyebrow">{relative}</p>}
          <h1 id={headingId} className="day__heading">
            {dayHeading(day, today, env.locale.code)}
          </h1>
        </div>
        <div className="day__nav">
          <IconButton
            label="Previous day"
            icon={<ChevronLeft />}
            variant="secondary"
            onClick={() => {
              go(addDaysToPlainDate(day, -1));
            }}
          />
          <Button
            variant="secondary"
            disabled={isToday}
            onClick={() => {
              go(today);
            }}
          >
            Today
          </Button>
          <IconButton
            label="Next day"
            icon={<ChevronRight />}
            variant="secondary"
            onClick={() => {
              go(addDaysToPlainDate(day, 1));
            }}
          />
        </div>
      </header>
      {body}
      <EventDetails
        event={opened}
        onClose={() => {
          setOpened(null);
        }}
        onDelete={(event) => {
          remove.mutate(event);
        }}
      />
    </section>
  );
}
