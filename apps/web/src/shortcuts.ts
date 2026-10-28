import { useEffect, useRef } from 'react';

/** Single-key shortcuts must not fire while the user is typing or a dialog is open. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.closest('input, textarea, select, [role="dialog"]') !== null;
}

export type ShortcutHandlers = Partial<Record<string, (event: KeyboardEvent) => void>>;

/**
 * Global keyboard shortcuts (DESIGN.md §5). Plain keys ("n", "t", "ArrowLeft") are
 * ignored while typing and with modifiers held; "mod+k" means Ctrl+K or Cmd+K and works
 * everywhere.
 */
export function useShortcuts(handlers: ShortcutHandlers): void {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      const map = latest.current;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        const handler = map['mod+k'];
        if (handler) {
          event.preventDefault();
          handler(event);
        }
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
      const handler = map[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (handler) {
        event.preventDefault();
        handler(event);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}
