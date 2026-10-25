import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Plus, Trash2 } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button.js';
import { IconButton } from './IconButton.js';
import { expectNoAxeViolations } from './test-utils/axe.js';

describe('Button', () => {
  it.each(['primary', 'secondary', 'ghost', 'danger'] as const)(
    'renders the %s variant',
    (variant) => {
      render(<Button variant={variant}>Save</Button>);
      const button = screen.getByRole('button', { name: 'Save' });
      expect(button.className).toContain(`ag-button--${variant}`);
      expect(button).toHaveProperty('type', 'button');
    },
  );

  it('defaults to primary, md and type=button, and accepts sm', () => {
    const { rerender } = render(<Button>Save</Button>);
    expect(screen.getByRole('button').className).toBe('ag-button ag-button--primary ag-button--md');
    rerender(
      <Button size="sm" type="submit" className="extra">
        Save
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button.className).toBe('ag-button ag-button--primary ag-button--sm extra');
    expect(button).toHaveProperty('type', 'submit');
  });

  it('is clicked with the mouse, Enter and Space', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await user.click(screen.getByRole('button'));
    await user.tab();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole('button'));
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('does nothing when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveProperty('disabled', true);
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('while loading: shows busy, ignores clicks, keeps focus', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button');
    button.focus();

    rerender(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button).toHaveProperty('disabled', false); // still focusable
    expect(document.activeElement).toBe(button);
    expect(screen.getByRole('button', { name: 'Save (loading)' })).toBe(button);
    expect(button.querySelector('.ag-button__spinner')).not.toBeNull();

    await user.click(button);
    await user.keyboard('{Enter}');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows an icon before the label', () => {
    render(<Button icon={<Plus aria-hidden="true" />}>Add event</Button>);
    expect(screen.getByRole('button', { name: 'Add event' }).querySelector('svg')).not.toBeNull();
  });

  it('has no axe violations in any state', async () => {
    const { container } = render(
      <div>
        <Button>Save</Button>
        <Button variant="secondary" disabled>
          Cancel
        </Button>
        <Button variant="danger" loading>
          Delete
        </Button>
      </div>,
    );
    await expectNoAxeViolations(container);
  });
});

describe('IconButton', () => {
  it('uses the required label as its accessible name and tooltip', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<IconButton label="Delete event" icon={<Trash2 />} onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Delete event' });
    expect(button.getAttribute('title')).toBe('Delete event');
    expect(button.className).toBe('ag-icon-button ag-button--ghost ag-icon-button--md');
    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('supports variants and the small size', () => {
    render(<IconButton label="Add" icon={<Plus />} variant="primary" size="sm" className="x" />);
    expect(screen.getByRole('button', { name: 'Add' }).className).toBe(
      'ag-icon-button ag-button--primary ag-icon-button--sm x',
    );
  });

  it('has no axe violations', async () => {
    const { container } = render(<IconButton label="Close" icon={<Plus />} />);
    await expectNoAxeViolations(container);
  });
});
