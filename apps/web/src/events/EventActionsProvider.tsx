import { formFromEvent, newEventForm, newId } from '@agenda/core';
import type { AgendaEvent, EventCreate, EventForm } from '@agenda/core';
import { useToast } from '@agenda/ui';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useEnv } from '../app/env';
import { EventActionsContext } from './actions';
import type { EventActions } from './actions';
import { EventDetails } from './EventDetails';
import { EventEditor } from './EventEditor';
import { failure, useCreateEvent, useDeleteEvent, useUpdateEvent } from './mutations';

type EditorState =
  { mode: 'create'; form: EventForm } | { mode: 'edit'; form: EventForm; event: AgendaEvent };

const HOUR = 60 * 60_000;

/** A checked editor result, before it gets an id. */
type EventDraft = Omit<EventCreate, 'id'>;

/**
 * Provides the event actions and renders their dialogs, once for the whole app. The
 * mutations live here, not in the dialogs, so their callbacks (error toasts, reopening
 * the editor) still run after a dialog has closed.
 */
export function EventActionsProvider({ children }: { children: ReactNode }) {
  const env = useEnv();
  const { toast } = useToast();
  const { mutate: createEvent } = useCreateEvent();
  const { mutate: updateEvent } = useUpdateEvent();
  const { mutate: removeEvent } = useDeleteEvent();
  const [opened, setOpened] = useState<AgendaEvent | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);

  const actions = useMemo<EventActions>(
    () => ({
      open: setOpened,
      edit: (event) => {
        setOpened(null);
        setEditor({ mode: 'edit', event, form: formFromEvent(event, env.timezone) });
      },
      create: (start) => {
        const at = start ?? new Date(Math.ceil(env.now().getTime() / HOUR) * HOUR);
        setEditor({ mode: 'create', form: newEventForm(at, env.timezone) });
      },
      remove: (event) => {
        removeEvent(event);
      },
    }),
    [env, removeEvent],
  );

  const save = (state: EditorState, value: EventDraft, form: EventForm) => {
    setEditor(null);
    // If the API says no, offer the form back with what was typed.
    const reopen = {
      label: 'Edit',
      altText: 'Open the editor again',
      onAction: () => {
        setEditor({ ...state, form });
      },
    };
    if (state.mode === 'create') {
      createEvent(
        { ...value, id: newId() },
        {
          onError: (error) => {
            toast({ message: failure(error, `add "${value.title}"`), action: reopen });
          },
        },
      );
    } else {
      updateEvent(
        { event: state.event, patch: value },
        {
          onError: (error) => {
            toast({ message: failure(error, `save "${value.title}"`), action: reopen });
          },
        },
      );
    }
  };

  return (
    <EventActionsContext.Provider value={actions}>
      {children}
      <EventDetails
        event={opened}
        onClose={() => {
          setOpened(null);
        }}
        onEdit={actions.edit}
        onDelete={actions.remove}
      />
      {editor !== null && (
        <EventEditor
          // A fresh editor (and form state) for each event or reopening.
          key={editor.mode === 'edit' ? editor.event.id : 'new'}
          mode={editor.mode}
          initial={editor.form}
          eventZone={editor.mode === 'edit' ? editor.event.timezone : env.timezone}
          onClose={() => {
            setEditor(null);
          }}
          onSave={(value, form) => {
            save(editor, value, form);
          }}
        />
      )}
    </EventActionsContext.Provider>
  );
}
