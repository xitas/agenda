import type { TokenStore } from '@agenda/core';
import * as SecureStore from 'expo-secure-store';

/**
 * What this phone remembers, in expo-secure-store: values encrypted with a key kept in
 * the Android Keystore, readable by this app only. The session token is a secret; the
 * Server URL isn't, but one small store for both keeps things simple.
 */
const TOKEN_KEY = 'agenda.token';
const SERVER_URL_KEY = 'agenda.serverUrl';

/**
 * The Android emulator reaches the PC's localhost at 10.0.2.2. On a phone, set your PC's
 * address in Settings (apps/mobile/README.md).
 */
export const DEFAULT_PHONE_SERVER_URL = 'http://10.0.2.2:4001';

export const secureTokens: TokenStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};

export async function readServerUrl(): Promise<string> {
  return (await SecureStore.getItemAsync(SERVER_URL_KEY)) ?? DEFAULT_PHONE_SERVER_URL;
}

/** A token belongs to the server that issued it, so a new server also logs out. */
export async function saveServerUrl(url: string): Promise<void> {
  await SecureStore.setItemAsync(SERVER_URL_KEY, url);
  await secureTokens.clear();
}
