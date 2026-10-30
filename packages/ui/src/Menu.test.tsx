import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Settings } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from './IconButton.js';
import { Menu } from './Menu.js';
import { expectNoAxeViolations } from './test-utils/axe.js';

function setup() {
  const onSettings = vi.fn();
  const onLogout = vi.fn();
  render(
    <Menu
      trigger={<IconButton label="Account" icon={<Settings />} />}
      items={[
        { label: 'Settings', icon: <Settings />, onSelect: onSettings },
        { label: 'Log out', onSelect: onLogout },
      ]}
    />,
  );
  return {
    onSettings,
    onLogout,
    user: userEvent.setup(),
    trigger: screen.getByRole('button', { name: 'Account' }),
  };
}

describe('Menu', () => {
  it('is a menu button that opens a labelled menu', async () => {
    const { user, trigger, onSettings } = setup();
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    await user.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(['Settings', 'Log out']);
    await user.click(screen.getByRole('menuitem', { name: 'Settings' }));
    expect(onSettings).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });

  it('works from the keyboard and returns focus on Esc', async () => {
    const { user, trigger, onLogout } = setup();
    trigger.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('menu');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onLogout).toHaveBeenCalledOnce();

    await user.keyboard('{Enter}');
    await screen.findByRole('menu');
    await expectNoAxeViolations(document.body);
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });
});
