use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    webview::WebviewWindowBuilder,
    Manager, RunEvent, WebviewUrl,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        // Option+Shift+N
                        if shortcut.matches(Modifiers::ALT | Modifiers::SHIFT, Code::KeyN) {
                            create_quick_note_window(app);
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            // Register the global shortcut (Option+Shift+N)
            let shortcut = Shortcut::new(Some(Modifiers::ALT | Modifiers::SHIFT), Code::KeyN);
            app.global_shortcut().register(shortcut)?;

            // Setup system tray
            let quit = MenuItem::with_id(app, "quit", "Quit Lumen", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Show Lumen", true, None::<&str>)?;
            let quick_note =
                MenuItem::with_id(app, "quick_note", "Quick Note (⌥⇧N)", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quick_note, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Lumen")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        show_main_window(app);
                    }
                    "quick_note" => {
                        create_quick_note_window(app);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Hide main window instead of quitting when closed
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // Run the app with event handling for dock icon click (macOS reopen)
    app.run(|app_handle, event| {
        if let RunEvent::Reopen {
            has_visible_windows,
            ..
        } = event
        {
            if !has_visible_windows {
                show_main_window(app_handle);
            }
        }
    });
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn create_quick_note_window(app: &tauri::AppHandle) {
    // Check if window already exists
    if let Some(window) = app.get_webview_window("quick-note") {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    // Create new quick-note window
    // Note: path without leading "/" to be relative to frontendDist base path
    let _ = WebviewWindowBuilder::new(app, "quick-note", WebviewUrl::App("quick-note".into()))
        .title("Quick Note")
        .inner_size(400.0, 300.0)
        .center()
        .always_on_top(true)
        .decorations(true)
        .resizable(true)
        .minimizable(false)
        .maximizable(false)
        .build();
}
