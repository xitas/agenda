import { rm } from 'node:fs/promises';

/** A SQLite database and the side files it may leave next to it. */
export const dbFiles = (file: string) =>
  ['', '-wal', '-shm', '-journal'].map((suffix) => `${file}${suffix}`);

/** Deletes a file, unless another process has it open (EBUSY or EPERM on Windows). */
export async function removeIfUnlocked(path: string): Promise<void> {
  try {
    await rm(path, { force: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'EBUSY' && code !== 'EPERM') throw error;
  }
}
