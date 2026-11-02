# Agenda: Architecture

## 1. Big picture

```
                 ┌──────────────────────── packages/ ────────────────────────┐
                 │  core  (types, zod schemas, API client, date + parsing)    │
                 │  ui    (React DOM components, used by web/desktop/ext)    │
                 │  tokens(design tokens: colors, spacing, type → CSS + TS)  │
                 └───────────────▲─────────▲──────────▲──────────▲──────────┘
                                 │         │          │          │
   apps/web (Vite+React) ────────┘         │          │          │
   apps/desktop (Tauri → loads web build) ─┘          │          │
   apps/extension (WXT, React popup/sidepanel) ───────┘          │
   apps/mobile (Expo / React Native, uses core + tokens only) ───┘
                                 │
                        HTTPS (REST + JSON)
                                 ▼
                apps/api (Hono + Drizzle) ──► SQLite / libSQL (Turso)
```

**Principle:** business rules live in `packages/core` and are written once. Each app is a thin shell that handles platform-specific UI and native capabilities.

## 2. Repository layout

```
agenda/
├─ apps/
│  ├─ api/          Hono server, Drizzle schema + migrations, auth
│  ├─ web/          Vite + React + TS, PWA
│  ├─ desktop/      Tauri 2: src-tauri/ (Rust core, capabilities, icons) around apps/web
│  ├─ extension/    WXT (MV3): popup, sidepanel, background service worker
│  ├─ mobile/       Expo + Expo Router
│  └─ e2e/          Playwright smoke test against the built api + web
├─ packages/
│  ├─ core/         schemas.ts, types.ts, ids.ts, dates.ts, agenda.ts, time-grid.ts, month.ts,
│  │                event-form.ts, import.ts, ics.ts, quick-add.ts, api-schemas.ts,
│  │                api-client.ts, http.ts, platform.ts, reminders.ts, tray.ts,
│  │                shortcut.ts, server-url.ts
│  ├─ ui/           React DOM components (no app logic)
│  ├─ tokens/       tokens.ts → generates tokens.css (CSS vars)
│  └─ config/       shared tsconfig, eslint, prettier, vitest
├─ docs/            PLAN, ARCHITECTURE, DESIGN, PROMPTS
├─ .github/         CI workflow, PR template
├─ CLAUDE.md
├─ .nvmrc           Node version used locally and in CI
├─ pnpm-workspace.yaml
└─ turbo.json
```

## 3. Tech choices (and why)

| Concern       | Choice                                                                      | Why / alternative                                                                         |
| ------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Language      | TypeScript everywhere (+ a little Rust in Tauri)                            | One type system shared across 5 apps                                                      |
| Monorepo      | pnpm workspaces + Turborepo                                                 | Fast, simple caching; Nx is the heavier alternative                                       |
| Toolchain     | Node 24 (`.nvmrc`), pnpm 12 via Corepack (`packageManager`), TypeScript 6.0 | TS stays below 6.1 until typescript-eslint supports newer versions                        |
| Web build     | Vite                                                                        | CRA is deprecated                                                                         |
| Routing (web) | React Router (data router: `createBrowserRouter`)                           | Chosen in Phase 2; one route table in `router.tsx`, a memory router in tests              |
| Server state  | TanStack Query                                                              | Caching, optimistic updates, retries. Same library in mobile                              |
| Validation    | Zod                                                                         | Same schema validates on client and server                                                |
| Dates         | date-fns (+ `@date-fns/tz`)                                                 | moment is in maintenance mode                                                             |
| NL quick add  | chrono-node                                                                 | "tomorrow 4pm" → Date                                                                     |
| API framework | Hono                                                                        | Tiny, typed, runs on Node, Bun, or Cloudflare. Express is OK if you prefer familiarity    |
| DB / ORM      | SQLite (libSQL) + Drizzle                                                   | Same SQLite you know, plus typed queries and real migrations                              |
| Desktop       | Tauri 2                                                                     | Small installers and native APIs. **Alternative:** Electron, if you'd rather stay 100% JS |
| Extension     | WXT                                                                         | Vite-based MV3 framework with hot reload; handles manifest generation                     |
| Mobile        | Expo (SDK latest) + Expo Router                                             | Fastest path to a real native app; EAS for builds                                         |
| Tests         | Vitest, Testing Library, Playwright (web e2e)                               | Same runner in every package                                                              |
| CI/CD         | GitHub Actions                                                              | Lint, typecheck, test on PR; deploy on `master`                                           |

