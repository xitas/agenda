# @agenda/api

The Agenda REST API: Hono on Node, Drizzle ORM, libSQL (a local SQLite file in dev, Turso later).
It has one user (you), who logs in with a password.

## Run it

From the repository root:

```sh
cp apps/api/.env.example apps/api/.env
pnpm -s --filter @agenda/api hash-password >> apps/api/.env   # asks for the password twice
pnpm --filter @agenda/api dev                                 # http://localhost:4001/api/v1
pnpm --filter @agenda/api db:seed Asia/Karachi                # optional: sample events
```

`hash-password` hides what you type and prints only the hash line, so `>>` appends exactly
`AGENDA_PASSWORD_HASH=scrypt:…` to `.env`. The API refuses to start without it.

The server applies pending migrations on start. To run them on their own:

```sh
pnpm --filter @agenda/api db:migrate
```

After changing `src/db/schema.ts`, generate a migration and commit the SQL it writes to `drizzle/`:

```sh
pnpm --filter @agenda/api db:generate
```

| Variable               | Default                 | Meaning                                                         |
| ---------------------- | ----------------------- | --------------------------------------------------------------- |
| `AGENDA_PASSWORD_HASH` | (required)              | Output of `hash-password`; the password itself is never stored  |
| `NODE_ENV`             | `production`            | `development` drops the cookie's Secure flag for plain http     |
| `CORS_ORIGINS`         | (none)                  | Comma-separated web app origins allowed to use cookies and CORS |
| `DATABASE_URL`         | `file:./data/agenda.db` | libSQL URL (`file:`, `:memory:`, Turso)                         |
| `PORT`                 | `4001`                  | Port to listen on                                               |

## Code layout

```
src/
  app.ts               createApp({ db, auth, now }) builds the Hono app (tests use an in-memory db)
  index.ts             reads env, migrates, starts the server
  env.ts               environment variables, validated with Zod
  errors.ts            ApiError and the { error: { code, message, fields? } } shape
  auth/password.ts     scrypt hashing (self-describing format)
  auth/sessions.ts     sessions: random token, only its SHA-256 stored, sliding 30-day expiry
  auth/middleware.ts   requireAuth (bearer or cookie) and the CSRF Origin check
  auth/rate-limit.ts   failed-login limiter (5 per 15 minutes per IP)
  auth/routes.ts       /auth/login, logout, me, sessions
  cli/hash-password.ts the hash-password script
  db/schema.ts         events and sessions tables (Drizzle)
  events/repo.ts       queries: range overlap, search, cursor paging, soft delete
  events/routes.ts     the /api/v1/events routes
drizzle/               generated migrations (committed)
test/                  Vitest tests and fixtures
```

## Authentication

Log in once per device. There are two kinds of session, both lasting 30 days after their last use:

- **`client: "token"`** returns `{ token }`. Send it as `Authorization: Bearer <token>`. This is
  for curl, the desktop app, the Chrome extension and the mobile app.
- **`client: "browser"`** sets an `HttpOnly`, `SameSite=Lax` cookie (also `Secure` and named
  `__Host-agenda_session` unless `NODE_ENV=development`). This is for the web app. Writes with the
  cookie must come from an origin in `CORS_ORIGINS` (CSRF protection), and so must the login.

After 5 wrong passwords from one IP in 15 minutes, login answers `429` with `Retry-After`.

## Errors

Every failure has the same shape:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "The event is invalid",
    "fields": { "title": ["Too small: expected string to have >=1 characters"] }
  }
}
```

| Status | `code`                | When                                                      |
| ------ | --------------------- | --------------------------------------------------------- |
| 400    | `invalid_json`        | The body is not valid JSON                                |
| 400    | `invalid_query`       | Bad query parameters (missing `tz`, bad range or cursor)  |
| 401    | `unauthorized`        | No session, or it expired or was revoked                  |
| 401    | `invalid_credentials` | Wrong password at login                                   |
| 403    | `csrf_rejected`       | A cookie write (or browser login) from an unlisted origin |
| 404    | `not_found`           | No such event or session (or it was deleted), or no route |
| 409    | `conflict`            | `POST /events` with an `id` that already exists           |
| 413    | `payload_too_large`   | An import body over 5 MB                                  |
| 422    | `validation_failed`   | Well-formed input that breaks the rules                   |
| 429    | `rate_limited`        | Too many failed logins; see `Retry-After`                 |
| 500    | `internal`            | Anything unexpected (details are logged, not returned)    |

## Routes and curl examples

All routes are under `/api/v1`. Set a base URL, log in, and keep the token in a header variable:

```sh
API=http://localhost:4001/api/v1

