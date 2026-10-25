# @agenda/api

The Agenda REST API: Hono on Node, Drizzle ORM, libSQL (a local SQLite file in dev, Turso later).

## Run it

```sh
cp apps/api/.env.example apps/api/.env      # optional; the defaults work
pnpm --filter @agenda/api dev               # http://localhost:4001/api/v1, restarts on change
pnpm --filter @agenda/api db:seed           # sample events around today (machine's zone)
pnpm --filter @agenda/api db:seed Asia/Karachi
```

The server applies pending migrations on start. To run them on their own:

```sh
pnpm --filter @agenda/api db:migrate
```

After changing `src/db/schema.ts`, generate a migration and commit the SQL it writes to `drizzle/`:

```sh
pnpm --filter @agenda/api db:generate
```

| Variable       | Default                 | Meaning                                 |
| -------------- | ----------------------- | --------------------------------------- |
| `DATABASE_URL` | `file:./data/agenda.db` | libSQL URL (`file:`, `:memory:`, Turso) |
| `PORT`         | `4001`                  | Port to listen on                       |

## Code layout

```
src/
  app.ts            createApp({ db, now }) builds the Hono app (tests use an in-memory db)
  index.ts          reads env, migrates, starts the server
  env.ts            environment variables, validated with Zod
  errors.ts         ApiError and the { error: { code, message, fields? } } shape
  db/schema.ts      the events table (Drizzle)
  db/migrate.ts     applies drizzle/*.sql
  events/repo.ts    queries: range overlap, search, cursor paging, soft delete
  events/routes.ts  the /api/v1/events routes
drizzle/            generated migrations (committed)
test/               Vitest tests and fixtures
```

Authentication arrives in step 1.4; its middleware goes on the `api` sub-app in `src/app.ts`.

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

| Status | `code`              | When                                                     |
| ------ | ------------------- | -------------------------------------------------------- |
| 400    | `invalid_json`      | The body is not valid JSON                               |
| 400    | `invalid_query`     | Bad query parameters (missing `tz`, bad range or cursor) |
| 404    | `not_found`         | No such event (or it was deleted), or no such route      |
| 409    | `conflict`          | `POST /events` with an `id` that already exists          |
| 413    | `payload_too_large` | An import body over 5 MB                                 |
| 422    | `validation_failed` | Well-formed input that breaks the event rules            |
| 500    | `internal`          | Anything unexpected (details are logged, not returned)   |

## Routes and curl examples

All routes are under `/api/v1`. Set a base URL first:

```sh
API=http://localhost:4001/api/v1
```

### List events: `GET /events`

Query parameters: `from` and `to` (ISO instants, a half-open range `[from, to)`), `tz` (IANA zone,
required with a range; it decides which local days all-day events cover), `q` (searches title,
notes and location), `limit` (1–200, default 50) and `cursor` (from `nextCursor`).

```sh
# Everything (first page)
curl "$API/events"

# The Karachi day of 24 October 2026
curl "$API/events?from=2026-10-23T19:00:00Z&to=2026-10-24T19:00:00Z&tz=Asia/Karachi"

# Search, two per page, then the next page
curl "$API/events?q=dentist&limit=2"
curl "$API/events?q=dentist&limit=2&cursor=<nextCursor from the previous response>"
```

Response: `{ "events": [...], "nextCursor": "..." | null }`.

### Create: `POST /events`

```sh
# Timed event (UTC instants)
curl -X POST "$API/events" -H 'Content-Type: application/json' \
  -d '{"title":"Dentist","start":"2026-10-24T11:00:00Z","end":"2026-10-24T12:00:00Z","timezone":"Asia/Karachi","color":"teal","reminders":[30]}'

# All-day, three days (the end date is exclusive, like iCal)
curl -X POST "$API/events" -H 'Content-Type: application/json' \
  -d '{"title":"Conference","start":"2026-11-03","end":"2026-11-06","allDay":true,"timezone":"Asia/Karachi"}'

# With a client-generated id (a second POST with the same id returns 409)
curl -X POST "$API/events" -H 'Content-Type: application/json' \
  -d '{"id":"0190f5a2-7c3e-7b1a-9d4e-1a2b3c4d5e6f","title":"Lunch","start":"2026-10-25","allDay":true,"timezone":"Asia/Karachi"}'
```

Returns `201` with the event and a `Location` header.

### Read, update, delete: `/events/:id`

```sh
ID=0190f5a2-7c3e-7b1a-9d4e-1a2b3c4d5e6f

curl "$API/events/$ID"

# Partial update; the result is re-checked (e.g. end must stay after start)
curl -X PATCH "$API/events/$ID" -H 'Content-Type: application/json' -d '{"color":"red","notes":"Table for two"}'

# Soft delete: 204, the row stays as a tombstone with deletedAt set
curl -i -X DELETE "$API/events/$ID"
```

### Import: `POST /events/import?tz=`

Accepts a v0 `AgendaData.json` export, a v1 `export.json`, or a mix. `tz` is the zone the v0 app
ran in, so v0 dates land on the right local day. Rows whose id already exists are skipped, so
importing the same file twice changes nothing.

```sh
curl -X POST "$API/events/import?tz=Asia/Karachi" -H 'Content-Type: application/json' \
  --data-binary @apps/api/test/fixtures/AgendaData.v0.built.json
```

Response: `{ "imported": 5, "skipped": [{ "index": 2, "reason": "title: Too small: …" }] }`.

### Export: `GET /events/export.json` and `GET /events/export.ics`

```sh
curl -OJ "$API/events/export.json"   # saves agenda-export.json (v1, re-importable)
curl -OJ "$API/events/export.ics"    # saves agenda.ics (all-day events use VALUE=DATE)
```
