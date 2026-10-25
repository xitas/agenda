import axe from 'axe-core';
import { expect } from 'vitest';

/**
 * Runs axe-core on a rendered component. Two page-level rules are off: color-contrast
 * needs real layout (jsdom has none; packages/tokens tests contrast instead) and region
 * is about whole pages, not single components.
 */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  const problems = results.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((node) => node.target.join(' ')).join(', ')})`,
  );
  expect(problems).toEqual([]);
}
