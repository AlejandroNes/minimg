import type { AppUpdater } from "../hooks/useUpdater";
import { APP_NAME } from "../appMetadata";

export function UpdatePanel({ updater, embedded = false }: { updater: AppUpdater; embedded?: boolean }) {
  const { state, controller } = updater;
  const working = ["checking", "downloading", "installing"].includes(state.phase);
  return (
    <section className={embedded ? "mt-4 border-t-2 border-[var(--color-celeste-border)] pt-4" : "rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] p-5"}>
      <h3 className="text-base font-extrabold text-[var(--color-text)]">Actualizaciones</h3>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        Busca nuevas versiones de {APP_NAME}. El procesamiento de imágenes sigue funcionando sin internet.
      </p>
      <p role="status" className="mt-3 text-sm text-[var(--color-text-secondary)]">
        {state.phase === "checking" ? "Comprobando actualizaciones…" : state.message}
        {state.update && state.phase !== "installed" && ` Versión disponible: ${state.update.version}.`}
        {state.update && updater.isProcessing && " Podrás actualizar cuando termine el procesamiento de imágenes."}
      </p>
      <button type="button" disabled={working} onClick={() => {
        if (state.phase === "installed" || state.update) controller.show();
        else void controller.check();
      }} className="mt-4 rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-control)] px-4 py-2.5 text-xs font-bold text-[var(--color-celeste-text)] transition-colors hover:bg-[var(--color-celeste-bg)] disabled:opacity-50">
        {working ? "Comprobando o actualizando…" : state.phase === "installed" ? "Reiniciar aplicación" : state.update ? "Ver actualización" : "Buscar actualizaciones"}
      </button>
    </section>
  );
}
