import { usesTwelveHour } from '@agenda/core';
import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { applyTheme } from '../theme';
import { EnvContext, useEnv } from './env';
import { useSettings } from './settings';

/**
 * Applies the user's settings inside the signed-in app: the theme on the page, and the
 * week start and clock in AppEnv, so every view, grid and form reading useEnv() follows
 * them.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const env = useEnv();
  const settings = useSettings();

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  const value = useMemo(
    () => ({
      ...env,
      weekStart: settings.weekStart,
      hour12: usesTwelveHour(settings.timeFormat, env.locale.code),
    }),
    [env, settings.weekStart, settings.timeFormat],
  );
  return <EnvContext.Provider value={value}>{children}</EnvContext.Provider>;
}
