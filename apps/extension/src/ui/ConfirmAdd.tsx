import {
  eventStartDay,
  formatShortDate,
  NetworkError,
  parseQuickAdd,
  quickAddPreview,
} from '@agenda/core';
import { Button, QuickAddField } from '@agenda/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { takePending } from '../storage';
import { useExtension, usePreferences } from './context';
import { useAddEvent } from './events';
import { SessionGate } from './SessionGate';

export interface ConfirmAddProps {
  /** The ?id= of this window: where the worker put the selected text. */
  id: string;
  /** Closes the window; a test passes a spy. */
  close?: () => void;
}

/**
 * "Add to Agenda" for selected text: shows what would be created, lets the text be
 * edited, and saves only on Add. Cancel or Esc closes without saving.
 */
export function ConfirmAdd({
  id,
  close = () => {
    window.close();
  },
}: ConfirmAddProps) {
  // Esc closes the window wherever the focus is (the field, a button).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [close]);
  const pending = useQuery({
    queryKey: ['pending', id],
    queryFn: () => takePending(id),
    staleTime: Infinity,
  });
  return (
    <main className="ext-confirm">
      <h1 className="ext-confirm__title">Add to Agenda</h1>
      <SessionGate>
        {pending.data === undefined ? (
          <p className="ext-message" role="status">
            Loading…
          </p>
        ) : (
          <ConfirmForm initial={pending.data} close={close} />
        )}
      </SessionGate>
    </main>
  );
}

function ConfirmForm({ initial, close }: { initial: string; close: () => void }) {
  const { env } = useExtension();
  const { hour12 } = usePreferences();
  const add = useAddEvent();
  const [text, setText] = useState(initial);
  const [failure, setFailure] = useState<string | null>(null);
  const parsed = useMemo(
    () =>
      text.trim() === ''
        ? null
        : parseQuickAdd(text, { now: env.now(), timezone: env.timezone, locale: env.locale.code }),
    [text, env],
  );
  const options = {
    timezone: env.timezone,
    locale: env.locale,
    ...(hour12 === undefined ? {} : { hour12 }),
  };

  const confirm = () => {
    if (parsed === null) return;
    setFailure(null);
    add.mutate(parsed.draft, {
      onSuccess: close,
      onError: (error) => {
        setFailure(
          error instanceof NetworkError
            ? `Couldn't reach the server, so "${parsed.draft.title}" wasn't added. Try again.`
            : `Couldn't add "${parsed.draft.title}". Try again.`,
        );
      },
    });
  };

  return (
    <>
      <QuickAddField
        layout="inline"
        autoFocus
        value={text}
        onChange={setText}
        onSubmit={confirm}
        // Esc is handled for the whole window above.
        onEscape={() => undefined}
        preview={parsed === null ? null : quickAddPreview(parsed, options)}
        hint="Enter to add · Esc to cancel"
      />
      {parsed !== null && (
        <p className="ext-confirm__day">
          Goes on {formatShortDate(eventStartDay(parsed.draft, env.timezone), env.locale.code)}.
        </p>
      )}
      {failure !== null && (
        <p className="ext-error" role="alert">
          {failure}
        </p>
      )}
      <div className="ext-confirm__actions">
        <Button onClick={confirm} disabled={parsed === null} loading={add.isPending}>
          Add
        </Button>
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
      </div>
    </>
  );
}
