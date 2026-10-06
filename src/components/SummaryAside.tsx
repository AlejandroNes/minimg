import {
  ArrowRight,
  Check,
  FileImage,
  FolderOpen,
  Gauge,
  ImagePlus,
  Images,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  Zap,
} from "lucide-react";
import { fileNameFromPath, formatBytes } from "../formatters";
import type { ImageItem } from "../types";
import { StepHeading } from "./StepHeading";

interface SummaryAsideProps {
  images: ImageItem[];
  totalOriginalSize: number;
  selectedFormatLabel?: string;
  selectedFormatDesc?: string;
  selectedModeLabel?: string;
  selectedModeDesc?: string;
  outputDir: string;
  isConverting: boolean;
  canConvert: boolean;
  hasFinished: boolean;
  completed: boolean;
  onConvert: () => void;
  onHideResults: () => void;
}

export function SummaryAside({
  images,
  totalOriginalSize,
  selectedFormatLabel,
  selectedFormatDesc,
  selectedModeLabel,
  selectedModeDesc,
  outputDir,
  isConverting,
  canConvert,
  hasFinished,
  completed,
  onConvert,
  onHideResults,
}: SummaryAsideProps) {
  return (
    <>
      <div data-step="6" data-complete={completed} className="summary-card step-section overflow-hidden">
        {/* Header */}
        <div className="border-b-2 border-[var(--color-celeste-border)] p-5">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--color-celeste-text)]">
            Resumen de la tarea
          </p>
          <div className="mt-3">
            <StepHeading number={6} completed={completed} title={hasFinished ? "Revisa los resultados" : "Optimizar imágenes"} description="Comprueba las opciones y comienza cuando todo esté preparado." />
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-4 p-5">
          <div className={`summary-row transition-colors ${images.length === 0 ? "border-[var(--color-amarillo-border)]! bg-[var(--color-amarillo-bg)]!" : ""}`}>
            <span className="summary-icon">
              <Images size={16} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p>Imágenes</p>
              <strong>
                {images.length > 0
                  ? `${images.length} seleccionadas · ${formatBytes(totalOriginalSize)}`
                  : "Aún no seleccionaste imágenes"}
              </strong>
            </div>
            {images.length > 0 && (
              <span className="grid size-6 shrink-0 place-items-center rounded-[22px] border-2 border-[var(--color-menta-border)] bg-[var(--color-menta-bg)] text-[var(--color-menta-text)]">
                <Check size={12} strokeWidth={2.5} />
              </span>
            )}
          </div>

          <div className="summary-row">
            <span className="summary-icon">
              <FileImage size={16} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p>Formato de salida</p>
              <strong>{selectedFormatLabel}</strong>
              <small>{selectedFormatDesc}</small>
            </div>
            <span className="grid size-6 shrink-0 place-items-center rounded-[22px] border-2 border-[var(--color-menta-border)] bg-[var(--color-menta-bg)] text-[var(--color-menta-text)]">
              <Check size={12} strokeWidth={2.5} />
            </span>
          </div>

          <div className="summary-row">
            <span className="summary-icon">
              <Gauge size={16} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p>Optimización</p>
              <strong>{selectedModeLabel}</strong>
              <small>{selectedModeDesc}</small>
            </div>
            <span className="grid size-6 shrink-0 place-items-center rounded-[22px] border-2 border-[var(--color-menta-border)] bg-[var(--color-menta-bg)] text-[var(--color-menta-text)]">
              <Check size={12} strokeWidth={2.5} />
            </span>
          </div>

          <div className={`summary-row transition-colors ${!outputDir ? "border-[var(--color-amarillo-border)]! bg-[var(--color-amarillo-bg)]!" : ""}`}>
            <span className="summary-icon">
              <FolderOpen size={16} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p>Carpeta de destino</p>
              <strong className="truncate">
                {outputDir ? fileNameFromPath(outputDir) : "Falta seleccionarla"}
              </strong>
              {outputDir && (
                <small className="truncate" title={outputDir}>
                  {outputDir}
                </small>
              )}
            </div>
            {outputDir && (
              <span className="grid size-6 shrink-0 place-items-center rounded-[22px] border-2 border-[var(--color-menta-border)] bg-[var(--color-menta-bg)] text-[var(--color-menta-text)]">
                <Check size={12} strokeWidth={2.5} />
              </span>
            )}
          </div>
        </div>

        {/* Action area */}
        <div className="border-t-2 border-[var(--color-celeste-border)] p-5 bg-[var(--color-celeste-bg)]">
          <button
            type="button"
            disabled={!canConvert}
            onClick={onConvert}
            className="primary-action group w-full"
          >
            {isConverting ? (
              <LoaderCircle size={18} strokeWidth={2} className="animate-spin" />
            ) : images.length === 0 ? (
              <ImagePlus size={18} strokeWidth={2} />
            ) : !outputDir ? (
              <FolderOpen size={18} strokeWidth={2} />
            ) : (
              <Zap size={18} strokeWidth={2} />
            )}
            {isConverting
              ? "Optimizando imágenes…"
              : images.length === 0
                ? "Primero añade imágenes"
                : !outputDir
                  ? "Selecciona una carpeta"
                  : `Optimizar ${images.length} ${images.length === 1 ? "imagen" : "imágenes"}`}
            {canConvert && (
              <ArrowRight
                size={15}
                strokeWidth={2}
                className="ml-auto transition-transform group-hover:translate-x-0.5"
              />
            )}
          </button>
          {!canConvert && !isConverting && (
            <p className="mt-3 text-center text-xs leading-4 text-[var(--color-celeste-text)]">
              Completa los pasos pendientes para activar el botón.
            </p>
          )}
          {hasFinished && (
            <button
              type="button"
              onClick={onHideResults}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-control)] py-2.5 text-xs font-bold text-[var(--color-celeste-text)] transition-colors hover:bg-[var(--color-celeste-bg)]"
            >
              <RotateCcw size={13} strokeWidth={2} /> Ocultar resultados
            </button>
          )}
        </div>
      </div>

      {/* Privacy badge */}
      <div className="rounded-[22px] border-2 border-[var(--color-menta-border)] bg-[var(--color-menta-bg)] p-4 text-[var(--color-menta-text)]">
        <div className="flex gap-3">
          <LockKeyhole size={17} strokeWidth={2} className="mt-0.5 shrink-0 text-[var(--color-menta-text)]" />
          <div>
            <p className="text-xs font-extrabold text-[var(--color-menta-text)]">
              Tus imágenes permanecen en tu equipo
            </p>
            <p className="mt-1 text-sm leading-5 text-[var(--color-menta-text)]/80">
              La aplicación funciona sin subir archivos a internet y nunca modifica los originales.
            </p>
          </div>
        </div>
      </div>

      {/* Compatible formats */}
      <div className="flex items-center justify-center gap-2 rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] px-3 py-2 text-xs font-bold text-[var(--color-celeste-text)]">
        <FileImage size={14} strokeWidth={2} /> Compatible con JPG, JPEG, PNG y WebP
      </div>
    </>
  );
}
