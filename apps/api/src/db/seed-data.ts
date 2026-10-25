import { AgendaEventSchema, newId, plainDateInTz, startOfDayInTz } from '@agenda/core';
import type { AgendaEvent, EventCreateInput } from '@agenda/core';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/** Sample events around today in `timezone`: timed, all-day, multi-day, past midnight. */
export function buildSeedEvents(now: Date, timezone: string): AgendaEvent[] {
  const dayStart = (offset: number) =>
    startOfDayInTz(new Date(now.getTime() + offset * DAY), timezone);
  const at = (offset: number, hours: number) =>
    new Date(dayStart(offset).getTime() + hours * HOUR).toISOString();
  const date = (offset: number) => plainDateInTz(new Date(now.getTime() + offset * DAY), timezone);

  const drafts: EventCreateInput[] = [
    { title: 'Gym', start: at(-1, 18), end: at(-1, 19), color: 'slate', timezone },
    {
      title: 'Standup',
      start: at(0, 9.5),
      end: at(0, 9.75),
      color: 'blue',
      reminders: [5],
      timezone,
    },
    {
      title: 'Lunch with Sara',
      start: at(0, 13),
      end: at(0, 14),
      color: 'green',
      location: 'Cafe Aylanto',
      timezone,
    },
    { title: 'Dentist', start: at(1, 16), color: 'teal', reminders: [60], timezone },
    { title: 'Pay rent', start: date(2), allDay: true, color: 'amber', timezone },
    {
      title: 'Late flight',
      notes: 'Crosses midnight on purpose.',
      start: at(3, 23.5),
      end: at(4, 1.5),
      color: 'red',
      timezone,
    },
    {
      title: 'Conference',
      start: date(5),
      end: date(8),
      allDay: true,
      color: 'violet',
      timezone,
    },
    {
      title: 'Birthday',
      notes: 'Buy a cake',
      start: date(10),
      allDay: true,
      color: 'pink',
      timezone,
    },
  ];

  const stamp = now.toISOString();
  return drafts.map((draft) =>
    AgendaEventSchema.parse({
      notes: '',
      end: null,
      allDay: false,
      location: null,
      reminders: [],
      rrule: null,
      ...draft,
      id: newId(),
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    }),
  );
}
