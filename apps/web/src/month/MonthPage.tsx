import { addMonthsToPlainDate, dayRangeInTz, monthGrid, plainDateInTz } from '@agenda/core';
import { Button, MonthGrid } from '@agenda/ui';
import { useId, useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useMinuteClock } from '../app/clock';
import { useEnv } from '../app/env';
import { useEventActions } from '../events/actions';
import { useRangeEvents } from '../events/queries';
import { useShortcuts } from '../shortcuts';
import { parseMonth, viewPath } from '../views/paths';
import { NewEventButton } from '../views/NewEventButton';
import { ViewHeader } from '../views/ViewHeader';

/** "/month" and "/month/YYYY-MM": the month grid, 6 weeks from the Monday before the 1st. */
export function MonthPage() {
  const env = useEnv();
  const navigate = useNavigate();
  const params = useParams();
  const headingId = useId();
  const actions = useEventActions();
  const now = useMinuteClock(env.now);
  const today = plainDateInTz(now, env.timezone);
  const thisMonth = `${today.slice(0, 7)}-01`;
  const parsed = params.month === undefined ? thisMonth : parseMonth(params.month);
  const month = parsed ?? thisMonth;

  // The same range as the sidebar calendar for this month, so both share one query.
  const range = useMemo(() => {
    const grid = monthGrid(month, env.weekStart);
    return {
      start: dayRangeInTz(grid[0] ?? month, env.timezone).start,
      end: dayRangeInTz(grid[grid.length - 1] ?? month, env.timezone).end,
    };
  }, [month, env.timezone, env.weekStart]);
  const events = useRangeEvents(range, env.timezone);

  const go = (day: string) => {
    void navigate(viewPath('month', day, today));
  };
  const previous = () => {
    go(addMonthsToPlainDate(month, -1));
  };
  const next = () => {
    go(addMonthsToPlainDate(month, 1));
  };
  useShortcuts({
    ArrowLeft: previous,
    ArrowRight: next,
    t: () => {
      go(today);
    },
  });

  if (parsed === null) return <Navigate to="/month" replace />;

  const title = new Intl.DateTimeFormat(env.locale.code, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}T12:00:00.000Z`));
  const showsToday = month === thisMonth;

  return (
    <section className="month" aria-labelledby={headingId}>
      <ViewHeader
        headingId={headingId}
        title={title}
        eyebrow={showsToday ? 'This month' : undefined}
        period="month"
        showsToday={showsToday}
        onPrevious={previous}
        onNext={next}
        onToday={() => {
          go(today);
        }}
        actions={<NewEventButton day={showsToday ? today : month} today={today} />}
      />
      {events.isError && (
        <div className="month__status" role="alert">
          <p>Couldn&apos;t load this month. Check your connection and try again.</p>
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
      <MonthGrid
        month={month}
        weekStart={env.weekStart}
        hour12={env.hour12}
        events={events.data ?? []}
        timezone={env.timezone}
        locale={env.locale}
        today={today}
        now={now}
        onSelectEvent={actions.open}
        onSelectDay={(day) => {
          void navigate(viewPath('day', day, today));
        }}
      />
    </section>
  );
}
