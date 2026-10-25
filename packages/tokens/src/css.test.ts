import { describe, expect, it } from 'vitest';
import { toCss } from './css.js';
import { EVENT_COLOR_NAMES, tokens } from './tokens.js';

const css = toCss();

/** The declarations inside the first block whose selector line matches exactly. */
function blockBody(selector: string): string {
  const start = css.indexOf(`${selector} {\n`);
  expect(start, `block ${selector}`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
}

describe('toCss', () => {
  it('puts static tokens and the light theme on :root', () => {
    const root = blockBody(':root');
    expect(root).toContain('color-scheme: light;');
    expect(root).toContain('--ag-color-bg: #FAFAF9;');
    expect(root).toContain('--ag-color-text-muted: #6B6560;');
    expect(root).toContain('--ag-color-surface-2: #F4F4F2;');
    expect(root).toContain('--ag-space-4: 16px;');
    expect(root).toContain('--ag-radius-full: 9999px;');
    expect(root).toContain('--ag-border-focus-ring: 2px;');
    expect(root).toContain('--ag-size-control-md: 40px;');
    expect(root).toContain('--ag-duration-dialog: 200ms;');
    expect(root).toContain('--ag-easing-standard: cubic-bezier(0.2, 0.8, 0.2, 1);');
  });

  it('uses rem for font sizes so text follows the user setting', () => {
    const root = blockBody(':root');
    expect(root).toContain('--ag-text-body: 1rem;');
    expect(root).toContain('--ag-text-caption: 0.75rem;');
    expect(root).toContain('--ag-text-display: 1.75rem;');
    expect(root).toContain('--ag-weight-medium: 500;');
    expect(root).toContain('--ag-leading-heading: 1.25;');
  });

  it('switches to dark for the system preference unless light is forced', () => {
    expect(css).toContain(
      '@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {',
    );
    const dark = blockBody('  :root:not([data-theme="light"])');
    expect(dark).toContain('color-scheme: dark;');
    expect(dark).toContain('--ag-color-bg: #0C0C0E;');
    expect(dark).toContain('--ag-shadow-floating: none;');
    expect(dark).toContain('--ag-color-floating-border: #4A4A52;');
    expect(dark).toContain('--ag-color-overlay: rgb(0 0 0 / 0.6);');
    expect(dark).not.toContain('--ag-space-');
  });

  it('lets data-theme force either theme', () => {
    expect(blockBody(':root[data-theme="dark"]')).toContain('--ag-color-accent: #818CF8;');
    expect(blockBody(':root[data-theme="light"]')).toContain('--ag-color-accent: #4F46E5;');
  });

  it('emits strong and soft variables for every event color in both themes', () => {
    for (const name of EVENT_COLOR_NAMES) {
      for (const theme of ['light', 'dark'] as const) {
        const { strong, soft } = tokens.eventColor[name][theme];
        const selector = theme === 'light' ? ':root' : ':root[data-theme="dark"]';
        expect(blockBody(selector)).toContain(`--ag-event-${name}-strong: ${strong};`);
        expect(blockBody(selector)).toContain(`--ag-event-${name}-soft: ${soft};`);
      }
    }
  });

  it('zeroes durations for reduced motion', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce) {');
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion'));
    for (const name of Object.keys(tokens.motion.duration)) {
      expect(reduced).toContain(`--ag-duration-${name}: 0ms;`);
    }
  });

  it('marks the file as generated', () => {
    expect(css.startsWith('/* Generated from @agenda/tokens')).toBe(true);
  });
});
