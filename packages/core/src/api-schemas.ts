import { z } from 'zod';
import { AgendaEventSchema, UtcInstantSchema } from './schemas.js';

/** Every `error.code` the API sends. apps/api imports this list, so both sides agree. */
export const API_ERROR_CODES = [
  'invalid_json',
  'invalid_query',
  'validation_failed',
  'unauthorized',
  'invalid_credentials',
  'csrf_rejected',
  'not_found',
  'conflict',
  'payload_too_large',
  'rate_limited',
  'internal',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/**
 * The standard error body. `code` is any string here: a newer server may add codes, and
 * an older client should still show the error rather than call the response invalid.
 */
export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string(),
    fields: z.record(z.string(), z.array(z.string())).optional(),
  }),
});

export const LoginRequestSchema = z.object({
  password: z.string().min(1).max(1024),
  /** "browser" gets the session cookie; "token" gets a bearer token in the body. */
  client: z.enum(['browser', 'token']),
  /** Shown in the session list, e.g. "web", "chrome", "android". */
  label: z.string().trim().min(1).max(50).optional(),
});

export const SessionSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  createdAt: UtcInstantSchema,
  lastUsedAt: UtcInstantSchema,
  expiresAt: UtcInstantSchema,
});

export const SessionResponseSchema = z.object({ session: SessionSchema });

export const LoginTokenResponseSchema = z.object({
  token: z.string().min(20),
  session: SessionSchema,
});

export const SessionListSchema = z.object({
  sessions: z.array(SessionSchema.extend({ current: z.boolean() })),
});

export const RevokeOthersResponseSchema = z.object({ revoked: z.int().min(0) });

export const EventPageSchema = z.object({
  events: z.array(AgendaEventSchema),
  nextCursor: z.string().min(1).nullable(),
});

export const EventListSchema = z.array(AgendaEventSchema);

export const ImportReportSchema = z.object({
  imported: z.int().min(0),
  skipped: z.array(z.object({ index: z.int(), reason: z.string() })),
});

export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;
export type LoginRequest = z.input<typeof LoginRequestSchema>;
export type LoginClient = LoginRequest['client'];
export type Session = z.infer<typeof SessionSchema>;
export type SessionWithCurrent = z.infer<typeof SessionListSchema>['sessions'][number];
export type EventPage = z.infer<typeof EventPageSchema>;
export type ImportReport = z.infer<typeof ImportReportSchema>;
