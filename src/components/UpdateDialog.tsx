import { useEffect, useRef } from "react";
import type { AppUpdater } from "../hooks/useUpdater";
import { APP_NAME } from "../appMetadata";

export function UpdateDialog({ updater }: { updater: AppUpdater }) {
  const { state, controller } = updater;
  const dialog = useRef<HTMLDivElement>(null);
  const working = state.phase === "downloading" || state.phase === "installing";
  const installed = state.phase === "installed";

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      previous?.focus();
    };
  }, []);

  const percentage = state.total ? Math.min(100, Math.round(state.downloaded / state.total * 100)) : undefined;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm">
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="update-title"
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] p-6"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            if (!working) controller.later();
          }
          if (event.key !== "Tab") return;
          const buttons = [...(dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
          const first = buttons[0];
          const last = buttons.at(-1);
          if (!first) { event.preventDefault(); return; }
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
            event.preventDefault(); last?.focus();
          } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
            event.preventDefault(); first.focus();
          }
        }}>
        <h2 id="update-title" className="text-xl font-black text-[var(--color-text)]">
          {installed ? "Actualización instalada" : `${APP_NAME} ${state.update?.version}`}
        </h2>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          {installed ? "Reinicia para utilizar la nueva versión." : "Hay una nueva versión disponible. Al actualizar, la aplicación se cerrará o reiniciará. Guarda tus resultados antes de continuar."}
        </p>
        {state.update?.notes && <div className="mt-4">
          <h3 className="text-sm font-bold text-[var(--color-text)]">Cambios de esta versión</h3>
          <p className="mt-2 max-h-52 overflow-y-auto whitespace-pre-wrap break-words text-sm text-[var(--color-text-secondary)]">{state.update.notes}</p>
        </div>}
        <div role="status" aria-live="polite" className="mt-4 text-sm text-[var(--color-text-secondary)]">
          {state.phase === "downloading" && `Descargando actualización${percentage === undefined ? "…" : `: ${percentage}%`}`}
          {state.phase === "installing" && "Verificando e instalando la actualización…"}
          {state.message}
        </div>
        {state.phase === "downloading" && (
          <div
            role="progressbar"
            aria-label="Descarga de actualización"
            aria-valuenow={percentage ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-3.5 h-3 overflow-hidden rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-control)]"
          >
            <div
              className="h-full rounded-[22px] bg-[var(--color-action)] transition-[width] duration-300"
              style={{ width: `${percentage ?? 0}%` }}
            />
          </div>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={working} onClick={controller.later}
            className="rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-control)] px-4 py-2.5 text-sm font-bold text-[var(--color-celeste-text)] transition-colors hover:bg-[var(--color-celeste-bg)] disabled:opacity-50">Más tarde</button>
          <button type="button" disabled={working} onClick={() => void (installed ? controller.restart() : controller.install())}
            className="primary-action w-auto disabled:opacity-50">{working ? "Actualizando…" : installed ? "Reiniciar" : "Actualizar"}</button>
        </div>
      </div>
    </div>
  );
}
