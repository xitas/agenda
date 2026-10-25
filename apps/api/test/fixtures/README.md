# Test fixtures

- `AgendaData.v0.built.json`: built to match what the v0 app's Export button wrote
  (`JSON.stringify(events)` in `legacy/src/Agenda/Agenda.js`): dates are UTC instants of
  local midnight in Asia/Karachi (the date picker), ids mix nanoid (old client) and UUID
  (v0 server), and one row has no `description`.
- `AgendaData.v0.json` (not yet added): a real export from the v0 app. When it is added,
  point the end-to-end import test in `test/import-export.test.ts` at it.