# Log in (type your password where it says so; nothing else in these examples is secret)
TOKEN=$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d '{"password":"<your password>","client":"token","label":"curl"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0, "utf8")).token')
AUTH="Authorization: Bearer $TOKEN"
```

### Sessions: `/auth/me`, `/auth/sessions`, `/auth/logout`

```sh
curl -H "$AUTH" "$API/auth/me"          # { "session": { "id", "label", "createdAt", "lastUsedAt", "expiresAt" } }
curl -H "$AUTH" "$API/auth/sessions"    # every active session, with "current": true for this one

# Sign out another device by its session id, or sign out this one
curl -i -X DELETE -H "$AUTH" "$API/auth/sessions/<session id>"
curl -i -X POST -H "$AUTH" "$API/auth/logout"
```

### The cookie flow (what the web app does)

Browsers send `Origin` themselves; with curl you set it by hand, and it must be in `CORS_ORIGINS`.

```sh
curl -s -c cookies.txt -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:5173' -d '{"password":"<your password>","client":"browser"}'
curl -b cookies.txt "$API/events"                                   # reads need no Origin
curl -b cookies.txt -X POST "$API/events" -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:5173' \
  -d '{"title":"From the cookie","start":"2026-10-25","allDay":true,"timezone":"Asia/Karachi"}'
```

### List events: `GET /events`

Query parameters: `from` and `to` (ISO instants, a half-open range `[from, to)`), `tz` (IANA zone,
required with a range; it decides which local days all-day events cover), `q` (searches title,
notes and location), `limit` (1–200, default 50) and `cursor` (from `nextCursor`).

```sh
# Everything (first page)
curl -H "$AUTH" "$API/events"

# The Karachi day of 24 October 2026
curl -H "$AUTH" "$API/events?from=2026-10-23T19:00:00Z&to=2026-10-24T19:00:00Z&tz=Asia/Karachi"

# Search, two per page, then the next page
curl -H "$AUTH" "$API/events?q=dentist&limit=2"
curl -H "$AUTH" "$API/events?q=dentist&limit=2&cursor=<nextCursor from the previous response>"
```

Response: `{ "events": [...], "nextCursor": "..." | null }`.

### Create: `POST /events`

```sh
# Timed event (UTC instants)
curl -X POST "$API/events" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"title":"Dentist","start":"2026-10-24T11:00:00Z","end":"2026-10-24T12:00:00Z","timezone":"Asia/Karachi","color":"teal","reminders":[30]}'

# All-day, three days (the end date is exclusive, like iCal)
curl -X POST "$API/events" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"title":"Conference","start":"2026-11-03","end":"2026-11-06","allDay":true,"timezone":"Asia/Karachi"}'

# With a client-generated id (a second POST with the same id returns 409)
curl -X POST "$API/events" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"id":"0190f5a2-7c3e-7b1a-9d4e-1a2b3c4d5e6f","title":"Lunch","start":"2026-10-25","allDay":true,"timezone":"Asia/Karachi"}'
```

Returns `201` with the event and a `Location` header.

### Read, update, delete: `/events/:id`

```sh
ID=0190f5a2-7c3e-7b1a-9d4e-1a2b3c4d5e6f

curl -H "$AUTH" "$API/events/$ID"

# Partial update; the result is re-checked (e.g. end must stay after start)
curl -X PATCH "$API/events/$ID" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"color":"red","notes":"Table for two"}'

# Soft delete: 204, the row stays as a tombstone with deletedAt set
curl -i -X DELETE -H "$AUTH" "$API/events/$ID"

# Undo the delete: clears deletedAt (404 if the event is not deleted)
curl -X POST -H "$AUTH" "$API/events/$ID/restore"
```

### Import: `POST /events/import?tz=`

Accepts a v0 `AgendaData.json` export, a v1 `export.json`, or a mix. `tz` is the zone the v0 app
ran in, so v0 dates land on the right local day. Rows whose id already exists are skipped, so
importing the same file twice changes nothing.

```sh
curl -X POST "$API/events/import?tz=Asia/Karachi" -H "$AUTH" -H 'Content-Type: application/json' \
  --data-binary @apps/api/test/fixtures/AgendaData.v0.built.json
```

Response: `{ "imported": 5, "skipped": [{ "index": 2, "reason": "title: Too small: …" }] }`.

### Export: `GET /events/export.json` and `GET /events/export.ics`

```sh
curl -OJ -H "$AUTH" "$API/events/export.json"   # saves agenda-export.json (v1, re-importable)
curl -OJ -H "$AUTH" "$API/events/export.ics"    # saves agenda.ics (all-day events use VALUE=DATE)
```
