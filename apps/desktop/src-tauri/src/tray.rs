//! The tray icon and its menu: the next events (sent by the web app, which owns the
//! data and the formatting), then Quick add…, Open Agenda and Quit.

use crate::{main_window, quick_add};
use serde::Deserialize;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{App, AppHandle};

const TRAY_ID: &str = "agenda";
const QUICK_ADD: &str = "quick-add";
const OPEN: &str = "open";
const QUIT: &str = "quit";
const EVENT_PREFIX: &str = "event:";
/// Until the main window sends its first list.
const STARTING: &str = "Open Agenda to see your events";

/// One line of the menu. With a path it is a link into the app; without, a note
/// ("Nothing today or tomorrow") that can't be clicked.
#[derive(Debug, Deserialize)]
pub struct TrayItem {
    label: String,
    path: Option<String>,
}

#[derive(Debug, PartialEq)]
enum Action<'a> {
    QuickAdd,
    Open(Option<&'a str>),
    Quit,
    None,
}

/// Event ids are "event:<index>:<path>", so two events on one day get different ids.
fn action(id: &str) -> Action<'_> {
    match id {
        QUICK_ADD => Action::QuickAdd,
        OPEN => Action::Open(None),
        QUIT => Action::Quit,
        other => match other
            .strip_prefix(EVENT_PREFIX)
            .and_then(|rest| rest.split_once(':'))
        {
            Some((_, path)) => Action::Open(Some(path)),
            None => Action::None,
        },
    }
}

/// Windows menus treat "&" as a keyboard-accelerator marker; "&&" shows one "&".
fn menu_text(label: &str) -> String {
    if cfg!(windows) {
        label.replace('&', "&&")
    } else {
        label.to_owned()
    }
}

fn build_menu(app: &AppHandle, items: &[TrayItem]) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::new(app)?;
    for (index, item) in items.iter().enumerate() {
        let id = match &item.path {
            Some(path) => format!("{EVENT_PREFIX}{index}:{path}"),
            None => format!("note:{index}"),
        };
        let text = menu_text(&item.label);
        menu.append(&MenuItem::with_id(
            app,
            id,
            text,
            item.path.is_some(),
            None::<&str>,
        )?)?;
    }
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&MenuItem::with_id(
        app,
        QUICK_ADD,
        "Quick add…",
        true,
        None::<&str>,
    )?)?;
    menu.append(&MenuItem::with_id(
        app,
        OPEN,
        "Open Agenda",
        true,
        None::<&str>,
    )?)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&MenuItem::with_id(app, QUIT, "Quit", true, None::<&str>)?)?;
    Ok(menu)
}

pub fn create(app: &App) -> tauri::Result<()> {
    let starting = [TrayItem {
        label: STARTING.to_owned(),
        path: None,
    }];
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Agenda")
        .menu(&build_menu(app.handle(), &starting)?)
        // Left click opens the app; right click shows the menu.
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match action(event.id().as_ref()) {
            Action::QuickAdd => quick_add::open(app),
            Action::Open(path) => main_window::show(app, path),
            Action::Quit => app.exit(0),
            Action::None => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                main_window::show(tray.app_handle(), None);
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

/// The web app sends the list whenever its events or the time change.
#[tauri::command]
pub fn set_tray_items(app: AppHandle, items: Vec<TrayItem>) -> Result<(), String> {
    let tray = app.tray_by_id(TRAY_ID).ok_or("The tray icon is missing")?;
    let menu = build_menu(&app, &items).map_err(crate::text_error)?;
    tray.set_menu(Some(menu)).map_err(crate::text_error)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_menu_ids() {
        assert_eq!(action("quick-add"), Action::QuickAdd);
        assert_eq!(action("open"), Action::Open(None));
        assert_eq!(action("quit"), Action::Quit);
        assert_eq!(
            action("event:3:/day/2026-11-02"),
            Action::Open(Some("/day/2026-11-02"))
        );
        assert_eq!(action("note:0"), Action::None);
        assert_eq!(action("event:broken"), Action::None);
    }

    #[test]
    fn escapes_ampersands_on_windows() {
        let expected = if cfg!(windows) {
            "Tom && Jerry"
        } else {
            "Tom & Jerry"
        };
        assert_eq!(menu_text("Tom & Jerry"), expected);
    }
}
