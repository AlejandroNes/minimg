import { useTranslation } from "../i18n/useTranslation";

import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, LoaderCircle } from "lucide-react";
import { fileNameFromPath } from "../formatters";

export function ImageComparisonModal({
  sourcePath,
  outputPath,
  onClose,
}: {
  sourcePath: string;
  outputPath: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [position, setPosition] = useState(50);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    let sourceObjUrl: string | null = null;
    let outputObjUrl: string | null = null;

    async function loadImages() {
      try {
        const [sourceBytes, outputBytes] = await Promise.all([
          invoke<ArrayBuffer>("read_file_bytes", { path: sourcePath }),
          invoke<ArrayBuffer>("read_file_bytes", { path: outputPath }),
        ]);

        if (active) {
          sourceObjUrl = URL.createObjectURL(new Blob([sourceBytes]));
          outputObjUrl = URL.createObjectURL(new Blob([outputBytes]));
          setSourceUrl(sourceObjUrl);
          setOutputUrl(outputObjUrl);
          setIsLoading(false);
        }
      } catch {
        console.error(t("imageComparisonModal.theComparisonImagesCouldNotBe"));
        if (active) setIsLoading(false);
      }
    }

    loadImages();

    return () => {
      active = false;
      if (sourceObjUrl) URL.revokeObjectURL(sourceObjUrl);
      if (outputObjUrl) URL.revokeObjectURL(outputObjUrl);
    };
  }, [sourcePath, outputPath]);

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

  const updatePosition = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPosition((x / rect.width) * 100);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || activePointer.current !== null) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointer.current = e.pointerId;
    updatePosition(e.clientX);
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== e.pointerId) return;
    activePointer.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== e.pointerId) return;
    updatePosition(e.clientX);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:p-8 animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("imageComparisonModal.visualComparison")}
        className="relative flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] p-4">
          <div>
            <h3 className="text-sm font-black text-[var(--color-text)]">{t("imageComparisonModal.visualComparisonAlt")}</h3>
            <p className="text-xs text-[var(--color-text-dim)]">{fileNameFromPath(sourcePath)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("imageComparisonModal.closeComparison")}
            className="rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-control)] p-2 text-[var(--color-celeste-text)] transition-colors hover:bg-[var(--color-celeste-bg)]"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        {/* Content */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[var(--color-control)] p-4">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 text-[var(--color-accent)]">
              <LoaderCircle size={32} strokeWidth={2} className="animate-spin" />
              <p className="text-sm font-bold">{t("imageComparisonModal.loadingImages")}</p>
            </div>
          ) : sourceUrl && outputUrl ? (
            <div
              ref={containerRef}
              className="bg-checkerboard relative m-auto h-full max-h-[70vh] w-full max-w-4xl select-none overflow-hidden rounded-[22px] border-2 border-[var(--color-celeste-border)]"
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerMove={handlePointerMove}
              onPointerCancel={handlePointerUp}
              onLostPointerCapture={handlePointerUp}
              style={{ touchAction: "none" }}
            >
              {/* Output Image (Background / Después) */}
              <img
                src={outputUrl}
                alt={t("imageComparisonModal.afterCompressed")}
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
              />

              {/* Source Image (Foreground / Antes) with Clip Path */}
              <img
                src={sourceUrl}
                alt={t("imageComparisonModal.beforeOriginal")}
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
              />

              {/* Slider Handle */}
              <div
                role="slider"
                tabIndex={0}
                aria-label={t("imageComparisonModal.comparisonDivider")}
                aria-valuenow={Math.round(position)}
                aria-valuemin={0}
                aria-valuemax={100}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft") {
                    setPosition((prev) => Math.max(0, prev - 5));
                  } else if (e.key === "ArrowRight") {
                    setPosition((prev) => Math.min(100, prev + 5));
                  }
                }}
                className="absolute bottom-0 top-0 w-1 cursor-ew-resize bg-[var(--color-action)]"
                style={{ left: `calc(${position}% - 2px)` }}
              >
                <div className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-control)] text-[var(--color-celeste-text)] shadow-sm">
                  <div className="flex gap-1">
                    <div className="h-3 w-0.5 rounded-full bg-current" />
                    <div className="h-3 w-0.5 rounded-full bg-current" />
                  </div>
                </div>
              </div>

              {/* Labels */}
              <div className="absolute bottom-4 left-4 rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] px-3 py-1.5 text-xs font-bold text-[var(--color-celeste-text)]">{t("imageComparisonModal.beforeOriginal")}{" "}</div>
              <div className="absolute bottom-4 right-4 rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] px-3 py-1.5 text-xs font-bold text-[var(--color-celeste-text)]">{t("imageComparisonModal.afterOptimized")}{" "}</div>
            </div>
          ) : (
            <p className="text-sm font-bold text-[var(--color-coral-text)]">{t("imageComparisonModal.theImagesCouldNotBeLoaded")}{" "}</p>
          )}
        </div>
      </div>
    </div>
  );
}
