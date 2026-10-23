import { describe, expect, it } from 'vitest';
import { tokens } from './index.js';

describe('tokens', () => {
  it('exports a token object', () => {
    expect(tokens).toBeTypeOf('object');
  });
});
