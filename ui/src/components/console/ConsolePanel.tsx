import React, { useMemo } from "react";
import type { Job } from "../../api/types";
import Button from "../ui/Button";
import useAutoScroll from "./useAutoScroll";
import { useI18n } from "../../i18n/I18nProvider";

type Props = {
  job: Job;
  logs: string[];
};

export default function ConsolePanel({ job, logs }: Props) {
  const { t } = useI18n();
  const trimmedLogs = useMemo(() => logs.slice(-2000), [logs]);
  const { containerRef, follow, setFollow, handleScroll, scrollToBottom } = useAutoScroll(
    trimmedLogs.length
  );

  return (
    <div className="console-panel details-scroll-panel">
      <div className="console-panel-header">
        <div>
          <div className="console-title">{t("console.title")}</div>
          <div className="console-subtitle">{job.filename}</div>
        </div>
      </div>

      <div className="console-body" ref={containerRef} onScroll={handleScroll}>
        {trimmedLogs.length === 0 ? (
          <div className="console-empty">{t("console.empty")}</div>
        ) : (
          trimmedLogs.map((line, idx) => (
            <div key={`${idx}-${line}`} className="console-line">
              {line}
            </div>
          ))
        )}
      </div>

      <div className="console-footer">
        {!follow && (
          <Button
            variant="secondary"
            onClick={() => {
              setFollow(true);
              scrollToBottom();
            }}
          >
            {t("console.follow")}
          </Button>
        )}
      </div>
    </div>
  );
}
