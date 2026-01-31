import React, { useEffect, useMemo, useState } from "react";
import Dropzone from "../components/Dropzone";
import JobTable from "../components/JobTable";
import LogViewer from "../components/LogViewer";
import TranscriptViewer from "../components/TranscriptViewer";
import MarkdownPreview from "../components/MarkdownPreview";
import SummaryViewer from "../components/SummaryViewer";
import { createJob, getJobs, cancelJob, exportJobToObsidian } from "../api/client";
import type { Job } from "../api/types";

const POLL_INTERVAL_MS = 1000;

export default function Transcribe() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const list = await getJobs();
      if (active) setJobs(list);
    };

    load();
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const selectedJob = useMemo(() => {
    if (!selectedJobId) return null;
    return jobs.find((j) => j.id === selectedJobId) || null;
  }, [jobs, selectedJobId]);

  const handleFiles = async (files: FileList) => {
    for (const file of Array.from(files)) {
      // Only accept mp3 for MVP.
      if (!file.name.toLowerCase().endsWith(".mp3")) continue;
      await createJob(file);
    }
  };

  return (
    <div>
      <Dropzone onFiles={handleFiles} />

      <JobTable
        jobs={jobs}
        onView={(job) => setSelectedJobId(job.id)}
        onExport={async (job) => {
          await exportJobToObsidian(job.id);
        }}
        onCancel={async (job) => {
          await cancelJob(job.id);
        }}
      />

      {selectedJob && (
        <div style={{ marginTop: 24 }}>
          <h3>Задание: {selectedJob.filename}</h3>
          <LogViewer logs={selectedJob.logs || []} />

          {/* Transcript viewer fetches segments on its own */}
          <TranscriptViewer jobId={selectedJob.id} />

          {/* Summary viewer fetches summary on its own and allows regeneration */}
          <SummaryViewer jobId={selectedJob.id} />

          {selectedJob.md_preview && (
            <div style={{ marginTop: 16 }}>
              <h4>Предпросмотр Markdown</h4>
              <MarkdownPreview markdown={selectedJob.md_preview} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
