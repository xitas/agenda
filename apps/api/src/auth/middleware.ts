import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { ApiError } from '../errors.js';
import type { Session, SessionStore } from './sessions.js';

export type AuthMethod = 'cookie' | 'bearer';

/** Hono context variables set by requireAuth. */
export interface AuthEnv {
  Variables: { session: Session; authMethod: AuthMethod };
}

export interface CookieConfig {
  name: string;
  /** Secure cookies use the __Host- prefix: HTTPS only, no Domain, Path=/. */
  secure: boolean;
}

const BEARER = /^Bearer ([A-Za-z0-9_-]{20,200})$/;

// One message for every failure, so a response never reveals whether a token existed,
// expired or was revoked.
const unauthorized = () => new ApiError(401, 'unauthorized', 'Log in to continue');

/**
 * Accepts `Authorization: Bearer <token>` (extension, mobile, desktop, scripts) or the
 * session cookie (web). A bearer header that is present but malformed is rejected
 * rather than falling back to the cookie.
 */
export function requireAuth(store: SessionStore, cookie: CookieConfig) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const header = c.req.header('Authorization');
    let token: string | undefined;
    let method: AuthMethod;
    if (header !== undefined) {
      token = BEARER.exec(header)?.[1];
      if (token === undefined) throw unauthorized();
      method = 'bearer';
    } else {
      token = getCookie(c, cookie.name, cookie.secure ? 'host' : undefined);
      method = 'cookie';
    }
    if (token === undefined) throw unauthorized();

    const session = await store.findByToken(token);
    if (session === undefined) throw unauthorized();

    c.set('session', await store.touch(session));
    c.set('authMethod', method);
    await next();
  });
}
