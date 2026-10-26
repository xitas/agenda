import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from './Button.js';
import { ToastProvider } from './Toast.js';
import { useToast } from './useToast.js';
import type { ToastOptions } from './useToast.js';
import { expectNoAxeViolations } from './test-utils/axe.js';

function DeleteButton({ options }: { options: ToastOptions }) {
  const { toast } = useToast();
  return (
    <Button
      onClick={() => {
        toast(options);
      }}
    >
      Delete
    </Button>
  );
}

function setup(options: ToastOptions, duration?: number) {
  const user = userEvent.setup();
  render(
    <ToastProvider {...(duration === undefined ? {} : { duration })}>
      <DeleteButton options={options} />
    </ToastProvider>,
  );
  return { user, trigger: screen.getByRole('button', { name: 'Delete' }) };
}

afterEach(() => {
  // Never let one test's fake timers leak into the next, even if it fails or times out.
  vi.useRealTimers();
});

describe('Toast', () => {
  it('shows the message in a live region', async () => {
    const { user, trigger } = setup({ message: 'Event deleted.' });
    await user.click(trigger);
    expect(screen.getByText('Event deleted.')).toBeDefined();
    expect(screen.getByRole('region', { name: /Notifications/ })).toBeDefined();
  });

  it('runs Undo and then hides the toast', async () => {
    const onAction = vi.fn();
    const { user, trigger } = setup({
      message: 'Event deleted.',
      action: { label: 'Undo', onAction, altText: 'Undo with Ctrl+Z' },
    });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onAction).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.queryByText('Event deleted.')).toBeNull();
    });
  });

  it('can be dismissed', async () => {
    const { user, trigger } = setup({ message: 'Saved.' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => {
      expect(screen.queryByText('Saved.')).toBeNull();
    });
  });

  it('hides by itself after its duration, not before', async () => {
    // Fake timers: the test decides when time passes, so a slow (busy CI) machine can't
    // make the toast disappear before it is checked. fireEvent is synchronous, unlike
    // user-event, whose own small delays would wait on the frozen clock.
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <DeleteButton options={{ message: 'Quick one.', duration: 3000 }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Quick one.')).toBeDefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2900);
    });
    expect(screen.getByText('Quick one.')).toBeDefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(screen.queryByText('Quick one.')).toBeNull();
  });

  it('uses the provider default duration and stacks several toasts', async () => {
    const { user, trigger } = setup({ message: 'Again.' }, 60_000);
    await user.click(trigger);
    await user.click(trigger);
    expect(screen.getAllByText('Again.')).toHaveLength(2);
  });

  it('needs a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<DeleteButton options={{ message: 'x' }} />)).toThrow(
      'useToast must be used inside <ToastProvider>',
    );
  });

  it('has no axe violations while a toast is shown', async () => {
    const { user, trigger } = setup({
      message: 'Event deleted.',
      action: { label: 'Undo', onAction: () => undefined },
    });
    await user.click(trigger);
    await expectNoAxeViolations(document.body);
  });
});
