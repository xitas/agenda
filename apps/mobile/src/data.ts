import { addDaysToPlainDate, dayRangeInTz, newId, usesTwelveHour } from '@agenda/core';
import type { AgendaEvent, EventCreate, EventPatch, Settings } from '@agenda/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useApp } from './context';

/** Every cached event list starts with this, so one invalidation refreshes them all. */
export const EVENTS_KEY = ['events'] as const;
export const SESSION_KEY = ['session'] as const;
export const SETTINGS_KEY = ['settings'] as const;

/** The events of `days` days from `first` (a plain date), through the repository. */
export function useDaysEvents(first: string, days: number) {
  const { events, env } = useApp();
  const last = addDaysToPlainDate(first, days - 1);
  return useQuery<AgendaEvent[]>({
    queryKey: [...EVENTS_KEY, 'range', first, last, env.timezone],
    queryFn: ({ signal }) =>
      events.listRange(
        {
          start: dayRangeInTz(first, env.timezone).start,
          end: dayRangeInTz(last, env.timezone).end,
        },
        env.timezone,
        { signal },
      ),
  });
}

export function useSearchEvents(query: string) {
  const { events } = useApp();
  return useQuery<AgendaEvent[]>({
    queryKey: [...EVENTS_KEY, 'search', query],
    queryFn: ({ signal }) => events.search(query, { signal }),
    enabled: query.trim() !== '',
  });
}

export function useSession() {
  const { api } = useApp();
  return useQuery({ queryKey: SESSION_KEY, queryFn: ({ signal }) => api.auth.me({ signal }) });
}

/** The shared preferences (theme, week start, clock) and the clock they imply here. */
export function usePreferences(): { preferences: Settings | undefined; hour12: boolean } {
  const { api, env } = useApp();
  const query = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: ({ signal }) => api.settings.get({ signal }),
  });
  return {
    preferences: query.data,
    hour12: usesTwelveHour(query.data?.timeFormat ?? 'auto', env.locale.code),
  };
}

/** Removes an event from every cached list (the swipe shows at once). */
function dropFromLists(client: QueryClient, id: string) {
  client.setQueriesData<AgendaEvent[]>({ queryKey: EVENTS_KEY }, (list) =>
    list?.filter((event) => event.id !== id),
  );
}

/** Create, edit, delete and Undo, all through the repository; lists refresh afterwards. */
export function useEventMutations() {
  const { events } = useApp();
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: EVENTS_KEY });
  return {
    create: useMutation({
      // The id is made here, so a retry (or Phase 7's offline queue) can't add it twice.
      mutationFn: (draft: Omit<EventCreate, 'id'>) => events.create({ ...draft, id: newId() }),
      onSettled: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: EventPatch }) => events.update(id, patch),
      onSettled: refresh,
    }),
    remove: useMutation({
      mutationFn: (event: AgendaEvent) => events.remove(event.id),
      onMutate: (event) => {
        dropFromLists(client, event.id);
      },
      onSettled: refresh,
    }),
    restore: useMutation({
      mutationFn: (event: AgendaEvent) => events.restore(event.id),
      onSettled: refresh,
    }),
  };
}
