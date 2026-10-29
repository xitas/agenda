// @vitest-environment node
/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { breakpoint, size } from '@agenda/tokens';
import { describe, expect, it } from 'vitest';

const dir = new URL('./', import.meta.url);
const sheets = readdirSync(dir).filter((name) => name.endsWith('.css'));
const read = (name: string) => readFileSync(new URL(name, dir), 'utf8');

const BREAKPOINTS = new Set<number>(Object.values(breakpoint));
/** Container queries can't use variables either; their widths must equal a size token. */
const CONTAINER_WIDTHS = new Set<number>([size.eventTimeMin]);

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
      // Comments may mention values; only declarations count.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // A zero length needs no token (e.g. the fallback in env(safe-area-inset-bottom, 0px)).
      .replace(/\b0px\b/g, '0')
      // Variables can't be used in @media conditions, so a width there must equal a token.
      .replace(/@media \(width [<>]=? (\d+)px\)/g, (match, px: string) =>
        BREAKPOINTS.has(Number(px)) ? '@media (breakpoint)' : match,
      )
      .replace(/@container \(width [<>]=? (\d+)px\)/g, (match, px: string) =>
        CONTAINER_WIDTHS.has(Number(px)) ? '@container (token)' : match,
      )
  );
}

function violations(css: string): string[] {
  const clean = declarations(css);
  return FORBIDDEN.flatMap(([what, pattern]) => {
    const match = pattern.exec(clean);
    return match === null ? [] : [`${what}: "${match[0]}"`];
  });
}

describe('ui stylesheets', () => {
  it('has a stylesheet per component', () => {
    expect(sheets.length).toBeGreaterThan(2);
  });

  it.each(sheets)('%s uses only token variables for colors and lengths', (name) => {
    expect(violations(read(name))).toEqual([]);
  });

  it('allows breakpoint widths and zero, and nothing else', () => {
    expect(violations('@media (width < 768px) { a { b: env(x, 0px); } }')).toEqual([]);
    expect(violations('@media (width < 700px) { a { b: c; } }')).toEqual(['px length: "700px"']);
    expect(violations('@container (width < 96px) { a { b: c; } }')).toEqual([]);
    expect(violations('@container (width < 90px) { a { b: c; } }')).toEqual(['px length: "90px"']);
    expect(violations('a { margin: 10px; }')).toEqual(['px length: "10px"']);
  });

  it('hides the time in time-grid blocks narrower than size.eventTimeMin', () => {
    const css = read('TimeGrid.css');
    // Blocks are size containers; below the token width the time is not shown.
    expect(css).toMatch(/\.ag-timegrid__event \{\s*container-type: inline-size;\s*\}/);
    expect(css).toContain(
      `@container (width < ${String(size.eventTimeMin)}px) {\n  .ag-timegrid__event-time {\n    display: none;`,
    );
  });

  it('imports every stylesheet from styles.css', () => {
    const index = read('styles.css');
    for (const name of sheets.filter((sheet) => sheet !== 'styles.css')) {
      expect(index).toContain(`@import './${name}';`);
    }
  });
});
