/// <reference types="node" />
// Copies the component stylesheets from src/ to dist/ after tsc (`pnpm build`).
import { copyFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('..', import.meta.url));
const src = fileURLToPath(new URL('../../src', import.meta.url));
for (const name of readdirSync(src)) {
  if (name.endsWith('.css')) copyFileSync(`${src}/${name}`, `${dist}/${name}`);
}
