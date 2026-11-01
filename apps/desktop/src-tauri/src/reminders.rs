//! Reminder notifications. The web app works out when each reminder is due (core's
//! reminderSchedule) and sends the whole list whenever events change; this module only
//! waits and shows each one once. It runs here, not in the page, because a hidden
//! webview's timers are slowed down to about once a minute.
//!
//! "Once" survives restarts: the keys of reminders already shown are kept in a small
//! store file. A key names the event, the offset and the start time, so moving an event
//! gives its reminders new keys and they fire again for the new time.

use serde::Deserialize;
use std::collections::HashMap;
use std::sync::{Condvar, Mutex, PoisonError};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_store::StoreExt;

const STORE: &str = "reminders.json";
const FIRED_KEY: &str = "fired";
/// A reminder up to this late (the app was starting, or the PC was asleep) still shows;
/// an older one is skipped rather than shown hours late.
pub const GRACE_MS: i64 = 5 * 60 * 1000;
/// Shown keys are forgotten after this long; their events are long past by then.
const KEEP_FIRED_MS: i64 = 2 * 24 * 60 * 60 * 1000;
/// The longest sleep between checks, so a changed clock or a resume from sleep is
/// noticed soon.
const MAX_WAIT_MS: i64 = 30 * 1000;

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Reminder {
    pub key: String,
    /// When to show it, in milliseconds since 1970 (UTC).
    pub at_ms: i64,
    pub title: String,
    pub body: String,
}

/// Shown keys and the time each was due.
type Fired = HashMap<String, i64>;

#[derive(Default)]
struct Inner {
    schedule: Vec<Reminder>,
    fired: Fired,
}

#[derive(Default)]
pub struct Reminders {
    inner: Mutex<Inner>,
    changed: Condvar,
}

/// The reminders to show now: due, not more than GRACE_MS late, and not shown before.
pub fn due(schedule: &[Reminder], fired: &Fired, now: i64) -> Vec<Reminder> {
    schedule
        .iter()
        .filter(|r| r.at_ms <= now && now - r.at_ms <= GRACE_MS && !fired.contains_key(&r.key))
        .cloned()
        .collect()
}

/// How long to sleep before the next reminder is due (at most MAX_WAIT_MS).
pub fn wait_ms(schedule: &[Reminder], fired: &Fired, now: i64) -> i64 {
    schedule
        .iter()
        .filter(|r| r.at_ms > now && !fired.contains_key(&r.key))
        .map(|r| r.at_ms - now)
        .min()
        .unwrap_or(MAX_WAIT_MS)
        .min(MAX_WAIT_MS)
}

/// Forgets keys whose reminders were due more than KEEP_FIRED_MS ago.
pub fn prune(fired: &mut Fired, now: i64) {
    fired.retain(|_, at_ms| now - *at_ms <= KEEP_FIRED_MS);
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| {
            i64::try_from(elapsed.as_millis()).unwrap_or(i64::MAX)
        })
}

fn load_fired(app: &AppHandle) -> Fired {
    app.store(STORE)
        .ok()
        .and_then(|store| store.get(FIRED_KEY))
        .and_then(|value| serde_json::from_value(value).ok())
        .unwrap_or_default()
}

fn save_fired(app: &AppHandle, fired: &Fired) {
    let Ok(store) = app.store(STORE) else {
        return;
    };
    store.set(FIRED_KEY, serde_json::json!(fired));
    if let Err(error) = store.save() {
        eprintln!("Couldn't save the shown reminders: {error}");
    }
}

