import { dayRangeInTz, newId, addDaysToPlainDate } from '@agenda/core';
import type { AgendaEvent, EventCreate } from '@agenda/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useExtension } from './context';

/** Every cached list starts with this, so one invalidation refreshes them all. */
export const EVENTS_KEY = ['events'] as const;

/** The events of `days` days from `first` (a plain date) in the viewer's zone. */
export function useDaysEvents(first: string, days: number) {
  const { api, env } = useExtension();
  const last = addDaysToPlainDate(first, days - 1);
  return useQuery<AgendaEvent[]>({
    queryKey: [...EVENTS_KEY, first, last, env.timezone],
    queryFn: ({ signal }) =>
      api.events.listAll(
        {
          from: dayRangeInTz(first, env.timezone).start,
          to: dayRangeInTz(last, env.timezone).end,
          tz: env.timezone,
        },
        { signal },
      ),
  });
}

/** Saves a parsed draft, refreshes the lists, and tells the worker (badge, reminders). */
export function useAddEvent() {
  const { api, platform } = useExtension();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: EventCreate) => api.events.create({ ...draft, id: newId() }),
    onSuccess: async () => {
      await platform.extension.eventsChanged();
      await queryClient.invalidateQueries({ queryKey: EVENTS_KEY });
    },
  });
}
