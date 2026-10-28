import type { Locale } from '@agenda/core';
import { enGB, enUS } from 'date-fns/locale';
import { createContext, useContext } from 'react';

/** Where and when the app runs: injected so tests can fix the clock, zone and locale. */
export interface AppEnv {
  /** The viewer's IANA zone; every day boundary is computed in it. */
  timezone: string;
  /** date-fns locale for times and dates (12- or 24-hour, day or month first). */
  locale: Locale;
  now: () => Date;
}

/** en-US gets US formats; every other language gets en-GB until real translations exist. */
export function pickLocale(language: string | undefined): Locale {
  return language === 'en-US' ? enUS : enGB;
}

export function browserEnv(): AppEnv {
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: pickLocale(navigator.language),
    now: () => new Date(),
  };
}

export const EnvContext = createContext<AppEnv | null>(null);

export function useEnv(): AppEnv {
  const env = useContext(EnvContext);
  if (env === null) throw new Error('useEnv must be used inside <EnvProvider>');
  return env;
}
