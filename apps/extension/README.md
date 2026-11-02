# @agenda/extension

Agenda for Chrome: a Manifest V3 extension built with [WXT](https://wxt.dev) and React. It reuses `packages/core` (the API client in token mode, the QuickAdd parser, dates, the badge and reminder rules), `packages/ui` (QuickAddField, EventCard, the "Can't reach" card) and `packages/tokens`.

- **Popup** (360×520): the date, QuickAdd with its live preview, today's events, settings, and "Open full Agenda →".
- **Side panel:** this week as a list, one section per day.
- **Add to Agenda:** select text on any page, right-click, **Add to Agenda**. A small window shows what would be created; nothing is saved until you press **Add**.
- **Toolbar badge:** today's timed events that haven't ended yet.
- **Reminders** as Chrome notifications, off by default (Settings → Show reminders in Chrome), so they don't show twice while the desktop app runs.

## Try it

```sh
pnpm dev                                     # the API on :4001 (and the web app on :5173)
pnpm --filter @agenda/extension dev          # opens Chrome with the extension, hot reload
```

Or load the built extension into your own Chrome:

1. `pnpm build` (or download `agenda-chrome-extension` from a CI run and unzip it).
2. Open `chrome://extensions`, turn on **Developer mode** (top right).
3. **Load unpacked** → choose `apps/extension/.output/chrome-mv3`.
4. Pin Agenda from the puzzle-piece menu so the badge is visible, click it, and log in with the API password. The session shows up as "Chrome extension" under Settings → Devices in the web app.

After `pnpm build` again, press the reload arrow on the extension's card in `chrome://extensions`. `pnpm --filter @agenda/extension zip` writes `.output/agenda-chrome-<version>.zip`, the file the Chrome Web Store takes (publishing is not set up; see docs/PLAN.md).

The extension talks to `http://localhost:4001` until you change the **Server URL** in its settings; the API needs no change for it (see Permissions).

## How it works

### The service worker can stop at any moment

An MV3 extension's background is a **service worker**, not a page that stays open. Chrome starts it for an event (an alarm, a message, a menu click, the browser starting) and stops it after about 30 seconds with nothing to do; you can stop it yourself in `chrome://serviceworker-internals`. Anything kept in a variable is gone when it stops. So:

- everything lives in `chrome.storage.local`: the token, settings, the events fetched last, the reminder schedule and the keys of reminders already shown (`src/storage.ts`);
- every handler in `src/background/worker.ts` reads what it needs, does its work, and writes back. A test throws the worker module away mid-way and checks a fresh one carries on from storage alone;
- listeners are registered synchronously at the top of `entrypoints/background.ts`, on every start: Chrome delivers the event that woke the worker only to listeners that exist by the time the script has run;
- timing uses `chrome.alarms`, which Chrome keeps while the worker sleeps: a 15-minute refresh, one at the next moment the badge changes (an event ending, or midnight), and one at the next reminder. Alarms can be dropped when Chrome restarts, so `onStartup` and `onInstalled` set them up again.

The badge and reminders come from core (`badgeCount`, `reminderSchedule`, `dueReminders`), the same rules the desktop app uses: a reminder has a key (event, offset, start), shown keys are stored, a moved event gets new keys, and one more than 5 minutes late is skipped.

### Permissions

The manifest is generated from `wxt.config.ts`, where each permission has its reason next to it:

| Permission                                 | Why                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `storage`                                  | The token, settings, cached events and shown reminders                           |
| `alarms`                                   | Wakes the worker to refresh every 15 minutes and at badge and reminder times     |
| `contextMenus`                             | "Add to Agenda" on selected text                                                 |
| `sidePanel`                                | The week in Chrome's side panel                                                  |
| `notifications` (optional)                 | Asked for only when you turn on "Show reminders in Chrome"                       |
| host `http://localhost/*`                  | The default server, the API on this PC (Chrome's host patterns cover every port) |
| optional hosts `http://*/*`, `https://*/*` | Nothing is granted at install; saving a new Server URL asks for that one origin  |

There is no `tabs`, `scripting`, `activeTab`, `<all_urls>` and **no content script**: the menu click already carries the selected text (`info.selectionText`), so the extension never runs code inside the pages you visit. The extension pages' CSP is `script-src 'self'; object-src 'none'; base-uri 'none'`.

**Host permissions instead of CORS.** A normal web page may only read a response from another origin if the server allows it (CORS). Extension pages and the service worker are different: they may call any origin they hold a **host permission** for, and Chrome skips CORS for those calls. So the API needs no `CORS_ORIGINS` entry for the extension. It logs in with `client: 'token'` and sends `Authorization: Bearer`, which skips the API's CSRF check (a token is never attached by the browser on its own). The e2e test runs this against the real API in Chromium.

Optional permissions can only be requested from a user gesture: the Settings **Save** click (a new server) and the reminders checkbox ask Chrome first, and Chrome shows its prompt. Changing the server gives back the old server's permission.

### Extension pages are not web pages

The popup, side panel and confirm window are HTML pages served from `chrome-extension://<id>/`, packaged with the extension:

- they can call `chrome.*` APIs (within the manifest's permissions); a web page can't;
- their origin is the extension's, so web pages can't read their storage, and `chrome.storage.local` is shared by them and the worker only;
- the CSP forbids inline and remote scripts, so everything is bundled at build time;
- the popup closes as soon as it loses focus, and its page is created fresh every time it opens: state that must outlive it goes to storage (or, like a new event, to the server);
- `window.close()` and `chrome.windows.create` work on extension windows, which is how the confirm window opens and closes.

## Code map

- `wxt.config.ts`: the manifest and its permissions.
- `src/entrypoints/`: `background.ts` (registers listeners), `popup/`, `sidepanel/`, `confirm/` (each an HTML page and a `main.tsx`).
- `src/background/worker.ts`: refresh, badge, reminders, the menu.
- `src/platform.ts`: `chromePlatform`, the Platform adapter (token in storage, settings, permissions, messages to the worker).
- `src/ui/`: the React pages, `SessionGate` (permission, login, "Can't reach"), `SettingsView`.
- Tests use WXT's in-memory fake browser (`wxt/testing`) plus `src/test-utils/chrome.ts` for the APIs it lacks, and `src/test-utils/server.ts`, a small fake API behind `fetch`.

## Dependencies

| Package                 | Why                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `wxt`                   | Builds the extension with Vite: manifest, entrypoints, hot reload, zip, test fake                |
| `@wxt-dev/module-react` | React in WXT's pages                                                                             |
| `@wxt-dev/auto-icons`   | The 16–128 px icons from `apps/web/public/icon.svg` at build time (sharp is already in the repo) |
| `web-ext`               | Lets `wxt dev` open Chrome with the extension loaded                                             |
