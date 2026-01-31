import React from "react";
import Button from "../ui/Button";
import { useI18n } from "../../i18n/I18nProvider";

type Section = "jobs" | "settings" | "details";

type Props = {
  section: Section;
  title: string;
  onNavigate: (section: "jobs" | "settings") => void;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  primaryActionDisabled?: boolean;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  secondaryActionDisabled?: boolean;
  backendOk?: boolean;
  children: React.ReactNode;
};

export default function AppShell({
  section,
  title,
  onNavigate,
  primaryActionLabel,
  onPrimaryAction,
  primaryActionDisabled,
  secondaryActionLabel,
  onSecondaryAction,
  secondaryActionDisabled,
  backendOk,
  children,
}: Props) {
  const { t } = useI18n();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-title">VoiceNote</div>
        <button
          className={`sidebar-item ${section === "jobs" || section === "details" ? "active" : ""}`}
          onClick={() => onNavigate("jobs")}
          aria-label={t("sidebar.jobs")}
        >
          {t("sidebar.jobs")}
        </button>
        <button
          className={`sidebar-item ${section === "settings" ? "active" : ""}`}
          onClick={() => onNavigate("settings")}
          aria-label={t("sidebar.settings")}
        >
          {t("sidebar.settings")}
        </button>
      </aside>

      <div className="main">
        <div className="toolbar">
          <div className="toolbar-title">{title}</div>
          <div className="toolbar-actions">
            <div className={`status-dot ${backendOk ? "ok" : ""}`} aria-hidden="true" />
            {secondaryActionLabel && onSecondaryAction && (
              <Button
                variant="secondary"
                onClick={onSecondaryAction}
                aria-label={secondaryActionLabel}
                disabled={secondaryActionDisabled}
              >
                {secondaryActionLabel}
              </Button>
            )}
            {primaryActionLabel && onPrimaryAction && (
              <Button
                variant="primary"
                onClick={onPrimaryAction}
                aria-label={primaryActionLabel}
                disabled={primaryActionDisabled}
              >
                {primaryActionLabel}
              </Button>
            )}
          </div>
        </div>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
