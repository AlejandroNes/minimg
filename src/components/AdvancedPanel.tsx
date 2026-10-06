import { ChevronDown, SlidersHorizontal } from "lucide-react";
import type { OptimizationEffort, OutputFormat } from "../types";

const EFFORT_OPTIONS: {
  value: OptimizationEffort;
  label: string;
  description: string;
}[] = [
    { value: "fast", label: "Rápido", description: "Menos intentos" },
    { value: "balanced", label: "Equilibrado", description: "Recomendado" },
    { value: "maximum", label: "Exhaustivo", description: "Más intentos" },
  ];

export function AdvancedPanel({
  filenameSuffix,
  setFilenameSuffix,
  targetSizeKb,
  setTargetSizeKb,
  effort,
  setEffort,
  outputFormat,
  applyOrientation,
  setApplyOrientation,
  overwriteExisting,
  setOverwriteExisting,
  enabled,
  onEnabledChange,
  disabled,
}: {
  filenameSuffix: string;
  setFilenameSuffix: (v: string) => void;
  targetSizeKb: number | null;
  setTargetSizeKb: (v: number | null) => void;
  effort: OptimizationEffort;
  setEffort: (v: OptimizationEffort) => void;
  outputFormat: OutputFormat;
  applyOrientation: boolean;
  setApplyOrientation: (v: boolean) => void;
  overwriteExisting: boolean;
  setOverwriteExisting: (v: boolean) => void;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <details className="advanced-panel mt-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[22px] px-4 py-3.5 text-xs font-bold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-control)]/50">
        <span className="flex items-center gap-2.5">
          <SlidersHorizontal size={16} strokeWidth={2} className="text-[var(--color-celeste-text)]" />
          Ajustes avanzados
          <span
            className={`font-medium ${enabled ? "text-[var(--color-celeste-text)]" : "text-[var(--color-coral-text)]"}`}
          >
            {enabled ? "(opcionales)" : "(desactivados)"}
          </span>
        </span>
        <span className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={enabled ? "Desactivar ajustes avanzados" : "Activar ajustes avanzados"}
            disabled={disabled}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onEnabledChange(!enabled);
            }}
            className={`relative h-6 w-11 shrink-0 rounded-[22px] border-2 transition-colors disabled:opacity-60 ${
              enabled ? "border-[var(--color-border-hover)] bg-[var(--color-action)]" : "border-[var(--color-switch-border-off)] bg-[var(--color-switch-track-off)]"
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 size-4 rounded-[22px] transition-transform ${
                enabled ? "translate-x-5 bg-[var(--color-text-inverse)]" : "translate-x-0 bg-[var(--color-switch-thumb-off)]"
              }`}
            />
          </button>
          <ChevronDown size={16} strokeWidth={2} className="advanced-chevron text-[var(--color-celeste-text)]" />
        </span>
      </summary>
      <div className="grid gap-5 border-t-2 border-[var(--color-celeste-border)] px-4 pb-4 pt-5 md:grid-cols-2">
        {!enabled && (
          <p className="text-sm text-[var(--color-text-secondary)] md:col-span-2">
            Estos ajustes están desactivados y no se aplicarán a las imágenes. Actívalos para utilizarlos.
          </p>
        )}
        {/* Filename suffix */}
        <div>
          <label htmlFor="filename-suffix" className="text-xs font-bold text-[var(--color-text)]">
            Texto añadido al nombre
          </label>
          <p className="mt-1 text-sm leading-5 text-[var(--color-text-dim)]">
            Ejemplo: foto.jpg se guardará como foto{enabled ? filenameSuffix || "" : ""}.webp
          </p>
          <input
            id="filename-suffix"
            value={filenameSuffix}
            onChange={(e) => setFilenameSuffix(e.target.value)}
            disabled={disabled || !enabled}
            placeholder="-optimizada"
            maxLength={80}
            className="form-input mt-2"
          />
        </div>

        {/* Target size */}
        <div>
          <label htmlFor="target-size" className="text-xs font-bold text-[var(--color-text)]">
            Peso objetivo
          </label>
          <p className="mt-1 text-sm leading-5 text-[var(--color-text-dim)]">
            Opcional. Intentará no superar este tamaño; puede ser imposible en PNG o calidad alta.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              id="target-size"
              type="number"
              min="1"
              max="512000"
              step="1"
              value={targetSizeKb ?? ""}
              onChange={(e) => {
                const v = Number(e.target.value);
                setTargetSizeKb(
                  e.target.value === "" ? null : Math.min(512_000, Math.max(1, v || 1)),
                );
              }}
              disabled={disabled || !enabled}
              placeholder="Ej.: 500"
              className="form-input"
            />
            <span className="shrink-0 text-xs font-bold text-[var(--color-text-dim)]">
              KB
            </span>
          </div>
        </div>

        {/* Effort */}
        <fieldset>
          <legend className="text-xs font-bold text-[var(--color-text)]">
            Profundidad de búsqueda
          </legend>
          <p className="mt-1 text-sm leading-5 text-[var(--color-text-dim)]">
            Solo afecta al formato Automático; los formatos manuales respetan su calidad elegida.
          </p>
          <div className="mt-2.5 grid grid-cols-3 gap-1 rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-control)] p-1">
            {EFFORT_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                disabled={disabled || !enabled || outputFormat !== "automatic"}
                onClick={() => setEffort(item.value)}
                className={`rounded-[22px] border-2 px-1 py-2 text-xs font-bold transition-all ${
                  enabled && effort === item.value
                    ? "border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] text-[var(--color-celeste-text)]"
                    : "border-transparent text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
                }`}
                title={
                  outputFormat === "automatic"
                    ? item.description
                    : "Disponible al usar el formato Automático"
                }
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Toggles */}
        <div className="space-y-2">
          <label className="option-toggle">
            <input
              type="checkbox"
              checked={enabled && applyOrientation}
              onChange={(e) => setApplyOrientation(e.target.checked)}
              disabled={disabled || !enabled}
            />
            <span>
              <b>Corregir fotos giradas</b>
              <small>
                Lee la orientación guardada por la cámara y coloca la imagen correctamente.
              </small>
            </span>
          </label>
          <label className="option-toggle">
            <input
              type="checkbox"
              checked={enabled && overwriteExisting}
              onChange={(e) => setOverwriteExisting(e.target.checked)}
              disabled={disabled || !enabled}
            />
            <span>
              <b>Reemplazar archivos con el mismo nombre</b>
              <small>
                Desactivado, el sistema crea una copia numerada para no perder archivos.
              </small>
            </span>
          </label>
        </div>
      </div>
    </details>
  );
}
