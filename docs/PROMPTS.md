# Prompt Pack: building Agenda with Claude

These prompts drive the build phase by phase. `CLAUDE.md` holds the standing rules, so each prompt only has to say _what_ to build.

## How to use them

1. **One phase per session**, and usually one _step_ per session. Big prompts produce big, hard-to-review diffs.
2. **Plan first.** Start with: _"Read CLAUDE.md and docs/. Don't write code yet. Propose a plan for the task below, list files you'll touch, and ask me anything unclear."_ Approve or adjust the plan, then let it build.
3. **Ask it to teach.** Add _"Explain the key concepts as you go, briefly"_ whenever the tech is new to you. That's the point of the project.
4. **Verify, don't trust.** Every prompt ends with acceptance criteria. Run the app yourself before merging.
5. **Close the loop.** End sessions with: _"Update docs/ and CLAUDE.md commands if anything changed, then open a PR."_

### Prompt template

```
Context: <phase + step, link to the relevant doc section>
Task: <one concrete outcome>
Constraints: <anything beyond CLAUDE.md, e.g. "no new deps">
Acceptance criteria:
- [ ] ...
- [ ] lint, typecheck, test all pass
Teach me: <concepts you want explained, optional>
```

---

## Phase 0: Foundation

**0.1 Archive and scaffold**

```
Context: Phase 0 of docs/PLAN.md. The current code is the v0 teaching app.
Task: Create tag legacy-agenda on the current master commit (I'll push it myself). Then convert the repo
into a pnpm + Turborepo monorepo following docs/ARCHITECTURE.md §2: empty apps/{api,web} and
packages/{core,tokens,ui,config}. Move the old src/ and server/ into legacy/ for reference
(we'll delete it at the end of Phase 2).
Acceptance criteria:
- [ ] `pnpm i` works from a clean clone; `pnpm build/lint/typecheck/test` run (even if trivially)
- [ ] shared tsconfig (strict) + ESLint + Prettier in packages/config
- [ ] Vitest configured in every package
- [ ] README rewritten: what Agenda is, workspace layout, how to run
Teach me: what pnpm workspaces and Turborepo pipelines actually do.
```

**0.2 CI**

```
Task: Add a GitHub Actions workflow: on PR and push to master → pnpm install (cached) → lint →
typecheck → test, using Turborepo caching. Add a PR template with What/Why/How tested/Screenshots.
Acceptance criteria: workflow passes on a test PR; a deliberately broken test makes it fail.
```

## Phase 1: Core + API

**1.1 Core schemas**

```
Context: docs/ARCHITECTURE.md §4 (data model).
Task: In packages/core implement Zod schemas + inferred types for AgendaEvent, EventCreate, EventPatch,
EventColor, plus a `fromV0()` converter for the old {id,title,description,date} format.
Add date helpers (date-fns): startOfDayInTz, rangeForView(view, date, tz), formatEventTime.
Acceptance criteria:
- [ ] Unit tests cover valid/invalid events, v0 conversion, all-day vs timed, tz edge cases
      (e.g. an event at 23:30 Asia/Karachi lands on the correct local day)
```

**1.2 Quick-add parser**

```
Task: packages/core/quick-add.ts: parseQuickAdd(text, now, tz) → { title, start, end, allDay, color }
using chrono-node. Support "#red" style color tags and "for 2h" durations.
Acceptance criteria: table-driven tests for at least 15 phrases ("dentist tomorrow 4pm",
"standup every weekday" → returns title + note that recurrence is unsupported for now, etc.).
```

**1.3 API + DB**

```
Context: docs/ARCHITECTURE.md §5.
Task: apps/api with Hono + Drizzle + libSQL. Events table per the data model, migrations, all
/api/v1/events routes (list with from/to/q, create, get, patch, soft delete, import, export json+ics).
Validate with core's Zod schemas. Standard error shape. Seed script for dev.
Acceptance criteria:
- [ ] Port every case from legacy/server/db.test.js to Vitest, plus new tests per route
- [ ] Importing a real v0 AgendaData.json works
- [ ] `.env.example` documents DATABASE_URL etc.
Teach me: how Drizzle migrations work and why soft deletes matter for sync later.
```

**1.4 Auth**

```
Task: Single-user auth per ARCHITECTURE.md §5: /auth/login (argon2 or bcrypt hash from env),
session cookie for browsers + bearer token for other clients, rate limit on login, middleware
protecting /events. A script `pnpm --filter @agenda/api hash-password` to generate the env value.
Acceptance criteria: unauthenticated → 401; tests for cookie and bearer paths; CORS limited to
configured origins.
```

**1.5 API client**

```
Task: packages/core/api-client.ts: a typed fetch client (baseUrl + auth strategy injected) with
methods for every endpoint, parsing responses with Zod. Errors become a typed ApiError.
Acceptance criteria: tests with a mocked fetch; no platform-specific imports.
```

## Phase 2: Web

**2.1 Tokens + UI primitives**

