import { plainDateInTz } from '@agenda/core';
import { Dialog, IconButton } from '@agenda/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Keyboard } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useEnv } from '../app/env';
import { useEventActions } from '../events/actions';
import { findCachedEvent } from '../events/queries';
import { useShortcuts } from '../shortcuts';
import { dateOnScreen, viewPath } from '../views/paths';
import type { CalendarViewName } from '../views/paths';

/** DESIGN.md §5, as shown in the help dialog. */
const SHORTCUTS: [keys: string[][], action: string][] = [
  [[['N'], ['Ctrl', 'K']], 'Add an event with QuickAdd (⌘K on a Mac)'],
  [[['T']], 'Go to today'],
  [[['D'], ['W'], ['M']], 'Day, week or month view'],
  [[['←'], ['→']], 'Previous or next day, week or month'],
  [[['/']], 'Search'],
  [[['E']], 'Edit the focused event'],
  [[['Delete']], 'Delete the focused event (with Undo)'],
  [[['Ctrl', 'Enter']], 'Save in the editor (⌘Enter on a Mac)'],
  [[['Esc']], 'Close a dialog or clear QuickAdd'],
  [[['?']], 'Show these shortcuts'],
];

/** The event whose card (or block) has keyboard focus, if any. */
function focusedEventId(): string | null {
  const active = document.activeElement;
  return active instanceof HTMLElement
    ? (active.closest<HTMLElement>('[data-event-id]')?.dataset.eventId ?? null)
    : null;
}

/**
 * The shortcuts that work on every screen (DESIGN.md §5), and the "?" help dialog. The
 * views add their own ←/→/T, and QuickAdd its N and Ctrl/Cmd+K.
 */
export function GlobalShortcuts() {
  const env = useEnv();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const actions = useEventActions();
  const [helpOpen, setHelpOpen] = useState(false);

  const switchTo = (view: CalendarViewName) => () => {
    const today = plainDateInTz(env.now(), env.timezone);
    void navigate(viewPath(view, dateOnScreen(pathname, today), today));
  };
  const onFocusedEvent = (act: (id: string) => void) => () => {
    const id = focusedEventId();
    if (id !== null) act(id);
  };

  useShortcuts({
    d: switchTo('day'),
    w: switchTo('week'),
    m: switchTo('month'),
    '/': () => {
      void navigate('/search');
    },
    e: onFocusedEvent((id) => {
      const event = findCachedEvent(queryClient, id);
      if (event !== undefined) actions.edit(event);
    }),
    Delete: onFocusedEvent((id) => {
      const event = findCachedEvent(queryClient, id);
      if (event !== undefined) actions.remove(event);
    }),
    '?': () => {
      setHelpOpen(true);
    },
  });

  return (
    <Dialog
      open={helpOpen}
      onOpenChange={setHelpOpen}
      title="Keyboard shortcuts"
      trigger={
        <IconButton label="Keyboard shortcuts" icon={<Keyboard />} className="shell__help" />
      }
    >
      <dl className="shortcuts">
        {SHORTCUTS.map(([keys, action]) => (
          <div key={action} className="shortcuts__row">
            <dt>
              {keys.map((combo, i) => (
                <span key={combo.join('+')}>
                  {i > 0 && <span className="shortcuts__or"> or </span>}
                  {combo.map((key, j) => (
                    <span key={key}>
                      {j > 0 && '+'}
                      <kbd>{key}</kbd>
                    </span>
                  ))}
                </span>
              ))}
            </dt>
            <dd>{action}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
