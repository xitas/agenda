import { NetworkError, newId, parseQuickAdd } from '@agenda/core';
import { useToast } from '@agenda/ui';
import { CircleAlert } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useEnv } from '../app/env';
import { dayPath, parseDay, shortDate, todayIn } from '../day/dayFormat';
import { useCreateEvent } from '../events/mutations';
import { useShortcuts } from '../shortcuts';
import { colorName, previewWhen, startDay } from './preview';

/** The day the page shows, or null when it isn't a day page (Week, Month, Search). */
function useViewedDay(today: string): string | null {
  const { pathname } = useLocation();
  if (pathname === '/') return today;
  return pathname.startsWith('/day/') ? parseDay(pathname.slice('/day/'.length)) : null;
}

/**
 * One line to add an event ("Dentist tomorrow 4pm #red", DESIGN.md §3), with a live
 * preview of what will be created. Enter adds, Esc clears, N or Ctrl/Cmd+K focuses it.
 */
export function QuickAdd() {
  const env = useEnv();
  const navigate = useNavigate();
  const { toast } = useToast();
  const create = useCreateEvent();
  const input = useRef<HTMLInputElement>(null);
  const previewId = useId();
  const [text, setText] = useState('');
  const today = todayIn(env);
  const viewedDay = useViewedDay(today);

  const focus = () => {
    input.current?.focus();
  };
  useShortcuts({ n: focus, 'mod+k': focus });

  const parsed = useMemo(() => {
    if (text.trim() === '') return null;
    return parseQuickAdd(text, {
      now: env.now(),
      timezone: env.timezone,
      locale: env.locale.code,
    });
  }, [text, env]);

  const submit = () => {
    if (parsed === null) return;
    const typed = text;
    const draft = { ...parsed.draft, id: newId() };
    const day = startDay(draft, env.timezone);
    setText('');
    create.mutate(draft, {
      onSuccess: () => {
        // Say where it went when that isn't the page on screen.
        if (day === viewedDay) return;
        toast({
          message: `Event added for ${shortDate(day, env.locale.code)}.`,
          action: {
            label: 'Show',
            altText: 'Go to that day',
            onAction: () => {
              void navigate(dayPath(day, todayIn(env)));
            },
          },
        });
      },
      onError: (error) => {
        // Give the text back so nothing typed is lost.
        setText((current) => (current === '' ? typed : current));
        toast({
          message:
            error instanceof NetworkError
              ? `Couldn't reach the server, so "${draft.title}" wasn't added. Try again.`
              : `Couldn't add "${draft.title}". Try again.`,
        });
      },
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    } else if (event.key === 'Escape') {
      if (text === '') event.currentTarget.blur();
      setText('');
    }
  };

  return (
    <div className="quick-add">
      <input
        ref={input}
        className="ag-input quick-add__input"
        type="text"
        aria-label="Quick add"
        placeholder="Add an event, e.g. Dentist tomorrow 4pm #red"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
        value={text}
        aria-describedby={parsed === null ? undefined : previewId}
        onChange={(event) => {
          setText(event.target.value);
        }}
        onKeyDown={onKeyDown}
      />
      {parsed !== null && (
        <div id={previewId} className="quick-add__preview">
          <p className="quick-add__chip" data-color={parsed.draft.color}>
            <span className="quick-add__dot" aria-hidden="true" />
            <span className="quick-add__title">{parsed.draft.title}</span>
            <span className="quick-add__when">{previewWhen(parsed.draft, env)}</span>
            <span className="quick-add__color">{colorName(parsed.draft.color)}</span>
          </p>
          {parsed.warnings.length > 0 && (
            <ul className="quick-add__warnings">
              {parsed.warnings.map((warning) => (
                <li key={warning}>
                  <CircleAlert aria-hidden="true" className="quick-add__warning-icon" />
                  {warning}
                </li>
              ))}
            </ul>
          )}
          <p className="quick-add__hint">Enter to add · Esc to clear</p>
        </div>
      )}
    </div>
  );
}
