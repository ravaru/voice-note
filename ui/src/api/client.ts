import type { AppConfig, Job, Segment, ModelDownloadStatus, SummaryResponse } from "./types";

// Centralized base URL makes it easy to change the backend port.
const API_BASE_URL = "http://127.0.0.1:8765";

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) {
    const message = await readErrorMessage(res);
    throw new Error(message || `GET ${path} failed`);
  }
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const message = await readErrorMessage(res);
    throw new Error(message || `POST ${path} failed`);
  }
  return res.json() as Promise<T>;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return "";
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.detail === "string") {
        return parsed.detail;
      }
    } catch {
      // Not JSON; return raw text below.
    }
    return text;
  } catch {
    return "";
  }
}

export async function getHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function getConfig(): Promise<AppConfig> {
  return apiGet<AppConfig>("/config");
}

export async function updateConfig(cfg: AppConfig): Promise<AppConfig> {
  return apiPost<AppConfig>("/config", cfg);
}

export async function initializeConfig(cfg: AppConfig): Promise<AppConfig> {
  return apiPost<AppConfig>("/config/initialize", cfg);
}

export async function getConfigInitialized(): Promise<boolean> {
  const res = await apiGet<{ initialized: boolean }>("/config/initialized");
  return res.initialized;
}

export async function getJobs(): Promise<Job[]> {
  return apiGet<Job[]>("/jobs");
}

export async function getJob(id: string): Promise<Job> {
  return apiGet<Job>(`/jobs/${id}`);
}

export async function createJob(file: File): Promise<Job> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE_URL}/jobs`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json() as Promise<Job>;
}

export async function createJobFromPath(path: string): Promise<Job> {
  return apiPost<Job>("/jobs/from-path", { path });
}

export async function cancelJob(id: string): Promise<void> {
  await apiPost(`/jobs/${id}/cancel`);
}

export async function deleteJob(id: string): Promise<void> {
  await apiPost(`/jobs/${id}/delete`);
}

export async function exportJobToObsidian(id: string): Promise<void> {
  await apiPost(`/jobs/${id}/export/obsidian`);
}

export async function getSegments(id: string): Promise<Segment[]> {
  return apiGet<Segment[]>(`/jobs/${id}/segments`);
}

// Summary endpoints are separated from /jobs to reduce payload size for UI polling.
export async function getSummary(id: string): Promise<SummaryResponse> {
  return apiGet<SummaryResponse>(`/jobs/${id}/summary`);
}

export async function summarizeJob(id: string): Promise<SummaryResponse> {
  return apiPost<SummaryResponse>(`/jobs/${id}/summarize`);
}

export async function getModelSize(modelSize: string): Promise<number> {
  const res = await apiGet<{ bytes: number }>(
    `/model/size?model_size=${encodeURIComponent(modelSize)}`
  );
  return res.bytes;
}

export async function getModelDownloadStatus(
  modelSize: string
): Promise<ModelDownloadStatus> {
  return apiGet<ModelDownloadStatus>(
    `/model/download/status?model_size=${encodeURIComponent(modelSize)}`
  );
}

export async function startModelDownload(
  modelSize: string
): Promise<ModelDownloadStatus> {
  return apiPost<ModelDownloadStatus>("/model/download/start", {
    model_size: modelSize,
  });
}

export function getClipUrl(id: string, start: number, end: number): string {
  // We avoid fetch here so <audio> can stream the URL directly.
  const params = new URLSearchParams({
    start: start.toString(),
    end: end.toString(),
  });
  return `${API_BASE_URL}/jobs/${id}/clip?${params.toString()}`;
}
