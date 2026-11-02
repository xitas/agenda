import { NetworkError, newId, parseQuickAdd, quickAddPreview } from '@agenda/core';
import { QuickAddField, useToast } from '@agenda/ui';
import { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useEnv } from '../app/env';
import { dayPath, parseDay, shortDate, todayIn } from '../day/dayFormat';
import { useCreateEvent } from '../events/mutations';
import { useShortcuts } from '../shortcuts';
import { startDay } from './preview';

/** The day the page shows, or null when it isn't a day page (Week, Month, Search). */
function useViewedDay(today: string): string | null {
  const { pathname } = useLocation();
  if (pathname === '/') return today;
  return pathname.startsWith('/day/') ? parseDay(pathname.slice('/day/'.length)) : null;
}

export interface QuickAddProps {
  /**
   * The desktop quick-add window: the field has focus from the start, the preview sits
   * under it instead of floating over a page, and these replace the toasts and Esc.
   */
  popup?: {
    /** After a save, with the day the event is on. */
    onAdded: (day: string) => void;
    /** Esc: close the window. */
    onCancel: () => void;
    onFailed: (message: string) => void;
  };
}

/**
 * One line to add an event ("Dentist tomorrow 4pm #red", DESIGN.md §3), with a live
 * preview of what will be created. Enter adds, Esc clears, N or Ctrl/Cmd+K focuses it.
 */
export function QuickAdd({ popup }: QuickAddProps = {}) {
  const env = useEnv();
  const navigate = useNavigate();
  const { toast } = useToast();
  const create = useCreateEvent();
  const input = useRef<HTMLInputElement>(null);
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
        if (popup !== undefined) {
          popup.onAdded(day);
          return;
        }
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
        const message =
          error instanceof NetworkError
            ? `Couldn't reach the server, so "${draft.title}" wasn't added. Try again.`
            : `Couldn't add "${draft.title}". Try again.`;
        if (popup === undefined) toast({ message });
        else popup.onFailed(message);
      },
    });
  };

  return (
    <QuickAddField
      className={popup === undefined ? 'quick-add' : 'quick-add quick-add--window'}
      layout={popup === undefined ? 'floating' : 'inline'}
      // The window opens for typing; nothing else is in it.
      autoFocus={popup !== undefined}
      inputRef={input}
      value={text}
      onChange={setText}
      onSubmit={submit}
      onEscape={(field) => {
        if (popup !== undefined) popup.onCancel();
        else if (text === '') field.blur();
        setText('');
      }}
      preview={parsed === null ? null : quickAddPreview(parsed, env)}
      hint={popup === undefined ? 'Enter to add · Esc to clear' : 'Enter to add · Esc to close'}
    />
  );
}
