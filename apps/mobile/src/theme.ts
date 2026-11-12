import type { Theme } from '@agenda/core';
import { border, color, eventColor, font, radius, size, space, toastOffset } from '@agenda/tokens';
import type { EventColor, EventColorName, ThemeColors, ThemeName } from '@agenda/tokens';
import { createContext, useContext } from 'react';

/**
 * The design tokens for React Native. The web turns them into CSS variables; here they
 * are plain numbers and strings in StyleSheets (React Native has no cascade: each
 * component gets its colors from this object, chosen by the current scheme).
 */
export interface Palette {
  scheme: ThemeName;
  color: ThemeColors;
  event: (name: EventColorName) => EventColor;
}

export function palette(scheme: ThemeName): Palette {
  return { scheme, color: color[scheme], event: (name) => eventColor[name][scheme] };
}

/** The theme setting ("system" follows the phone) as the scheme to draw with. */
export function schemeFor(theme: Theme | undefined, system: string | null | undefined): ThemeName {
  if (theme === 'light' || theme === 'dark') return theme;
  return system === 'dark' ? 'dark' : 'light';
}

export const PaletteContext = createContext<Palette>(palette('light'));

export function usePalette(): Palette {
  return useContext(PaletteContext);
}

/** Spacing, radii and type sizes (numbers: density-independent pixels on Android). */
export { border, radius, size, space, toastOffset };
export const text = font.size;
/** React Native wants font weights as strings. */
export const weight = {
  regular: String(font.weight.regular),
  medium: String(font.weight.medium),
  semibold: String(font.weight.semibold),
} as { regular: '400'; medium: '500'; semibold: '600' };
