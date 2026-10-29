import { formatEventTime, plainDateInTz } from '@agenda/core';
import type { AgendaEvent } from '@agenda/core';
import { Button, EmptyState } from '@agenda/ui';
import { Search } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useEnv } from '../app/env';
import { useDebouncedValue } from '../app/useDebouncedValue';
import { dayHeading, relativeDay } from '../day/dayFormat';
import { useEventActions } from '../events/actions';
import { SEARCH_LIMIT, useSearchEvents } from '../events/queries';
import { contains, highlight, snippet } from './highlight';

/** How long typing must pause before searching. */
const SEARCH_DEBOUNCE_MS = 300;

interface Group {
  day: string;
  events: AgendaEvent[];
}

/** The day an event is listed under: its start, in the viewer's zone. */
const startDay = (event: AgendaEvent, timezone: string) =>
  event.allDay ? event.start : plainDateInTz(new Date(event.start), timezone);

/** Groups by start day: upcoming days first (soonest first), then past days (latest first). */
function groupByDay(events: readonly AgendaEvent[], timezone: string, today: string) {
  const byDay = new Map<string, AgendaEvent[]>();
  const sorted = [...events].sort(
    (a, b) =>
      Number(b.allDay) - Number(a.allDay) ||
      Date.parse(a.start) - Date.parse(b.start) ||
      a.title.localeCompare(b.title),
  );
  for (const event of sorted) {
    const day = startDay(event, timezone);
    byDay.set(day, [...(byDay.get(day) ?? []), event]);
  }
  const groups: Group[] = [...byDay].map(([day, list]) => ({ day, events: list }));
  return {
    upcoming: groups
      .filter((group) => group.day >= today)
      .sort((a, b) => a.day.localeCompare(b.day)),
    past: groups.filter((group) => group.day < today).sort((a, b) => b.day.localeCompare(a.day)),
  };
}

/** "/search?q=": events matching the text in any date, grouped by day. */
export function SearchPage() {
  const env = useEnv();
  const actions = useEventActions();
  const headingId = useId();
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  const query = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS);
  const results = useSearchEvents(query);
  const today = plainDateInTz(env.now(), env.timezone);

  // Keep the URL in step with the search, so it can be shared and survives a reload.
  useEffect(() => {
    if ((params.get('q') ?? '') === query) return;
    setParams(query === '' ? {} : { q: query }, { replace: true });
  }, [query, params, setParams]);

  const groups = useMemo(
    () => groupByDay(results.data ?? [], env.timezone, today),
    [results.data, env.timezone, today],
  );

  const renderGroup = ({ day, events }: Group) => {
    const relative = relativeDay(day, today);
    const label = `${relative === undefined ? '' : `${relative} · `}${dayHeading(day, today, env.locale.code)}`;
    return (
      <li key={day} className="search__group">
        <h3 className="search__day">{label}</h3>
        <ul className="search__events">
          {events.map((event) => {
            const where = contains(event.location, query) ? event.location : null;
            const notes =
              !contains(event.title, query) && where === null && contains(event.notes, query);
            return (
              <li key={event.id} data-event-id={event.id}>
                <button
                  type="button"
                  className="search__result"
                  data-event-color={event.color}
                  onClick={() => {
                    actions.open(event);
                  }}
                >
                  <span className="search__title">{highlight(event.title, query)}</span>
                  <span className="search__time">
                    {formatEventTime(event, env.timezone, env.locale, { hour12: env.hour12 })}
                  </span>
                  {where !== null && (
                    <span className="search__extra">{highlight(where, query)}</span>
                  )}
                  {notes && (
                    <span className="search__extra">
                      {highlight(snippet(event.notes, query), query)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </li>
    );
  };

  let body;
  if (query === '') {
    body = (
      <EmptyState
        icon={<Search />}
        title="Find an event."
        hint="Search titles, places and notes."
      />
    );
  } else if (results.isPending) {
    body = (
      <p className="search__status" role="status">
        Searching…
      </p>
    );
  } else if (results.isError) {
    body = (
      <div className="search__status" role="alert">
        <p>Couldn&apos;t search. Check your connection and try again.</p>
        <Button
          variant="secondary"
          onClick={() => {
            void results.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  } else if (results.data.length === 0) {
    body = (
      <EmptyState
        icon={<Search />}
        title={`Nothing matches "${query}".`}
        hint="Check the spelling, or try a shorter word."
      />
    );
  } else {
    const count = results.data.length;
    body = (
      <>
        <p className="search__status" role="status">
          {count >= SEARCH_LIMIT
            ? `Showing the first ${String(SEARCH_LIMIT)} matches. Add a word to narrow it down.`
            : `${String(count)} ${count === 1 ? 'match' : 'matches'}`}
        </p>
        {groups.upcoming.length > 0 && (
          <section className="search__section" aria-label="Upcoming">
            <h2 className="search__heading">Upcoming</h2>
            <ol className="search__groups">{groups.upcoming.map(renderGroup)}</ol>
          </section>
        )}
        {groups.past.length > 0 && (
          <section className="search__section" aria-label="Past">
            <h2 className="search__heading">Past</h2>
            <ol className="search__groups">{groups.past.map(renderGroup)}</ol>
          </section>
        )}
      </>
    );
  }

  return (
    <section className="search" aria-labelledby={headingId}>
      <h1 id={headingId} className="view-header__heading">
        Search
      </h1>
      <div className="search__field">
        <Search aria-hidden="true" className="search__icon" />
        <input
          className="ag-input search__input"
          type="search"
          aria-label="Search events"
          placeholder="Search events…"
          autoComplete="off"
          // The page exists to type into; "/" and the nav both land here.
          autoFocus
          maxLength={200}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
      </div>
      {body}
    </section>
  );
}
