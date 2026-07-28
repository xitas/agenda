# Agenda

A small agenda/event manager: add, view, edit, delete, import, and export events. Built with React (Create React App) on the frontend and a small Express + SQLite API on the backend, so your events persist in a real database instead of living only in browser state.

## Stack

- **Frontend**: React 18, react-bootstrap, react-datepicker
- **Backend**: Express, [`node:sqlite`](https://nodejs.org/api/sqlite.html) (Node's built-in SQLite module — no native build step required)
- **Requires**: Node.js 22.5+ (for `node:sqlite`)

## Getting started

```
npm install
npm run dev
```

`npm run dev` starts both the API server (port 4001) and the React dev server (port 3000, proxying `/api/*` to the backend) together. Open [http://localhost:3000](http://localhost:3000).

The database file is created automatically at `server/agenda.db` on first run, seeded with a few example events.

## Available scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the API server and the React dev server together (recommended for local development) |
| `npm start` | Runs only the React dev server (expects the API to already be running separately) |
| `npm run server` | Runs only the API server |
| `npm test` | Runs the frontend test suite (Jest, via react-scripts) |
| `npm run test:server` | Runs the backend test suite (Node's built-in test runner) |
| `npm run build` | Builds the frontend for production into `build/` |

## Production

After `npm run build`, `npm run server` will serve the built frontend and the `/api/*` routes from the same process/port — no separate static server needed.
