import React, { useEffect, useState } from "react";
import { getSummary, summarizeJob } from "../../api/client";
import type { SummaryResponse } from "../../api/types";
import Button from "../ui/Button";
import MarkdownPreview from "../MarkdownPreview";
import { useI18n } from "../../i18n/I18nProvider";

type Props = {
  jobId: string;
};

export default function SummaryPanel({ jobId }: Props) {
  const { t } = useI18n();
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await getSummary(jobId);
      setSummary(data);
      setError(null);
    } catch {
      setSummary(null);
      setError(t("summary.load_error"));
    }
  };

  useEffect(() => {
    load();
  }, [jobId]);

  const regenerate = async () => {
    setStatus(null);
    setError(null);
    try {
      const data = await summarizeJob(jobId);
      setSummary(data);
      setStatus(t("summary.updated"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("summary.load_error");
      setError(message);
      setStatus(t("summary.load_error"));
      try {
        const data = await getSummary(jobId);
        setSummary(data);
      } catch {
        // Ignore secondary failure.
      }
    }
  };

  const statusKey = summary?.summary_status ?? "not_started";

  return (
    <div className="panel summary-panel details-scroll-panel">
      <div className="details-meta" style={{ marginBottom: 12 }}>
        {summary?.summary_model && <span className="table-muted">{summary.summary_model}</span>}
      </div>

      {summary?.summary_md ? (
        <MarkdownPreview markdown={summary.summary_md} />
      ) : (
        <div className="text-muted summary-empty">{t("summary.empty")}</div>
      )}

      {summary?.summary_error && (
        <div className="text-muted" style={{ marginTop: 8 }}>
          {t("jobs.status.error")}: {summary.summary_error}
        </div>
      )}
      {error && (
        <div className="text-muted" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
      {statusKey !== "not_started" && (
        <div style={{ marginTop: 12 }}>
          <Button variant="secondary" onClick={regenerate}>
            {t("summary.regenerate")}
          </Button>
          {status && <span className="table-muted" style={{ marginLeft: 8 }}>{status}</span>}
        </div>
      )}
    </div>
  );
}
