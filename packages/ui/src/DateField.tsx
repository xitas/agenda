import { formatDateInput, parseDateInput } from '@agenda/core';
import type { Locale, WeekStart } from '@agenda/core';
import { CalendarDays, CircleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { cx } from './cx.js';
import { KEEP_DIALOG_OPEN_ON_ESCAPE } from './Dialog.js';
import { IconButton } from './IconButton.js';
import { MiniMonth } from './MiniMonth.js';

export interface DateFieldProps {
  /** Always visible, e.g. "Start date". */
  label: string;
  /** A plain date (YYYY-MM-DD), or whatever unreadable text the user left in the field. */
  value: string;
  /**
   * Called with a plain date when the text reads as one (on blur or Enter) or a day is
   * picked; otherwise with the text as typed, so the form's validation can flag it.
   */
  onChange: (value: string) => void;
  /** Today as a plain date; relative words ("tomorrow") and the calendar start from it. */
  today: string;
  locale: Locale;
  error?: string;
  hint?: string;
  /** The calendar's first column (a setting; Monday by default). */
  weekStart?: WeekStart;
}

const isPlainDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * A date you can type ("27 Oct", "tomorrow", "2026-10-27") or pick from a MiniMonth that
 * opens inline below the field (WAI-ARIA date picker: the grid is an extra, typing always
 * works). Esc or a pick closes the calendar and returns focus to the field.
 */
export function DateField({
  label,
  value,
  onChange,
  today,
  locale,
  error,
  hint,
  weekStart = 'monday',
}: DateFieldProps) {
  const id = useId();
  const calendarId = `${id}-calendar`;
  const input = useRef<HTMLInputElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  // What the field shows: the formatted date, or the user's text while they type.
  const shown = isPlainDate(value) ? formatDateInput(value, locale.code) : value;
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? shown;

  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    onChange(parseDateInput(draft, { today, locale: locale.code }) ?? draft.trim());
  };

  const close = (focus: HTMLElement | null) => {
    setOpen(false);
    focus?.focus();
  };

  // Opening moves focus to the selected (or today's) day, as in the WAI-ARIA date picker.
  const calendar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open)
      calendar.current?.querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]')?.focus();
  }, [open]);

  // While the calendar is open, Esc anywhere in the field closes it (not the dialog).
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (open && event.key === 'Escape') {
      event.preventDefault();
      close(toggle.current);
    }
  };

  const describedBy = [hint ? `${id}-hint` : undefined, error ? `${id}-error` : undefined]
    .filter(Boolean)
    .join(' ');
  const pickLabel = `Choose ${label.charAt(0).toLowerCase()}${label.slice(1)}`;

  return (
    <div
      className={cx('ag-field', 'ag-datefield', error !== undefined && 'ag-field--invalid')}
      {...(open ? { [KEEP_DIALOG_OPEN_ON_ESCAPE]: '' } : {})}
      onKeyDown={onKeyDown}
    >
      <label htmlFor={id} className="ag-field__label">
        {label}
      </label>
      <div className="ag-datefield__row">
        <input
          ref={input}
          id={id}
          className="ag-input"
          type="text"
          inputMode="text"
          autoComplete="off"
          value={text}
          aria-invalid={error !== undefined || undefined}
          aria-describedby={describedBy === '' ? undefined : describedBy}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
          }}
        />
        <IconButton
          ref={toggle}
          label={
            isPlainDate(value) ? `${pickLabel}, ${formatDateInput(value, locale.code)}` : pickLabel
          }
          icon={<CalendarDays />}
          variant="secondary"
          aria-expanded={open}
          aria-controls={calendarId}
          onClick={() => {
            setOpen((current) => !current);
          }}
        />
      </div>
      {hint !== undefined && (
        <p id={`${id}-hint`} className="ag-field__hint">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={`${id}-error`} className="ag-field__error">
          <CircleAlert aria-hidden="true" className="ag-field__error-icon" />
          {error}
        </p>
      )}
      {open && (
        <div id={calendarId} className="ag-datefield__calendar" ref={calendar}>
          <MiniMonth
            today={today}
            {...(isPlainDate(value) ? { selected: value } : {})}
            locale={locale}
            weekStart={weekStart}
            onSelect={(day) => {
              setDraft(null);
              onChange(day);
              close(input.current);
            }}
          />
        </div>
      )}
    </div>
  );
}