```
Context: docs/DESIGN.md §2–3.
Task: packages/tokens (TS source → generated tokens.css with light/dark via
[data-theme] + prefers-color-scheme). packages/ui: Button, IconButton, Input, Textarea, Dialog,
Toast (with Undo), EmptyState, EventCard (default + compact). Use Radix primitives for
Dialog/Popover if helpful.
Acceptance criteria: a simple /playground route in web shows every component in both themes;
focus rings and aria labels per DESIGN.md §6.
```

**2.2 App shell + Today**

```
Task: apps/web with Vite + React + TS, React Router, TanStack Query. Login page, app shell
(sidebar + main per DESIGN.md §4), Today view with QuickAdd (live parse preview) and event list.
Optimistic create/delete with Undo toast.
Acceptance criteria: I can log in, add "Lunch with Sara tomorrow 1pm", see it under tomorrow,
delete it and undo. Works at 375px width.
```

**2.3 Week + Month + Search**

```
Task: Week view (TimeGrid with now-line, all-day strip), Month view (+N more), Search (debounced q).
Keyboard shortcuts per DESIGN.md §5 with a "?" help dialog. Event editor dialog for full edits.
Acceptance criteria: Playwright smoke test: login → add → switch views → edit → delete.
```

**2.4 Settings + PWA**

```
Task: Settings: theme (system/light/dark), import (v0 + v1 JSON, shows imported/skipped report),
export JSON/ICS, logout. Add PWA manifest + icons + service worker for app-shell caching.
Acceptance criteria: Chrome shows "Install app"; Lighthouse PWA + a11y ≥ 90. Then delete legacy/.
```

## Phase 3: Deploy

```
Task: Dockerfile for apps/api, deploy config for <Fly.io | Railway | my VPS>, DB on <Turso | volume>.
Web on <Cloudflare Pages | Vercel>. GitHub Actions: deploy on merge to master using repo secrets.
Nightly DB backup job. Write docs/DEPLOY.md with every manual step I need to do once.
Acceptance criteria: HTTPS URL works; redeploy keeps data; restoring a backup is documented and tested.
Teach me: where each secret lives and why.
```

## Phase 4: Desktop (Tauri)

```
Context: docs/ARCHITECTURE.md §6–7, DESIGN.md §4 desktop extras.
Task: apps/desktop with Tauri 2 loading apps/web (devUrl in dev, dist in build). Implement
tauriPlatform (notifications via plugin), tray menu with next 5 events + "Quick add" + "Quit",
global shortcut (Ctrl+Shift+Space, configurable) opening a frameless 560x72 quick-add window,
launch-at-login toggle in Settings. CI job building an installer for <Windows|macOS|Linux>.
Acceptance criteria: hotkey → type → Enter → event appears in main window; reminder notification
fires while app is in tray.
Teach me: Tauri's process model, capabilities/permissions file, and the Rust parts I touched.
```

## Phase 5: Chrome extension

```
Context: ARCHITECTURE.md §6 extension notes; DESIGN.md §4 popup layout.
Task: apps/extension with WXT + React + packages/ui. Popup (today + QuickAdd + login), side panel
(week list), background service worker: context menu "Add to Agenda" on selected text → parseQuickAdd
→ create; chrome.alarms every 15 min to refresh + badge count; reminders via chrome.notifications.
Token in chrome.storage.local. host_permissions only the API origin.
Acceptance criteria: works after the service worker is killed (chrome://serviceworker-internals →
stop) and restarted; load-unpacked instructions in apps/extension/README.md.
Teach me: MV3 service worker lifecycle and why state can't live in memory.
```

## Phase 6: Mobile (Expo)

```
Context: ARCHITECTURE.md §6 mobile; DESIGN.md §2 tokens, §4 mobile layout.
Task: apps/mobile with Expo (latest SDK) + Expo Router. Tabs: Today, Calendar (month + day list),
Search, Settings. Editor as bottom sheet. Reuse core (API client, schemas, quick-add) and tokens;
build RN components (no react-dom). Token in expo-secure-store. Schedule local reminders with
expo-notifications on every event change (cancel + reschedule). Swipe-to-delete with Undo.
Acceptance criteria: runs in a development build on my phone; reminders fire with the app killed;
EAS internal build config documented.
Teach me: RN layout vs CSS, Expo Go vs development builds, and how EAS Build works.
```

## Phase 7: Sync + recurrence (stretch)

```
Task: Design first. Write docs/adr/0005-sync.md comparing last-write-wins via updatedAt cursor vs
alternatives, then implement GET/POST /sync, a local SQLite store (expo-sqlite on mobile, Tauri SQL
plugin on desktop) and a sync engine in core with a pluggable storage interface. Then add rrule support.
Acceptance criteria: edit on phone in airplane mode, edit another event on web, reconnect → both
present everywhere; conflicting edits resolve deterministically; tests simulate both.
```

---

## Handy one-liners

- **Review:** "Review the diff on this branch against CLAUDE.md and docs/DESIGN.md. List problems by severity; don't fix yet."
- **Debug:** "Here's the error + steps to reproduce. Find the root cause first and explain it, then propose the smallest fix with a test."
- **Learn:** "Before changing anything, explain how <X> works in this codebase with file references."
- **Refactor safely:** "Refactor <X> with no behavior change. Tests must pass before and after; show me the test you relied on."
