import { useCallback, useEffect, useState } from 'react';

const parseEvent = (event) => ({ ...event, date: new Date(event.date) });

async function request(url, options) {
    const res = await fetch(url, {
        headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
        ...options,
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
    }
    if (res.status === 204) return null;
    return res.json();
}

let useAgendaEvents = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        request('/api/events')
            .then((data) => {
                if (!cancelled) setEvents(data.map(parseEvent));
            })
            .catch((err) => {
                if (!cancelled) setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const addEvent = useCallback(async (newEvent) => {
        try {
            const created = await request('/api/events', {
                method: 'POST',
                body: JSON.stringify(newEvent),
            });
            setEvents((prev) => [...prev, parseEvent(created)]);
            return { ok: true };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    }, []);

    const editEvent = useCallback(async (data) => {
        try {
            const updated = await request(`/api/events/${data.id}`, {
                method: 'PUT',
                body: JSON.stringify(data),
            });
            setEvents((prev) =>
                prev.map((event) => (event.id === updated.id ? parseEvent(updated) : event))
            );
            return { ok: true };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    }, []);

    const deleteEvent = useCallback(async (id) => {
        try {
            await request(`/api/events/${id}`, { method: 'DELETE' });
            setEvents((prev) => prev.filter((event) => event.id !== id));
            return { ok: true };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    }, []);

    const importEvents = useCallback(async (rawEvents) => {
        try {
            const imported = await request('/api/events/import', {
                method: 'POST',
                body: JSON.stringify(rawEvents),
            });
            setEvents((prev) => [...prev, ...imported.map(parseEvent)]);
            return { ok: true };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    }, []);

    return { events, loading, error, addEvent, editEvent, deleteEvent, importEvents };
};

export default useAgendaEvents;
