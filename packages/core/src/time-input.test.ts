import { describe, expect, it } from 'vitest';
import { formatTimeInput, parseTimeInput, stepTime } from './time-input.js';

describe('parseTimeInput', () => {
  it.each([
    ['16:30', '16:30'],
    ['9:05', '09:05'],
    ['1630', '16:30'],
    ['9.30', '09:30'],
    ['9', '09:00'],
    ['0', '00:00'],
    ['4pm', '16:00'],
    ['4:30 PM', '16:30'],
    ['4.30p.m.', '16:30'],
    ['12am', '00:00'],
    ['12:15 am', '00:15'],
    ['12pm', '12:00'],
    ['11:59 PM', '23:59'],
    ['  7 am ', '07:00'],
  ])('reads %j as %s', (text, expected) => {
    expect(parseTimeInput(text)).toBe(expected);
  });

  it.each(['', 'soon', '24:00', '9:60', '13pm', '0am', '4:3', '12345'])('rejects %j', (text) => {
    expect(parseTimeInput(text)).toBeNull();
  });
});

describe('formatTimeInput and stepTime', () => {
  it('shows a 24- or 12-hour clock', () => {
    expect(formatTimeInput('16:30', false)).toBe('16:30');
    expect(formatTimeInput('16:30', true)).toBe('4:30 PM');
    expect(formatTimeInput('00:05', true)).toBe('12:05 AM');
    expect(formatTimeInput('12:00', true)).toBe('12:00 PM');
    expect(formatTimeInput('9:00', false)).toBe('09:00');
  });

  it('round-trips through the parser', () => {
    for (const time of ['00:00', '09:15', '12:00', '23:45']) {
      expect(parseTimeInput(formatTimeInput(time, true))).toBe(time);
      expect(parseTimeInput(formatTimeInput(time, false))).toBe(time);
    }
  });

  it('steps by minutes, wrapping around midnight', () => {
    expect(stepTime('09:00', 15)).toBe('09:15');
    expect(stepTime('23:50', 15)).toBe('00:05');
    expect(stepTime('00:10', -15)).toBe('23:55');
  });
});
