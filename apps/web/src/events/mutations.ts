import { NetworkError, eventOverlapsRange } from '@agenda/core';
import type { AgendaEvent, EventCreate, EventPatch } from '@agenda/core';
import { useToast } from '@agenda/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { useApi } from '../app/api';
import { useEnv } from '../app/env';
import { EVENTS_KEY, rangeFromKey } from './queries';

/** Every cached event list as it was before an optimistic change. */
export type EventsSnapshot = [QueryKey, AgendaEvent[] | undefined][];

/**
 * Stops in-flight event fetches (so they can't overwrite the optimistic change when they
 * land) and remembers every cached list, to roll back to if the server says no.
 */
async function takeSnapshot(queryClient: QueryClient): Promise<EventsSnapshot> {
  await queryClient.cancelQueries({ queryKey: EVENTS_KEY });
  return queryClient.getQueriesData<AgendaEvent[]>({ queryKey: EVENTS_KEY });
}

/** Adds an event to every cached list whose range it overlaps (and only those). */
function insertEverywhere(queryClient: QueryClient, snapshot: EventsSnapshot, event: AgendaEvent) {
  for (const [key, data] of snapshot) {
    const cached = rangeFromKey(key);
    if (data && cached && eventOverlapsRange(event, cached.range, cached.timezone)) {
      queryClient.setQueryData<AgendaEvent[]>(
        key,
        data.filter((other) => other.id !== event.id).concat(event),
      );
    }
  }
}

/**
 * Puts an edited event in place of the old one: range lists drop it, then take it back
 * only if it still overlaps their range (it may have moved); other lists (search) swap it
 * where it was.
 */
function replaceEverywhere(queryClient: QueryClient, snapshot: EventsSnapshot, event: AgendaEvent) {
  for (const [key, data] of snapshot) {
    if (!data) continue;
    const cached = rangeFromKey(key);
    if (cached === null) {
      queryClient.setQueryData<AgendaEvent[]>(
        key,
        data.map((other) => (other.id === event.id ? event : other)),
      );
    } else {
      const without = data.filter((other) => other.id !== event.id);
      queryClient.setQueryData<AgendaEvent[]>(
        key,
        eventOverlapsRange(event, cached.range, cached.timezone) ? [...without, event] : without,
      );
    }
  }
}

export function restoreSnapshot(queryClient: QueryClient, snapshot: EventsSnapshot | undefined) {
  for (const [key, data] of snapshot ?? []) queryClient.setQueryData(key, data);
}

/** "Couldn't delete "Dentist". Try again.", or why the server couldn't be asked. */
export function failure(error: unknown, action: string): string {
  return error instanceof NetworkError
    ? `Couldn't reach the server, so we couldn't ${action}. Try again.`
    : `Couldn't ${action}. Try again.`;
}

/** A new event with the client's own id, so the optimistic copy and the saved one match. */
export type NewEvent = EventCreate & { id: string };

/**
 * Creates an event optimistically: it appears in every cached range it overlaps at once,
 * disappears again if the API rejects it, and the lists are refetched either way.
 */
export function useCreateEvent() {
  const api = useApi();
  const env = useEnv();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: NewEvent) => api.events.create(draft),
    onMutate: async (draft) => {
      const snapshot = await takeSnapshot(queryClient);
      const now = env.now().toISOString();
      const event: AgendaEvent = { ...draft, createdAt: now, updatedAt: now, deletedAt: null };
      insertEverywhere(queryClient, snapshot, event);
      return { snapshot };
    },
    onError: (_error, _draft, context) => {
      restoreSnapshot(queryClient, context?.snapshot);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: EVENTS_KEY }),
  });
}

/**
 * Deletes optimistically: the event leaves every cached list at once and comes back on
 * error. Success shows "Event deleted." with Undo (DESIGN.md §7: Undo over confirm dialogs).
 * The toasts are hook-level callbacks, which still run if the page has unmounted.
 */
export function useDeleteEvent() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const restore = useRestoreEvent();
  return useMutation({
    mutationFn: (event: AgendaEvent) => api.events.remove(event.id),
    onMutate: async (event) => {
      const snapshot = await takeSnapshot(queryClient);
      for (const [key, data] of snapshot) {
        if (data)
          queryClient.setQueryData(
            key,
            data.filter((other) => other.id !== event.id),
          );
      }
      return { snapshot };
    },
    onSuccess: (_result, event) => {
      toast({
        message: 'Event deleted.',
        action: {
          label: 'Undo',
          altText: 'Undo the delete',
          onAction: () => {
            restore.mutate(event);
          },
        },
      });
    },
    onError: (error, event, context) => {
      restoreSnapshot(queryClient, context?.snapshot);
      toast({ message: failure(error, `delete "${event.title}"`) });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: EVENTS_KEY }),
  });
}

/** Undoes a delete optimistically: the event is back on screen before the API answers. */
export function useRestoreEvent() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (event: AgendaEvent) => api.events.restore(event.id),
    onMutate: async (event) => {
      const snapshot = await takeSnapshot(queryClient);
      insertEverywhere(queryClient, snapshot, { ...event, deletedAt: null });
      return { snapshot };
    },
    onError: (error, event, context) => {
      restoreSnapshot(queryClient, context?.snapshot);
      toast({ message: failure(error, `restore "${event.title}"`) });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: EVENTS_KEY }),
  });
}

/** What an edit needs: the event as it was (for the optimistic copy) and the changes. */
export interface EventEdit {
  event: AgendaEvent;
  patch: EventPatch;
}

/**
 * Saves an edit optimistically: the changed event shows at once, in the right lists if it
 * moved, and everything rolls back if the API rejects it. The caller adds its own error
 * message (the editor offers to reopen the form).
 */
export function useUpdateEvent() {
  const api = useApi();
  const env = useEnv();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ event, patch }: EventEdit) => api.events.update(event.id, patch),
    onMutate: async ({ event, patch }) => {
      const snapshot = await takeSnapshot(queryClient);
      replaceEverywhere(queryClient, snapshot, {
        ...event,
        ...patch,
        updatedAt: env.now().toISOString(),
      });
      return { snapshot };
    },
    onError: (_error, _edit, context) => {
      restoreSnapshot(queryClient, context?.snapshot);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: EVENTS_KEY }),
  });
}
