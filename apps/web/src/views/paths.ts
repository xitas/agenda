import { addDaysToPlainDate } from '@agenda/core';
import { dayPath } from '../day/dayFormat';

export type CalendarViewName = 'day' | 'week' | 'month';

/**
 * Where a view shows `day`. Each view has a short path for the period containing today
 * ("/", "/week", "/month") and a dated one for the rest.
 */
export function viewPath(view: CalendarViewName, day: string, today: string): string {
  switch (view) {
    case 'day':
      return dayPath(day, today);
    case 'week':
      return day === today ? '/week' : `/week/${day}`;
    case 'month':
      return day.slice(0, 7) === today.slice(0, 7) ? '/month' : `/month/${day.slice(0, 7)}`;
  }
}

/** "2026-10" as the first of that month ("2026-10-01"), or null for anything else. */
export function parseMonth(value: string | undefined): string | null {
  if (value === undefined || !/^\d{4}-\d{2}$/.test(value)) return null;
  try {
    return addDaysToPlainDate(`${value}-01`, 0);
  } catch {
    return null;
  }
}
