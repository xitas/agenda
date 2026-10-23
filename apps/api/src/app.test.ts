import { describe, expect, it } from 'vitest';
import { describeApi } from './app.js';

describe('api', () => {
  it('describes itself using the shared app name', () => {
    expect(describeApi()).toBe('Agenda API');
  });
});
