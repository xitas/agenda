// @vitest-environment node
/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dir = new URL('./', import.meta.url);
const sheets = readdirSync(dir).filter((name) => name.endsWith('.css'));
const read = (name: string) => readFileSync(new URL(name, dir), 'utf8');

/** Literal values that must come from tokens instead (CLAUDE.md: tokens only). */
const FORBIDDEN: [string, RegExp][] = [
  ['hex color', /#[0-9a-f]{3,8}\b/i],
  ['rgb/hsl color', /\b(?:rgba?|hsla?|oklch|lab)\(/i],
  ['named color', /:\s*(?:[^;]*\s)?(?:white|black|red|blue|green|gray|grey)\b/i],
  ['px length', /\b\d+(?:\.\d+)?px\b/],
  ['rem length', /\b\d+(?:\.\d+)?rem\b/],
];

describe('web stylesheets', () => {
  it.each(sheets)('%s uses only token variables for colors and lengths', (name) => {
    // Comments may mention values; only declarations count.
    const css = read(name).replace(/\/\*[\s\S]*?\*\//g, '');
    const found = FORBIDDEN.flatMap(([what, pattern]) => {
      const match = pattern.exec(css);
      return match === null ? [] : [`${what}: "${match[0]}"`];
    });
    expect(found).toEqual([]);
  });
});
