/**
 * Agenda's design tokens (docs/DESIGN.md §2), as plain data with no platform code.
 * The web build turns them into CSS variables (tokens.css); mobile imports this object.
 * Lengths are numbers in px; each platform decides how to apply them.
 */

export const EVENT_COLOR_NAMES = [
  'slate',
  'blue',
  'green',
  'amber',
  'red',
  'violet',
  'pink',
  'teal',
] as const;

export type EventColorName = (typeof EVENT_COLOR_NAMES)[number];
export type ThemeName = 'light' | 'dark';

export interface ThemeColors {
  bg: string;
  surface: string;
  surface2: string;
  /** Decorative hairlines between areas. */
  border: string;
  /** Edges that identify a control (inputs, secondary buttons): at least 3:1. */
  borderStrong: string;
  text: string;
  textMuted: string;
  accent: string;
  accentFg: string;
  danger: string;
  /** Text on a danger fill (the danger button). */
  dangerFg: string;
  success: string;
}

export interface EventColor {
  /** Left bar and text on the soft fill. */
  strong: string;
  /** Event block fill. */
  soft: string;
}

// Light danger, success and six event strongs are darker than in the first DESIGN.md
// draft so every text pair stays above 5:1 (see contrast.test.ts).
export const color: Record<ThemeName, ThemeColors> = {
  light: {
    bg: '#FAFAF9',
    surface: '#FFFFFF',
    surface2: '#F4F4F2',
    border: '#E7E5E4',
    borderStrong: '#888380',
    text: '#1C1917',
    textMuted: '#6B6560',
    accent: '#4F46E5',
    accentFg: '#FFFFFF',
    danger: '#CB2323',
    dangerFg: '#FFFFFF',
    success: '#107937',
  },
  dark: {
    bg: '#0C0C0E',
    surface: '#16161A',
    surface2: '#1E1E23',
    border: '#2A2A30',
    borderStrong: '#717175',
    text: '#EDEDEF',
    textMuted: '#9A9AA3',
    accent: '#818CF8',
    accentFg: '#0C0C0E',
    danger: '#F87171',
    dangerFg: '#0C0C0E',
    success: '#4ADE80',
  },
};

export const eventColor: Record<EventColorName, Record<ThemeName, EventColor>> = {
  slate: {
    light: { strong: '#475569', soft: '#F1F5F9' },
    dark: { strong: '#94A3B8', soft: '#1E293B' },
  },
  blue: {
    light: { strong: '#2460E3', soft: '#EFF6FF' },
    dark: { strong: '#60A5FA', soft: '#172554' },
  },
  green: {
    light: { strong: '#117C38', soft: '#F0FDF4' },
    dark: { strong: '#4ADE80', soft: '#052E16' },
  },
  amber: {
    light: { strong: '#A35904', soft: '#FFFBEB' },
    dark: { strong: '#FBBF24', soft: '#451A03' },
  },
  red: {
    light: { strong: '#CB2323', soft: '#FEF2F2' },
    dark: { strong: '#F87171', soft: '#450A0A' },
  },
  violet: {
    light: { strong: '#7C3AED', soft: '#F5F3FF' },
    dark: { strong: '#A78BFA', soft: '#2E1065' },
  },
  pink: {
    light: { strong: '#C5236B', soft: '#FDF2F8' },
    dark: { strong: '#F472B6', soft: '#500724' },
  },
  teal: {
    light: { strong: '#0B7970', soft: '#F0FDFA' },
    dark: { strong: '#2DD4BF', soft: '#042F2E' },
  },
};

export const font = {
  family: {
    sans: "'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  /** px; the CSS uses rem (px / 16) so text follows the user's font-size setting. */
  size: { caption: 12, bodySm: 14, body: 16, titleSm: 18, title: 22, display: 28 },
  weight: { regular: 400, medium: 500, semibold: 600 },
  lineHeight: { body: 1.5, heading: 1.25 },
} as const;

/** 4-pt spacing scale; the key is the value / 4. */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48 } as const;

export const radius = { sm: 6, md: 10, lg: 16, full: 9999 } as const;

export const size = {
  control: { sm: 32, md: 40, touch: 44 },
  icon: { md: 20, sm: 16 },
  dialog: { width: 480 },
  toast: { width: 420 },
  sidebar: 240,
} as const;

export const border = {
  hairline: 1,
  /** The event category bar. */
  bar: 3,
  focusRing: 2,
  focusOffset: 2,
} as const;

export interface Elevation {
  /** Shadow under floating layers (dialogs, menus, toasts). */
  floating: string;
  /** Their border; dark mode has no shadow, so the border is stronger instead. */
  floatingBorder: string;
  /** The dimmed backdrop behind a modal dialog. */
  overlay: string;
}

/** Shadows only on floating layers; dark mode uses a stronger border instead. */
export const elevation: Record<ThemeName, Elevation> = {
  light: {
    floating: '0 8px 24px rgb(0 0 0 / 0.12)',
    floatingBorder: '#E7E5E4',
    overlay: 'rgb(28 25 23 / 0.4)',
  },
  dark: { floating: 'none', floatingBorder: '#4A4A52', overlay: 'rgb(0 0 0 / 0.6)' },
};

export const motion = {
  duration: { fast: 150, dialog: 200, sheet: 250 },
  easing: { standard: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
} as const;

export const tokens = {
  color,
  eventColor,
  font,
  space,
  radius,
  size,
  border,
  elevation,
  motion,
} as const;

export type Tokens = typeof tokens;
