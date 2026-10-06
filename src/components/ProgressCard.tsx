import { Check, LoaderCircle, Square } from "lucide-react";

export function ProgressCard({
  isConverting,
  isCancelling,
  wasCancelled,
  progress,
  processed,
  total,
  onCancel,
}: {
  isConverting: boolean;
  isCancelling: boolean;
  wasCancelled: boolean;
  progress: number;
  processed: number;
  total: number;
  onCancel: () => void;
}) {
  const cardStyles = isConverting
    ? "border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)]"
    : wasCancelled
      ? "border-[var(--color-amarillo-border)] bg-[var(--color-amarillo-bg)]"
      : "border-[var(--color-menta-border)] bg-[var(--color-menta-bg)]";

  const iconStyles = isConverting
    ? "border-[var(--color-celeste-border)] bg-[var(--color-control)] text-[var(--color-celeste-text)]"
    : wasCancelled
      ? "border-[var(--color-amarillo-border)] bg-[var(--color-control)] text-[var(--color-amarillo-text)]"
      : "border-[var(--color-menta-border)] bg-[var(--color-control)] text-[var(--color-menta-text)]";

  const percentStyles = isConverting
    ? "text-[var(--color-celeste-text)]"
    : wasCancelled
      ? "text-[var(--color-amarillo-text)]"
      : "text-[var(--color-menta-text)]";

  const progressTrackBorder = isConverting
    ? "border-[var(--color-celeste-border)]"
    : wasCancelled
      ? "border-[var(--color-amarillo-border)]"
      : "border-[var(--color-menta-border)]";

  return (
    <section
      aria-live="polite"
      className={`animate-slide-up p-5 sm:p-6 rounded-[22px] border-2 transition-colors ${cardStyles}`}
    >
      <div className="flex items-center gap-4">
        <span
          className={`grid size-12 shrink-0 place-items-center rounded-[22px] border-2 ${iconStyles}`}
        >
          {isConverting ? (
            <LoaderCircle size={22} strokeWidth={2} className="animate-spin" />
          ) : wasCancelled ? (
            <Square size={16} strokeWidth={2} fill="currentColor" />
          ) : (
            <Check size={22} strokeWidth={2} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-[var(--color-text)]">
                {isConverting
                  ? "Optimizando las imágenes"
                  : wasCancelled
                    ? "Proceso detenido"
                    : "Proceso terminado"}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {processed} de {total} imágenes procesadas
              </p>
            </div>
            <strong className={`text-2xl font-black tabular-nums ${percentStyles}`}>
              {Math.round(progress)}%
            </strong>
          </div>
          <div className={`mt-3.5 h-3 overflow-hidden rounded-[22px] border-2 bg-[var(--color-control)] ${progressTrackBorder}`}>
            <div
              className={`h-full rounded-[22px] transition-[width] duration-300 ${
                wasCancelled ? "bg-[var(--color-amarillo-text)]" : !isConverting ? "bg-[var(--color-menta-text)]" : "bg-[var(--color-action)]"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
      {isConverting && (
        <button
          type="button"
          disabled={isCancelling}
          onClick={onCancel}
          className="mt-4 inline-flex items-center gap-2 rounded-[22px] border-2 border-[var(--color-coral-border)] bg-[var(--color-coral-bg)] px-4 py-2.5 text-xs font-bold text-[var(--color-coral-text)] transition-colors hover:border-[var(--color-coral-text)] disabled:cursor-wait disabled:opacity-60"
        >
          {isCancelling ? (
            <LoaderCircle size={13} strokeWidth={2} className="animate-spin" />
          ) : (
            <Square size={11} strokeWidth={2} fill="currentColor" />
          )}
          {isCancelling ? "Deteniendo…" : "Detener proceso"}
        </button>
      )}
    </section>
  );
}
