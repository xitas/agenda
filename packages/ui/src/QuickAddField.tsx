import type { QuickAddPreview } from '@agenda/core';
import { CircleAlert } from 'lucide-react';
import { useId } from 'react';
import type { KeyboardEvent, Ref } from 'react';
import { cx } from './cx.js';

export interface QuickAddFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Enter. */
  onSubmit: () => void;
  /** Esc; receives the field, e.g. to blur it. */
  onEscape: (input: HTMLInputElement) => void;
  /** The parsed event to show under the field (core's quickAddPreview), or null. */
  preview: QuickAddPreview | null;
  /** The keys line under the preview. */
  hint?: string;
  /**
   * floating: the preview floats over the page while the field has focus (the web
   * app's top bar). inline: it sits under the field (popups and small windows).
   */
  layout?: 'floating' | 'inline';
  autoFocus?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
}

/**
 * One line to add an event ("Dentist tomorrow 4pm #red", DESIGN.md §3) with a live
 * preview of what will be created. The app parses the text and saves; this only shows
 * the field and the preview.
 */
export function QuickAddField({
  value,
  onChange,
  onSubmit,
  onEscape,
  preview,
  hint = 'Enter to add · Esc to clear',
  layout = 'floating',
  autoFocus = false,
  inputRef,
  className,
}: QuickAddFieldProps) {
  const previewId = useId();

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSubmit();
    } else if (event.key === 'Escape') {
      onEscape(event.currentTarget);
    }
  };

  return (
    <div className={cx('ag-quickadd', `ag-quickadd--${layout}`, className)}>
      <input
        ref={inputRef}
        // Only where the field is the reason the window opened (a popup, the hotkey).
        autoFocus={autoFocus}
        className="ag-input ag-quickadd__input"
        type="text"
        aria-label="Quick add"
        placeholder="Add an event…"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
        value={value}
        aria-describedby={preview === null ? undefined : previewId}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onKeyDown={onKeyDown}
      />
      {preview !== null && (
        <div id={previewId} className="ag-quickadd__preview">
          <p className="ag-quickadd__chip" data-event-color={preview.color}>
            <span className="ag-quickadd__dot" aria-hidden="true" />
            <span className="ag-quickadd__title">{preview.title}</span>
            <span className="ag-quickadd__when">{preview.when}</span>
            <span className="ag-quickadd__color">{preview.colorName}</span>
          </p>
          {preview.warnings.length > 0 && (
            <ul className="ag-quickadd__warnings">
              {preview.warnings.map((warning) => (
                <li key={warning}>
                  <CircleAlert aria-hidden="true" className="ag-quickadd__warning-icon" />
                  {warning}
                </li>
              ))}
            </ul>
          )}
          <p className="ag-quickadd__hint">{hint}</p>
        </div>
      )}
    </div>
  );
}