## 4. Data model

```ts
// packages/core/src/schemas.ts (AgendaEventSchema; type AgendaEvent in types.ts)
AgendaEvent {
  id: string            // uuid v7 (sortable), generated on the client so offline creates work
  title: string         // 1..200 chars
  notes: string         // markdown-lite, may be ''
  start: string         // timed: ISO 8601 UTC instant; all-day: plain date YYYY-MM-DD
  end: string | null    // same format as start, after start; all-day end is exclusive (iCal)
  allDay: boolean       // null end = point-in-time (timed) or a single day (all-day)
  timezone: string      // IANA tz at creation, e.g. 'Asia/Karachi'
  location: string | null
  color: EventColor     // 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'pink' | 'teal'
  reminders: number[]   // whole minutes before start, unique, e.g. [10, 60]
  rrule: string | null  // v2
  createdAt: string
  updatedAt: string     // drives sync (last-write-wins)
  deletedAt: string | null  // soft delete (tombstone for sync)
}
```

The type is called `AgendaEvent`, not `Event`, so it doesn't shadow the DOM's global `Event` type in web code. `EventCreate` (client may send `id`; other fields have defaults) and `EventPatch` (any subset, at least one field) are derived from the same fields. Unknown keys are dropped.

**All-day events** store plain dates rather than instants, so a birthday stays on the same day wherever it is viewed. Timed events store UTC instants; days, weeks and months are computed in the viewer's time zone (`rangeForView` in `dates.ts`, weeks start Monday).

**Migration from v0:** the v0 `{ id, title, description, date }` maps to `{ title, notes: description, start: <local date>, allDay: true }`. v0 stored picked dates as the UTC instant of local midnight, so `fromV0` reads the calendar day in the importer's time zone. UUID ids are kept; older nanoid ids get a new id. `parseImport` accepts both shapes in one file and reports skipped rows as `{ index, reason }`.
**Quick add:** `parseQuickAdd(text, { now, timezone, locale })` in `quick-add.ts` returns an `EventCreate` draft, the matched parts of the text (for highlighting) and warnings. Its interpretation rules (past times move forward, "tonight" = 20:00, day-first `3/4` unless the locale is US, recurrence → first occurrence plus a warning) are documented in the comment block at the top of that file, which is the single source for them.

## 5. API (v1)

All routes are under `/api/v1`, and all bodies are JSON validated by the Zod schemas in `core`.

| Method   | Path                                         | Notes                                                                                                                                    |
| -------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| POST     | `/auth/login`                                | `{ password, client: 'browser'                                                                                                           | 'token', label? }`→`browser`sets the session cookie;`token`returns`{ token }`. 401 wrong password, 429 rate limited |
| POST     | `/auth/logout`                               | Revokes the current session (and clears the cookie)                                                                                      |
| GET      | `/auth/me` · `/auth/sessions`                | The current session · all active sessions, the current one marked                                                                        |
| DELETE   | `/auth/sessions/:id`                         | Revokes another device                                                                                                                   |
| POST     | `/auth/sessions/revoke-others`               | "Log out everywhere else": revokes every session but this one in one request; returns `{ revoked }`                                      |
| GET/PUT  | `/settings`                                  | The user's preferences (`SettingsSchema` in core: theme, week start, time format), shared by every device; PUT replaces the whole object |
| GET      | `/events?from&to&tz&q&limit&cursor`          | Range (`tz` required with one) + search; excludes soft-deleted; returns `{ events, nextCursor }`                                         |
| POST     | `/events`                                    | Client may send `id` (uuid); 409 if it exists, even soft-deleted                                                                         |
| GET      | `/events/:id`                                |                                                                                                                                          |
| PATCH    | `/events/:id`                                | Partial update, merged then re-checked with `checkEventTiming`; bumps `updatedAt`                                                        |
| DELETE   | `/events/:id`                                | Sets `deletedAt` (soft delete, 204)                                                                                                      |
| POST     | `/events/:id/restore`                        | Undo for a delete: clears `deletedAt`, bumps `updatedAt`; 404 if the event is not deleted                                                |
| POST     | `/events/import?tz`                          | Accepts v0 and v1 JSON; returns `{ imported, skipped: [{ index, reason }] }`; existing ids are skipped                                   |
| GET      | `/events/export.json` · `/events/export.ics` | v1 JSON (re-importable) · iCalendar via core `toICalendar`                                                                               |
| GET/POST | `/sync`                                      | Phase 7                                                                                                                                  |

