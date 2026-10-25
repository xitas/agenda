import type { Context } from 'hono';
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
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection for anything the browser authenticates by itself (the cookie). The
 * browser sets Origin on every cross-origin request and on same-origin POST/PATCH/DELETE,
 * and pages can't forge it, so a write must name one of our own web origins. A missing
 * Origin is refused too. SameSite=Lax already blocks most cross-site writes; this also
 * covers same-site subdomains, older browsers and SameSite exceptions.
 */
export function requireAllowedOrigin(c: Context, allowedOrigins: readonly string[]): void {
  const origin = c.req.header('Origin');
  if (origin === undefined || !allowedOrigins.includes(origin)) {
    throw new ApiError(403, 'csrf_rejected', 'This request must come from an allowed origin');
  }
}

// One message for every failure, so a response never reveals whether a token existed,
// expired or was revoked.
const unauthorized = () => new ApiError(401, 'unauthorized', 'Log in to continue');

/**
 * Accepts `Authorization: Bearer <token>` (extension, mobile, desktop, scripts) or the
 * session cookie (web). A bearer header that is present but malformed is rejected
 * rather than falling back to the cookie. Cookie-authenticated writes must also pass
 * the Origin check; bearer tokens are never sent automatically, so they don't need it.
 */
export function requireAuth(
  store: SessionStore,
  cookie: CookieConfig,
  allowedOrigins: readonly string[],
) {
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
    if (method === 'cookie' && !SAFE_METHODS.has(c.req.method)) {
      requireAllowedOrigin(c, allowedOrigins);
    }

    const session = await store.findByToken(token);
    if (session === undefined) throw unauthorized();

    c.set('session', await store.touch(session));
    c.set('authMethod', method);
    await next();
  });
}
