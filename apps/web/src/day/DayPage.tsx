import { addDaysToPlainDate, dayAgenda, dayRangeInTz, plainDateInTz } from '@agenda/core';
import type { AgendaEvent } from '@agenda/core';
import { Button, EmptyState, EventCard } from '@agenda/ui';
import { useId, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useMinuteClock } from '../app/clock';
import { useEnv } from '../app/env';
import { useEventActions } from '../events/actions';
import { useRangeEvents } from '../events/queries';
import { useShortcuts } from '../shortcuts';
import { NewEventButton } from '../views/NewEventButton';
import { ViewHeader } from '../views/ViewHeader';
import { dayHeading, dayPath, parseDay, relativeDay, timeOfDay } from './dayFormat';

/** "/" and "/day/YYYY-MM-DD": one day's events, all-day first, with a "now" marker today. */
export function DayPage() {
  const env = useEnv();
  const navigate = useNavigate();
  const params = useParams();
  const headingId = useId();
  const actions = useEventActions();
  const now = useMinuteClock(env.now);
  const today = plainDateInTz(now, env.timezone);
  const parsed = params.date === undefined ? today : parseDay(params.date);
  const day = parsed ?? today;
  const isToday = day === today;

  const range = useMemo(() => dayRangeInTz(day, env.timezone), [day, env.timezone]);
  const events = useRangeEvents(range, env.timezone);

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

  const card = (event: AgendaEvent) => (
    <li key={event.id} data-event-id={event.id}>
      <EventCard
        event={event}
        timezone={env.timezone}
        locale={env.locale}
        onSelect={() => {
          actions.open(event);
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
      <ViewHeader
        headingId={headingId}
        title={dayHeading(day, today, env.locale.code)}
        eyebrow={relativeDay(day, today)}
        period="day"
        showsToday={isToday}
        onPrevious={() => {
          go(addDaysToPlainDate(day, -1));
        }}
        onNext={() => {
          go(addDaysToPlainDate(day, 1));
        }}
        onToday={() => {
          go(today);
        }}
        actions={<NewEventButton day={day} today={today} />}
      />
      {body}
    </section>
  );
}
