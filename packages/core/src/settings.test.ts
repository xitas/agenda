import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SettingsSchema, usesTwelveHour } from './settings.js';

describe('settings', () => {
  it('defaults to the system theme, Monday and the locale clock', () => {
    expect(DEFAULT_SETTINGS).toEqual({ theme: 'system', weekStart: 'monday', timeFormat: 'auto' });
    expect(SettingsSchema.parse(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });

  it('rejects unknown values', () => {
    expect(SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, weekStart: 'saturday' }).success).toBe(
      false,
    );
    expect(SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, theme: 'blue' }).success).toBe(false);
    expect(SettingsSchema.safeParse({ theme: 'dark' }).success).toBe(false);
  });

  it('decides the clock from the setting, or the locale for auto', () => {
    expect(usesTwelveHour('12h', 'en-GB')).toBe(true);
    expect(usesTwelveHour('24h', 'en-US')).toBe(false);
    expect(usesTwelveHour('auto', 'en-US')).toBe(true);
    expect(usesTwelveHour('auto', 'en-GB')).toBe(false);
  });
});
