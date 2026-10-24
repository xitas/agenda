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
│  ├─ desktop/      Tauri 2 (src-tauri/ in Rust), points at apps/web build
│  ├─ extension/    WXT (MV3): popup, sidepanel, background service worker
│  └─ mobile/       Expo + Expo Router
├─ packages/
│  ├─ core/         schemas.ts, types.ts, ids.ts, dates.ts, import.ts, api-client.ts, quick-add.ts
│  ├─ ui/           React DOM components (no app logic)
│  ├─ tokens/       tokens.ts → generates tokens.css (CSS vars)
│  └─ config/       shared tsconfig, eslint, prettier, vitest
├─ legacy/          v0 CRA + Express app, reference only (deleted after Phase 2)
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
| Routing (web) | React Router (or TanStack Router)                                           | Either is fine; pick one and keep it                                                      |
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

| Method   | Path                                         | Notes                                                             |
| -------- | -------------------------------------------- | ----------------------------------------------------------------- |
| POST     | `/auth/login`                                | `{ password }` → sets session cookie and returns `{ token }`      |
| POST     | `/auth/logout`                               |                                                                   |
| GET      | `/events?from&to&q&limit&cursor`             | Range + search; excludes soft-deleted                             |
| POST     | `/events`                                    | Client may send `id` (uuid)                                       |
| GET      | `/events/:id`                                |                                                                   |
| PATCH    | `/events/:id`                                | Partial update; bumps `updatedAt`                                 |
| DELETE   | `/events/:id`                                | Sets `deletedAt`                                                  |
| POST     | `/events/import`                             | Accepts v0 and v1 JSON; returns `{ imported, skipped, errors[] }` |
| GET      | `/events/export.json` · `/events/export.ics` |                                                                   |
| GET/POST | `/sync`                                      | Phase 7                                                           |

Errors always use the shape `{ error: { code, message, fields? } }` with proper HTTP status codes.

**Auth (single user):** the password hash lives in an env var (`AGENDA_PASSWORD_HASH`). Web and desktop use an httpOnly, Secure, SameSite=Lax cookie. The extension and mobile app use a bearer token stored in `chrome.storage.local` or `expo-secure-store`. Rate-limit `/auth/login`.

## 6. Per-platform notes

**Web.** This is the SPA plus the PWA. Server state lives in TanStack Query; UI state stays in React (no global store unless it's needed). The API URL comes from `VITE_API_URL`.

**Desktop (Tauri).** Loads `apps/web` (`devUrl` in dev, the built `dist` in prod). Native features go through Tauri plugins (`notification`, `global-shortcut`, `autostart`, `updater`) plus a tray. The web code detects Tauri with `isTauri()` and calls a small `platform` adapter, so web code never imports Tauri directly.

**Extension (WXT, MV3).**

- `entrypoints/popup`, `entrypoints/sidepanel`: React, reuses `packages/ui`
- `entrypoints/background.ts`: service worker that owns `chrome.alarms` (refresh + reminders), the context menu, and the badge. It is **stateless**, because MV3 workers are killed when idle, so everything must persist in `chrome.storage`.
- `host_permissions` limited to the API origin only

**Mobile (Expo).** Expo Router tabs. It uses the `core` API client and TanStack Query. Reminders are scheduled locally with `expo-notifications` whenever events change. `expo-secure-store` holds the token. In Phase 7, `expo-sqlite` becomes the local store for offline use.

## 7. Platform adapter pattern

Anything that differs per platform goes behind one interface in `core`:

```ts
export interface Platform {
  notify(title: string, body: string): Promise<void>;
  scheduleReminder(event: AgendaEvent): Promise<void>;
  storage: { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void> };
  openExternal(url: string): Promise<void>;
}
```

Each app provides its own implementation (`webPlatform`, `tauriPlatform`, `chromePlatform`, `expoPlatform`). Shared code only ever sees `Platform`.

## 8. Quality gates

- CI (`.github/workflows/ci.yml`) runs `pnpm format:check`, `lint`, `typecheck`, `test` and `build` on every PR and push to `master`; all must pass.
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