Errors always use the shape `{ error: { code, message, fields? } }`: 400 `invalid_json` / `invalid_query`, 404 `not_found`, 409 `conflict`, 413 `payload_too_large`, 422 `validation_failed` (with `fields`), 500 `internal`.

**Range queries:** `[from, to)` is half-open. Timed events overlap when they start before `to` and end after `from` (or, with no end, start at or after `from`). All-day events are matched on the local dates the range covers in `tz`, using their exclusive end. Instants are stored as `toISOString()` so string order in SQLite is time order. Paging is a keyset cursor on `(start, id)`.

**Import ids:** UUIDs are kept; non-UUID v0 ids (old nanoid clients) become a UUID v5 in a fixed namespace, so re-importing the same file skips every row as "Already exists".

**Auth (single user):** the password hash lives in an env var (`AGENDA_PASSWORD_HASH`), made with `pnpm --filter @agenda/api hash-password`. It is scrypt (N=2^17, r=8, p=1) in a self-describing format (`scrypt:<logN>:<r>:<p>:<salt>:<key>`), so the cost or the algorithm (argon2id, once Node's built-in is stable) can change later by re-hashing at the next login. The API refuses to start without it.

- **Sessions** live in the `sessions` table: a random 256-bit token is given to the client once; only its SHA-256 is stored. Sessions slide: each use (recorded at most once a minute) moves the expiry 30 days ahead. Logout and `DELETE /auth/sessions/:id` set `revoked_at`.
- **Only the web app uses the cookie** (`client: 'browser'`): httpOnly, SameSite=Lax, and Secure with the `__Host-` prefix unless `NODE_ENV=development`. **Desktop, extension and mobile use `client: 'token'`** and send `Authorization: Bearer`; the token is stored in the OS credential store (desktop, through the `keyring` crate behind three Rust commands), `chrome.storage.local` or `expo-secure-store`.
- **CSRF:** cookie-authenticated writes and browser logins must carry an `Origin` listed in `CORS_ORIGINS` (403 otherwise; a missing Origin too). Bearer requests need no check, because tokens are never attached automatically. **CORS** allows only `CORS_ORIGINS`, with credentials.
- **Same site required for the cookie:** a SameSite=Lax cookie is only sent when the web app and the API are on the same _site_ (same registrable domain). Phase 3 must therefore serve both from one domain with subdomains, for example `agenda.<domain>` (web) and `api.<domain>` (API), and list the web origin in `CORS_ORIGINS`. Hosting them on unrelated domains (e.g. `*.pages.dev` and `*.fly.dev`) would break cookie login.
- **Rate limit:** 5 failed logins per IP per 15 minutes, then 429 with `Retry-After`; only failures count. The IP is the socket address; `X-Forwarded-For` is only trusted behind our own proxy (`TRUST_PROXY`, Phase 3). Passwords and tokens are never logged.

**API client:** `createApiClient({ baseUrl, auth, fetch })` in `packages/core/src/api-client.ts` is the only way apps talk to the API. `baseUrl` is the API origin (the client adds `/api/v1`).

- `auth: { kind: 'cookie' }` (web) sends `credentials: 'include'`; `auth: { kind: 'token', getToken, onUnauthorized }` (desktop, extension, mobile) sends the bearer token. The client never stores the token; the app keeps it in its platform storage.
- Every response is parsed with the shared schemas in `api-schemas.ts` (the same error codes and login schema the API imports). Anything that doesn't match is `ApiError` with code `invalid_response`; API errors keep their `status`, `code`, `message` and `fields`. Failures without a response are `NetworkError` (`timeout`, default 15 s; `aborted`; `network`). Every method takes an `AbortSignal`.
- `fetch` is injected and described by small structural types (`http.ts`), so core needs no DOM or Node types and the same client runs in the browser, Tauri, an MV3 service worker and React Native.
- `apps/api/test/client.contract.test.ts` drives the real API through the client in-process; it fails if the two drift apart or if a client method has no contract coverage.

## 6. Per-platform notes

**Web.** This is the SPA plus the PWA. Server state lives in TanStack Query; UI state stays in React (no global store unless it's needed).

- **Settings** live on the server (a one-row `settings` table holding JSON, merged over the defaults on read, so a new preference needs no migration), so every device shares them. The web app keeps a copy in `localStorage` to paint the first frame (theme before React renders), then follows the server. `PreferencesProvider` puts the week start and the clock (`hour12`) into `AppEnv`, so every view and form reads them through `useEnv()`.
- **PWA.** `vite-plugin-pwa` (injectManifest) builds the manifest and gives our own service worker (`src/sw/sw.ts`, typed by its own WebWorker tsconfig) the build's file list. The worker precaches the build on install, answers page loads with the cached shell and build files from the cache, and never touches `/api` (the routing is a pure, tested function in `src/sw/routes.ts`). A new version waits until the user picks Reload in the "Update available." toast. No service worker in dev. Icons are generated from `public/icon.svg` (`pnpm --filter @agenda/web icons`) and committed.

- **Same origin in dev.** Vite proxies `/api` to `http://localhost:4001` (`AGENDA_API_URL` changes the target; `vite preview` uses the same proxy), so the browser only ever talks to the Vite origin and the session cookie is first-party with no CORS involved. Builds call `VITE_API_URL` instead.
- **Injected, not imported.** The core client (cookie mode), the query client, and an `AppEnv` (`timezone` from Intl, `locale`: en-US for en-US browsers, en-GB otherwise, and `now()`) come from React context (`src/app/`). Tests render the real routes with a fake client and a fixed clock and zone (`src/test-utils/renderApp.tsx`).
- **401 anywhere** clears the query cache and goes to `/login?next=…`; `next` must be a same-site path, so the login link can't become an open redirect.
- **Routes.** `/` and `/day/YYYY-MM-DD`, `/week` and `/week/YYYY-MM-DD` (the week containing the date; 3 days from it below 768 px), `/month` and `/month/YYYY-MM`, `/search?q=`. The short paths mean "the period with today".
- **Query keys.** Event lists are cached per range: `['events', 'range', startISO, endISO, tz]` (a day, a week, or a 6-week month grid, which the Month view and the sidebar calendar share). Search results are `['events', 'search', q]` (no range: every event). Every key starts with `'events'` and holds a plain `AgendaEvent[]`, so one invalidation refreshes them all and optimistic writes can patch any of them.
- **Optimistic writes.** Create, update, delete and restore snapshot every cached list, change them at once (a new or edited event goes into each range it overlaps, using the API's overlap rule from `core`, and leaves ranges it no longer touches), roll back from the snapshot with a toast on error, and refetch on settle. New events get their id on the client (`newId()`), so the optimistic copy and the saved one are the same row.
- **One place for event dialogs.** `EventActionsProvider` (in the shell) owns the details dialog, the editor and the mutations; views and shortcuts call `useEventActions()` (`open`, `edit`, `create`, `remove`). The mutations live there, not in the dialogs, so their callbacks still run after a dialog closes.
- **Layout.** `src/shell/` is the frame (one nav, placed by CSS grid areas per breakpoint; the global shortcuts and their help dialog), `src/views/` (shared header, paths), `src/day/`, `src/week/`, `src/month/`, `src/search/`, `src/quick-add/`, `src/events/` (queries, mutations, details dialog, editor), `src/settings/`, `src/pwa/` (update toast, install offer), `src/sw/` (the service worker), `src/auth/`.

**Desktop (Tauri 2).** `apps/desktop` wraps `apps/web`: the window loads the Vite dev server in dev (`devUrl`, port 5174 so it runs beside `pnpm dev`) and the built `dist` in the installer (`frontendDist`). There is no separate desktop frontend; the same build runs in the browser and in Tauri, and `apps/desktop/README.md` covers setup, commands and permissions in detail.

- **The process model.** A Tauri app is one native process (the **Rust core**, `src-tauri/src/`) that owns the OS: windows, the tray, the global shortcut, notifications, files and the credential store. Each window holds a **webview** (WebView2 on Windows, WebKit on macOS and Linux) that runs our web app like a browser tab: it has no Node, no file system and no OS access of its own. The two talk only through IPC messages. That split is the security model: the page is untrusted UI, and the core decides what it may do.
- **Calling into Rust: commands and events.** A _command_ is a Rust function marked `#[tauri::command]` and registered in `main.rs`; the page calls it with `invoke('set_tray_items', { items })` and gets a promise of its `Result` (arguments and results are JSON, through serde). An _event_ goes the other way (or between windows): Rust calls `app.emit_to("main", "navigate", "/day/2026-11-02")` and the page receives it with `listen('navigate', …)`. Agenda's commands are listed in `build.rs`; the events are `navigate` (tray → main window), `events-changed` (quick-add → main window, through a command) and `quick-add-open` (shortcut → quick-add window).
- **Capabilities and permissions.** Every IPC call is checked against the calling window's _capability_ (`src-tauri/capabilities/*.json`), a list of _permissions_. Plugins ship permissions such as `notification:allow-notify`, and because `build.rs` lists our commands, Tauri also generates `allow-<command>` for each and refuses anything not granted. Agenda's pages get **no plugin permissions at all**: every plugin is used from Rust, and the pages can only call Agenda's own commands (the main window more of them than the quick-add window). Capabilities apply to the app's own pages, so even a page loaded from elsewhere could call nothing; a strict CSP in `tauri.conf.json` limits what a page may load.
- **Auth and the server.** The pages run on `http://tauri.localhost` (Windows) or `tauri://localhost`, cross-site to the API, so the SameSite cookie would not be sent: the desktop app logs in with `client: 'token'`, sends `Authorization: Bearer` to the Server URL from the device settings (default `http://localhost:4001`, absolute URLs, no proxy), and keeps the token in the OS credential store through the `keyring` crate (Windows Credential Manager, encrypted with the user's login), never in `localStorage`. Bearer requests skip the CSRF check; the API lists the Tauri origins in `CORS_ORIGINS` for CORS only. A 401 forgets the token and returns to `/login`; a network failure, a timeout or a proxy's 502/503/504 shows "Can't reach Agenda at <url>" (`isUnreachable` in core) with Retry and a link to change the Server URL.
- **Tray, quick add and reminders.** The main window keeps running while hidden (closing it hides it; Quit is in the tray). It owns the data: one query for today and the next three days, refreshed every 5 minutes, feeds core's `trayItems` (the tray's next 5 events) and `reminderSchedule` (all-day events count from 09:00), which it sends to Rust whenever they change. Rust only renders the menu and times the notifications on its own thread, because a hidden webview's timers are slowed to about once a minute. Reminder keys (event, offset, start) that have fired are stored, so a restart shows nothing twice and a moved event's reminders fire for the new time. The global shortcut (Ctrl+Shift+Space by default, changeable) shows the `quick-add` window, which renders `/quick-add` (QuickAdd with its preview), grows to fit the preview, saves on Enter and closes on Esc or blur.
- **Device settings** (Server URL, shortcut) live in a JSON file in the app's data folder (`tauri-plugin-store`), launch at login in the OS (`tauri-plugin-autostart`). The shared preferences stay on the server.
- **Builds.** `pnpm desktop:installer` builds web, then an NSIS installer (per-user, no admin). CI's `desktop` job on windows-latest runs `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`, builds the installer and uploads it as an artifact. Code signing and auto-update are not set up yet (PLAN.md, Phase 4).

**Extension (WXT, MV3).**

- `entrypoints/popup`, `entrypoints/sidepanel`: React, reuses `packages/ui`
- `entrypoints/background.ts`: service worker that owns `chrome.alarms` (refresh + reminders), the context menu, and the badge. It is **stateless**, because MV3 workers are killed when idle, so everything must persist in `chrome.storage`.
- `host_permissions` limited to the API origin only

**Mobile (Expo).** Expo Router tabs. It uses the `core` API client and TanStack Query. Reminders are scheduled locally with `expo-notifications` whenever events change. `expo-secure-store` holds the token. In Phase 7, `expo-sqlite` becomes the local store for offline use.

## 7. Platform adapter pattern

Anything that differs per platform goes behind one interface in `core` (`packages/core/src/platform.ts`):

```ts
export interface Platform {
  saveFile(file: SaveFileRequest): Promise<boolean>; // a download, or a native save dialog
  auth: { kind: 'cookie' } | { kind: 'token'; tokens: TokenStore }; // TokenStore: get/set/clear
  apiBaseUrl: string; // '' = the page's own origin (the web app's dev proxy)
  desktop?: DesktopBridge; // only in the desktop app
}
```

`DesktopBridge` holds what only the desktop app has: which window the page is in, the device settings (`settings`, `setServerUrl`, `setShortcut`, `setLaunchAtLogin`), `setTrayItems`, `setReminders` (replaces the whole schedule, which makes rescheduling and "no duplicates" one rule in one place), the events from Rust (`onNavigate`, `onEventsChanged`, `onQuickAddOpen`, each returning an unsubscribe), and the quick-add window's calls (`hideQuickAdd`, `resizeQuickAdd`, `showMain`, `eventsChanged`). The data it carries (`TrayItem`, `ScheduledReminder`) is computed by pure, tested functions in core.

Each app provides its own implementation; shared code only ever sees `Platform`, through `usePlatform()`:

- `webPlatform` (`apps/web/src/app/platform.ts`): the cookie, `VITE_API_URL` (or the dev proxy), downloads through a Blob URL.
- `tauriPlatform` (`apps/web/src/platform/tauri.ts`): a bearer token from the OS keychain, the Server URL, and `invoke`/`listen` for everything else. It is the only file that imports `@tauri-apps/api` (an ESLint rule), and `loadPlatform()` (`platform/detect.ts`) fetches it as a separate chunk only when `isTauri()` sees Tauri's injected internals, so the browser build never loads it.
- `chromePlatform` and `expoPlatform` come with the extension and mobile phases, and add members (notifications, storage) as those need them.

`main.tsx` awaits `loadPlatform()`, builds the API client from it (`createAppApi`: cookie or token mode), and passes it to `AppProviders`. Tests pass fakes (`test-utils/fakeDesktop.ts`).

## 8. Quality gates

- CI (`.github/workflows/ci.yml`) runs `pnpm format:check`, `lint`, `typecheck`, `test` and `build` on every PR and push to `master`; all must pass.
- A desktop job on windows-latest runs `cargo fmt --check`, `cargo clippy -D warnings` and `cargo test` on the Rust core, then builds the NSIS installer and uploads it as an artifact. Rust checks stay out of `pnpm lint`/`test`, so the other jobs and machines without Rust are unaffected.
- A second CI job runs the Playwright smoke test (`apps/e2e`, Chromium only) against the built apps: the API with a temp-file database per run (not libSQL's `:memory:`, which gives each transaction an empty database), `NODE_ENV=development` and `CORS_ORIGINS` set to the preview server, and `vite preview` proxying `/api` to it. Locally: `pnpm build && pnpm e2e` (ports 4101 and 5101, so a dev API on 4001 is untouched). Unit tests cover the details; the smoke test covers what only a real browser, server and database show (cookies through the proxy, the CSRF check, migrations, CSS that blocks a click).
- CI installs with `pnpm install --frozen-lockfile`, so lockfile changes must be committed with the `package.json` change that caused them.
- Line endings are LF everywhere (`.gitattributes`), so Prettier gives the same result on Windows, macOS and Linux.
- `core` targets about 90% test coverage, since it holds the logic everything depends on. Apps get smoke tests.
- Conventional commits (`feat:`, `fix:`, `chore:`), one squash merge per PR.
- Secrets never go in the repo; use `.env.example` files.

## 9. Architecture decision log

Record significant decisions in `docs/adr/NNNN-title.md` (context → decision → consequences). Start with:

- 0001 Monorepo with pnpm + Turborepo
- 0002 Tauri over Electron
- 0003 Chrome Extension (MV3) instead of the discontinued Chrome Apps
- 0004 Expo for mobile; share logic, not UI
