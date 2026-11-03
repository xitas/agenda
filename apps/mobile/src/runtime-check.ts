/**
 * What core needs from the JavaScript engine, checked at startup in development builds:
 * Hermes (React Native's engine) implements most of ES2023 but not everything a browser
 * or Node has. Each check returns the missing feature's name, so a gap shows up in the
 * Metro log on day one instead of as a wrong date later.
 */
export function missingRuntimeFeatures(scope: typeof globalThis = globalThis): string[] {
  const missing: string[] = [];
  // @date-fns/tz reads offsets with timeZoneName "longOffset" ("GMT+05:00").
  try {
    const text = new scope.Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Karachi',
      timeZoneName: 'longOffset',
    }).format(new Date(0));
    if (!text.includes('GMT+05:00')) missing.push('Intl time zones (longOffset)');
  } catch {
    missing.push('Intl time zones (longOffset)');
  }
  // uuid (newId) needs a source of random bytes.
  if (!('crypto' in scope) || typeof scope.crypto.getRandomValues !== 'function') {
    missing.push('crypto.getRandomValues');
  }
  // normalizeServerUrl reads these URL parts.
  try {
    const url = new scope.URL('http://192.168.1.20:4001/');
    if (
      url.origin !== 'http://192.168.1.20:4001' ||
      url.pathname !== '/' ||
      url.protocol !== 'http:'
    ) {
      missing.push('URL');
    }
  } catch {
    missing.push('URL');
  }
  return missing;
}
