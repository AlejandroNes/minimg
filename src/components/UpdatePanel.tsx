import { useTranslation } from "../i18n/useTranslation";
import { renderMessage } from "../i18n/index";
import type { AppUpdater } from "../hooks/useUpdater";
import { APP_NAME } from "../appMetadata";

export function UpdatePanel({ updater, embedded = false }: { updater: AppUpdater; embedded?: boolean }) {
  const { t } = useTranslation();
  const { state, controller } = updater;
  const working = ["checking", "downloading", "installing"].includes(state.phase);
  return (
    <section className={embedded ? "mt-4 border-t-2 border-[var(--color-celeste-border)] pt-4" : "rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] p-5"}>
      <h3 className="text-base font-extrabold text-[var(--color-text)]">{t("updatePanel.updates")}</h3>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{t("updates.description", { name: APP_NAME })}</p>
      <p role="status" className="mt-3 text-sm text-[var(--color-text-secondary)]">
        {state.phase === "checking" ? t("updatePanel.checkingForUpdates") : renderMessage(state.message)}
        {state.update && state.phase !== "installed" && t("updatePanel.availableVersion", { p0: state.update.version })}
        {state.update && updater.isProcessing && t("updatePanel.youCanUpdateWhenImageProcessing")}
      </p>
      <button type="button" disabled={working} onClick={() => {
        if (state.phase === "installed" || state.update) controller.show();
        else void controller.check();
      }} className="mt-4 rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-control)] px-4 py-2.5 text-xs font-bold text-[var(--color-celeste-text)] transition-colors hover:bg-[var(--color-celeste-bg)] disabled:opacity-50">
        {working ? t("updatePanel.checkingOrUpdating") : state.phase === "installed" ? t("updatePanel.restartApplication") : state.update ? t("updatePanel.viewUpdate") : t("updatePanel.checkForUpdates")}
      </button>
    </section>
  );
}
