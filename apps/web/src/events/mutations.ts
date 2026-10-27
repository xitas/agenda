import { eventOverlapsRange } from '@agenda/core';
import type { AgendaEvent, EventCreate } from '@agenda/core';
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

export function restoreSnapshot(queryClient: QueryClient, snapshot: EventsSnapshot | undefined) {
  for (const [key, data] of snapshot ?? []) queryClient.setQueryData(key, data);
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
      for (const [key, data] of snapshot) {
        const cached = rangeFromKey(key);
        if (data && cached && eventOverlapsRange(event, cached.range, cached.timezone)) {
          queryClient.setQueryData<AgendaEvent[]>(key, [...data, event]);
        }
      }
      return { snapshot };
    },
    onError: (_error, _draft, context) => {
      restoreSnapshot(queryClient, context?.snapshot);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: EVENTS_KEY }),
  });
}
