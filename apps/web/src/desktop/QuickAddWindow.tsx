import { isUnreachable } from '@agenda/core';
import type { DesktopBridge } from '@agenda/core';
import { Button } from '@agenda/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router';
import { usePlatform } from '../app/platform';
import { PreferencesProvider } from '../app/PreferencesProvider';
import { serverLabel, unreachableMessage } from '../auth/server';
import { isUnauthorized, useSession } from '../auth/session';
import { QuickAdd } from '../quick-add/QuickAdd';

/**
 * "/quick-add": the page in the desktop app's quick-add window, opened by the global
 * shortcut or the tray. Anywhere else it is just a way back to Today.
 */
export function QuickAddWindow() {
  const { desktop } = usePlatform();
  if (desktop?.window !== 'quick-add') return <Navigate to="/" replace />;
  return <QuickAddPopup desktop={desktop} />;
}

function QuickAddPopup({ desktop }: { desktop: DesktopBridge }) {
  const platform = usePlatform();
  const session = useSession();
  const queryClient = useQueryClient();
  const root = useRef<HTMLDivElement>(null);
  // Each opening starts a fresh field (a new key remounts QuickAdd, empty and focused).
  const [opened, setOpened] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(
    () =>
      desktop.onQuickAddOpen(() => {
        setOpened((count) => count + 1);
        setFailure(null);
        // The main window may have logged in or out, or changed the theme or clock,
        // since the last time: refresh the session and settings this window has cached.
        void queryClient.invalidateQueries();
      }),
    [desktop, queryClient],
  );

  // The window is as tall as what it shows: 72 px for the field, more with a preview.
  useEffect(() => {
    const element = root.current;
    if (element === null) return;
    const observer = new ResizeObserver(() => {
      void desktop.resizeQuickAdd(Math.ceil(element.getBoundingClientRect().height));
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [desktop]);

  // Esc closes the window whatever has focus (QuickAdd handles it in its own field).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void desktop.hideQuickAdd();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [desktop]);

  let content;
  if (session.isPending) {
    content = <p className="quick-add-window__note">Loading…</p>;
  } else if (session.isError) {
    content = (
      <div className="quick-add-window__note" role="alert">
        <p>
          {isUnauthorized(session.error)
            ? 'Log in to Agenda to add events from here.'
            : isUnreachable(session.error)
              ? unreachableMessage(serverLabel(platform))
              : 'Something went wrong. Try again.'}
        </p>
        <Button
          size="sm"
          onClick={() => {
            void desktop.showMain(isUnauthorized(session.error) ? '/login' : undefined);
          }}
        >
          Open Agenda
        </Button>
      </div>
    );
  } else {
    content = (
      <PreferencesProvider>
        <QuickAdd
          key={opened}
          popup={{
            onAdded: () => {
              void desktop.eventsChanged();
              void desktop.hideQuickAdd();
            },
            onCancel: () => {
              void desktop.hideQuickAdd();
            },
            onFailed: setFailure,
          }}
        />
        {failure !== null && (
          <p className="quick-add-window__error" role="alert">
            {failure}
          </p>
        )}
      </PreferencesProvider>
    );
  }

  return (
    <main ref={root} className="quick-add-window" aria-label="Quick add">
      {content}
    </main>
  );
}
