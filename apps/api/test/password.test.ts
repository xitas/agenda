import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCRYPT,
  hashPassword,
  isPasswordHash,
  verifyPassword,
} from '../src/auth/password.js';

// Cheap parameters keep tests fast; the format records them, so verify still works.
const FAST = { logN: 10, r: 8, p: 1 };

describe('hashPassword and verifyPassword', () => {
  it('uses the self-describing scrypt format with OWASP defaults', async () => {
    expect(DEFAULT_SCRYPT).toEqual({ logN: 17, r: 8, p: 1 });
    const hash = await hashPassword('correct horse battery', FAST);
    expect(hash).toMatch(/^scrypt:10:8:1:[\w-]{22}:[\w-]{43}$/);
    expect(isPasswordHash(hash)).toBe(true);
  });

  it('accepts the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery', FAST);
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('correct horse batterY', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('salts every hash', async () => {
    const [a, b] = await Promise.all([hashPassword('same', FAST), hashPassword('same', FAST)]);
    expect(a).not.toBe(b);
  });

  it('verifies the default (slow) parameters too', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash.startsWith('scrypt:17:8:1:')).toBe(true);
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
  });

  it.each([
    ['plain text', 'hunter2'],
    ['another algorithm', 'argon2id:3:65536:4:c2FsdHNhbHQ:a2V5a2V5a2V5a2V5'],
    ['N too large', 'scrypt:30:8:1:c2FsdHNhbHRzYWx0:a2V5a2V5a2V5a2V5a2V5a2V5'],
    ['N too small', 'scrypt:4:8:1:c2FsdHNhbHRzYWx0:a2V5a2V5a2V5a2V5a2V5a2V5'],
    ['salt too short', 'scrypt:10:8:1:c2E:a2V5a2V5a2V5a2V5a2V5a2V5'],
    ['empty', ''],
  ])('never matches a malformed hash (%s)', async (_name, stored) => {
    expect(isPasswordHash(stored)).toBe(false);
    expect(await verifyPassword('anything', stored)).toBe(false);
  });
});

describe('hash-password script', () => {
  const script = fileURLToPath(new URL('../src/cli/hash-password.ts', import.meta.url));
  const run = (input: string) =>
    spawnSync(process.execPath, ['--import', 'tsx', script], { input, encoding: 'utf8' });

  it('prints an env line whose hash verifies', async () => {
    const result = run('correct horse battery\n');
    expect(result.status).toBe(0);
    const match = /^AGENDA_PASSWORD_HASH=(\S+)\n$/.exec(result.stdout);
    expect(match).not.toBeNull();
    expect(await verifyPassword('correct horse battery', match?.[1] ?? '')).toBe(true);
    // Only the hash goes to stdout, never the password.
    expect(result.stdout).not.toContain('correct horse');
  }, 20_000);

  it('refuses a short password', () => {
    const result = run('short\n');
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Use at least 12 characters.');
  }, 20_000);
});
