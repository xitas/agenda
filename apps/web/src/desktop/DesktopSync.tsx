import {
  addDaysToPlainDate,
  dayRangeInTz,
  plainDateInTz,
  reminderSchedule,
  TRAY_SIGNED_OUT,
  trayItems,
} from '@agenda/core';
import type { DesktopBridge } from '@agenda/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useMinuteClock } from '../app/clock';
import { useEnv } from '../app/env';
import { EVENTS_KEY, useRangeEvents } from '../events/queries';

/** Today and the next three days: the tray's two days plus the longest reminder (1 day). */
const DAYS = 4;
/** The window may sit hidden in the tray all day; its list still has to stay fresh. */
const REFRESH_MS = 5 * 60_000;

/**
 * The main window's link to the desktop app, while someone is logged in. It keeps the
 * tray menu and the reminder schedule up to date from the same cached events as the
 * views (so an edit anywhere updates them), follows the tray's "open this day", and
 * refetches when the quick-add window has saved something. Renders nothing.
 */
export function DesktopSync({ desktop }: { desktop: DesktopBridge }) {
  const env = useEnv();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const now = useMinuteClock(env.now);
  const today = plainDateInTz(now, env.timezone);
  const range = useMemo(
    () => ({
      start: dayRangeInTz(today, env.timezone).start,
      end: dayRangeInTz(addDaysToPlainDate(today, DAYS - 1), env.timezone).end,
    }),
    [today, env.timezone],
  );
  const events = useRangeEvents(range, env.timezone, {
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (events.data === undefined) return;
    const options = { now, timezone: env.timezone, locale: env.locale, hour12: env.hour12 };
    void desktop.setTrayItems(trayItems(events.data, options));
    void desktop.setReminders(reminderSchedule(events.data, options));
  }, [desktop, events.data, now, env.timezone, env.locale, env.hour12]);

  // Logged out (or this window reloading): no names in the tray, no reminders.
  useEffect(
    () => () => {
      void desktop.setTrayItems([{ label: TRAY_SIGNED_OUT }]);
      void desktop.setReminders([]);
    },
    [desktop],
  );

  useEffect(
    () =>
      desktop.onNavigate((path) => {
        void navigate(path);
      }),
    [desktop, navigate],
  );

  useEffect(
    () =>
      desktop.onEventsChanged(() => {
        void queryClient.invalidateQueries({ queryKey: EVENTS_KEY });
      }),
    [desktop, queryClient],
  );

  return null;
}
