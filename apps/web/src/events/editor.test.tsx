import { ApiError, NetworkError, eventOverlapsRange } from '@agenda/core';
import type { AgendaEvent } from '@agenda/core';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../test-utils/axe';
import { makeEvent } from '../test-utils/events';
import type { FakeApi } from '../test-utils/fakeApi';
import { NOW, renderApp } from '../test-utils/renderApp';
import { findToastAction } from '../test-utils/toast';

// NOW is Tuesday 27 October 2026, 14:00 in Karachi (UTC+5).
const REVIEW = makeEvent({
  title: 'Review',
  start: '2026-10-27T11:00:00.000Z',
  end: '2026-10-27T12:00:00.000Z',
  color: 'red',
  reminders: [10],
  location: 'Room 4',
  notes: 'Bring the slides',
});

/** A server that stores what create and update send, so refetches show the true state. */
function withServer(initial: AgendaEvent[] = [REVIEW]) {
  return (fake: FakeApi) => {
    let events = initial;
    fake.events.listAll.mockImplementation((params) =>
      Promise.resolve(
        events.filter((event) =>
          eventOverlapsRange(
            event,
            { start: new Date(params?.from ?? 0), end: new Date(params?.to ?? 0) },
            params?.tz ?? 'UTC',
          ),
        ),
      ),
    );
    fake.events.create.mockImplementation((input) => {
      const event = {
        ...input,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
        deletedAt: null,
      } as AgendaEvent;
      events = [...events, event];
      return Promise.resolve(event);
    });
    fake.events.update.mockImplementation((id, patch) => {
      const old = events.find((event) => event.id === id);
      if (old === undefined)
        return Promise.reject(new ApiError(404, 'not_found', 'Event not found'));
      const event = { ...old, ...patch };
      events = events.map((other) => (other.id === id ? event : other));
      return Promise.resolve(event);
    });
  };
}

const dialog = (name: string) => screen.findByRole('dialog', { name });
const field = (scope: HTMLElement, name: string) =>
  within(scope).getByLabelText<HTMLInputElement>(name);

async function openEditorFor(title: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: new RegExp(`^${title}`) }));
  await user.click(within(await dialog(title)).getByRole('button', { name: 'Edit' }));
  return { user, editor: await dialog('Edit event') };
}

async function newEvent() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'New event' }));
  return { user, editor: await dialog('New event') };
}

describe('editing an event', () => {
  it('fills every field from the event', async () => {
    renderApp('/', { setup: withServer() });
    const { editor } = await openEditorFor('Review');
    expect(field(editor, 'Title').value).toBe('Review');
    expect(field(editor, 'All day').checked).toBe(false);
    expect(field(editor, 'Start date').value).toBe('27 Oct 2026');
    expect(field(editor, 'Start time').value).toBe('16:00');
    expect(field(editor, 'End date').value).toBe('27 Oct 2026');
    expect(field(editor, 'End time').value).toBe('17:00');
    expect(within(editor).getByRole('radio', { name: 'Red' })).toHaveProperty('checked', true);
    expect(within(editor).getByRole('checkbox', { name: '10 min before' })).toHaveProperty(
      'checked',
      true,
    );
    expect(within(editor).getByRole('checkbox', { name: '1 hour before' })).toHaveProperty(
      'checked',
      false,
    );
    expect(field(editor, 'Location').value).toBe('Room 4');
    expect(field(editor, 'Notes').value).toBe('Bring the slides');
    await expectNoAxeViolations();
  });

  it('saves the changes optimistically', async () => {
    const app = renderApp('/', { setup: withServer() });
    const { user, editor } = await openEditorFor('Review');
    app.events.update.mockImplementation(() => new Promise(() => undefined));
    await user.clear(field(editor, 'Title'));
    await user.type(field(editor, 'Title'), 'Design review');
    fireEvent.change(field(editor, 'End time'), { target: { value: '17:30' } });
    await user.click(within(editor).getByRole('radio', { name: 'Teal' }));
    await user.click(within(editor).getByRole('checkbox', { name: '1 day before' }));
    await user.type(field(editor, 'Location'), ' (2nd floor)');
    await user.type(field(editor, 'Notes'), ' and the demo');
    await user.click(within(editor).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(
      await screen.findByRole('button', { name: /^Design review16:00 – 17:30/ }),
    ).toBeDefined();
    expect(app.events.update).toHaveBeenCalledWith(REVIEW.id, {
      title: 'Design review',
      notes: 'Bring the slides and the demo',
      start: '2026-10-27T11:00:00.000Z',
      end: '2026-10-27T12:30:00.000Z',
      allDay: false,
      timezone: 'Asia/Karachi',
      location: 'Room 4 (2nd floor)',
      color: 'teal',
      reminders: [10, 1440],
      rrule: null,
    });
  });

  it('moves an edited event off a day it no longer touches', async () => {
    renderApp('/', { setup: withServer() });
    const { user, editor } = await openEditorFor('Review');
    await user.clear(field(editor, 'Start date'));
    await user.type(field(editor, 'Start date'), '28 Oct 2026');
    await user.clear(field(editor, 'End date'));
    await user.type(field(editor, 'End date'), '28 Oct 2026{Enter}');
    await user.click(within(editor).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Nothing today. Enjoy the space.')).toBeDefined();
  });

  it('rolls back and offers the form again when the API says no', async () => {
    const app = renderApp('/', { setup: withServer() });
    const { user, editor } = await openEditorFor('Review');
    app.events.update.mockRejectedValue(new ApiError(500, 'internal', 'Boom'));
    await user.clear(field(editor, 'Title'));
    await user.type(field(editor, 'Title'), 'Renamed');
    await user.click(within(editor).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Couldn\'t save "Renamed". Try again.')).toBeDefined();
    expect(await screen.findByRole('button', { name: /^Review/ })).toBeDefined();
    await user.click(await findToastAction('Edit'));
    const again = await dialog('Edit event');
    expect(field(again, 'Title').value).toBe('Renamed');
  });
});

describe('editing from search', () => {
  it('updates the result in place', async () => {
    renderApp('/search?q=review', {
      setup: (fake) => {
        withServer()(fake);
        fake.events.list.mockResolvedValue({ events: [REVIEW], nextCursor: null });
        fake.events.update.mockImplementation(() => new Promise(() => undefined));
      },
    });
    const { user, editor } = await openEditorFor('Review');
    await user.type(field(editor, 'Title'), ' notes');
    await user.click(within(editor).getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: /^Review notes/ })).toBeDefined();
  });
});

