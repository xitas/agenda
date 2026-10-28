import type { AgendaEvent } from '@agenda/core';
import { createContext, useContext } from 'react';

/** What any screen can do with an event; the dialogs live once, in the app shell. */
export interface EventActions {
  /** The read-only details dialog. */
  open: (event: AgendaEvent) => void;
  /** Optimistic delete with an Undo toast. */
  remove: (event: AgendaEvent) => void;
}

export const EventActionsContext = createContext<EventActions | null>(null);

export function useEventActions(): EventActions {
  const actions = useContext(EventActionsContext);
  if (actions === null)
    throw new Error('useEventActions must be used inside <EventActionsProvider>');
  return actions;
}
