import { dayRangeInTz, eventDays, monthGrid } from '@agenda/core';
import { MiniMonth } from '@agenda/ui';
import { useMemo, useState } from 'react';
import { useMatch, useNavigate } from 'react-router';
import { useEnv } from '../app/env';
import { dayPath, parseDay, todayIn } from '../day/dayFormat';
import { useRangeEvents } from '../events/queries';

const firstOfMonth = (day: string) => `${day.slice(0, 7)}-01`;

export interface CalendarPanelProps {
  /** Called after a day is picked, e.g. to close the dialog it sits in. */
  onPicked?: () => void;
}

/** The MiniMonth wired to the URL: the viewed day is selected, days with events get a dot. */
export function CalendarPanel({ onPicked }: CalendarPanelProps) {
  const env = useEnv();
  const navigate = useNavigate();
  const match = useMatch('/day/:date');
  const today = todayIn(env);
  const selected = parseDay(match?.params.date) ?? today;

  // The month on screen, so its whole 6-week grid can be loaded for the dots. It follows
  // the selected day like MiniMonth does (adjusted during render, not in an effect).
  const [month, setMonth] = useState(firstOfMonth(selected));
  const [previousSelected, setPreviousSelected] = useState(selected);
  if (selected !== previousSelected) {
    setPreviousSelected(selected);
    setMonth(firstOfMonth(selected));
  }

  const range = useMemo(() => {
    const grid = monthGrid(month, env.weekStart);
    return {
      start: dayRangeInTz(grid[0] ?? month, env.timezone).start,
      end: dayRangeInTz(grid[grid.length - 1] ?? month, env.timezone).end,
    };
  }, [month, env.timezone, env.weekStart]);
  const events = useRangeEvents(range, env.timezone);
  const days = useMemo(
    () => eventDays(events.data ?? [], env.timezone),
    [events.data, env.timezone],
  );

  return (
    <MiniMonth
      weekStart={env.weekStart}
      today={today}
      selected={selected}
      eventDays={days}
      locale={env.locale}
      onMonthChange={setMonth}
      onSelect={(day) => {
        void navigate(dayPath(day, today));
        onPicked?.();
      }}
    />
  );
}
