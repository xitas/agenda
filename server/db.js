const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');

function seedEvents() {
    const today = new Date();
    const inDays = (n) => {
        const d = new Date(today);
        d.setDate(d.getDate() + n);
        return d.toISOString();
    };
    return [
        {
            id: randomUUID(),
            title: 'Meeting',
            description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Debitis, repellat.',
            date: inDays(0),
        },
        {
            id: randomUUID(),
            title: 'Vacation',
            description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Debitis, repellat.',
            date: inDays(2),
        },
        {
            id: randomUUID(),
            title: 'Conference',
            description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Debitis, repellat.',
            date: inDays(7),
        },
    ];
}

function createDb(dbPath) {
    const db = new DatabaseSync(dbPath);

    db.exec(`
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            date TEXT NOT NULL
        )
    `);

    const count = db.prepare('SELECT COUNT(*) AS count FROM events').get().count;
    if (count === 0) {
        const insert = db.prepare(
            'INSERT INTO events (id, title, description, date) VALUES (?, ?, ?, ?)'
        );
        for (const event of seedEvents()) {
            insert.run(event.id, event.title, event.description, event.date);
        }
    }

    return db;
}

module.exports = { createDb, defaultDbPath: path.join(__dirname, 'agenda.db') };
