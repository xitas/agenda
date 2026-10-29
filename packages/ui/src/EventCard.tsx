import { formatEventTime } from '@agenda/core';
import type { AgendaEvent, Locale } from '@agenda/core';
import { MapPin } from 'lucide-react';
import { cx } from './cx.js';

export type EventCardVariant = 'default' | 'compact';

export interface EventCardProps {
  event: Pick<AgendaEvent, 'title' | 'start' | 'end' | 'allDay' | 'color' | 'location'>;
  /** The viewer's zone; times are shown in it (all-day dates never move). */
  timezone: string;
  locale: Locale;
  /** compact: one line, for month cells and the extension popup. */
  variant?: EventCardVariant;
  /** Makes the card a button, e.g. to open the editor. */
  onSelect?: () => void;
  /** The event has ended: its title is muted (still readable). */
  past?: boolean;
  /** Replaces the time shown (e.g. just the start in a month cell); null shows none. */
  time?: string | null;
  /** Force a 12- (true) or 24-hour (false) clock; by default the locale decides. */
  hour12?: boolean | undefined;
}

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * An event block (DESIGN.md §3): a 3 px bar in the category's strong color on its soft
 * fill, the title, and the time in tabular figures. The category is also named for
 * screen readers, so color is never the only signal.
 */
export function EventCard({
  event,
  timezone,
  locale,
  variant = 'default',
  onSelect,
  past = false,
  time: timeOverride,
  hour12,
}: EventCardProps) {
  const time =
    timeOverride === undefined
      ? formatEventTime(event, timezone, locale, { hour12 })
      : timeOverride;
  const content = (
    <>
      <span className="ag-event-card__title">{event.title}</span>
      {time !== null && (
        <time className="ag-event-card__time" dateTime={event.start}>
          {time}
        </time>
      )}
      {variant === 'default' && event.location !== null && event.location !== '' && (
        <span className="ag-event-card__location">
          <MapPin aria-hidden="true" className="ag-event-card__icon" />
          <span className="ag-event-card__location-text">{event.location}</span>
        </span>
      )}
      <span className="ag-visually-hidden">Category: {capitalise(event.color)}</span>
    </>
  );
  const className = cx(
    'ag-event-card',
    `ag-event-card--${variant}`,
    onSelect && 'ag-event-card--interactive',
    past && 'ag-event-card--past',
  );

  return onSelect === undefined ? (
    <div className={className} data-event-color={event.color}>
      {content}
    </div>
  ) : (
    <button type="button" className={className} data-event-color={event.color} onClick={onSelect}>
      {content}
    </button>
  );
}
