const path = require('path');
const express = require('express');
const { createDb, defaultDbPath } = require('./db');
const { createEventsRouter } = require('./routes/events');

const db = createDb(defaultDbPath);
const app = express();

app.use(express.json());
app.use('/api', createEventsRouter(db));

const buildPath = path.join(__dirname, '..', 'build');
app.use(express.static(buildPath));

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
    console.log(`Agenda API listening on http://localhost:${PORT}`);
});
