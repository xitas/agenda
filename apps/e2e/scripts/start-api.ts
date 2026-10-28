// Starts the built API for one e2e run (Playwright's webServer runs this). It hashes the
// run's password with the API's own CLI, then runs dist/index.js with a temp database,
// development cookies (no Secure flag over http://localhost) and the preview server as
// the only allowed origin, so the CSRF Origin check accepts it.
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') throw new Error(`start-api: ${name} is not set`);
  return value;
}

const password = required('E2E_PASSWORD');
const dbFile = required('E2E_DB_FILE');
const port = required('E2E_API_PORT');
const origin = required('E2E_WEB_ORIGIN');
const apiDir = fileURLToPath(new URL('../../api/', import.meta.url));

// With piped input the CLI reads one line and prints AGENDA_PASSWORD_HASH=...
// One command string through the shell, so pnpm's .cmd shim also runs on Windows.
const hashed = spawnSync('pnpm -s hash-password', {
  cwd: apiDir,
  input: `${password}\n`,
  encoding: 'utf8',
  shell: true,
});
const hash = /AGENDA_PASSWORD_HASH=(\S+)/.exec(hashed.stdout)?.[1];
if (hash === undefined) {
  throw new Error(`start-api: hashing the password failed\n${hashed.stderr}`);
}

const api = spawn(process.execPath, ['dist/index.js'], {
  cwd: apiDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: port,
    // libSQL wants forward slashes, also on Windows.
    DATABASE_URL: `file:${dbFile.replaceAll('\\', '/')}`,
    CORS_ORIGINS: origin,
    AGENDA_PASSWORD_HASH: hash,
  },
});

// Stop the API with us, and stop with it.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    api.kill(signal);
  });
}
api.on('exit', (code) => {
  process.exit(code ?? 0);
});