describe('creating an event', () => {
  it('starts at the next whole hour today, title focused, and creates it', async () => {
    const app = renderApp('/', { setup: withServer([]) });
    const { user, editor } = await newEvent();
    await waitFor(() => {
      expect(document.activeElement).toBe(field(editor, 'Title'));
    });
    expect(field(editor, 'Start time').value).toBe('14:00');
    expect(field(editor, 'End time').value).toBe('15:00');
    await user.type(field(editor, 'Title'), 'Call the bank');
    await user.click(within(editor).getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByRole('button', { name: /^Call the bank14:00 – 15:00/ }),
    ).toBeDefined();
    expect(app.events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown,
        title: 'Call the bank',
        start: '2026-10-27T09:00:00.000Z',
        end: '2026-10-27T10:00:00.000Z',
        timezone: 'Asia/Karachi',
        color: 'blue',
        reminders: [],
        location: null,
      }),
    );
  });

  it('creates multi-day all-day events, with the times hidden', async () => {
    const app = renderApp('/day/2026-10-28', { setup: withServer([]) });
    const { user, editor } = await newEvent();
    expect(field(editor, 'Start time').value).toBe('09:00');
    await user.type(field(editor, 'Title'), 'Conference');
    await user.click(field(editor, 'All day'));
    expect(within(editor).queryByLabelText('Start time')).toBeNull();
    await user.clear(field(editor, 'End date'));
    await user.type(field(editor, 'End date'), '30 Oct{Enter}');
    await user.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() => {
      expect(app.events.create).toHaveBeenCalledWith(
        expect.objectContaining({ allDay: true, start: '2026-10-28', end: '2026-10-31' }),
      );
    });
  });

  it('says why a create failed and keeps what was typed', async () => {
    const app = renderApp('/', { setup: withServer([]) });
    app.events.create.mockRejectedValue(new NetworkError('network', 'offline'));
    const { user, editor } = await newEvent();
    await user.type(field(editor, 'Title'), 'Gym');
    await user.keyboard('{Meta>}{Enter}{/Meta}');
    expect(
      await screen.findByText('Couldn\'t reach the server, so we couldn\'t add "Gym". Try again.'),
    ).toBeDefined();
    await user.click(await findToastAction('Edit'));
    expect(field(await dialog('New event'), 'Title').value).toBe('Gym');
  });

  it('closes without saving on Cancel and on Esc', async () => {
    const app = renderApp('/', { setup: withServer([]) });
    const { user, editor } = await newEvent();
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await newEvent();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(app.events.create).not.toHaveBeenCalled();
  });
});

