# Agenda: Roadmap

Agenda started as a teaching project: a single React (CRA) page plus a small Express + SQLite API with CRUD, import and export. The goal now is to turn it into an app I use every day, and to use it to get hands-on experience shipping the same product on **four platforms**:

| Platform | Technology                                         | Main thing to learn                                                              |
| -------- | -------------------------------------------------- | -------------------------------------------------------------------------------- |
| Web      | Vite + React + TypeScript (PWA)                    | Modern React, routing, server state, deploys                                     |
| Desktop  | Tauri 2 (wraps the web app)                        | Native shell, tray, global shortcuts, OS notifications, packaging                |
| Chrome   | Chrome **Extension** (Manifest V3, built with WXT) | Extension architecture: popup, side panel, service worker, alarms, context menus |
| Mobile   | Expo (React Native)                                | Native UI, navigation, local DB, push and local notifications, app store builds  |

> **Note on "Chrome App":** Google has discontinued Chrome Apps. The modern equivalent is a Chrome Extension (Manifest V3), and that is what this plan builds.

---

## Decision: keep the repo

Keep `xitas/agenda` and restructure it in place:

1. Tag the current state: `git tag v0-teaching && git push origin v0-teaching`.
2. Optionally keep a `legacy` branch pointing at the same commit.
3. Rebuild `main` as a monorepo (see `ARCHITECTURE.md`).

This costs nothing, keeps the history that shows where the project started, and keeps the stars and links. Rename the repo later if you want; GitHub redirects old URLs.

---

## Product scope (v1 = "I actually use it")

**Must have**

- Events with title, notes, start/end, all-day flag, location, and a color/category
- Views: **Today** (default), **Week**, **Month**, **List/Search**
- Quick add with natural language: "Dentist tomorrow 4pm" (via `chrono-node`)
- Reminders (for example 10 min before), delivered as native notifications on each platform
- Import/export as JSON (backward compatible with the v0 export) and `.ics`
- Light and dark mode, plus keyboard shortcuts on web and desktop
- Single-user authentication (it's my data on a public server)

**Later (v2)**

- Recurring events (RRULE)
- Offline-first sync (edit on the phone in airplane mode, sync later)
- Home-screen widget (mobile), menu-bar mini view (desktop)
- Google Calendar read-only import

**Non-goals:** multi-user sharing, teams, invitations.

---

## Phases

Each phase ends with something usable and merged to `main`. Work in small PRs, one feature per PR, with CI green.

### Phase 0: Foundation (about 1 week)

**Learn:** monorepo tooling, TypeScript config, CI.

- Tag `v0-teaching`; move old code out of `main`
- pnpm workspaces + Turborepo; `apps/` and `packages/` folders
- Shared `tsconfig`, ESLint + Prettier (or Biome), Vitest
- GitHub Actions: install → lint → typecheck → test on every PR
- `CLAUDE.md` + `docs/` (this folder) committed

**Done when:** `pnpm i && pnpm test` passes in CI on an empty skeleton.

### Phase 1: Core + API (about 1–2 weeks)

**Learn:** schema design, validation, ORM + migrations, REST design, auth.

- `packages/core`: Zod schemas, TS types, date helpers (date-fns, replacing moment), typed API client
- `apps/api`: Hono + Drizzle + SQLite (libSQL), with migrations
- Endpoints: `GET/POST /events`, `GET/PATCH/DELETE /events/:id`, `GET /events?from=&to=&q=`, `POST /events/import`, `GET /events/export.ics`
- Soft deletes plus `updatedAt` on every row (sets up sync for later)
- Single-user auth: password login → httpOnly session cookie (web/desktop) and bearer token (extension/mobile)
- Port the existing `server/db.test.js` cases to Vitest; add more

**Done when:** API tests pass, and a v0 `AgendaData.json` imports cleanly.

### Phase 2: Web app (about 2–3 weeks)

**Learn:** Vite, React Router / TanStack Router, TanStack Query, design tokens, accessibility.

- `packages/ui`: tokens + primitives (Button, Input, Dialog, Sheet, EventCard, DayColumn…)
- Screens: Login, Today, Week, Month, Search, Event editor (dialog), Settings (theme, import/export)
- Quick-add bar (`N` or `Ctrl/Cmd+K`), with optimistic updates
- PWA manifest + installability
- Component tests (Vitest + Testing Library); one Playwright smoke test

**Done when:** I use the web app as my agenda for one full week.

### Phase 3: Deploy (about 3–5 days)

**Learn:** hosting, env/secrets, DB backups, domains.

- API on a small host (Fly.io / Railway / a VPS with Docker); DB on Turso or a persistent volume
- Web on Cloudflare Pages / Vercel / Netlify
- GitHub Actions deploy on merge to `main`; nightly DB backup

**Done when:** it's reachable at a real URL over HTTPS and survives a redeploy with data intact.

### Phase 4: Desktop with Tauri (about 1–2 weeks)

**Learn:** Rust basics, the Tauri IPC/permissions model, native APIs, signing and packaging.

- `apps/desktop` loads the built web app
- System tray icon with "Today" list; **global shortcut** opens a quick-add window
- Native notifications for reminders; launch at login; auto-update (later)
- Build installers for your OS in CI

**Done when:** I can press a global hotkey anywhere and add an event.

### Phase 5: Chrome extension (about 1 week)

**Learn:** MV3 (service worker lifecycle), `chrome.storage`, `chrome.alarms`, context menus, side panel.

- Popup (360×520): today's events + quick add
- Side panel: week view
- Context menu: "Add selection to Agenda" (selected text → quick-add parser)
- Toolbar badge = number of remaining events today; reminders via `chrome.alarms` + `chrome.notifications`
- Load unpacked → later publish privately/unlisted on the Chrome Web Store

**Done when:** I can highlight "Call Ali Friday 3pm" on any page and it becomes an event.

### Phase 6: Mobile with Expo (about 2–4 weeks)

**Learn:** React Native layout, Expo Router, native modules, notifications, EAS Build.

- Tabs: Today · Calendar · Search · Settings; editor as a bottom sheet
- Reuses `packages/core` (types, validation, API client, parsing). The UI is native and only the design **tokens** are shared.
- Local reminders via `expo-notifications`
- Dev build on my own phone through EAS; internal distribution

**Done when:** the app is on my phone home screen and reminders fire with the app closed.

### Phase 7: Offline sync + recurrence (stretch)

**Learn:** sync protocols, conflict resolution, RRULE.

- `GET /sync?since=<cursor>` + `POST /sync` (batch upserts), last-write-wins on `updatedAt`
- Local SQLite on mobile/desktop as the source of truth; background sync
- Recurring events with `rrule`

---

## Working rhythm

- One phase = one GitHub milestone; one feature = one issue = one PR.
- Every PR: tests for new logic, CI green, a screenshot for UI changes.
- Update `docs/` whenever a decision changes. These docs are the source of truth for both me and Claude.
