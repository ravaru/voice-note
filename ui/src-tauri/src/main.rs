//! Tauri entrypoint that spawns the Python backend.
//!
//! We keep this minimal: start backend, let the frontend poll /health.

use std::{
    process::{Child, Command, Stdio},
    sync::Mutex,
};

use tauri::{Manager, RunEvent};
use std::path::{Path, PathBuf};

fn find_backend_dir() -> Option<PathBuf> {
    if let Ok(explicit) = std::env::var("VOICENOTE_BACKEND_DIR") {
        let path = PathBuf::from(explicit);
        if path.join("app/main.py").exists() {
            return Some(path);
        }
    }

    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(current) = std::env::current_dir() {
        candidates.push(current);
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.to_path_buf());
        }
    }

    for base in candidates {
        let mut cursor: &Path = &base;
        for _ in 0..6 {
            let probe = cursor.join("backend");
            if probe.join("app/main.py").exists() {
                return Some(probe);
            }
            if let Some(parent) = cursor.parent() {
                cursor = parent;
            } else {
                break;
            }
        }
    }

    None
}

// Store child process handle so we can terminate on exit.
struct BackendState {
    child: Mutex<Option<Child>>,
}

fn spawn_backend() -> std::io::Result<Child> {
    // Find backend directory by walking up from current dir / executable,
    // or use VOICENOTE_BACKEND_DIR if provided.
    let backend_dir = find_backend_dir().ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "backend directory not found (set VOICENOTE_BACKEND_DIR)",
        )
    })?;

    let venv_python = backend_dir.join(".venv/bin/python3");
    let mut candidates: Vec<PathBuf> = vec![venv_python, PathBuf::from("python3")];

    for python in candidates.drain(..) {
        let mut cmd = Command::new(&python);
        cmd.args([
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            "8765",
        ])
        .current_dir(&backend_dir)
        .env("PYTHONUNBUFFERED", "1")
        .env(
            "PATH",
            "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin",
        )
        // Inherit stdout/stderr so users can see logs in terminal.
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());

        if let Ok(child) = cmd.spawn() {
            return Ok(child);
        }
    }

    // If we reach here, all candidates failed.
    Err(std::io::Error::new(
        std::io::ErrorKind::NotFound,
        "could not find a working Python executable for backend",
    ))
}

fn main() {
    tauri::Builder::default()
        // Enable plugins used by the frontend.
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Spawn backend once at startup.
            match spawn_backend() {
                Ok(child) => {
                    app.manage(BackendState {
                        child: Mutex::new(Some(child)),
                    });
                }
                Err(err) => {
                    eprintln!("Failed to start backend: {err}");
                    // We still launch the UI so the user can see the error.
                    app.manage(BackendState {
                        child: Mutex::new(None),
                    });
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                // On exit, try to terminate backend to avoid orphan process.
                // Use a temporary closure to ensure the borrow ends before scope exit.
                (|| {
                    let state = app_handle.state::<BackendState>();
                    let mut child_opt = state.child.lock().ok()?;
                    let mut child = child_opt.take()?;
                    let _ = child.kill();
                    Some(())
                })();
            }
        });
}
