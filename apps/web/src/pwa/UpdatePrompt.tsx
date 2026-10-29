import { useToast } from '@agenda/ui';
import { useEffect, useRef } from 'react';

/** What virtual:pwa-register's registerSW looks like (passed in, so tests can fake it). */
export type RegisterServiceWorker = (options: {
  onNeedRefresh?: () => void;
}) => (reloadPage?: boolean) => Promise<void>;

/**
 * Registers the service worker and, when a new version has installed and is waiting,
 * shows "Update available." until the user picks Reload. Reload tells the waiting worker
 * to take over (SKIP_WAITING) and reloads the page onto it.
 */
export function UpdatePrompt({ register }: { register: RegisterServiceWorker }) {
  const { toast } = useToast();
  const registered = useRef(false);

  useEffect(() => {
    // Once per page, also under StrictMode's double effects.
    if (registered.current) return;
    registered.current = true;
    const update = register({
      onNeedRefresh: () => {
        toast({
          message: 'Update available.',
          // Stays until acted on: the new version only runs after a reload.
          duration: Number.POSITIVE_INFINITY,
          action: {
            label: 'Reload',
            altText: 'Reload the page to use the new version',
            onAction: () => {
              void update(true);
            },
          },
        });
      },
    });
  }, [register, toast]);

  return null;
}
