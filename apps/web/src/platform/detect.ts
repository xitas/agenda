import type { Platform } from '@agenda/core';
import { webPlatform } from '../app/platform';

/**
 * True inside the desktop app: Tauri defines `__TAURI_INTERNALS__` in its webviews
 * before any page script runs. Checked here, without importing Tauri, so the browser
 * build never loads any Tauri code.
 */
export function isTauri(scope: object = globalThis): boolean {
  return '__TAURI_INTERNALS__' in scope;
}

/**
 * The platform adapter for where the app runs (ARCHITECTURE.md §7). The Tauri one is a
 * separate chunk, fetched only inside Tauri.
 */
export async function loadPlatform(scope?: object): Promise<Platform> {
  if (!isTauri(scope)) return webPlatform;
  const { createTauriPlatform } = await import('./tauri');
  return createTauriPlatform();
}
