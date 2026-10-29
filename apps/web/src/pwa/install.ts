import { useSyncExternalStore } from 'react';

/** Chrome's install event (not in the DOM types yet). */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// The browser fires beforeinstallprompt once, early, so it is kept for whenever the
// Settings page asks.
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};

/** Starts listening (main.tsx, before the first render); returns a function to stop. */
export function listenForInstallPrompt(target: Window = window): () => void {
  const onPrompt = (event: Event) => {
    // Keep Chrome from showing its own mini-infobar; Settings offers the install instead.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  };
  const onInstalled = () => {
    deferred = null;
    notify();
  };
  target.addEventListener('beforeinstallprompt', onPrompt);
  target.addEventListener('appinstalled', onInstalled);
  return () => {
    target.removeEventListener('beforeinstallprompt', onPrompt);
    target.removeEventListener('appinstalled', onInstalled);
    deferred = null;
    notify();
  };
}

/** Shows the browser's install dialog; resolves to true if the user installed. */
async function install(): Promise<boolean> {
  const event = deferred;
  if (event === null) return false;
  // A prompt can only be used once.
  deferred = null;
  notify();
  await event.prompt();
  return (await event.userChoice).outcome === 'accepted';
}

/** Whether the browser offers to install Agenda now, and the function that asks. */
export function useInstallPrompt(): { canInstall: boolean; install: () => Promise<boolean> } {
  const canInstall = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => deferred !== null,
  );
  return { canInstall, install };
}
