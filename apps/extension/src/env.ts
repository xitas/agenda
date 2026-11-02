import type { Locale } from '@agenda/core';
import { enGB, enUS } from 'date-fns/locale';

/** Where and when the extension runs: injected so tests can fix the clock and zone. */
export interface ExtensionEnv {
  timezone: string;
  locale: Locale;
  now: () => Date;
}

/** en-US gets US formats; every other language gets en-GB (as in the web app). */
export function pickLocale(language: string | undefined): Locale {
  return language === 'en-US' ? enUS : enGB;
}

/** The browser's zone, language and clock; available in pages and the service worker. */
export function browserEnv(): ExtensionEnv {
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: pickLocale(navigator.language),
    now: () => new Date(),
  };
}
