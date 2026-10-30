import { z } from 'zod';

/**
 * The user's preferences, stored on the server so every device shares them
 * (GET/PUT /api/v1/settings). Apps keep a local copy only to paint the first frame.
 */
export const THEMES = ['system', 'light', 'dark'] as const;
export const WEEK_STARTS = ['monday', 'sunday'] as const;
export const TIME_FORMATS = ['auto', '12h', '24h'] as const;

export const SettingsSchema = z.object({
  theme: z.enum(THEMES),
  weekStart: z.enum(WEEK_STARTS),
  timeFormat: z.enum(TIME_FORMATS),
});

export type Settings = z.infer<typeof SettingsSchema>;
export type Theme = Settings['theme'];
export type TimeFormat = Settings['timeFormat'];

/** What a new install starts with: the OS theme, Monday first (DESIGN.md), the locale's clock. */
export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  weekStart: 'monday',
  timeFormat: 'auto',
};

/**
 * Whether times show on a 12-hour clock: forced by the setting, or for "auto" the
 * locale's habit (en-US uses 12-hour, en-GB 24-hour).
 */
export function usesTwelveHour(timeFormat: TimeFormat, localeCode: string | undefined): boolean {
  if (timeFormat !== 'auto') return timeFormat === '12h';
  const { hourCycle } = new Intl.DateTimeFormat(localeCode, { hour: 'numeric' }).resolvedOptions();
  return hourCycle === 'h11' || hourCycle === 'h12';
}
