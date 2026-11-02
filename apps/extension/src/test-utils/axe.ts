import axe from 'axe-core';
import { expect } from 'vitest';

/** Runs axe on the whole page. Contrast is checked by the tokens tests (jsdom can't). */
export async function expectNoAxeViolations() {
  const results = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}
