import { describe, expect, it } from 'vitest';
import {
  ApiErrorBodySchema,
  EventPageSchema,
  ImportReportSchema,
  LoginRequestSchema,
  LoginTokenResponseSchema,
  SessionListSchema,
} from './api-schemas.js';

const session = {
  id: '0190f5a2-0000-7000-8000-000000000001',
  label: 'web',
  createdAt: '2026-10-23T09:00:00.000Z',
  lastUsedAt: '2026-10-23T09:00:00.000Z',
  expiresAt: '2026-11-22T09:00:00.000Z',
};

describe('API schemas', () => {
  it('accepts error bodies with known and future codes', () => {
    const known = { error: { code: 'not_found', message: 'Event not found' } };
    expect(ApiErrorBodySchema.parse(known)).toEqual(known);
    const future = { error: { code: 'teapot', message: 'Short and stout', fields: { a: ['b'] } } };
    expect(ApiErrorBodySchema.parse(future)).toEqual(future);
    expect(ApiErrorBodySchema.safeParse({ message: 'flat' }).success).toBe(false);
  });

  it('validates the login request', () => {
    expect(LoginRequestSchema.parse({ password: 'x', client: 'token', label: ' chrome ' })).toEqual(
      {
        password: 'x',
        client: 'token',
        label: 'chrome',
      },
    );
    expect(LoginRequestSchema.safeParse({ password: '', client: 'phone' }).success).toBe(false);
  });

  it('parses session responses and drops unknown fields', () => {
    expect(LoginTokenResponseSchema.parse({ token: 'A'.repeat(43), session, extra: 1 })).toEqual({
      token: 'A'.repeat(43),
      session,
    });
    expect(
      SessionListSchema.parse({ sessions: [{ ...session, current: true }] }).sessions,
    ).toHaveLength(1);
    expect(SessionListSchema.safeParse({ sessions: [session] }).success).toBe(false);
  });

  it('parses an event page and an import report', () => {
    expect(EventPageSchema.parse({ events: [], nextCursor: null })).toEqual({
      events: [],
      nextCursor: null,
    });
    expect(EventPageSchema.safeParse({ events: [], nextCursor: '' }).success).toBe(false);
    expect(
      ImportReportSchema.parse({ imported: 2, skipped: [{ index: 1, reason: 'x' }] }).imported,
    ).toBe(2);
    expect(ImportReportSchema.safeParse({ imported: -1, skipped: [] }).success).toBe(false);
  });
});
