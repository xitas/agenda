import { ApiError, NetworkError } from '@agenda/core';
import type { AgendaEvent } from '@agenda/core';
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../test-utils/axe';
import { makeEvent } from '../test-utils/events';
import type { FakeApi } from '../test-utils/fakeApi';
import { renderApp } from '../test-utils/renderApp';
import { findToastAction } from '../test-utils/toast';
import { failure } from './mutations';

const review = makeEvent({
  title: 'Review',
  start: '2026-10-27T11:00:00.000Z',
  end: '2026-10-27T12:00:00.000Z',
  location: 'Room 4',
  notes: 'Bring the slides',
  color: 'violet',
});
const standup = makeEvent({ title: 'Standup', start: '2026-10-27T05:00:00.000Z' });

/** A server that really deletes and restores, so refetches show the true state. */
function withServer(fake: FakeApi) {
  let saved: AgendaEvent[] = [review, standup];
  const deleted = new Map<string, AgendaEvent>();
  fake.events.listAll.mockImplementation(() => Promise.resolve(saved));
  fake.events.remove.mockImplementation((id) => {
    const event = saved.find((other) => other.id === id);
    if (event) deleted.set(id, event);
    saved = saved.filter((other) => other.id !== id);
    return Promise.resolve();
  });
  fake.events.restore.mockImplementation((id) => {
    const event = deleted.get(id);
    if (!event) return Promise.reject(new ApiError(404, 'not_found', 'Deleted event not found'));
    deleted.delete(id);
    saved = [...saved, event];
    return Promise.resolve(event);
  });
}

const titles = async () => {
  const list = await screen.findByRole('list', { name: /^Events,/ });
  return within(list)
    .queryAllByRole('button')
    .map((button) => button.textContent);
};

async function openReview() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /^Review/ }));
  const dialog = await screen.findByRole('dialog', { name: 'Review' });
  return { user, dialog };
}

describe('event details', () => {
  it('shows the event read-only', async () => {
    renderApp('/', { setup: withServer });
    const { user, dialog } = await openReview();
    expect(within(dialog).getByText('Tue 27 Oct · 16:00 – 17:00')).toBeDefined();
    expect(within(dialog).getByText('Violet')).toBeDefined();
    expect(within(dialog).getByText('Room 4')).toBeDefined();
    expect(within(dialog).getByText('Bring the slides')).toBeDefined();
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    await expectNoAxeViolations();

    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('leaves out empty fields', async () => {
    renderApp('/', { setup: withServer });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^Standup/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Standup' });
    expect(within(dialog).queryByText('Location')).toBeNull();
    expect(within(dialog).queryByText('Notes')).toBeNull();
  });
});

describe('delete with Undo', () => {
  it('removes the event at once and brings it back with Undo', async () => {
    const app = renderApp('/', { setup: withServer });
    const { user, dialog } = await openReview();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await titles()).not.toContainEqual(expect.stringContaining('Review'));
    expect(await screen.findByText('Event deleted.')).toBeDefined();
    expect(app.events.remove).toHaveBeenCalledWith(review.id);

    await user.click(await findToastAction('Undo'));
    await waitFor(async () => {
      expect(await titles()).toContainEqual(expect.stringContaining('Review'));
    });
    expect(app.events.restore).toHaveBeenCalledWith(review.id);
  });

  it('puts the event back and explains when the delete fails', async () => {
    const app = renderApp('/', { setup: withServer });
    app.events.remove.mockRejectedValue(new ApiError(500, 'internal', 'Boom'));
    const { user, dialog } = await openReview();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Couldn\'t delete "Review". Try again.')).toBeDefined();
    expect(await titles()).toContainEqual(expect.stringContaining('Review'));
  });

  it('explains when Undo fails, and the event stays deleted', async () => {
    const app = renderApp('/', { setup: withServer });
    app.events.restore.mockRejectedValue(new NetworkError('network', 'offline'));
    const { user, dialog } = await openReview();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await user.click(await findToastAction('Undo'));

    expect(
      await screen.findByText(
        'Couldn\'t reach the server, so we couldn\'t restore "Review". Try again.',
      ),
    ).toBeDefined();
    await waitFor(async () => {
      expect(await titles()).toEqual([expect.stringContaining('Standup')]);
    });
  });
});

describe('failure', () => {
  it('names the action, and the network when that was the problem', () => {
    expect(failure(new ApiError(500, 'internal', 'x'), 'delete "A"')).toBe(
      'Couldn\'t delete "A". Try again.',
    );
    expect(failure(new NetworkError('timeout', 'x'), 'delete "A"')).toBe(
      'Couldn\'t reach the server, so we couldn\'t delete "A". Try again.',
    );
  });
});
