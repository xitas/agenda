import type { z } from 'zod';
import {
  ApiErrorBodySchema,
  EventListSchema,
  EventPageSchema,
  ImportReportSchema,
  LoginTokenResponseSchema,
  SessionListSchema,
  SessionResponseSchema,
} from './api-schemas.js';
import type { EventPage, ImportReport, Session, SessionWithCurrent } from './api-schemas.js';
import { abortAfter } from './http.js';
import type { AbortSignalLike, FetchLike, RequestInitLike, ResponseLike } from './http.js';
import { AgendaEventSchema } from './schemas.js';
import type { AgendaEvent, EventCreateInput, EventPatch } from './types.js';

export const API_PREFIX = '/api/v1';
export const DEFAULT_TIMEOUT_MS = 15_000;
const LIST_ALL_PAGE_SIZE = 200;
const LIST_ALL_MAX_PAGES = 1000;

/** An error response from the API, or a response the client couldn't accept. */
export class ApiError extends Error {
  override name = 'ApiError';

  constructor(
    readonly status: number,
    /**
     * One of the API's codes (see API_ERROR_CODES), or "invalid_response" when the
     * response didn't match what this client expects (wrong shape, not JSON, ...).
     */
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

export type NetworkErrorKind = 'timeout' | 'aborted' | 'network';

/** The request never got a response: no connection, a timeout, or the caller aborted. */
export class NetworkError extends Error {
  override name = 'NetworkError';

  constructor(
    readonly kind: NetworkErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

type MaybePromise<T> = T | Promise<T>;

export type AuthStrategy =
  | {
      /** The browser holds the session cookie; requests use credentials: 'include'. */
      kind: 'cookie';
      onUnauthorized?: (error: ApiError) => void;
    }
  | {
      /** Desktop, extension, mobile: the app stores the token and hands it over here. */
      kind: 'token';
      getToken: () => MaybePromise<string | null | undefined>;
      /** Called when the session is gone (401 unauthorized), e.g. to show the login screen. */
      onUnauthorized?: (error: ApiError) => void;
    };

export interface ApiClientOptions<A extends AuthStrategy> {
  /** The API origin, e.g. "https://api.agenda.example"; the client adds /api/v1. */
  baseUrl: string;
  auth: A;
  /** Defaults to the global fetch. Inject one for tests, Tauri plugins or other runtimes. */
  fetch?: FetchLike;
  timeoutMs?: number;
}

export interface CallOptions {
  signal?: AbortSignalLike;
  timeoutMs?: number;
}

export interface ListParams {
  /** With `to` and `tz`: the half-open range [from, to). */
  from?: Date | string;
  to?: Date | string;
  tz?: string;
  q?: string;
  limit?: number;
  cursor?: string;
}

export type LoginResult<A extends AuthStrategy> = A extends { kind: 'token' }
  ? { token: string; session: Session }
  : { session: Session };

type Query = Record<string, string | number | undefined>;

interface RequestSpec {
  query?: Query;
  body?: unknown;
  call?: CallOptions;
  accept?: string;
}

function encodeQuery(query: Query = {}): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length === 0 ? '' : `?${parts.join('&')}`;
}

const instant = (value: Date | string | undefined) =>
  value instanceof Date ? value.toISOString() : value;

function invalid(status: number, message: string, cause?: unknown): ApiError {
  return new ApiError(status, 'invalid_response', message, undefined, { cause });
}

function globalFetch(): FetchLike {
  const candidate = (globalThis as { fetch?: FetchLike }).fetch;
  if (candidate === undefined) {
    throw new Error('No global fetch here; pass `fetch` to createApiClient');
  }
  // Call it unbound-safe: window.fetch throws "Illegal invocation" without its `this`.
  return (url, init) => candidate.call(globalThis, url, init);
}

/**
 * A typed client for every /api/v1 route. Every response is parsed with core's schemas,
 * so a mismatch is an ApiError("invalid_response") at the boundary, not a crash later.
 */
export function createApiClient<A extends AuthStrategy>(options: ApiClientOptions<A>) {
  const { auth } = options;
  const base = options.baseUrl.replace(/\/+$/, '') + API_PREFIX;
  const fetchImpl = options.fetch ?? globalFetch();
  const defaultTimeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  /** Sends one request and returns the response with its body, or throws a typed error. */
  async function send(method: string, path: string, spec: RequestSpec = {}) {
    const headers: Record<string, string> = { Accept: spec.accept ?? 'application/json' };
    let body: string | undefined;
    if (spec.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(spec.body);
    }
    if (auth.kind === 'token') {
      const token = await auth.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const timeoutMs = spec.call?.timeoutMs ?? defaultTimeout;
    const abort = abortAfter(timeoutMs, spec.call?.signal);
    if (abort.reason() === 'aborted') {
      // Aborted before we got this far (e.g. while getToken ran): don't send anything.
      abort.done();
      throw new NetworkError('aborted', 'The request was aborted');
    }
    const init: RequestInitLike = {
      method,
      headers,
      credentials: auth.kind === 'cookie' ? 'include' : 'omit',
      signal: abort.signal,
      ...(body === undefined ? {} : { body }),
    };

    let response: ResponseLike;
    let text: string;
    try {
      response = await fetchImpl(`${base}${path}${encodeQuery(spec.query)}`, { ...init });
      text = await response.text();
    } catch (error) {
      const reason = abort.reason();
      if (reason === 'timeout') {
        throw new NetworkError('timeout', `No response within ${String(timeoutMs)} ms`, {
          cause: error,
        });
      }
      if (reason === 'aborted')
        throw new NetworkError('aborted', 'The request was aborted', { cause: error });
      throw new NetworkError('network', "Couldn't reach the server", { cause: error });
    } finally {
      abort.done();
    }

    if (response.status < 200 || response.status > 299) throw toApiError(response.status, text);
    return { response, text };
  }

  function toApiError(status: number, text: string): ApiError {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      return invalid(status, `Unexpected ${String(status)} response that isn't JSON`, error);
    }
    const body = ApiErrorBodySchema.safeParse(parsed);
    if (!body.success) {
      return invalid(status, `Unexpected ${String(status)} response body`, body.error);
    }
    const { code, message, fields } = body.data.error;
    const error = new ApiError(status, code, message, fields);
    if (status === 401 && code === 'unauthorized') auth.onUnauthorized?.(error);
    return error;
  }

  async function json<S extends z.ZodType>(
    schema: S,
    method: string,
    path: string,
    spec?: RequestSpec,
  ): Promise<z.output<S>> {
    const { response, text } = await send(method, path, spec);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw invalid(response.status, 'The response is not JSON', error);
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw invalid(response.status, "The response doesn't match the expected shape", result.error);
    }
    return result.data;
  }

  async function empty(method: string, path: string, spec?: RequestSpec): Promise<void> {
    const { response, text } = await send(method, path, spec);
    if (response.status !== 204 || text !== '') {
      throw invalid(response.status, 'Expected an empty 204 response');
    }
  }

  const id = (value: string) => encodeURIComponent(value);

  const events = {
    list(params: ListParams = {}, call?: CallOptions): Promise<EventPage> {
      const query = {
        from: instant(params.from),
        to: instant(params.to),
        tz: params.tz,
        q: params.q,
        limit: params.limit,
        cursor: params.cursor,
      };
      return json(EventPageSchema, 'GET', '/events', { query, call });
    },

    /** Every matching event, following nextCursor page by page. */
    async listAll(
      params: Omit<ListParams, 'cursor'> = {},
      call?: CallOptions,
    ): Promise<AgendaEvent[]> {
      const all: AgendaEvent[] = [];
      const seen = new Set<string>();
      let cursor: string | undefined;
      for (let page = 0; page < LIST_ALL_MAX_PAGES; page++) {
        const result = await events.list(
          { limit: LIST_ALL_PAGE_SIZE, ...params, ...(cursor === undefined ? {} : { cursor }) },
          call,
        );
        all.push(...result.events);
        if (result.nextCursor === null) return all;
        if (seen.has(result.nextCursor)) throw invalid(200, 'The API repeated a page cursor');
        seen.add(result.nextCursor);
        cursor = result.nextCursor;
      }
      throw invalid(200, `Stopped after ${String(LIST_ALL_MAX_PAGES)} pages`);
    },

    get: (eventId: string, call?: CallOptions): Promise<AgendaEvent> =>
      json(AgendaEventSchema, 'GET', `/events/${id(eventId)}`, { call }),

    create: (input: EventCreateInput, call?: CallOptions): Promise<AgendaEvent> =>
      json(AgendaEventSchema, 'POST', '/events', { body: input, call }),

    update: (eventId: string, patch: EventPatch, call?: CallOptions): Promise<AgendaEvent> =>
      json(AgendaEventSchema, 'PATCH', `/events/${id(eventId)}`, {
        body: patch,
        call,
      }),

    /** Soft delete. */
    remove: (eventId: string, call?: CallOptions): Promise<void> =>
      empty('DELETE', `/events/${id(eventId)}`, { call }),

    /** Imports a v0 and/or v1 export; `tz` is the zone the v0 app ran in. */
    importEvents: (
      data: unknown,
      { tz }: { tz: string },
      call?: CallOptions,
    ): Promise<ImportReport> =>
      json(ImportReportSchema, 'POST', '/events/import', {
        query: { tz },
        body: data,
        call,
      }),

    exportJson: (call?: CallOptions): Promise<AgendaEvent[]> =>
      json(EventListSchema, 'GET', '/events/export.json', { call }),

    async exportIcs(call?: CallOptions): Promise<string> {
      const { response, text } = await send('GET', '/events/export.ics', {
        accept: 'text/calendar',
        call,
      });
      const type = response.headers.get('Content-Type') ?? '';
      if (!type.startsWith('text/calendar') || !text.startsWith('BEGIN:VCALENDAR')) {
        throw invalid(response.status, 'Expected an iCalendar file');
      }
      return text;
    },
  };

  const authApi = {
    /** Cookie clients log in as "browser" (sets the cookie); token clients get a token. */
    async login(
      password: string,
      { label, ...call }: CallOptions & { label?: string } = {},
    ): Promise<LoginResult<A>> {
      const body = {
        password,
        client: auth.kind === 'cookie' ? 'browser' : 'token',
        ...(label === undefined ? {} : { label }),
      };
      const schema = auth.kind === 'token' ? LoginTokenResponseSchema : SessionResponseSchema;
      // The schema matches the strategy, which TypeScript can't follow through `A`.
      return (await json(schema, 'POST', '/auth/login', { body, call })) as LoginResult<A>;
    },

    logout: (call?: CallOptions): Promise<void> => empty('POST', '/auth/logout', { call }),

    async me(call?: CallOptions): Promise<Session> {
      return (await json(SessionResponseSchema, 'GET', '/auth/me', { call })).session;
    },

    async sessions(call?: CallOptions): Promise<SessionWithCurrent[]> {
      return (await json(SessionListSchema, 'GET', '/auth/sessions', { call })).sessions;
    },

    revokeSession: (sessionId: string, call?: CallOptions): Promise<void> =>
      empty('DELETE', `/auth/sessions/${id(sessionId)}`, { call }),
  };

  return { auth: authApi, events };
}

export type ApiClient<A extends AuthStrategy = AuthStrategy> = ReturnType<
  typeof createApiClient<A>
>;
