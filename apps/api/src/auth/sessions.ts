import { createHash, randomBytes } from 'node:crypto';
import { newId } from '@agenda/core';
import { and, asc, eq, gt, isNull } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { sessions } from '../db/schema.js';
import type { SessionRow } from '../db/schema.js';

/** Sessions slide: every use (at most once a minute) pushes the expiry this far ahead. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const TOUCH_INTERVAL_MS = 60 * 1000;

/** What clients see about a session; the token and its hash never leave the server. */
export interface Session {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

/** 32 random bytes; the token is the only secret, so it needs no other structure. */
function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * A fast hash is enough here, unlike for passwords: the token is 256 random bits, so
 * there is nothing to guess. Looking up by hash also means the attacker controls the
 * token but not the compared value, so lookup timing reveals nothing useful.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    label: row.label,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
  };
}

export function createSessionStore(db: Db, now: () => Date) {
  const iso = () => now().toISOString();
  // Read the clock once, so the expiry is exactly SESSION_TTL_MS after the stamp.
  const stampWithExpiry = () => {
    const at = now().getTime();
    return { at: new Date(at).toISOString(), expires: new Date(at + SESSION_TTL_MS).toISOString() };
  };
  const active = () => and(isNull(sessions.revokedAt), gt(sessions.expiresAt, iso()));

  return {
    /** Starts a session and returns the token, which is shown to the client only once. */
    async create(label: string): Promise<{ token: string; session: Session }> {
      const token = newToken();
      const { at, expires } = stampWithExpiry();
      const row: SessionRow = {
        id: newId(),
        tokenHash: hashToken(token),
        label,
        createdAt: at,
        lastUsedAt: at,
        expiresAt: expires,
        revokedAt: null,
      };
      await db.insert(sessions).values(row);
      return { token, session: toSession(row) };
    },

    /** The active (not revoked, not expired) session for a token, if any. */
    async findByToken(token: string): Promise<Session | undefined> {
      const [row] = await db
        .select()
        .from(sessions)
        .where(and(eq(sessions.tokenHash, hashToken(token)), active()));
      return row === undefined ? undefined : toSession(row);
    },

    /** Records use and slides the expiry, but writes at most once a minute per session. */
    async touch(session: Session): Promise<Session> {
      if (now().getTime() - Date.parse(session.lastUsedAt) < TOUCH_INTERVAL_MS) return session;
      const { at, expires } = stampWithExpiry();
      const touched = { ...session, lastUsedAt: at, expiresAt: expires };
      await db
        .update(sessions)
        .set({ lastUsedAt: touched.lastUsedAt, expiresAt: touched.expiresAt })
        .where(eq(sessions.id, session.id));
      return touched;
    },

    /** Revokes an active session; false if there was none with that id. */
    async revoke(id: string): Promise<boolean> {
      const revoked = await db
        .update(sessions)
        .set({ revokedAt: iso() })
        .where(and(eq(sessions.id, id), active()))
        .returning({ id: sessions.id });
      return revoked.length > 0;
    },

    async listActive(): Promise<Session[]> {
      const rows = await db
        .select()
        .from(sessions)
        .where(active())
        .orderBy(asc(sessions.createdAt));
      return rows.map(toSession);
    },
  };
}

export type SessionStore = ReturnType<typeof createSessionStore>;
