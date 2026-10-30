import {
  addDaysToPlainDate,
  addMonthsToPlainDate,
  monthGrid,
  startOfWeekPlain,
} from '@agenda/core';
import type { Locale, WeekStart } from '@agenda/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { cx } from './cx.js';
import { IconButton } from './IconButton.js';

export interface MiniMonthProps {
  /** Today as a plain date (YYYY-MM-DD) in the viewer's zone; gets the accent ring. */
  today: string;
  /** The day being viewed; filled. Also decides which month opens first. */
  selected?: string;
  /** Days that have at least one event; shown with a dot. */
  eventDays?: ReadonlySet<string>;
  onSelect: (day: string) => void;
  /** Called with the 1st of the newly shown month, e.g. to load its event dots. */
  onMonthChange?: (firstOfMonth: string) => void;
  /** Month and weekday names follow this locale (its BCP 47 code). */
  locale: Locale;
  /** The first column (a setting; Monday by default). */
  weekStart?: WeekStart;
}

const firstOfMonth = (day: string) => `${day.slice(0, 7)}-01`;
const sameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7);
const atNoonUtc = (day: string) => new Date(`${day}T12:00:00.000Z`);

/**
 * A month calendar for the sidebar (WAI-ARIA date grid): one day is in the tab order at a
 * time; arrows move by day and week, Home/End to the start/end of the week, PageUp/
 * PageDown by month, Enter or Space selects.
 */
export function MiniMonth({
  today,
  selected,
  eventDays,
  onSelect,
  onMonthChange,
  locale,
  weekStart = 'monday',
}: MiniMonthProps) {
  const [focused, setFocused] = useState(selected ?? today);
  const [month, setMonth] = useState(firstOfMonth(selected ?? today));
  const moveFocus = useRef(false);
  const cells = useRef(new Map<string, HTMLTableCellElement>());
  const titleId = useId();

  // Follow the page when the selected day changes from outside (e.g. the day arrows).
  // Adjusting state during render is React's pattern for this; an effect would render twice.
  const [previousSelected, setPreviousSelected] = useState(selected);
  if (selected !== previousSelected) {
    setPreviousSelected(selected);
    if (selected !== undefined) {
      setFocused(selected);
      setMonth(firstOfMonth(selected));
    }
  }

  const formats = useMemo(
    () => ({
      title: new Intl.DateTimeFormat(locale.code, {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }),
      weekdayShort: new Intl.DateTimeFormat(locale.code, { weekday: 'short', timeZone: 'UTC' }),
      weekdayLong: new Intl.DateTimeFormat(locale.code, { weekday: 'long', timeZone: 'UTC' }),
      full: new Intl.DateTimeFormat(locale.code, { dateStyle: 'full', timeZone: 'UTC' }),
    }),
    [locale.code],
  );

  const grid = useMemo(() => monthGrid(month, weekStart), [month, weekStart]);
  const weeks = [0, 1, 2, 3, 4, 5].map((week) => grid.slice(week * 7, week * 7 + 7));

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    cells.current.get(focused)?.focus();
  }, [focused, month]);

  const showMonth = (day: string) => {
    const first = firstOfMonth(day);
    if (first !== month) {
      setMonth(first);
      onMonthChange?.(first);
    }
  };

  const focusDay = (day: string) => {
    moveFocus.current = true;
    setFocused(day);
    showMonth(day);
  };

  const changeMonth = (delta: number) => {
    const day = addMonthsToPlainDate(focused, delta);
    setFocused(day);
    showMonth(day);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const weekFirst = startOfWeekPlain(focused, weekStart);
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDaysToPlainDate(focused, -1),
      ArrowRight: () => addDaysToPlainDate(focused, 1),
      ArrowUp: () => addDaysToPlainDate(focused, -7),
      ArrowDown: () => addDaysToPlainDate(focused, 7),
      Home: () => weekFirst,
      End: () => addDaysToPlainDate(weekFirst, 6),
      PageUp: () => addMonthsToPlainDate(focused, -1),
      PageDown: () => addMonthsToPlainDate(focused, 1),
    };
    const move = moves[event.key];
    if (move !== undefined) {
      event.preventDefault();
      focusDay(move());
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(focused);
    }
  };

  // The focusable day must be in the shown month; otherwise use its 1st.
  const tabbable = sameMonth(focused, month) ? focused : month;

  return (
    <div className="ag-minimonth">
      <div className="ag-minimonth__header">
        <h2 id={titleId} className="ag-minimonth__title" aria-live="polite">
          {formats.title.format(atNoonUtc(month))}
        </h2>
        <IconButton
          label="Previous month"
          icon={<ChevronLeft />}
          size="sm"
          onClick={() => {
            changeMonth(-1);
          }}
        />
        <IconButton
          label="Next month"
          icon={<ChevronRight />}
          size="sm"
          onClick={() => {
            changeMonth(1);
          }}
        />
      </div>
      <table
        role="grid"
        className="ag-minimonth__grid"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        <thead>
          <tr>
            {grid.slice(0, 7).map((day) => (
              <th key={day} scope="col" abbr={formats.weekdayLong.format(atNoonUtc(day))}>
                {formats.weekdayShort.format(atNoonUtc(day)).slice(0, 2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((day) => {
                const outside = !sameMonth(day, month);
                const hasEvents = eventDays?.has(day) ?? false;
                const label = [
                  formats.full.format(atNoonUtc(day)),
                  hasEvents ? 'has events' : undefined,
                ]
                  .filter(Boolean)
                  .join(', ');
                return (
                  <td
                    role="gridcell"
                    key={day}
                    ref={(cell) => {
                      if (cell) cells.current.set(day, cell);
                      else cells.current.delete(day);
                    }}
                    tabIndex={day === tabbable ? 0 : -1}
                    aria-selected={day === selected}
                    aria-current={day === today ? 'date' : undefined}
                    aria-label={label}
                    className={cx(
                      'ag-minimonth__day',
                      outside && 'ag-minimonth__day--outside',
                      day === today && 'ag-minimonth__day--today',
                      day === selected && 'ag-minimonth__day--selected',
                    )}
                    onClick={() => {
                      setFocused(day);
                      onSelect(day);
                    }}
                    onFocus={() => {
                      setFocused(day);
                    }}
                  >
                    <span aria-hidden="true">{Number(day.slice(8))}</span>
                    {hasEvents && <span className="ag-minimonth__dot" aria-hidden="true" />}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
