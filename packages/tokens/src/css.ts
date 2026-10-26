import { EVENT_COLOR_NAMES, tokens } from './tokens.js';
import type { ThemeName, Tokens } from './tokens.js';

const PREFIX = '--ag';
const REM = 16;

const kebab = (value: string) => value.replace(/[A-Z0-9]+/g, (part) => `-${part.toLowerCase()}`);
const px = (value: number) => `${String(value)}px`;
const rem = (value: number) => `${String(value / REM)}rem`;
const ms = (value: number) => `${String(value)}ms`;

type Declarations = [name: string, value: string][];

function block(selector: string, declarations: Declarations, indent = ''): string {
  const body = declarations.map(([name, value]) => `${indent}  ${name}: ${value};`).join('\n');
  return `${indent}${selector} {\n${body}\n${indent}}`;
}

/** Everything that doesn't change with the theme. */
function staticDeclarations(t: Tokens): Declarations {
  const out: Declarations = [[`${PREFIX}-font-sans`, t.font.family.sans]];
  for (const [name, value] of Object.entries(t.font.size))
    out.push([`${PREFIX}-text-${kebab(name)}`, rem(value)]);
  for (const [name, value] of Object.entries(t.font.weight))
    out.push([`${PREFIX}-weight-${name}`, String(value)]);
  for (const [name, value] of Object.entries(t.font.lineHeight))
    out.push([`${PREFIX}-leading-${name}`, String(value)]);
  for (const [name, value] of Object.entries(t.space))
    out.push([`${PREFIX}-space-${name}`, px(value)]);
  for (const [name, value] of Object.entries(t.radius))
    out.push([`${PREFIX}-radius-${name}`, px(value)]);
  for (const [name, value] of Object.entries(t.size.control))
    out.push([`${PREFIX}-size-control-${name}`, px(value)]);
  for (const [name, value] of Object.entries(t.size.icon))
    out.push([`${PREFIX}-size-icon-${name}`, px(value)]);
  out.push(
    [`${PREFIX}-size-dialog`, px(t.size.dialog.width)],
    [`${PREFIX}-size-toast`, px(t.size.toast.width)],
    [`${PREFIX}-size-sidebar`, px(t.size.sidebar)],
    [`${PREFIX}-size-bottom-nav`, px(t.size.bottomNav)],
    [`${PREFIX}-toast-offset-wide`, px(t.toastOffset.wide)],
    [`${PREFIX}-toast-offset-narrow`, px(t.toastOffset.narrow)],
    // For reference only: CSS variables cannot be used inside @media conditions.
    [`${PREFIX}-breakpoint-narrow`, px(t.breakpoint.narrow)],
  );
  for (const [name, value] of Object.entries(t.border))
    out.push([`${PREFIX}-border-${kebab(name)}`, px(value)]);
  for (const [name, value] of Object.entries(t.motion.duration))
    out.push([`${PREFIX}-duration-${name}`, ms(value)]);
  out.push([`${PREFIX}-easing-standard`, t.motion.easing.standard]);
  return out;
}

/** Colors and elevation for one theme, plus color-scheme so native controls match. */
function themeDeclarations(t: Tokens, theme: ThemeName): Declarations {
  const out: Declarations = [['color-scheme', theme]];
  for (const [name, value] of Object.entries(t.color[theme]))
    out.push([`${PREFIX}-color-${kebab(name)}`, value]);
  for (const name of EVENT_COLOR_NAMES) {
    const { strong, soft } = t.eventColor[name][theme];
    out.push([`${PREFIX}-event-${name}-strong`, strong], [`${PREFIX}-event-${name}-soft`, soft]);
  }
  const { floating, floatingBorder, overlay } = t.elevation[theme];
  out.push(
    [`${PREFIX}-shadow-floating`, floating],
    [`${PREFIX}-color-floating-border`, floatingBorder],
    [`${PREFIX}-color-overlay`, overlay],
  );
  return out;
}

/**
 * tokens.css: light on :root by default, dark when the system prefers it, and
 * [data-theme] on <html> to force either. The explicit choice wins in both directions.
 */
export function toCss(t: Tokens = tokens): string {
  const zeroMotion: Declarations = Object.keys(t.motion.duration).map((name) => [
    `${PREFIX}-duration-${name}`,
    '0ms',
  ]);
  return [
    '/* Generated from @agenda/tokens (src/tokens.ts). Do not edit. */',
    block(':root', [...staticDeclarations(t), ...themeDeclarations(t, 'light')]),
    `@media (prefers-color-scheme: dark) {\n${block(':root:not([data-theme="light"])', themeDeclarations(t, 'dark'), '  ')}\n}`,
    block(':root[data-theme="light"]', themeDeclarations(t, 'light')),
    block(':root[data-theme="dark"]', themeDeclarations(t, 'dark')),
    `@media (prefers-reduced-motion: reduce) {\n${block(':root', zeroMotion, '  ')}\n}`,
    '',
  ].join('\n\n');
}