/// Starts the thread that shows reminders for as long as the app runs.
pub fn start(app: AppHandle) {
    let fired = load_fired(&app);
    app.state::<Reminders>()
        .inner
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .fired = fired;

    std::thread::spawn(move || {
        let state = app.state::<Reminders>();
        let mut inner = state.inner.lock().unwrap_or_else(PoisonError::into_inner);
        loop {
            let now = now_ms();
            let to_show = due(&inner.schedule, &inner.fired, now);
            if to_show.is_empty() {
                let wait = wait_ms(&inner.schedule, &inner.fired, now);
                let wait = Duration::from_millis(u64::try_from(wait).unwrap_or(0));
                inner = state
                    .changed
                    .wait_timeout(inner, wait)
                    .unwrap_or_else(PoisonError::into_inner)
                    .0;
                continue;
            }
            for reminder in &to_show {
                inner.fired.insert(reminder.key.clone(), reminder.at_ms);
            }
            prune(&mut inner.fired, now);
            let fired = inner.fired.clone();
            // Notifications and the file write happen without holding the lock.
            drop(inner);
            save_fired(&app, &fired);
            for reminder in to_show {
                let shown = app
                    .notification()
                    .builder()
                    .title(&reminder.title)
                    .body(&reminder.body)
                    .show();
                if let Err(error) = shown {
                    eprintln!("Couldn't show a reminder: {error}");
                }
            }
            inner = state.inner.lock().unwrap_or_else(PoisonError::into_inner);
        }
    });
}

/// Replaces the whole schedule; the thread wakes up and works from the new one.
#[tauri::command]
pub fn set_reminders(state: State<'_, Reminders>, reminders: Vec<Reminder>) {
    state
        .inner
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .schedule = reminders;
    state.changed.notify_all();
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_793_000_000_000;

    fn reminder(key: &str, at_ms: i64) -> Reminder {
        Reminder {
            key: key.to_owned(),
            at_ms,
            title: "Dentist".to_owned(),
            body: "16:00 – 17:00".to_owned(),
        }
    }

    #[test]
    fn shows_what_is_due_within_the_grace_period() {
        let schedule = [
            reminder("due-now", NOW),
            reminder("a-minute-late", NOW - 60_000),
            reminder("too-late", NOW - GRACE_MS - 1),
            reminder("later", NOW + 1),
        ];
        let keys: Vec<_> = due(&schedule, &Fired::new(), NOW)
            .into_iter()
            .map(|r| r.key)
            .collect();
        assert_eq!(keys, ["due-now", "a-minute-late"]);
    }

    #[test]
    fn never_shows_a_key_twice() {
        let schedule = [reminder("a", NOW - 1_000)];
        let fired = Fired::from([("a".to_owned(), NOW - 1_000)]);
        assert!(due(&schedule, &fired, NOW).is_empty());
    }

    #[test]
    fn a_moved_event_gets_a_new_key_and_fires_again() {
        let fired = Fired::from([("e1:30:2026-11-02T10:00:00.000Z".to_owned(), NOW - 1_000)]);
        let moved = [reminder("e1:30:2026-11-02T11:00:00.000Z", NOW)];
        assert_eq!(due(&moved, &fired, NOW), moved);
    }

    #[test]
    fn sleeps_until_the_next_reminder_or_thirty_seconds() {
        let fired = Fired::from([("shown".to_owned(), NOW + 5_000)]);
        let schedule = [
            reminder("shown", NOW + 5_000),
            reminder("next", NOW + 10_000),
        ];
        assert_eq!(wait_ms(&schedule, &fired, NOW), 10_000);
        assert_eq!(wait_ms(&[], &fired, NOW), MAX_WAIT_MS);
        assert_eq!(
            wait_ms(&[reminder("far", NOW + 3_600_000)], &fired, NOW),
            MAX_WAIT_MS
        );
    }

    #[test]
    fn forgets_old_keys() {
        let mut fired = Fired::from([
            ("old".to_owned(), NOW - KEEP_FIRED_MS - 1),
            ("recent".to_owned(), NOW - 1_000),
        ]);
        prune(&mut fired, NOW);
        assert_eq!(fired.keys().collect::<Vec<_>>(), ["recent"]);
    }

    #[test]
    fn reads_the_list_the_web_app_sends() {
        let json = r#"[{"key":"k","atMs":5,"title":"Call Ali","body":"15:00"}]"#;
        let list: Vec<Reminder> = serde_json::from_str(json).unwrap();
        assert_eq!(list[0].at_ms, 5);
        assert_eq!(list[0].title, "Call Ali");
    }
}
