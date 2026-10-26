import type { AgendaEvent, EventColor } from '@agenda/core';
import { EVENT_COLORS } from '@agenda/core';
import {
  Button,
  Dialog,
  DialogClose,
  EmptyState,
  EventCard,
  IconButton,
  Input,
  Textarea,
  useToast,
} from '@agenda/ui';
import { enGB } from 'date-fns/locale';
import { Pencil, Plus, Search, Settings, Trash2 } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { ThemeSwitcher } from './ThemeSwitcher';

const TIMEZONE = 'Asia/Karachi';
type CardEvent = Pick<AgendaEvent, 'title' | 'start' | 'end' | 'allDay' | 'color' | 'location'>;

const TITLES: Record<EventColor, string> = {
  slate: 'Weekly review',
  blue: 'Standup',
  green: 'Lunch with Sara',
  amber: 'Pay rent',
  red: 'Dentist',
  violet: 'Yoga',
  pink: 'Birthday drinks',
  teal: 'Flight to Lahore',
};

const timedEvents: CardEvent[] = EVENT_COLORS.map((color, i) => ({
  title: TITLES[color],
  color,
  allDay: false,
  start: `2026-10-24T${String(4 + i).padStart(2, '0')}:00:00.000Z`,
  end: `2026-10-24T${String(4 + i).padStart(2, '0')}:45:00.000Z`,
  location: i % 3 === 0 ? 'Office, 2nd floor' : null,
}));

const allDayEvents: CardEvent[] = [
  {
    title: 'Conference',
    color: 'violet',
    allDay: true,
    start: '2026-11-03',
    end: '2026-11-06',
    location: 'Expo Centre',
  },
  {
    title: 'Public holiday',
    color: 'green',
    allDay: true,
    start: '2026-11-09',
    end: null,
    location: null,
  },
  {
    title: 'A very long event title that has to be cut off neatly at the edge of the card',
    color: 'blue',
    allDay: false,
    start: '2026-10-24T18:00:00.000Z',
    end: '2026-10-24T20:00:00.000Z',
    location: 'Somewhere with an equally long address, Block 7, Street 12',
  },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  // An id from useId: a title with spaces would be read as several ids by aria-labelledby.
  const headingId = useId();
  return (
    <section className="playground__section" aria-labelledby={headingId}>
      <h2 id={headingId} className="playground__heading">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ToastDemo() {
  const { toast } = useToast();
  return (
    <div className="playground__row">
      <Button
        variant="secondary"
        onClick={() => {
          toast({ message: 'Saved.' });
        }}
      >
        Show a toast
      </Button>
      <Button
        variant="danger"
        icon={<Trash2 aria-hidden="true" />}
        onClick={() => {
          toast({
            message: 'Event deleted.',
            action: {
              label: 'Undo',
              onAction: () => {
                toast({ message: 'Event restored.' });
              },
            },
          });
        }}
      >
        Delete with Undo
      </Button>
    </div>
  );
}

/** Every ui component in every state, in both themes (DESIGN.md §2–3). */
export function Playground() {
  return (
    <main className="playground">
      <header className="playground__header">
        <h1 className="playground__title">UI playground</h1>
        <ThemeSwitcher />
      </header>

      <Section title="Buttons">
        {(['md', 'sm'] as const).map((size) => (
          <div key={size} className="playground__row">
            {(['primary', 'secondary', 'ghost', 'danger'] as const).map((variant) => (
              <Button key={variant} variant={variant} size={size}>
                {variant.charAt(0).toUpperCase() + variant.slice(1)}
              </Button>
            ))}
          </div>
        ))}
        <div className="playground__row">
          <Button icon={<Plus aria-hidden="true" />}>Add event</Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
          <Button loading>Saving</Button>
          <Button variant="danger" loading>
            Deleting
          </Button>
        </div>
        <div className="playground__row">
          <IconButton label="Search" icon={<Search />} />
          <IconButton label="Edit" icon={<Pencil />} variant="secondary" />
          <IconButton label="Add" icon={<Plus />} variant="primary" />
          <IconButton label="Settings" icon={<Settings />} size="sm" />
          <IconButton label="Delete" icon={<Trash2 />} variant="danger" size="sm" />
        </div>
      </Section>

      <Section title="Inputs">
        <div className="playground__grid">
          <Input label="Title" placeholder="Dentist tomorrow 4pm" />
          <Input label="Location" hint="Optional" defaultValue="Clinic" />
          <Input label="Title (required)" required error="Add a title" />
          <Input label="Disabled" disabled defaultValue="Can't change this" />
          <Textarea
            label="Notes"
            hint="Markdown-lite"
            defaultValue={'Bring the form.\nAsk about the X-ray.'}
          />
        </div>
      </Section>

      <Section title="Dialog and toast">
        <div className="playground__row">
          <Dialog
            trigger={<Button variant="secondary">Open the event editor</Button>}
            title="Edit event"
            description="Changes are saved when you press Save."
            footer={
              <>
                <DialogClose asChild>
                  <Button variant="secondary">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>Save</Button>
                </DialogClose>
              </>
            }
          >
            <Input label="Title" defaultValue="Dentist" />
            <Textarea label="Notes" />
          </Dialog>
        </div>
        <ToastDemo />
      </Section>

      <Section title="Event cards">
        <div className="playground__cards">
          {timedEvents.map((event) => (
            <EventCard
              key={event.color}
              event={event}
              timezone={TIMEZONE}
              locale={enGB}
              onSelect={() => undefined}
            />
          ))}
          {allDayEvents.map((event) => (
            <EventCard key={event.title} event={event} timezone={TIMEZONE} locale={enGB} />
          ))}
        </div>
        <h3 className="playground__subheading">Compact</h3>
        <div className="playground__compact">
          {[...timedEvents.slice(0, 4), ...allDayEvents].map((event) => (
            <EventCard
              key={event.title}
              event={event}
              timezone={TIMEZONE}
              locale={enGB}
              variant="compact"
            />
          ))}
        </div>
      </Section>

      <Section title="Empty state">
        <EmptyState
          title="Nothing today. Enjoy the space."
          hint="Press N to add an event."
          action={<Button icon={<Plus aria-hidden="true" />}>Add event</Button>}
        />
      </Section>
    </main>
  );
}
