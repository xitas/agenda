import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { isTypingTarget, useShortcuts } from './shortcuts';
import type { ShortcutHandlers } from './shortcuts';

function Shortcuts({ handlers }: { handlers: ShortcutHandlers }) {
  useShortcuts(handlers);
  return (
    <div>
      <input aria-label="Field" />
      <div role="dialog" aria-label="Dialog">
        <button type="button">Inside</button>
      </div>
    </div>
  );
}

function setup() {
  const handlers = { n: vi.fn(), ArrowLeft: vi.fn(), 'mod+k': vi.fn() };
  const view = render(<Shortcuts handlers={handlers} />);
  return { ...view, handlers };
}

describe('useShortcuts', () => {
  it('runs plain keys case-insensitively and named keys as they are', () => {
    const { handlers } = setup();
    fireEvent.keyDown(window, { key: 'N' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'x' });
    expect(handlers.n).toHaveBeenCalledOnce();
    expect(handlers.ArrowLeft).toHaveBeenCalledOnce();
  });

  it('ignores plain keys while typing, in a dialog, with modifiers or repeated', () => {
    const { handlers, getByLabelText, getByText } = setup();
    fireEvent.keyDown(getByLabelText('Field'), { key: 'n' });
    fireEvent.keyDown(getByText('Inside'), { key: 'n' });
    fireEvent.keyDown(window, { key: 'n', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'n', altKey: true });
    fireEvent.keyDown(window, { key: 'n', repeat: true });
    expect(handlers.n).not.toHaveBeenCalled();
  });

  it('runs mod+k with Ctrl or Cmd, even while typing, and prevents the default', () => {
    const { handlers, getByLabelText } = setup();
    expect(fireEvent.keyDown(getByLabelText('Field'), { key: 'k', ctrlKey: true })).toBe(false);
    fireEvent.keyDown(window, { key: 'K', metaKey: true });
    expect(handlers['mod+k']).toHaveBeenCalledTimes(2);
  });

  it('leaves Ctrl+K alone without a handler', () => {
    render(<Shortcuts handlers={{}} />);
    expect(fireEvent.keyDown(window, { key: 'k', ctrlKey: true })).toBe(true);
  });

  it('stops listening on unmount', () => {
    const { handlers, unmount } = setup();
    unmount();
    fireEvent.keyDown(window, { key: 'n' });
    expect(handlers.n).not.toHaveBeenCalled();
  });
});

describe('isTypingTarget', () => {
  it('knows fields and editable content', () => {
    const editable = document.createElement('div');
    // jsdom doesn't compute isContentEditable from the attribute.
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(window)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
