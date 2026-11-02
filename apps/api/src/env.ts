import { z } from 'zod';
import { isPasswordHash } from './auth/password.js';

const HASH_HELP =
  'Run `pnpm -s --filter @agenda/api hash-password` and put the line it prints in apps/api/.env.';

/** An exact origin such as https://agenda.example or http://localhost:5173. */
/**
 * scheme://host[:port], exactly. URL gives custom schemes such as tauri:// the origin
 * "null", so for those the origin is rebuilt from the scheme and host.
 */
function isOrigin(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  const origin = url.origin === 'null' ? `${url.protocol}//${url.host}` : url.origin;
  return origin === value;
}

const OriginSchema = z.string().refine(isOrigin, {
  message: 'Expected an origin like https://agenda.example (no path or trailing slash)',
});

const DbEnvSchema = z.object({
  DATABASE_URL: z.string().min(1).default('file:./data/agenda.db'),
});

const ServerEnvSchema = DbEnvSchema.extend({
  PORT: z.coerce.number().int().min(1).max(65535).default(4001),
  // Anything but "development" counts as production, so cookies are Secure by default.
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  AGENDA_PASSWORD_HASH: z
    .string()
    .refine(isPasswordHash, { message: `AGENDA_PASSWORD_HASH is not a valid hash. ${HASH_HELP}` }),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin !== ''),
    )
    .pipe(z.array(OriginSchema)),
});

export type DbEnv = z.infer<typeof DbEnvSchema>;
export type ServerEnv = z.infer<typeof ServerEnvSchema>;

type Source = Record<string, string | undefined>;

function parse<T extends z.ZodType>(schema: T, source: Source): z.output<T> {
  const result = schema.safeParse(source);
  if (!result.success) throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  return result.data;
}

/** Settings the database scripts need (migrate, seed). */
export function loadDbEnv(source: Source): DbEnv {
  return parse(DbEnvSchema, source);
}

/** Everything the server needs. Throws a readable error when the password hash is missing. */
export function loadServerEnv(source: Source): ServerEnv {
  if (source.AGENDA_PASSWORD_HASH === undefined || source.AGENDA_PASSWORD_HASH === '') {
    throw new Error(`AGENDA_PASSWORD_HASH is not set, so nobody could log in. ${HASH_HELP}`);
  }
  return parse(ServerEnvSchema, source);
}
