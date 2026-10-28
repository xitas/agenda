import type { EventColor } from '@agenda/core';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { enGB, enUS } from 'date-fns/locale';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState.js';
import { EventCard } from './EventCard.js';
import type { EventCardProps } from './EventCard.js';
import { expectNoAxeViolations } from './test-utils/axe.js';

const dentist: EventCardProps['event'] = {
  title: 'Dentist',
  start: '2026-10-24T11:00:00.000Z',
  end: '2026-10-24T12:30:00.000Z',
  allDay: false,
  color: 'teal',
  location: 'Clinic, Main St',
};

const card = (props: Partial<EventCardProps> = {}) =>
  render(<EventCard event={dentist} timezone="Asia/Karachi" locale={enGB} {...props} />);

describe('EventCard', () => {
  it('shows the title, the time in the given zone, the location and the category', () => {
    const { container } = card();
    expect(screen.getByText('Dentist')).toBeDefined();
    // Tests run in UTC+14, so this only passes if the timezone prop is used.
    const time = screen.getByText('16:00 – 17:30');
    expect(time.tagName).toBe('TIME');
    expect(time.getAttribute('datetime')).toBe(dentist.start);
    expect(screen.getByText('Clinic, Main St')).toBeDefined();
    expect(screen.getByText('Category: Teal').className).toBe('ag-visually-hidden');
    const root = container.firstElementChild;
    expect(root?.getAttribute('data-event-color')).toBe('teal');
    expect(root?.className).toBe('ag-event-card ag-event-card--default');
  });

  it('follows the locale for 12- or 24-hour time', () => {
    card({ locale: enUS });
    expect(screen.getByText('4:00 PM – 5:30 PM')).toBeDefined();
  });

  it('shows "All day" for all-day events', () => {
    card({ event: { ...dentist, allDay: true, start: '2026-10-24', end: null } });
    expect(screen.getByText('All day')).toBeDefined();
  });

  it('compact: no location, compact class', () => {
    const { container } = card({ variant: 'compact' });
    expect(screen.queryByText('Clinic, Main St')).toBeNull();
    expect(container.firstElementChild?.className).toContain('ag-event-card--compact');
  });

  it('leaves out an empty location', () => {
    card({ event: { ...dentist, location: '' } });
    expect(document.querySelector('.ag-event-card__location')).toBeNull();
  });

  it.each(['slate', 'blue', 'green', 'amber', 'red', 'violet', 'pink', 'teal'] as EventColor[])(
    'sets data-event-color for %s',
    (color) => {
      const { container } = card({ event: { ...dentist, color } });
      expect(container.firstElementChild?.getAttribute('data-event-color')).toBe(color);
    },
  );

  it('becomes a button with onSelect, usable from the keyboard', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    card({ onSelect });
    const button = screen.getByRole('button', { name: /Dentist/ });
    expect(button.className).toContain('ag-event-card--interactive');
    expect(button.textContent).toContain('Category: Teal');
    await user.click(button);
    await user.tab();
    await user.tab({ shift: true });
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('has no axe violations as a block or a button', async () => {
    const { container } = render(
      <div>
        <EventCard event={dentist} timezone="UTC" locale={enGB} />
        <EventCard
          event={dentist}
          timezone="UTC"
          locale={enGB}
          variant="compact"
          onSelect={() => undefined}
        />
      </div>,
    );
    await expectNoAxeViolations(container);
  });
});

describe('EmptyState', () => {
  it('shows a default icon, the line, a hint and an action', () => {
    const { container } = render(
      <EmptyState
        title="Nothing today. Enjoy the space."
        hint="Press N to add an event."
        action={<button type="button">Add event</button>}
      />,
    );
    expect(screen.getByText('Nothing today. Enjoy the space.')).toBeDefined();
    expect(screen.getByText('Press N to add an event.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add event' })).toBeDefined();
    expect(container.querySelector('.ag-empty__icon svg')).not.toBeNull();
  });

  it('accepts a custom icon and works without hint or action', () => {
    render(<EmptyState title="No results" icon={<span data-testid="icon" />} />);
    expect(screen.getByTestId('icon')).toBeDefined();
    expect(document.querySelector('.ag-empty__hint')).toBeNull();
    expect(document.querySelector('.ag-empty__action')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(<EmptyState title="Nothing today." hint="Press N." />);
    await expectNoAxeViolations(container);
  });
});
