import { DEFAULT_SETTINGS, SettingsSchema } from '@agenda/core';
import type { Settings } from '@agenda/core';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { settings } from '../db/schema.js';

const ROW = 1;

export function createSettingsRepo(db: Db, now: () => Date) {
  return {
    /** The saved settings over the defaults; anything unreadable falls back to a default. */
    async get(): Promise<Settings> {
      const [row] = await db.select().from(settings).where(eq(settings.id, ROW));
      const stored: unknown = row?.value ?? {};
      const merged = { ...DEFAULT_SETTINGS, ...(typeof stored === 'object' ? stored : {}) };
      const parsed = SettingsSchema.safeParse(merged);
      return parsed.success ? parsed.data : DEFAULT_SETTINGS;
    },

    async put(value: Settings): Promise<Settings> {
      const updatedAt = now().toISOString();
      await db
        .insert(settings)
        .values({ id: ROW, value, updatedAt })
        .onConflictDoUpdate({ target: settings.id, set: { value, updatedAt } });
      return value;
    },
  };
}

export type SettingsRepo = ReturnType<typeof createSettingsRepo>;
