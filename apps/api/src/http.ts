import type { Context } from 'hono';
import { ApiError } from './errors.js';

/** Parses the JSON body, turning a syntax error into a 400 with the standard shape. */
export async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json<unknown>();
  } catch {
    throw new ApiError(400, 'invalid_json', 'The request body is not valid JSON');
  }
}
