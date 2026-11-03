import type { Locale } from '@agenda/core';
import { enGB, enUS } from 'date-fns/locale';

/** Where and when the app runs: injected so tests can fix the clock, zone and locale. */
export interface MobileEnv {
  timezone: string;
  locale: Locale;
  now: () => Date;
}

/** en-US gets US formats; every other language gets en-GB (as on the web). */
export function pickLocale(language: string | undefined): Locale {
  return language === 'en-US' ? enUS : enGB;
}

/** The phone's zone, language and clock (Hermes has Intl; see runtime-check.ts). */
export function deviceEnv(): MobileEnv {
  const { timeZone, locale } = Intl.DateTimeFormat().resolvedOptions();
  return { timezone: timeZone, locale: pickLocale(locale), now: () => new Date() };
}
