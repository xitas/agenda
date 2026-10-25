import { hashPassword, MIN_PASSWORD_LENGTH } from '../auth/password.js';

// Usage: pnpm -s --filter @agenda/api hash-password
// Prompts twice with hidden input and prints the line to put in apps/api/.env.
// With piped input (no terminal) it reads one line, e.g. for scripts and tests.

/** Reads one line from a terminal without echoing it. */
function readHidden(prompt: string): Promise<string> {
  const { stdin, stderr } = process;
  stderr.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          finish();
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          finish();
          reject(new Error('Cancelled'));
          return;
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else value += char;
      }
    };
    const finish = () => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stderr.write('\n');
    };
    stdin.on('data', onData);
  });
}

async function readPipedLine(): Promise<string> {
  let input = '';
  for await (const chunk of process.stdin) input += String(chunk);
  return input.split(/\r?\n/)[0] ?? '';
}

async function main(): Promise<void> {
  let password: string;
  if (process.stdin.isTTY) {
    password = await readHidden('Password: ');
    if ((await readHidden('Repeat password: ')) !== password) {
      throw new Error("The passwords don't match.");
    }
  } else {
    password = await readPipedLine();
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Use at least ${String(MIN_PASSWORD_LENGTH)} characters.`);
  }
  process.stdout.write(`AGENDA_PASSWORD_HASH=${await hashPassword(password)}\n`);
  process.stderr.write('Put this line in apps/api/.env (it is the hash, not the password).\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
