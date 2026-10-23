# Agenda

Agenda is a personal agenda and calendar app. It started as a small teaching project (a Create React App frontend with an Express + SQLite API) and is being rebuilt as a TypeScript monorepo that will ship as:

- a **web** app (Vite + React)
- an **API** (Hono + Drizzle + SQLite)
- a **desktop** app (Tauri)
- a **Chrome extension** (Manifest V3)
- a **mobile** app (Expo)

Right now only the workspace skeleton exists: every package builds, lints, type-checks and has a placeholder test, but there are no features yet.

## Workspace layout

```
apps/
  api/        Node API (TypeScript skeleton; Hono + Drizzle + SQLite later)
  web/        Vite + React web app
packages/
  core/       Shared types, validation, date helpers and API client
  tokens/     Design tokens (color, spacing, type) for every platform
  ui/         Shared React components for web-based apps
  config/     Shared tsconfig, ESLint, Prettier and Vitest settings
legacy/       The original CRA + Express app, kept for reference only
```

Apps depend on packages through `workspace:*` links, so a change in `packages/core` is picked up by `apps/web` without publishing anything. Library packages compile to `dist/` with type declarations.

## Requirements

- Node.js 22.12 or newer (`.nvmrc` pins 24)
- pnpm, through Corepack: run `corepack enable` once (from an administrator terminal on Windows). The exact pnpm version comes from `packageManager` in `package.json`.

## Getting started

```sh
pnpm i
pnpm dev
```

`pnpm dev` builds the shared packages, then starts every app in watch mode. To run a single app:

```sh
pnpm dev --filter @agenda/web   # Vite dev server on http://localhost:5173
pnpm dev --filter @agenda/api   # API in watch mode (tsx)
```

## Scripts

All scripts run through [Turborepo](https://turborepo.com), which orders tasks by package dependencies and caches results.

| Command          | What it does                                             |
| ---------------- | -------------------------------------------------------- |
| `pnpm dev`       | Start all apps in watch mode                             |
| `pnpm build`     | Build every package and app (`dist/`)                    |
| `pnpm lint`      | ESLint across the workspace                              |
| `pnpm typecheck` | `tsc --noEmit` in every package                          |
| `pnpm test`      | Vitest in every package                                  |
| `pnpm format`    | Format the repo with Prettier (`format:check` to verify) |

Add `--filter <package-name>` to any of them to limit the run to one package and its dependencies.

## Legacy app

The original v0 app lives in `legacy/` and is not part of the workspace. The last commit before the rebuild is tagged `legacy-agenda`. To run it:

```sh
cd legacy
npm install
npm run dev
```
