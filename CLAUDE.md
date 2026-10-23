# CLAUDE.md: working on Agenda

Agenda is a personal agenda/calendar app being rebuilt from a teaching project (tag `legacy-agenda`; the old code is kept in `legacy/` for reference) into a monorepo that ships on web, desktop (Tauri), Chrome extension (MV3/WXT), and mobile (Expo). The owner is using it to **learn** each platform, so explain non-obvious decisions briefly in PR descriptions.

## Read first

- `docs/PLAN.md`: phases and what "done" means
- `docs/ARCHITECTURE.md`: layout, stack, data model, API, platform adapter
- `docs/DESIGN.md`: tokens, components, layout, copy rules

If a request conflicts with these docs, point it out and ask before deviating. If a decision changes, update the doc in the same PR.

## Rules

- TypeScript strict everywhere. No `any` without a comment explaining why.
- Business logic (validation, dates, parsing, API client) goes in `packages/core`, never inside an app.
- Use only design tokens from `packages/tokens`. No raw hex colors or px spacing in app code.
- Shared web UI goes in `packages/ui`; mobile builds its own RN components from the same tokens.
- Platform-specific APIs (Tauri, chrome.*, Expo modules) are only called through the `Platform` adapter.
- Use date-fns, not moment. Store times as UTC ISO strings; format in the user's timezone.
- Every new function in `core` or `api` gets a Vitest test. UI changes need at least a render test.
- Keep PRs small: one feature, conventional commit title (`feat(web): week view`).
- Don't add a dependency without saying why in the PR.
- **No AI attribution.** Never add `Co-Authored-By: Claude`, "Generated with Claude", or similar
  lines to commits, PR descriptions, code comments, or docs. Commits are authored by the repo owner only.

## Commands

```
pnpm i                              # install (pnpm via Corepack; version pinned in package.json)
pnpm dev                            # run all apps in watch mode
pnpm dev --filter @agenda/web       # run one app (@agenda/api, @agenda/web; desktop, extension, mobile later)
pnpm build                          # build every package and app
pnpm lint && pnpm typecheck && pnpm test   # must pass before a PR
pnpm format                         # Prettier (format:check to verify)
```

Filters need the full scoped package name (`@agenda/web`, not `web`).
Planned, not yet available: `pnpm --filter @agenda/api db:migrate` (apply Drizzle migrations).
(Update this section as scripts are added.)

## Definition of done for any task

1. Lint, typecheck, and tests all pass.
2. Behavior matches the acceptance criteria in the prompt or issue.
3. Docs updated if architecture or design changed.
4. PR description says what changed, why, how it was tested, and includes screenshots for UI.
