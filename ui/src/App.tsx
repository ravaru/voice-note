import React, { useEffect, useState } from "react";
import Wizard from "./pages/Wizard";
import Settings from "./pages/Settings";
import Transcribe from "./pages/Transcribe";
import { getHealth, getConfigInitialized } from "./api/client";

// Simple top-level app state. We keep navigation minimal for MVP.
export default function App() {
  const [backendReady, setBackendReady] = useState(false);
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [page, setPage] = useState<"transcribe" | "settings">("transcribe");

  useEffect(() => {
    // Poll /health until backend becomes available.
    const timer = setInterval(async () => {
      try {
        const ok = await getHealth();
        if (ok) {
          setBackendReady(true);
          clearInterval(timer);
        }
      } catch {
        // Backend not ready yet; keep waiting.
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!backendReady) return;
    // Once backend is ready, check if config was initialized.
    getConfigInitialized().then((value) => setInitialized(value));
  }, [backendReady]);

  let content: React.ReactNode;
  if (!backendReady) {
    content = <div>Запуск бэкенда…</div>;
  } else if (initialized === false) {
    content = (
      <Wizard
        onFinished={() => {
          // Re-check state after wizard completion.
          setInitialized(true);
        }}
      />
    );
  } else if (initialized === null) {
    content = <div>Загрузка…</div>;
  } else {
    content = (
      <>
        <header style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>VoiceNote</h2>
          <nav style={{ marginTop: 8 }}>
            <button onClick={() => setPage("transcribe")}>Расшифровка</button>
            <button onClick={() => setPage("settings")} style={{ marginLeft: 8 }}>
              Настройки
            </button>
          </nav>
        </header>

        {page === "transcribe" && <Transcribe />}
        {page === "settings" && <Settings />}
      </>
    );
  }

  return <div className="app-shell">{content}</div>;
}
