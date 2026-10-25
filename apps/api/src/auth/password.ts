import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Password hashes are self-describing so the cost (or algorithm) can change later:
 *
 *   scrypt:<log2 N>:<r>:<p>:<salt, base64url>:<key, base64url>
 *
 * Only base64url characters and ":" are used, so the value can sit in a .env file or a
 * shell variable without "$" expansion. Defaults follow OWASP: N = 2^17, r = 8, p = 1.
 * Moving to argon2id later means: verify the old hash at login, then store a new one.
 */
export interface ScryptParams {
  logN: number;
  r: number;
  p: number;
}

export const DEFAULT_SCRYPT: ScryptParams = { logN: 17, r: 8, p: 1 };
export const MIN_PASSWORD_LENGTH = 12;

const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
// Limits for parameters read from a stored hash, so a bad value can't exhaust memory.
const LIMITS = { logN: [10, 20], r: [1, 32], p: [1, 16] } as const;
const FORMAT = /^scrypt:(\d+):(\d+):(\d+):([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)$/;

interface ParsedHash extends ScryptParams {
  salt: Buffer;
  key: Buffer;
}

function derive(password: string, salt: Buffer, params: ScryptParams, length: number) {
  const N = 2 ** params.logN;
  return new Promise<Buffer>((resolve, reject) => {
    // scrypt needs about 128 * N * r bytes; allow twice that.
    scrypt(
      password,
      salt,
      length,
      { N, r: params.r, p: params.p, maxmem: 256 * N * params.r },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

function inRange(value: number, [min, max]: readonly [number, number]): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

function parseHash(stored: string): ParsedHash | null {
  const match = FORMAT.exec(stored);
  if (match === null) return null;
  const [, logN = '', r = '', p = '', salt = '', key = ''] = match;
  const params = { logN: Number(logN), r: Number(r), p: Number(p) };
  const valid =
    inRange(params.logN, LIMITS.logN) && inRange(params.r, LIMITS.r) && inRange(params.p, LIMITS.p);
  const saltBytes = Buffer.from(salt, 'base64url');
  const keyBytes = Buffer.from(key, 'base64url');
  if (!valid || saltBytes.length < 8 || keyBytes.length < 16) return null;
  return { ...params, salt: saltBytes, key: keyBytes };
}

/** True when `value` looks like a hash this module can verify. */
export function isPasswordHash(value: string): boolean {
  return parseHash(value) !== null;
}

export async function hashPassword(password: string, params: ScryptParams = DEFAULT_SCRYPT) {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, params, KEY_LENGTH);
  return [
    'scrypt',
    params.logN,
    params.r,
    params.p,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join(':');
}

/** Checks a password against a stored hash in constant time. Malformed hashes never match. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseHash(stored);
  if (parsed === null) return false;
  const key = await derive(password, parsed.salt, parsed, parsed.key.length);
  return timingSafeEqual(key, parsed.key);
}
