import { formatTimeInput, parseTimeInput, stepTime } from '@agenda/core';
import { CircleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { cx } from './cx.js';

export interface TimeFieldProps {
  /** Always visible, e.g. "Start time". */
  label: string;
  /** "HH:mm" (24-hour), or whatever unreadable text the user left in the field. */
  value: string;
  /**
   * Called with "HH:mm" when the text reads as a time (on blur, Enter or ↑/↓), otherwise
   * with the text as typed, so the form's validation can flag it.
   */
  onChange: (value: string) => void;
  /** Show "4:30 PM" (true) or "16:30" (false): the user's clock setting. */
  hour12: boolean;
  error?: string;
  /** ↑/↓ move by this many minutes. */
  step?: number;
}

const isTime = (value: string) => /^\d{2}:\d{2}$/.test(value);

/**
 * A time you type ("16:30", "4:30pm", "4pm"), shown on the user's 12- or 24-hour clock.
 * It replaces the native time input, whose clock follows the browser's language rather
 * than the app's setting. ↑ and ↓ change it by `step` minutes.
 */
export function TimeField({ label, value, onChange, hour12, error, step = 15 }: TimeFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = isTime(value) ? formatTimeInput(value, hour12) : value;
  const text = draft ?? shown;

  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    onChange(parseTimeInput(draft) ?? draft.trim());
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const current = draft === null ? value : parseTimeInput(draft);
      if (current === null || !isTime(current)) return;
      event.preventDefault();
      setDraft(null);
      onChange(stepTime(current, event.key === 'ArrowUp' ? step : -step));
    }
  };

  return (
    <div className={cx('ag-field', error !== undefined && 'ag-field--invalid')}>
      <label htmlFor={id} className="ag-field__label">
        {label}
      </label>
      <input
        id={id}
        className="ag-input"
        type="text"
        inputMode="text"
        autoComplete="off"
        value={text}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={error === undefined ? `${id}-hint` : `${id}-hint ${id}-error`}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
      {/* For screen readers; sighted users see the format in the field itself. */}
      <span id={`${id}-hint`} className="ag-visually-hidden">
        For example {hour12 ? '4:30 PM' : '16:30'}. Up and down arrows change it by {step} minutes.
      </span>
      {error !== undefined && (
        <p id={`${id}-error`} className="ag-field__error">
          <CircleAlert aria-hidden="true" className="ag-field__error-icon" />
          {error}
        </p>
      )}
    </div>
  );
}
