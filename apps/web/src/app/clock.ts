import { useEffect, useState } from 'react';

/** The clock, refreshed every minute so "now" lines (and "today") move on. */
export function useMinuteClock(now: () => Date): Date {
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
