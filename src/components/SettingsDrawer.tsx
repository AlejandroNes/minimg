import { useTranslation } from "../i18n/useTranslation";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { AppSettings, Theme } from "../settings";
import { SettingsPanel } from "./SettingsPanel";
import type { AppUpdater } from "../hooks/useUpdater";

export function SettingsDrawer({
  settings,
  onThemeChange,
  onUsernameChange,
  onSoundOnFinishChange,
  onReset,
  onClose,
  updater,
}: {
  settings: AppSettings;
  onThemeChange: (theme: Theme) => void;
  onUsernameChange: (username: string) => void;
  onSoundOnFinishChange: (value: boolean) => void;
  onReset: () => void;
  onClose: () => void;
  updater: AppUpdater;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="animate-fade-in absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("appHeader.settings")}
        className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[400px] max-w-[92vw] flex-col rounded-l-[22px] border-l-2 border-[var(--color-celeste-border)] bg-[var(--color-bg)]"
      >
        <div className="flex shrink-0 items-center justify-between border-b-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] px-5 py-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--color-celeste-text)]">{t("settingsDrawer.preferences")}{" "}</p>
            <h2 className="mt-0.5 text-xl font-black tracking-[-0.03em] text-[var(--color-text)]">{t("appHeader.settings")}{" "}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("settingsDrawer.closeSettings")}
            className="grid size-10 place-items-center rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-control)] text-[var(--color-celeste-text)] transition-colors hover:bg-[var(--color-celeste-bg)]"
          >
            <X size={19} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-5">
          <SettingsPanel
            settings={settings}
            onThemeChange={onThemeChange}
            onUsernameChange={onUsernameChange}
            onSoundOnFinishChange={onSoundOnFinishChange}
            onReset={onReset}
            updater={updater}
          />
        </div>
      </aside>
    </div>
  );
}
