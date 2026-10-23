import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('shared tsconfig', () => {
  it('turns on strict mode', () => {
    const base = JSON.parse(
      readFileSync(new URL('../tsconfig/base.json', import.meta.url), 'utf8'),
    ) as { compilerOptions: { strict?: boolean } };

    expect(base.compilerOptions.strict).toBe(true);
  });
});
