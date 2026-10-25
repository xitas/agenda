import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button.js';
import { Dialog, DialogClose } from './Dialog.js';
import { Input } from './Field.js';
import { expectNoAxeViolations } from './test-utils/axe.js';

function EditorDialog({ onSave = () => undefined }: { onSave?: () => void }) {
  return (
    <>
      <Button variant="secondary">Before</Button>
      <Dialog
        trigger={<Button>Edit event</Button>}
        title="Edit event"
        description="Change the title or time."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button onClick={onSave}>Save</Button>
          </>
        }
      >
        <Input label="Title" defaultValue="Dentist" />
      </Dialog>
      <Button variant="secondary">After</Button>
    </>
  );
}

const focused = () => document.activeElement as HTMLElement | null;

describe('Dialog', () => {
  it('opens from its trigger as a labelled, described modal dialog', async () => {
    const user = userEvent.setup();
    render(<EditorDialog />);
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Edit event' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit event' });
    expect(dialog.getAttribute('aria-describedby')).toBe(
      screen.getByText('Change the title or time.').id,
    );
    // Focus moves into the dialog.
    expect(dialog.contains(focused())).toBe(true);
  });

  it('traps Tab and Shift+Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(<EditorDialog />);
    await user.click(screen.getByRole('button', { name: 'Edit event' }));
    const dialog = screen.getByRole('dialog');

    const order: string[] = [];
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(dialog.contains(focused())).toBe(true);
      order.push(focused()?.getAttribute('aria-label') ?? focused()?.textContent ?? '');
    }
    // Close, Title, Cancel, Save and around again: never "Before" or "After".
    expect(order).toContain('Cancel');
    expect(order).toContain('Save');
    expect(order).not.toContain('Before');
    expect(order).not.toContain('After');

    for (let i = 0; i < 6; i++) {
      await user.tab({ shift: true });
      expect(dialog.contains(focused())).toBe(true);
    }
  });

  it('closes on Esc and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<EditorDialog />);
    const trigger = screen.getByRole('button', { name: 'Edit event' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(focused()).toBe(trigger);
  });

  it('closes from the close button and from a DialogClose footer button', async () => {
    const user = userEvent.setup();
    render(<EditorDialog />);
    await user.click(screen.getByRole('button', { name: 'Edit event' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Edit event' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hides the rest of the page from assistive technology while open', async () => {
    const user = userEvent.setup();
    render(<EditorDialog />);
    await user.click(screen.getByRole('button', { name: 'Edit event' }));
    // Radix marks everything outside the dialog aria-hidden.
    expect(screen.queryByRole('button', { name: 'Before' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Before', hidden: true })).toBeDefined();
  });

  it('can be controlled and works without a description, body or footer', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    function Controlled() {
      const [open, setOpen] = useState(true);
      return (
        <Dialog
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            setOpen(next);
          }}
          title="Delete event?"
          closeLabel="Dismiss"
        />
      );
    }
    render(<Controlled />);
    const dialog = screen.getByRole('dialog', { name: 'Delete event?' });
    expect(dialog.getAttribute('aria-describedby')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('has no axe violations while open', async () => {
    const user = userEvent.setup();
    render(<EditorDialog />);
    await user.click(screen.getByRole('button', { name: 'Edit event' }));
    await expectNoAxeViolations(document.body);
  });
});
