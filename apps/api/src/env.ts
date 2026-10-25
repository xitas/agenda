import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1).default('file:./data/agenda.db'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4001),
});

export type Env = z.infer<typeof EnvSchema>;

/** Reads the API's settings from environment variables, with dev defaults. */
export function loadEnv(source: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
