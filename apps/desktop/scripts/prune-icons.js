// `tauri icon` also writes Android, iOS and Microsoft Store icons; the desktop app only
// ships the .ico/.icns/PNGs that tauri.conf.json lists, so the rest is removed.
import { readdirSync, rmSync } from 'node:fs';

const dir = new URL('../src-tauri/icons/', import.meta.url);
for (const name of readdirSync(dir)) {
  if (
    name === 'android' ||
    name === 'ios' ||
    /^Square\d+x\d+Logo\.png$|^StoreLogo\.png$/.test(name)
  ) {
    rmSync(new URL(name, dir), { recursive: true, force: true });
  }
}
