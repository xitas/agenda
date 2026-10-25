import type { TimingIssue } from '@agenda/core';
import type { z } from 'zod';

export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 500;

export type ErrorCode =
  | 'invalid_json'
  | 'invalid_query'
  | 'validation_failed'
  | 'unauthorized'
  | 'invalid_credentials'
  | 'csrf_rejected'
  | 'not_found'
  | 'conflict'
  | 'payload_too_large'
  | 'rate_limited'
  | 'internal';

/** Field path (dot-separated) → messages, e.g. `{ "title": ["Too small: …"] }`. */
export type FieldErrors = Record<string, string[]>;

export interface ErrorBody {
  error: { code: ErrorCode; message: string; fields?: FieldErrors };
}

/** Thrown anywhere in a request; `app.onError` turns it into the standard error body. */
export class ApiError extends Error {
  constructor(
    readonly status: ErrorStatus,
    readonly code: ErrorCode,
    message: string,
    readonly fields?: FieldErrors,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  toBody(): ErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields === undefined ? {} : { fields: this.fields }),
      },
    };
  }
}

type Issue = Pick<z.core.$ZodIssue, 'path' | 'message'> | TimingIssue;

export function fieldErrors(issues: readonly Issue[]): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_';
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

/** 422: well-formed input that breaks the event rules. */
export function validationFailed(issues: readonly Issue[]): ApiError {
  return new ApiError(422, 'validation_failed', 'The event is invalid', fieldErrors(issues));
}

/** 400: query parameters that can't be used. */
export function invalidQuery(issues: readonly Issue[]): ApiError {
  return new ApiError(
    400,
    'invalid_query',
    'The query parameters are invalid',
    fieldErrors(issues),
  );
}

export function notFound(what: string): ApiError {
  return new ApiError(404, 'not_found', `${what} not found`);
}
