import { describe, expect, it } from 'vitest';
import { contrastRatio, luminance, MIN_CONTRAST } from './contrast.js';
import { color, EVENT_COLOR_NAMES, eventColor } from './tokens.js';
import type { ThemeColors, ThemeName } from './tokens.js';

type Kind = keyof typeof MIN_CONTRAST;

interface Pair {
  theme: ThemeName;
  kind: Kind;
  fg: string;
  bg: string;
  fgValue: string;
  bgValue: string;
}

const BACKGROUNDS = ['bg', 'surface', 'surface2'] as const satisfies (keyof ThemeColors)[];

/** Every text/background (and UI edge/background) combination the components use. */
function pairs(theme: ThemeName): Pair[] {
  const c = color[theme];
  const out: Pair[] = [];
  const add = (kind: Kind, fg: string, bg: string, fgValue: string, bgValue: string) =>
    out.push({ theme, kind, fg, bg, fgValue, bgValue });

  for (const bg of BACKGROUNDS) {
    for (const fg of ['text', 'textMuted', 'danger', 'success', 'accent'] as const) {
      add('text', fg, bg, c[fg], c[bg]);
    }
    // Control edges (inputs, secondary buttons) and the focus ring must be visible.
    add('ui', 'borderStrong', bg, c.borderStrong, c[bg]);
    add('ui', 'accent (focus ring)', bg, c.accent, c[bg]);
  }
  add('text', 'accentFg', 'accent', c.accentFg, c.accent);
  add('text', 'dangerFg', 'danger', c.dangerFg, c.danger);

  for (const name of EVENT_COLOR_NAMES) {
    const { strong, soft } = eventColor[name][theme];
    add('text', 'text', `${name}.soft`, c.text, soft);
    add('text', 'textMuted', `${name}.soft`, c.textMuted, soft);
    add('text', `${name}.strong`, `${name}.soft`, strong, soft);
    add('ui', `${name}.strong (bar)`, 'surface', strong, c.surface);
  }
  return out;
}

const all = [...pairs('light'), ...pairs('dark')];

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBe(1);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#FFFFFF', '#777777')).toBeCloseTo(4.48, 2);
  });

  it('rejects colors it cannot read', () => {
    expect(() => luminance('red')).toThrow('Expected a #RRGGBB color, got red');
    expect(() => luminance('#FFF')).toThrow();
  });
});

describe('token contrast (WCAG AA)', () => {
  it('checks a meaningful set of pairs', () => {
    expect(all.length).toBeGreaterThan(100);
  });

  it.each(all.map((pair) => [`${pair.theme}: ${pair.fg} on ${pair.bg}`, pair] as const))(
    '%s',
    (_name, pair) => {
      const ratio = contrastRatio(pair.fgValue, pair.bgValue);
      const min = MIN_CONTRAST[pair.kind];
      expect(
        ratio,
        `${pair.fgValue} on ${pair.bgValue} is ${ratio.toFixed(2)}:1, needs ${String(min)}:1`,
      ).toBeGreaterThanOrEqual(min);
    },
  );

  it('keeps a margin: no text pair is closer than 5:1 in the light theme', () => {
    const tight = pairs('light')
      .filter((pair) => pair.kind === 'text')
      .map((pair) => ({
        pair: `${pair.fg} on ${pair.bg}`,
        ratio: contrastRatio(pair.fgValue, pair.bgValue),
      }))
      .filter(({ ratio }) => ratio < 5);
    expect(tight).toEqual([]);
  });
});
