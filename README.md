# Agenda

[![CI](https://github.com/xitas/agenda/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/xitas/agenda/actions/workflows/ci.yml)

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
```

Apps depend on packages through `workspace:*` links, so a change in `packages/core` is picked up by `apps/web` without publishing anything. Library packages compile to `dist/` with type declarations.

## Requirements

- Node.js 22.12 or newer (`.nvmrc` pins 24)
- pnpm, through Corepack: run `corepack enable` once (from an administrator terminal on Windows). The exact pnpm version (12.x) comes from `packageManager` in `package.json`.
- Git checks files out with LF line endings on every OS (`.gitattributes`), so Prettier gives the same result everywhere.

## Getting started

The first time, give the API a password (it refuses to start without one):

```sh
pnpm i
cp apps/api/.env.example apps/api/.env
pnpm -s --filter @agenda/api hash-password >> apps/api/.env   # asks for the password twice
```

Then:

```sh
pnpm dev
```

`pnpm dev` builds the shared packages, then starts the API (http://localhost:4001) and the web app (http://localhost:5173) in watch mode. Open the web app and log in. In dev, Vite forwards `/api` to the API, so both are on one origin and the session cookie works without CORS. To run a single app:

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

Add `--filter @agenda/<name>` (for example `--filter @agenda/core`) to any of them to limit the run to one package and its dependencies.

## Continuous integration

Every pull request and push to `master` runs `.github/workflows/ci.yml`: a frozen-lockfile install, then `format:check`, `lint`, `typecheck`, `test` and `build`. Run the same checks locally before opening a PR.

## The original app

The v0 app (Create React App and Express) is no longer in the tree. The last commit before the rebuild is tagged `legacy-agenda`; check it out to see or run the old code. Its exports still import: Settings > Data takes an old `AgendaData.json`.
