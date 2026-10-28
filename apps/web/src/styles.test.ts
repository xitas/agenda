// @vitest-environment node
/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { breakpoint } from '@agenda/tokens';
import { describe, expect, it } from 'vitest';

const src = new URL('./', import.meta.url);
// Every stylesheet under src/, in any folder.
const sheets = (readdirSync(src, { recursive: true }) as string[])
  .map((name) => name.replace(/\\/g, '/'))
  .filter((name) => name.endsWith('.css'));
const read = (name: string) => readFileSync(new URL(name, src), 'utf8');

const BREAKPOINTS = new Set<number>(Object.values(breakpoint));

/** Literal values that must come from tokens instead (CLAUDE.md: tokens only). */
const FORBIDDEN: [string, RegExp][] = [
  ['hex color', /#[0-9a-f]{3,8}\b/i],
  ['rgb/hsl color', /\b(?:rgba?|hsla?|oklch|lab)\(/i],
  ['named color', /:\s*(?:[^;]*\s)?(?:white|black|red|blue|green|gray|grey)\b/i],
  ['px length', /\b\d+(?:\.\d+)?px\b/],
  ['rem length', /\b\d+(?:\.\d+)?rem\b/],
];

/** The CSS that must be token-only, with the allowed exceptions taken out. */
function declarations(css: string): string {
  return (
    css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // A zero length needs no token (e.g. the fallback in env(safe-area-inset-bottom, 0px)).
      .replace(/\b0px\b/g, '0')
      // Variables can't be used in @media conditions, so a width there must equal a token.
      .replace(/@media \(width [<>]=? (\d+)px\)/g, (match, px: string) =>
        BREAKPOINTS.has(Number(px)) ? '@media (breakpoint)' : match,
      )
  );
}

describe('web stylesheets', () => {
  it('finds stylesheets in subfolders too', () => {
    expect(sheets).toContain('auth/login.css');
  });

  it.each(sheets)('%s uses only token variables for colors and lengths', (name) => {
    const css = declarations(read(name));
    const found = FORBIDDEN.flatMap(([what, pattern]) => {
      const match = pattern.exec(css);
      return match === null ? [] : [`${what}: "${match[0]}"`];
    });
    expect(found).toEqual([]);
  });
});
