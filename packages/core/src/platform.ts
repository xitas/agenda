/**
 * The platform adapter (ARCHITECTURE.md §7): what differs between the web app, the
 * desktop app (Tauri), the extension and mobile. Shared code only sees this interface;
 * each app passes its own implementation. It grows as features need it (notifications
 * and reminders come with Phase 4).
 */

/** A text file to give the user, such as an export. */
export interface SaveFileRequest {
  /** Suggested file name, e.g. "agenda-2026-10-29.json". */
  name: string;
  /** e.g. "application/json" or "text/calendar". */
  mimeType: string;
  contents: string;
}

export interface Platform {
  /**
   * Hands a file to the user: a download on the web, a native save dialog on desktop.
   * Resolves to false if the user cancelled (a dialog can be cancelled; a download can't).
   */
  saveFile: (file: SaveFileRequest) => Promise<boolean>;
}
