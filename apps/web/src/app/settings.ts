import { DEFAULT_SETTINGS, SettingsSchema } from '@agenda/core';
import type { Settings } from '@agenda/core';
import { useToast } from '@agenda/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applyTheme } from '../theme';
import { useApi } from './api';

export const SETTINGS_KEY = ['settings'] as const;

/** The last settings seen, so a reload can paint with them before the server answers. */
export const SETTINGS_STORAGE_KEY = 'agenda.settings';

export function readCachedSettings(
  storage: Pick<Storage, 'getItem'> | undefined = safeStorage(),
): Settings {
  try {
    const raw = storage?.getItem(SETTINGS_STORAGE_KEY);
    const parsed = SettingsSchema.safeParse(raw ? JSON.parse(raw) : null);
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function cacheSettings(
  settings: Settings,
  storage: Pick<Storage, 'setItem'> | undefined = safeStorage(),
): void {
  try {
    storage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Not cached; the next reload paints with the defaults until the server answers.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * The user's settings: the server's (shared by every device) once loaded, the local copy
 * before that.
 */
export function useSettings(): Settings {
  const api = useApi();
  const query = useQuery<Settings>({
    queryKey: SETTINGS_KEY,
    queryFn: async ({ signal }) => {
      const settings = await api.settings.get({ signal });
      cacheSettings(settings);
      return settings;
    },
    placeholderData: () => readCachedSettings(),
    staleTime: 5 * 60_000,
  });
  return query.data ?? DEFAULT_SETTINGS;
}

interface SettingsSave {
  settings: Settings;
  /** What to roll back to if the server says no. */
  previous: Settings;
}

/**
 * Saves settings optimistically: they apply at once (the theme too) and roll back with
 * a toast if the server says no. Returns `save`, which applies the change synchronously
 * (a controlled radio button must not flick back while the save starts), then sends it.
 */
export function useUpdateSettings(): { save: (settings: Settings) => Promise<void> } {
  const api = useApi();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const apply = (settings: Settings) => {
    queryClient.setQueryData(SETTINGS_KEY, settings);
    cacheSettings(settings);
    applyTheme(settings.theme);
  };
  const { mutateAsync } = useMutation({
    mutationFn: ({ settings }: SettingsSave) => api.settings.update(settings),
    onError: (_error, { previous }) => {
      apply(previous);
      toast({ message: "Couldn't save your settings. Check your connection and try again." });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
  return {
    save: (settings) => {
      // A load still in flight must not land on top of the change.
      void queryClient.cancelQueries({ queryKey: SETTINGS_KEY });
      const previous = queryClient.getQueryData<Settings>(SETTINGS_KEY) ?? DEFAULT_SETTINGS;
      apply(settings);
      // Resolves when the save has finished either way; a failure is handled above.
      return mutateAsync({ settings, previous }).then(
        () => undefined,
        () => undefined,
      );
    },
  };
}
