const express = require('express');
const { randomUUID } = require('node:crypto');

function validateEvent(body) {
    if (!body || typeof body.title !== 'string' || !body.title.trim()) {
        return 'title is required';
    }
    if (!body.date || isNaN(new Date(body.date).getTime())) {
        return 'a valid date is required';
    }
    return null;
}

function rowToEvent(row) {
    return {
        id: row.id,
        title: row.title,
        description: row.description || '',
        date: row.date,
    };
}

function createEventsRouter(db) {
    const router = express.Router();

    const listStmt = db.prepare('SELECT * FROM events ORDER BY date ASC');
    const getStmt = db.prepare('SELECT * FROM events WHERE id = ?');
    const insertStmt = db.prepare(
        'INSERT INTO events (id, title, description, date) VALUES (?, ?, ?, ?)'
    );
    const updateStmt = db.prepare(
        'UPDATE events SET title = ?, description = ?, date = ? WHERE id = ?'
    );
    const deleteStmt = db.prepare('DELETE FROM events WHERE id = ?');

    router.get('/events', (req, res) => {
        const rows = listStmt.all();
        res.json(rows.map(rowToEvent));
    });

    router.post('/events', (req, res) => {
        const error = validateEvent(req.body);
        if (error) {
            return res.status(400).json({ error });
        }
        const event = {
            id: randomUUID(),
            title: req.body.title.trim(),
            description: req.body.description || '',
            date: new Date(req.body.date).toISOString(),
        };
        insertStmt.run(event.id, event.title, event.description, event.date);
        res.status(201).json(event);
    });

    router.post('/events/import', (req, res) => {
        if (!Array.isArray(req.body)) {
            return res.status(400).json({ error: 'expected an array of events' });
        }
        const imported = [];
        for (const item of req.body) {
            if (validateEvent(item)) continue;
            const event = {
                id: randomUUID(),
                title: item.title.trim(),
                description: item.description || '',
                date: new Date(item.date).toISOString(),
            };
            insertStmt.run(event.id, event.title, event.description, event.date);
            imported.push(event);
        }
        res.status(201).json(imported);
    });

    router.put('/events/:id', (req, res) => {
        const existing = getStmt.get(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'event not found' });
        }
        const error = validateEvent(req.body);
        if (error) {
            return res.status(400).json({ error });
        }
        const event = {
            id: req.params.id,
            title: req.body.title.trim(),
            description: req.body.description || '',
            date: new Date(req.body.date).toISOString(),
        };
        updateStmt.run(event.title, event.description, event.date, event.id);
        res.json(event);
    });

    router.delete('/events/:id', (req, res) => {
        const existing = getStmt.get(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'event not found' });
        }
        deleteStmt.run(req.params.id);
        res.status(204).end();
    });

    return router;
}

module.exports = { createEventsRouter, validateEvent };
