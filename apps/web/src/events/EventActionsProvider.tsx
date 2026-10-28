import type { AgendaEvent } from '@agenda/core';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { EventActionsContext } from './actions';
import type { EventActions } from './actions';
import { EventDetails } from './EventDetails';
import { useDeleteEvent } from './mutations';

/** Provides the event actions and renders their dialogs, once for the whole app. */
export function EventActionsProvider({ children }: { children: ReactNode }) {
  const remove = useDeleteEvent();
  const [opened, setOpened] = useState<AgendaEvent | null>(null);
  const { mutate: removeEvent } = remove;

  const actions = useMemo<EventActions>(
    () => ({
      open: setOpened,
      remove: (event) => {
        removeEvent(event);
      },
    }),
    [removeEvent],
  );

  return (
    <EventActionsContext.Provider value={actions}>
      {children}
      <EventDetails
        event={opened}
        onClose={() => {
          setOpened(null);
        }}
        onDelete={actions.remove}
      />
    </EventActionsContext.Provider>
  );
}
