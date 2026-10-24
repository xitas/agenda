import { validate, version } from 'uuid';
import { describe, expect, it } from 'vitest';
import { newId } from './ids.js';

describe('newId', () => {
  it('returns a UUID v7', () => {
    const id = newId();
    expect(validate(id)).toBe(true);
    expect(version(id)).toBe(7);
  });

  it('returns ids that sort in creation order', () => {
    const ids = Array.from({ length: 50 }, () => newId());
    expect([...ids].sort()).toEqual(ids);
  });
});
