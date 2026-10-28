import {
  addDaysToPlainDate,
  dayRangeInTz,
  localDateTimeToUtc,
  daysFrom,
  plainDateInTz,
  startOfWeekPlain,
  wallClockMinutes,
} from '@agenda/core';
import { Button, TimeGrid } from '@agenda/ui';
import { useId, useMemo, useRef } from 'react';
import type { PointerEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useMinuteClock } from '../app/clock';
import { useEnv } from '../app/env';
import { NARROW, useMediaQuery } from '../app/useMediaQuery';
import { parseDay } from '../day/dayFormat';
import { useEventActions } from '../events/actions';
import { useRangeEvents } from '../events/queries';
import { useShortcuts } from '../shortcuts';
import { viewPath } from '../views/paths';
import { NewEventButton } from '../views/NewEventButton';
import { ViewHeader } from '../views/ViewHeader';

/** A horizontal touch swipe longer than this (px) moves to the previous or next period. */
const SWIPE_DISTANCE = 60;
const DEFAULT_SCROLL_MINUTES = 8 * 60;
/** How far above the now line the grid opens, so the current hour isn't at the very top. */
const NOW_MARGIN_MINUTES = 90;

/**
 * "/week" and "/week/YYYY-MM-DD": the time grid for the week (Monday first) containing
 * the date, or 3 days starting at it below 768 px.
 */
export function WeekPage() {
  const env = useEnv();
  const navigate = useNavigate();
  const params = useParams();
  const headingId = useId();
  const actions = useEventActions();
  const narrow = useMediaQuery(NARROW);
  const now = useMinuteClock(env.now);
  const today = plainDateInTz(now, env.timezone);
  const parsed = params.date === undefined ? today : parseDay(params.date);
  const anchor = parsed ?? today;

  const step = narrow ? 3 : 7;
  const first = narrow ? anchor : startOfWeekPlain(anchor);
  const days = useMemo(() => daysFrom(first, step), [first, step]);
  const last = days[days.length - 1] ?? first;
  const range = useMemo(
    () => ({
      start: dayRangeInTz(first, env.timezone).start,
      end: dayRangeInTz(last, env.timezone).end,
    }),
    [first, last, env.timezone],
  );
  const events = useRangeEvents(range, env.timezone);
  const showsToday = days.includes(today);

  const go = (day: string) => {
    void navigate(viewPath('week', day, today));
  };
  const previous = () => {
    go(addDaysToPlainDate(first, -step));
  };
  const next = () => {
    go(addDaysToPlainDate(first, step));
  };
  useShortcuts({
    ArrowLeft: previous,
    ArrowRight: next,
    t: () => {
      go(today);
    },
  });

  // Touch swipes move by one period; mouse drags are left alone.
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (event: PointerEvent) => {
    swipeStart.current =
      event.pointerType === 'touch' ? { x: event.clientX, y: event.clientY } : null;
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (start === null) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) next();
    else previous();
  };

  // TimeGrid scrolls once when it mounts, and the key below remounts it for each period.
  const scrollTo = showsToday
    ? Math.max(0, wallClockMinutes(now, env.timezone) - NOW_MARGIN_MINUTES)
    : DEFAULT_SCROLL_MINUTES;

  if (parsed === null) return <Navigate to="/week" replace />;

  const title = new Intl.DateTimeFormat(env.locale.code, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatRange(new Date(`${first}T12:00:00.000Z`), new Date(`${last}T12:00:00.000Z`));

  return (
    <section className="week" aria-labelledby={headingId}>
      <ViewHeader
        headingId={headingId}
        title={title}
        eyebrow={showsToday && !narrow ? 'This week' : undefined}
        period={narrow ? '3 days' : 'week'}
        showsToday={showsToday}
        onPrevious={previous}
        onNext={next}
        onToday={() => {
          go(today);
        }}
        actions={<NewEventButton day={showsToday ? today : first} today={today} />}
      />
      {events.isError && (
        <div className="week__status" role="alert">
          <p>Couldn&apos;t load this week. Check your connection and try again.</p>
          <Button
            variant="secondary"
            onClick={() => {
              void events.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      )}
      {events.isPending && (
        <p className="ag-visually-hidden" role="status">
          Loading…
        </p>
      )}
      <div className="week__grid" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <TimeGrid
          key={first}
          days={days}
          events={events.data ?? []}
          timezone={env.timezone}
          locale={env.locale}
          today={today}
          now={now}
          scrollToMinutes={scrollTo}
          onSelectEvent={actions.open}
          onSelectSlot={(day, minutes) => {
            const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
            actions.create(new Date(localDateTimeToUtc(day, time, env.timezone)));
          }}
          onSelectDay={(day) => {
            void navigate(viewPath('day', day, today));
          }}
        />
      </div>
    </section>
  );
}
