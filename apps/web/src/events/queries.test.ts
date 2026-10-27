import { describe, expect, it } from 'vitest';
import { rangeFromKey, rangeKey } from './queries';

describe('range keys', () => {
  const range = {
    start: new Date('2026-10-26T19:00:00.000Z'),
    end: new Date('2026-10-27T19:00:00.000Z'),
  };

  it('round-trip a range and its zone', () => {
    const key = rangeKey(range, 'Asia/Karachi');
    expect(key).toEqual([
      'events',
      'range',
      '2026-10-26T19:00:00.000Z',
      '2026-10-27T19:00:00.000Z',
      'Asia/Karachi',
    ]);
    expect(rangeFromKey(key)).toEqual({ range, timezone: 'Asia/Karachi' });
  });

  it('ignore other keys', () => {
    expect(rangeFromKey(['session'])).toBeNull();
    expect(rangeFromKey(['events', 'detail', 'x'])).toBeNull();
    expect(rangeFromKey(['events', 'range', 1, 2, 3])).toBeNull();
  });
});
