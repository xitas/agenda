import type { AgendaEvent, DateRange } from '@agenda/core';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../app/api';

/** Every cached list of events starts with this, so one invalidation refreshes them all. */
export const EVENTS_KEY = ['events'] as const;

export type RangeKey = readonly ['events', 'range', string, string, string];

/** The cache key for the events in [range.start, range.end) as seen from `timezone`. */
export function rangeKey(range: DateRange, timezone: string): RangeKey {
  return ['events', 'range', range.start.toISOString(), range.end.toISOString(), timezone];
}

/** Reads a range back from its cache key (used to place optimistic events). */
export function rangeFromKey(
  key: readonly unknown[],
): { range: DateRange; timezone: string } | null {
  const [root, kind, start, end, timezone] = key;
  if (root !== 'events' || kind !== 'range') return null;
  if (typeof start !== 'string' || typeof end !== 'string' || typeof timezone !== 'string')
    return null;
  return { range: { start: new Date(start), end: new Date(end) }, timezone };
}

/** All events overlapping a range, following the cursor until the last page. */
export function useRangeEvents(range: DateRange, timezone: string) {
  const api = useApi();
  return useQuery<AgendaEvent[]>({
    queryKey: rangeKey(range, timezone),
    queryFn: ({ signal }) =>
      api.events.listAll({ from: range.start, to: range.end, tz: timezone }, { signal }),
  });
}
