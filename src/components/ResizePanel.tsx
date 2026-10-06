import { Expand } from "lucide-react";
import { StepHeading } from "./StepHeading";

export function ResizePanel({
  resizeWidth,
  setResizeWidth,
  maxWidth,
  disabled,
  completed,
}: {
  resizeWidth: string;
  setResizeWidth: (v: string) => void;
  maxWidth: number;
  disabled: boolean;
  completed: boolean;
}) {
  const currentNum = resizeWidth ? parseInt(resizeWidth, 10) : maxWidth;
  const widthValue = Math.min(maxWidth, Math.max(100, isNaN(currentNum) ? maxWidth : currentNum));
  const isOriginalMax = widthValue >= maxWidth;

  return (
    <section data-step="4" data-tone="lila" data-complete={completed} className="step-section p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <StepHeading number={4} completed={completed} icon={<Expand size={17} strokeWidth={2} />} title="Redimensionar" description="Opcional. Puedes conservar el tamaño original." />
        {isOriginalMax ? (
          <span className="hidden rounded-[22px] border-2 border-[var(--color-lila-border)] bg-[var(--color-control)] px-3 py-1 text-xs font-bold text-[var(--color-lila-text)] sm:inline-block">
            Tamaño máximo original
          </span>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setResizeWidth(maxWidth.toString())}
            className="hidden rounded-[22px] border-2 border-[var(--color-lila-border)] bg-[var(--color-control)] px-3 py-1 text-xs font-bold text-[var(--color-lila-text)] hover:opacity-80 sm:inline-block"
          >
            Restablecer ({maxWidth} px)
          </button>
        )}
      </div>
      <div className="mt-4 flex flex-col items-center gap-3">
        <div className="flex w-full items-center justify-between gap-4">
          <input
            type="range"
            min={Math.min(100, maxWidth)}
            max={maxWidth}
            step="10"
            value={widthValue}
            onChange={(e) => setResizeWidth(e.target.value)}
            disabled={disabled}
            className="h-2 w-full cursor-pointer appearance-none rounded-[22px] bg-[var(--color-lila-border)] accent-[var(--color-lila-text)]"
          />
          <div className="flex shrink-0 items-center gap-1.5 rounded-[22px] border-2 border-[var(--color-lila-border)] bg-[var(--color-control)] px-3 py-1.5 text-xs font-bold text-[var(--color-lila-text)]">
            <span className="min-w-10 text-right">{widthValue}</span>
            <span className="text-[var(--color-text-dim)]">px</span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-sm font-medium text-[var(--color-text-dim)]">
        {isOriginalMax
          ? `Ajustado al ancho de la imagen más grande (${maxWidth} px). Las imágenes conservarán su tamaño original a menos que reduzcas el control.`
          : `Las imágenes más anchas que ${widthValue} px se reducirán manteniendo su proporción original.`}
      </p>
    </section>
  );
}
