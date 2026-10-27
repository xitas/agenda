import { ToastProvider } from '@agenda/ui';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import axe from 'axe-core';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routes } from './router';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
}

describe('/playground', () => {
  it('shows every component section', () => {
    renderAt('/playground');
    expect(screen.getByRole('heading', { level: 1, name: 'UI playground' })).toBeDefined();
    for (const section of ['Buttons', 'Inputs', 'Dialog and toast', 'Event cards', 'Empty state']) {
      expect(screen.getByRole('region', { name: section })).toBeDefined();
    }
    const cards = within(screen.getByRole('region', { name: 'Event cards' }));
    for (const color of ['Slate', 'Blue', 'Green', 'Amber', 'Red', 'Violet', 'Pink', 'Teal']) {
      expect(cards.getAllByText(`Category: ${color}`).length).toBeGreaterThan(0);
    }
    expect(cards.getAllByText('All day').length).toBeGreaterThan(0);
  });

  it('opens the dialog and shows the Undo toast', async () => {
    const user = userEvent.setup();
    renderAt('/playground');
    await user.click(screen.getByRole('button', { name: 'Open the event editor' }));
    expect(screen.getByRole('dialog', { name: 'Edit event' })).toBeDefined();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Delete with Undo' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Event restored.')).toBeDefined();
  });

  it('has no axe violations (contrast is tested on the tokens)', async () => {
    renderAt('/playground');
    const results = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

describe('ThemeSwitcher', () => {
  it('sets data-theme and remembers the choice; System removes it', async () => {
    const user = userEvent.setup();
    renderAt('/playground');
    const group = screen.getByRole('group', { name: 'Theme' });
    const radio = (name: string) => within(group).getByRole('radio', { name });

    expect(radio('System')).toHaveProperty('checked', true);
    await user.click(radio('Dark'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('agenda.theme')).toBe('dark');

    // Arrow keys move between native radios.
    await user.keyboard('{ArrowRight}');
    expect(radio('System')).toHaveProperty('checked', true);
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem('agenda.theme')).toBeNull();

    await user.click(radio('Light'));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('starts from the saved choice', () => {
    localStorage.setItem('agenda.theme', 'light');
    renderAt('/playground');
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveProperty('checked', true);
  });
});
