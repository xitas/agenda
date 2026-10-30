/**
 * A readable name for a login, from the browser's user agent: "Chrome on Windows".
 * Shown in Settings > Devices so you can tell your sessions apart.
 */
const BROWSERS: [RegExp, string][] = [
  [/Edg\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Version\/[\d.]+.*Safari\//, 'Safari'],
];

const SYSTEMS: [RegExp, string][] = [
  [/Windows/, 'Windows'],
  [/Android/, 'Android'],
  [/iPhone|iPod/, 'iOS'],
  [/iPad/, 'iPadOS'],
  [/CrOS/, 'ChromeOS'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux/, 'Linux'],
];

const first = (list: [RegExp, string][], text: string) =>
  list.find(([pattern]) => pattern.test(text))?.[1];

export function deviceLabel(userAgent: string): string {
  const browser = first(BROWSERS, userAgent);
  const system = first(SYSTEMS, userAgent);
  if (browser !== undefined && system !== undefined) return `${browser} on ${system}`;
  return browser ?? system ?? 'Web browser';
}
