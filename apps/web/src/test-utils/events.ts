import type { AgendaEvent } from '@agenda/core';

let counter = 0;

/** A stored event with sensible defaults; ids are unique per call. */
export function makeEvent(fields: Partial<AgendaEvent> & Pick<AgendaEvent, 'title' | 'start'>) {
  counter += 1;
  const event: AgendaEvent = {
    id: `0190f5a2-0000-7000-8000-${String(counter).padStart(12, '0')}`,
    notes: '',
    end: null,
    allDay: false,
    timezone: 'Asia/Karachi',
    location: null,
    color: 'blue',
    reminders: [],
    rrule: null,
    createdAt: '2026-10-20T05:00:00.000Z',
    updatedAt: '2026-10-20T05:00:00.000Z',
    deletedAt: null,
    ...fields,
  };
  return event;
}
