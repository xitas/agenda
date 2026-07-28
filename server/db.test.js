const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const express = require('express');
const http = require('node:http');
const { createEventsRouter, validateEvent } = require('./routes/events');

function makeTestApp() {
    const db = new DatabaseSync(':memory:');
    db.exec(`
        CREATE TABLE events (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            date TEXT NOT NULL
        )
    `);
    const app = express();
    app.use(express.json());
    app.use('/api', createEventsRouter(db));
    return app;
}

function listen(app) {
    return new Promise((resolve) => {
        const server = app.listen(0, () => resolve(server));
    });
}

async function request(server, method, urlPath, body) {
    const { port } = server.address();
    const res = await fetch(`http://localhost:${port}${urlPath}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
}

test('validateEvent rejects missing title and bad dates', () => {
    assert.equal(validateEvent({ title: '', date: '2026-01-01' }), 'title is required');
    assert.equal(validateEvent({ title: 'x', date: 'not-a-date' }), 'a valid date is required');
    assert.equal(validateEvent({ title: 'x', date: '2026-01-01' }), null);
});

test('full CRUD lifecycle through the API', async () => {
    const server = await listen(makeTestApp());
    try {
        const empty = await request(server, 'GET', '/api/events');
        assert.deepEqual(empty.body, []);

        const created = await request(server, 'POST', '/api/events', {
            title: 'Standup',
            description: 'Daily sync',
            date: '2026-08-01T00:00:00.000Z',
        });
        assert.equal(created.status, 201);
        assert.equal(created.body.title, 'Standup');
        const id = created.body.id;

        const afterCreate = await request(server, 'GET', '/api/events');
        assert.equal(afterCreate.body.length, 1);

        const updated = await request(server, 'PUT', `/api/events/${id}`, {
            title: 'Standup (moved)',
            description: 'Daily sync',
            date: '2026-08-02T00:00:00.000Z',
        });
        assert.equal(updated.status, 200);
        assert.equal(updated.body.title, 'Standup (moved)');

        const rejected = await request(server, 'PUT', `/api/events/${id}`, {
            title: '',
            date: '2026-08-02T00:00:00.000Z',
        });
        assert.equal(rejected.status, 400);

        const deleted = await request(server, 'DELETE', `/api/events/${id}`);
        assert.equal(deleted.status, 204);

        const missing = await request(server, 'DELETE', `/api/events/${id}`);
        assert.equal(missing.status, 404);

        const afterDelete = await request(server, 'GET', '/api/events');
        assert.deepEqual(afterDelete.body, []);
    } finally {
        server.close();
    }
});

test('import endpoint skips invalid records and regenerates ids', async () => {
    const server = await listen(makeTestApp());
    try {
        const result = await request(server, 'POST', '/api/events/import', [
            { id: 'dup', title: 'Valid one', date: '2026-08-01T00:00:00.000Z' },
            { id: 'dup', title: '', date: '2026-08-01T00:00:00.000Z' },
            { id: 'dup', title: 'Valid two', date: 'not-a-date' },
        ]);
        assert.equal(result.status, 201);
        assert.equal(result.body.length, 1);
        assert.notEqual(result.body[0].id, 'dup');
    } finally {
        server.close();
    }
});
