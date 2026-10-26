import { describe, expect, it } from 'vitest';
import { color, DARK_SOFT_ALPHA, EVENT_COLOR_NAMES, eventColor } from './tokens.js';

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** `fg` at `alpha` over `bg`, as #RRGGBB. */
function mix(fg: string, bg: string, alpha: number): string {
  const f = channels(fg);
  const b = channels(bg);
  const out = f.map((value, i) => Math.round(value * alpha + (b[i] ?? 0) * (1 - alpha)));
  return `#${out
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

describe('dark event soft fills', () => {
  it.each(EVENT_COLOR_NAMES)(
    '%s is its strong color at the soft alpha over the surface',
    (name) => {
      const { strong, soft } = eventColor[name].dark;
      expect(soft).toBe(mix(strong, color.dark.surface, DARK_SOFT_ALPHA));
    },
  );

  it('uses a subtle tint, not a solid block', () => {
    expect(DARK_SOFT_ALPHA).toBeGreaterThanOrEqual(0.12);
    expect(DARK_SOFT_ALPHA).toBeLessThanOrEqual(0.16);
  });
});
