// Transpiler desktop shell.
//
// IMPORTANT SCOPE NOTE (read this before building an installer for
// distribution): this shell spawns the backend from an already-set-up
// local install — the same Python virtual environment that
// start_windows.bat creates at %LOCALAPPDATA%\TranspilerApp\venv-backend,
// running the backend source from wherever your project's `backend`
// folder lives on disk. It does NOT bundle Python, Manim, FFmpeg, or
// LaTeX into a self-contained installer — this app requires those to be
// installed locally regardless of whether you run it via
// start_windows.bat or this native shell, so bundling them is a separate,
// much larger effort (see ROADMAP.md Phase 5 notes) rather than something
// silently skipped here.
//
// One-time setup after building/installing this shell: create
// `backend-config.json` next to the installed .exe (see
// backend-config.example.json in this folder) pointing `backend_dir` at
// your project's `backend` folder.

use serde::Deserialize;
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;
use tauri::Manager;

#[derive(Deserialize)]
struct BackendConfig {
    backend_dir: String,
}

struct BackendProcess(Mutex<Option<Child>>);

fn venv_python_path() -> PathBuf {
    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".into());
    PathBuf::from(local_app_data)
        .join("TranspilerApp")
        .join("venv-backend")
        .join("Scripts")
        .join("python.exe")
}

fn load_backend_dir() -> Option<PathBuf> {
    let exe_dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    let config_path = exe_dir.join("backend-config.json");
    let raw = std::fs::read_to_string(&config_path).ok()?;
    let config: BackendConfig = serde_json::from_str(&raw).ok()?;
    Some(PathBuf::from(config.backend_dir))
}

fn wait_for_backend(max_attempts: u32) -> bool {
    for _ in 0..max_attempts {
        if TcpStream::connect("127.0.0.1:8000").is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(400));
    }
    false
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            let python = venv_python_path();
            let backend_dir = load_backend_dir();

            match backend_dir {
                Some(dir) if python.exists() && dir.exists() => {
                    match Command::new(&python)
                        .args(["-m", "app.main"])
                        .current_dir(&dir)
                        .spawn()
                    {
                        Ok(child) => {
                            let state = app.state::<BackendProcess>();
                            *state.0.lock().unwrap() = Some(child);
                            // Give the backend a moment to bind its port before
                            // the window tries to load http://127.0.0.1:8000.
                            // This is a best-effort wait, not a guarantee - if
                            // Manim/deps are still installing, or the machine
                            // is slow, a manual reload (Ctrl+R) in the window
                            // may still be needed once.
                            wait_for_backend(20);
                        }
                        Err(e) => {
                            eprintln!("Failed to start Transpiler backend: {e}");
                        }
                    }
                }
                Some(_) => {
                    eprintln!(
                        "backend-config.json's backend_dir or the venv python ({}) does not exist. \
                         Run start_windows.bat once from your project folder first, then check \
                         backend-config.json next to this executable.",
                        python.display()
                    );
                }
                None => {
                    eprintln!(
                        "No backend-config.json found next to the executable. Copy \
                         backend-config.example.json to backend-config.json and set \
                         backend_dir to your project's backend folder."
                    );
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state = window.state::<BackendProcess>();
                if let Some(mut child) = state.0.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Transpiler");
}