describe('editor validation', () => {
  it('shows friendly errors on Save, focuses the first, and clears them as fields are fixed', async () => {
    const app = renderApp('/', { setup: withServer([]) });
    const { user, editor } = await newEvent();
    fireEvent.change(field(editor, 'End time'), { target: { value: '13:00' } });
    await user.click(within(editor).getByRole('button', { name: 'Save' }));

    expect(within(editor).getByText('Add a title')).toBeDefined();
    expect(within(editor).getByText('End must be after start')).toBeDefined();
    expect(field(editor, 'Title').getAttribute('aria-invalid')).toBe('true');
    expect(field(editor, 'End time').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field(editor, 'Title'));
    expect(app.events.create).not.toHaveBeenCalled();

    await user.type(field(editor, 'Title'), 'Dentist');
    expect(within(editor).queryByText('Add a title')).toBeNull();
    fireEvent.change(field(editor, 'End time'), { target: { value: '15:00' } });
    expect(within(editor).queryByText('End must be after start')).toBeNull();
  });

  it.each([
    ['Start date', 'someday', 'Enter a date, like 27 Oct 2026'],
    ['End date', 'never', 'Enter a date, like 27 Oct 2026'],
  ])('flags an unreadable %s', async (label, text, message) => {
    renderApp('/', { setup: withServer([]) });
    const { user, editor } = await newEvent();
    await user.type(field(editor, 'Title'), 'Dentist');
    await user.clear(field(editor, label));
    await user.type(field(editor, label), `${text}{Enter}`);
    await user.click(within(editor).getByRole('button', { name: 'Save' }));
    expect(within(editor).getByText(message)).toBeDefined();
    expect(document.activeElement).toBe(field(editor, label));
  });

  it('flags a missing time and an all-day end before the start', async () => {
    renderApp('/', { setup: withServer([]) });
    const { user, editor } = await newEvent();
    await user.type(field(editor, 'Title'), 'Dentist');
    fireEvent.change(field(editor, 'Start time'), { target: { value: '' } });
    await user.click(within(editor).getByRole('button', { name: 'Save' }));
    expect(within(editor).getByText('Enter a time, like 14:30')).toBeDefined();

    await user.click(field(editor, 'All day'));
    await user.clear(field(editor, 'End date'));
    await user.type(field(editor, 'End date'), '20 Oct 2026{Enter}');
    await user.click(within(editor).getByRole('button', { name: 'Save' }));
    expect(within(editor).getByText("End date can't be before the start date")).toBeDefined();
  });

  it('lists reminders as a multi-select, with a note when there are none', async () => {
    renderApp('/', { setup: withServer([]) });
    const { user, editor } = await newEvent();
    const group = within(editor).getByRole('group', { name: 'Reminders' });
    expect(
      within(group)
        .getAllByRole('checkbox')
        .map((box) => box.getAttribute('name') ?? box.closest('label')?.textContent),
    ).toEqual(['5 min before', '10 min before', '30 min before', '1 hour before', '1 day before']);
    expect(within(group).getByText('No reminders.')).toBeDefined();
    await user.click(within(group).getByRole('checkbox', { name: '5 min before' }));
    expect(within(group).getByText('You can pick more than one.')).toBeDefined();
    await user.click(within(group).getByRole('checkbox', { name: '5 min before' }));
    expect(within(group).getByText('No reminders.')).toBeDefined();
    expect(within(editor).getByRole('group', { name: 'Color' })).toBeDefined();
    expect(
      within(editor)
        .getAllByRole('radio')
        .map((radio) => radio.closest('label')?.textContent),
    ).toEqual(['Slate', 'Blue', 'Green', 'Amber', 'Red', 'Violet', 'Pink', 'Teal']);
    await expectNoAxeViolations();
  });
});

describe('opening the editor from the views', () => {
  it('opens at the clicked time in Week', async () => {
    const { container } = renderApp('/week', { setup: withServer([]) });
    await screen.findByRole('heading', { level: 1, name: /Oct/ });
    const thursday = container.querySelector<HTMLElement>(
      '.ag-timegrid__column[data-day="2026-10-29"]',
    );
    if (thursday === null) throw new Error('No Thursday column');
    vi.spyOn(thursday, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      height: 1152,
    } as DOMRect);
    // 15:30 is 15.5 / 24 of the way down.
    fireEvent.click(thursday, { clientY: (1152 * 15.5) / 24 + 5 });
    const editor = await dialog('New event');
    expect(field(editor, 'Start date').value).toBe('29 Oct 2026');
    expect(field(editor, 'Start time').value).toBe('15:30');
    expect(field(editor, 'End time').value).toBe('16:30');
  });

  it('starts at 09:00 on the first day of another week or month', async () => {
    renderApp('/week/2026-11-04', { setup: withServer([]) });
    const week = await newEvent();
    expect(field(week.editor, 'Start date').value).toBe('2 Nov 2026');
    expect(field(week.editor, 'Start time').value).toBe('09:00');
    await week.user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('starts at the next hour in this month', async () => {
    renderApp('/month', { setup: withServer([]) });
    const { editor } = await newEvent();
    expect(field(editor, 'Start date').value).toBe('27 Oct 2026');
    expect(field(editor, 'Start time').value).toBe('14:00');
  });
});
