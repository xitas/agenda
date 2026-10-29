import { usesTwelveHour } from '@agenda/core';
import type { Locale, WeekStart } from '@agenda/core';
import { enGB, enUS } from 'date-fns/locale';
import { createContext, useContext } from 'react';

/** Where and when the app runs: injected so tests can fix the clock, zone and locale. */
export interface AppEnv {
  /** The viewer's IANA zone; every day boundary is computed in it. */
  timezone: string;
  /** date-fns locale for times and dates (12- or 24-hour, day or month first). */
  locale: Locale;
  now: () => Date;
  /** The first day of the week (a setting). */
  weekStart: WeekStart;
  /** Times on a 12-hour clock (a setting; "auto" follows the locale). */
  hour12: boolean;
}

/** en-US gets US formats; every other language gets en-GB until real translations exist. */
export function pickLocale(language: string | undefined): Locale {
  return language === 'en-US' ? enUS : enGB;
}

/** The browser's zone, locale and clock; the settings start at their defaults. */
export function browserEnv(): AppEnv {
  const locale = pickLocale(navigator.language);
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale,
    now: () => new Date(),
    weekStart: 'monday',
    hour12: usesTwelveHour('auto', locale.code),
  };
}

export const EnvContext = createContext<AppEnv | null>(null);

export function useEnv(): AppEnv {
  const env = useContext(EnvContext);
  if (env === null) throw new Error('useEnv must be used inside <EnvProvider>');
  return env;
}
