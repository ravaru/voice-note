import React, { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import Wizard from "./pages/Wizard";
import Settings, { type SettingsHandle } from "./pages/Settings";
import Jobs from "./pages/Jobs";
import JobDetails from "./pages/JobDetails";
import AppShell from "./components/shell/AppShell";
import GlobalDropOverlay from "./components/shell/GlobalDropOverlay";
import {
  getHealth,
  getConfigInitialized,
  getJobs,
  createJob,
  createJobFromPath,
  exportJobToObsidian,
  cancelJob,
  deleteJob,
  getConfig,
} from "./api/client";
import type { AppConfig, Job } from "./api/types";
import { useI18n } from "./i18n/I18nProvider";

const POLL_INTERVAL_MS = 1000;

type Page = "jobs" | "settings" | "details";

function isSameJob(a: Job, b: Job): boolean {
  return (
    a.id === b.id &&
    a.status === b.status &&
    a.progress === b.progress &&
    a.stage === b.stage &&
    a.filename === b.filename &&
    a.summary_status === b.summary_status &&
    a.summary_md === b.summary_md &&
    a.summary_error === b.summary_error &&
    a.summary_model === b.summary_model &&
    a.exported_to_obsidian === b.exported_to_obsidian
  );
}

function mergeJobs(prev: Job[], next: Job[]): Job[] {
  const prevMap = new Map(prev.map((job) => [job.id, job]));
  return next.map((job) => {
    const existing = prevMap.get(job.id);
    return existing && isSameJob(existing, job) ? existing : job;
  });
}

export default function App() {
  const { t } = useI18n();
  const [backendReady, setBackendReady] = useState(false);
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [page, setPage] = useState<Page>("jobs");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const settingsRef = useRef<SettingsHandle | null>(null);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

  useEffect(() => {
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
    getConfigInitialized().then((value) => setInitialized(value));
  }, [backendReady]);

  useEffect(() => {
    if (!backendReady || initialized !== true) return;
    getConfig().then(setConfig).catch(() => setConfig(null));
  }, [backendReady, initialized]);

  useEffect(() => {
    if (!backendReady || initialized !== true) return;
    let active = true;

    const load = async () => {
      try {
        const list = await getJobs();
        if (active) {
          setJobs((prev) => mergeJobs(prev, list));
        }
      } catch {
        // Ignore transient polling errors.
      }
    };

    load();
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [backendReady, initialized]);

  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | null = null;
    const setup = async () => {
      const webview = getCurrentWebview();
      unlisten = await webview.onDragDropEvent(async (event) => {
        if (!backendReady || initialized !== true) return;
        if (event.payload.type !== "drop") return;
        const paths = event.payload.paths || [];
        for (const path of paths) {
          if (!path.toLowerCase().endsWith(".mp3") &&
              !path.toLowerCase().endsWith(".m4a") &&
              !path.toLowerCase().endsWith(".wav")) {
            continue;
          }
          try {
            const created = await createJobFromPath(path);
            setJobs((prev) => [created, ...prev]);
          } catch {
            // Ignore failed drops.
          }
        }
      });
    };
    setup();
    return () => {
      if (unlisten) unlisten();
    };
  }, [isTauri, backendReady, initialized]);

  const selectedJob = useMemo(() => {
    if (!selectedJobId) return null;
    return jobs.find((job) => job.id === selectedJobId) || null;
  }, [jobs, selectedJobId]);

  const handleFiles = async (files: FileList) => {
    for (const file of Array.from(files)) {
      const name = file.name.toLowerCase();
      if (!name.endsWith(".mp3") && !name.endsWith(".m4a") && !name.endsWith(".wav")) {
        continue;
      }
      try {
        const created = await createJob(file);
        setJobs((prev) => [created, ...prev]);
      } catch {
        // Ignore failed uploads for now.
      }
    }
  };

  const handleAddAudio = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      handleFiles(event.target.files);
      event.target.value = "";
    }
  };


  if (!backendReady) {
    return <div className="wizard-shell">{t("app.launching")}</div>;
  }

  if (initialized === false) {
    return (
      <div className="wizard-shell">
        <Wizard onFinished={() => setInitialized(true)} />
      </div>
    );
  }

  if (initialized === null) {
    return <div className="wizard-shell">{t("app.loading")}</div>;
  }

  const title =
    page === "settings"
      ? t("settings.title")
      : page === "details"
        ? t("details.title")
        : t("sidebar.jobs");
  const vaultConfigured = Boolean(config?.vault_path);
  const showToolbarAction = page === "settings";

  return (
    <div className="app-root">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/mpeg,audio/mp4,audio/wav,.mp3,.m4a,.wav"
        multiple
        style={{ display: "none" }}
        onChange={handleFileInputChange}
      />
      <GlobalDropOverlay onFiles={handleFiles}>
        <AppShell
          section={page}
          title={title}
          backendOk={backendReady}
          onNavigate={(section) => {
            setPage(section);
            if (section === "jobs") setSelectedJobId(null);
          }}
          primaryActionLabel={showToolbarAction ? t("toolbar.save") : undefined}
          onPrimaryAction={
            showToolbarAction ? () => settingsRef.current?.save() : undefined
          }
          primaryActionDisabled={page === "settings" ? !settingsDirty : undefined}
        >
          {page === "jobs" && (
            <Jobs
              jobs={jobs}
              modelSize={config?.model_size}
              language={config?.language}
              onAddAudio={handleAddAudio}
              onFiles={handleFiles}
              onOpen={(job) => {
                setSelectedJobId(job.id);
                setPage("details");
              }}
              onExport={async (job) => {
                await exportJobToObsidian(job.id);
              }}
              onCancel={async (job) => {
                await cancelJob(job.id);
              }}
              onDelete={async (job) => {
                await deleteJob(job.id);
                setJobs((prev) => prev.filter((item) => item.id !== job.id));
                if (selectedJobId === job.id) {
                  setSelectedJobId(null);
                  setPage("jobs");
                }
              }}
            />
          )}
          {page === "settings" && (
            <Settings
              ref={settingsRef}
              onDirtyChange={setSettingsDirty}
              onSaved={(next) => setConfig(next)}
            />
          )}
          {page === "details" && selectedJobId && (
            <JobDetails
              job={selectedJob}
              jobId={selectedJobId}
              vaultConfigured={vaultConfigured}
              onExport={async (job) => {
                await exportJobToObsidian(job.id);
              }}
              onCancel={async (job) => {
                await cancelJob(job.id);
              }}
              onOpenSettings={() => setPage("settings")}
              onClose={() => {
                setPage("jobs");
                setSelectedJobId(null);
              }}
            />
          )}
        </AppShell>
      </GlobalDropOverlay>
    </div>
  );
}
