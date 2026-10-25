import {
  AgendaEventSchema,
  checkEventTiming,
  EventCreateSchema,
  EventPatchSchema,
  ImportFormatError,
  newId,
  parseImport,
  TimeZoneSchema,
  toICalendar,
} from '@agenda/core';
import type { AgendaEvent, SkippedRow } from '@agenda/core';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { ApiError, invalidQuery, notFound, validationFailed } from '../errors.js';
import type { EventRepo, ListCursor } from './repo.js';

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

const InstantParam = z.iso.datetime({ offset: true });

const ListQuerySchema = z
  .object({
    from: InstantParam.optional(),
    to: InstantParam.optional(),
    tz: TimeZoneSchema.optional(),
    q: z.string().trim().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    cursor: z.string().optional(),
  })
  .superRefine((query, ctx) => {
    const hasRange = query.from !== undefined || query.to !== undefined;
    if (!hasRange) return;
    if (query.from === undefined || query.to === undefined) {
      ctx.addIssue({ code: 'custom', path: ['from'], message: 'Give both from and to' });
    } else if (Date.parse(query.from) >= Date.parse(query.to)) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'to must be after from' });
    }
    if (query.tz === undefined) {
      ctx.addIssue({ code: 'custom', path: ['tz'], message: 'tz is required with a range' });
    }
  });

const ImportQuerySchema = z.object({ tz: TimeZoneSchema });

const CursorSchema = z.object({ start: z.string(), id: z.string() });

function encodeCursor(cursor: ListCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(value: string): ListCursor {
  try {
    return CursorSchema.parse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));
  } catch {
    throw invalidQuery([{ path: ['cursor'], message: 'Invalid cursor' }]);
  }
}

async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json<unknown>();
  } catch {
    throw new ApiError(400, 'invalid_json', 'The request body is not valid JSON');
  }
}

function parseQuery<T extends z.ZodType>(schema: T, c: Context): z.output<T> {
  const result = schema.safeParse(c.req.query());
  if (!result.success) throw invalidQuery(result.error.issues);
  return result.data;
}

export interface EventRoutesOptions {
  repo: EventRepo;
  now: () => Date;
}

export function eventRoutes({ repo, now }: EventRoutesOptions) {
  const routes = new Hono();
  const stamp = () => now().toISOString();

  async function getOr404(id: string): Promise<AgendaEvent> {
    const event = await repo.get(id);
    if (event === undefined) throw notFound('Event');
    return event;
  }

  // Static paths first, so "export.json" is never read as an :id.
  routes.get('/export.json', async (c) => {
    c.header('Content-Disposition', 'attachment; filename="agenda-export.json"');
    return c.json(await repo.all());
  });

  routes.get('/export.ics', async (c) => {
    c.header('Content-Type', 'text/calendar; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="agenda.ics"');
    return c.body(toICalendar(await repo.all(), { now: now() }));
  });

  routes.post(
    '/import',
    bodyLimit({
      maxSize: IMPORT_MAX_BYTES,
      onError: () => {
        throw new ApiError(413, 'payload_too_large', 'Import files can be at most 5 MB');
      },
    }),
    async (c) => {
      const { tz } = parseQuery(ImportQuerySchema, c);
      const body = await readJson(c);

      let parsed;
      try {
        parsed = parseImport(body, { timezone: tz, now: now() });
      } catch (error) {
        if (error instanceof ImportFormatError) {
          throw new ApiError(422, 'validation_failed', error.message);
        }
        throw error;
      }

      // Re-importing the same file must not duplicate or overwrite anything.
      const existing = await repo.existingIds(parsed.events.map((event) => event.id));
      const skipped: SkippedRow[] = [...parsed.skipped];
      const fresh: AgendaEvent[] = [];
      parsed.events.forEach((event, i) => {
        if (existing.has(event.id)) {
          skipped.push({ index: parsed.indexes[i] ?? -1, reason: 'Already exists' });
        } else {
          fresh.push(event);
        }
      });
      await repo.insertMany(fresh);

      skipped.sort((a, b) => a.index - b.index);
      return c.json({ imported: fresh.length, skipped });
    },
  );

  routes.get('/', async (c) => {
    const query = parseQuery(ListQuerySchema, c);
    const page = await repo.list({
      limit: query.limit,
      ...(query.from !== undefined && query.to !== undefined && query.tz !== undefined
        ? { range: { from: new Date(query.from), to: new Date(query.to), timezone: query.tz } }
        : {}),
      ...(query.q === undefined ? {} : { q: query.q }),
      ...(query.cursor === undefined ? {} : { after: decodeCursor(query.cursor) }),
    });
    return c.json({
      events: page.events,
      nextCursor: page.next === null ? null : encodeCursor(page.next),
    });
  });

  routes.post('/', async (c) => {
    const result = EventCreateSchema.safeParse(await readJson(c));
    if (!result.success) throw validationFailed(result.error.issues);

    const { id = newId(), ...fields } = result.data;
    if ((await repo.get(id, { includeDeleted: true })) !== undefined) {
      throw new ApiError(409, 'conflict', `An event with id ${id} already exists`);
    }
    const time = stamp();
    const event = await repo.insert(
      AgendaEventSchema.parse({ ...fields, id, createdAt: time, updatedAt: time, deletedAt: null }),
    );
    c.header('Location', `/api/v1/events/${event.id}`);
    return c.json(event, 201);
  });

  routes.get('/:id', async (c) => c.json(await getOr404(c.req.param('id'))));

  routes.patch('/:id', async (c) => {
    const stored = await getOr404(c.req.param('id'));
    const patch = EventPatchSchema.safeParse(await readJson(c));
    if (!patch.success) throw validationFailed(patch.error.issues);

    const merged = { ...stored, ...patch.data, updatedAt: stamp() };
    const timing = checkEventTiming(merged);
    if (timing.length > 0) throw validationFailed(timing);

    const event = AgendaEventSchema.safeParse(merged);
    if (!event.success) throw validationFailed(event.error.issues);
    return c.json(await repo.update(event.data));
  });

  routes.delete('/:id', async (c) => {
    const stored = await getOr404(c.req.param('id'));
    const time = stamp();
    // Soft delete: the row stays as a tombstone so sync can tell other devices.
    await repo.update({ ...stored, deletedAt: time, updatedAt: time });
    return c.body(null, 204);
  });

  return routes;
}
