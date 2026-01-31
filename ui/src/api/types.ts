// Shared types for backend API.

export type JobStatus = "queued" | "running" | "done" | "error" | "cancelled";

export type Job = {
  id: string;
  filename: string;
  status: JobStatus;
  progress: number;
  stage: string;
  logs: string[];
  created_at: string;
  audio_path: string;
  transcript_txt_path: string;
  transcript_json_path: string;
  transcript_srt_path: string;
  md_preview?: string;
  // Summary fields are returned by backend so UI can show status and content.
  summary_status?: "not_started" | "running" | "done" | "skipped" | "error";
  summary_model?: string;
  summary_error?: string;
  summary_md?: string;
  exported_to_obsidian: boolean;
};

export type Segment = {
  start: number;
  end: number;
  text: string;
};

export type ModelDownloadStatus = {
  state: "idle" | "downloading" | "done" | "error";
  model_size: string;
  repo_id: string;
  total_bytes: number;
  downloaded_bytes: number;
  message?: string;
  started_at?: number;
  finished_at?: number;
};

// Summary payload returned by backend /jobs/{id}/summary and /summarize.
export type SummaryResponse = {
  summary_status: string;
  summary_model: string;
  summary_error?: string;
  summary_md: string;
};

export type AppConfig = {
  initialized: boolean;
  vault_path: string;
  output_subfolder: string;
  model_size: "tiny" | "small" | "medium" | "large-v3";
  preload_model?: boolean;
  language?: string;
  // Summarization settings (Ollama).
  enable_summarization?: boolean;
  auto_summarize_after_transcription?: boolean;
  ollama_base_url?: string;
  ollama_model?: string;
  summary_prompt?: string;
  enable_summarization?: boolean;
  auto_summarize_after_transcription?: boolean;
  ollama_base_url?: string;
  ollama_model?: string;
  include_timestamps: boolean;
  watch_inbox_enabled: boolean;
  inbox_poll_seconds: number;
};
