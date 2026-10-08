import { useTranslation } from "../i18n/useTranslation";

import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  FolderOpen,
  RotateCcw,
} from "lucide-react";
import { fileNameFromPath, formatBytes } from "../formatters";
import type { ConversionResult } from "../types";

export function ResultPanel({
  results,
  wasCancelled,
  onShowFiles,
  onRetryFailed,
  onShowFile,
  onCompare,
}: {
  results: ConversionResult[];
  wasCancelled: boolean;
  onShowFiles: () => void;
  onRetryFailed: (paths: string[]) => void;
  onShowFile: (path: string) => void;
  onCompare: (result: ConversionResult) => void;
}) {
  const { t, plural, text, number } = useTranslation();
  const successfulResults = results.filter((r) => r.success);
  const convertedResults = successfulResults.filter((r) => !r.preservedOriginal);
  const optimizedResults = successfulResults.filter((r) => r.optimized);
  const unchangedResults = successfulResults.filter((r) => r.preservedOriginal);
  const failedResults = results.filter((r) => !r.success);

  const originalConvertedTotal = successfulResults.reduce((t, r) => t + r.originalSize, 0);
  const convertedTotal = successfulResults.reduce((t, r) => t + (r.convertedSize ?? 0), 0);
  const totalSaved = Math.max(0, originalConvertedTotal - convertedTotal);
  const savingsPercent =
    originalConvertedTotal > 0 ? (totalSaved / originalConvertedTotal) * 100 : 0;

  return (
    <section className="animate-scale-in overflow-hidden rounded-[22px] border-2 border-[var(--color-menta-border)] bg-[var(--color-menta-bg)] text-[var(--color-text)]">
      {/* Header */}
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-[22px] border-2 border-[var(--color-menta-border)] bg-[var(--color-control)] text-[var(--color-menta-text)]">
            <CheckCircle2 size={24} strokeWidth={2} />
          </span>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--color-menta-text)]">
              {wasCancelled ? t("resultPanel.partialResults") : failedResults.length ? t("resultPanel.processCompletedWithErrors") : t("resultPanel.allDone")}
            </p>
            <h2 className="mt-1 text-xl font-black">
              {plural("images.saved.other", successfulResults.length)}
            </h2>
            <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
              {t("results.summary", { converted: convertedResults.length, optimized: optimizedResults.length, unchanged: unchangedResults.length, failed: failedResults.length })}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onShowFiles}
            className="inline-flex items-center justify-center gap-2 rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-action)] px-4 py-3 text-xs font-extrabold text-white transition-all hover:bg-[var(--color-action-hover)]"
          >
            <FolderOpen size={16} strokeWidth={2} />{t("resultPanel.showFiles")}{" "}</button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-col border-y-2 border-[var(--color-menta-border)] bg-[var(--color-menta-bg)] sm:flex-row">
        {/* Main savings highlight */}
        <div className="flex flex-1 flex-col justify-center border-b-2 border-[var(--color-menta-border)] bg-[var(--color-menta-bg)] p-6 sm:border-b-0 sm:border-r-2">
          <p className="text-xs font-black uppercase tracking-widest text-[var(--color-menta-text)]">{t("resultPanel.spaceSaved")}{" "}</p>
          <p className="mt-1 text-5xl font-black tracking-tight text-[var(--color-menta-text)]">
            {formatBytes(totalSaved)}
          </p>
          <div className="mt-3 flex items-center gap-3 text-xs font-bold text-[var(--color-text-secondary)]">
            <span className="line-through opacity-70">{formatBytes(originalConvertedTotal)}</span>
            <ArrowRight size={13} strokeWidth={2} className="inline text-[var(--color-menta-text)]" />
            <span className="text-[var(--color-text)]">{formatBytes(convertedTotal)}</span>
            <span className="ml-2 inline-flex items-center gap-0.5 rounded-[22px] border-2 border-[var(--color-menta-border)] bg-[var(--color-control)] px-2 py-0.5 text-xs font-extrabold text-[var(--color-menta-text)]">
              <ArrowDown size={11} strokeWidth={2.5} className="shrink-0" />
              {number(savingsPercent, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
            </span>
          </div>
        </div>
      </div>

      {/* File list */}
      {successfulResults.length > 0 && (
        <ul className="max-h-[380px] overflow-y-auto">
          {successfulResults.map((result) => {
            const finalSize = result.convertedSize ?? result.originalSize;
            const savings = result.savingsPercent ?? 0;

            return (
              <li
                key={result.sourcePath}
                className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[var(--color-menta-border)] bg-[var(--color-menta-bg)] px-5 py-3 transition-colors hover:bg-[var(--color-control)] last:border-b-0"
              >
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <p className="w-1/3 truncate text-xs font-bold text-[var(--color-text)] sm:w-1/4">
                    {fileNameFromPath(result.sourcePath)}
                  </p>
                  <div className="flex flex-1 items-center gap-3 text-sm font-bold text-[var(--color-text-dim)]">
                    {result.preservedOriginal ? (
                      <span className="text-[var(--color-text-secondary)]">{t("resultPanel.alreadyOptimizedAlt")}</span>
                    ) : result.optimized ? (
                      <>
                        <span className="line-through opacity-70">{formatBytes(result.originalSize)}</span>
                        <ArrowRight size={12} strokeWidth={2} className="inline text-[var(--color-text-dim)]" />
                        <span className="text-[var(--color-text)]">{formatBytes(finalSize)}</span>
                        <span className="ml-2 inline-flex items-center gap-0.5 rounded-[22px] border-2 border-[var(--color-menta-border)] bg-[var(--color-control)] px-2 py-0.5 text-xs font-extrabold text-[var(--color-menta-text)]">
                          <ArrowDown size={10} strokeWidth={2.5} className="shrink-0" />
                          {number(savings, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                        </span>
                      </>
                    ) : (
                      <span className="text-[var(--color-celeste-text)]">{finalSize === result.originalSize ? t("resultPanel.sizeUnchanged") : t("resultPanel.theSelectedFormatIsLarger")}</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {result.optimized && result.outputPath && (
                    <button
                      type="button"
                      onClick={() => onCompare(result)}
                      className="rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] px-3 py-1.5 text-xs font-bold text-[var(--color-celeste-text)] transition-colors hover:border-[var(--color-border-hover)]"
                    >{t("resultPanel.compare")}{" "}</button>
                  )}
                  {result.outputPath && (
                    <button
                      type="button"
                      onClick={() => onShowFile(result.outputPath!)}
                      className="rounded-[22px] border-2 border-[var(--color-menta-border)] bg-[var(--color-control)] px-3 py-1.5 text-xs font-bold text-[var(--color-menta-text)] transition-colors hover:bg-[var(--color-menta-bg)]"
                    >
                      {t("files.show")}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Failed */}
      {failedResults.length > 0 && (
        <div className="m-4 rounded-[22px] border-2 border-[var(--color-coral-border)] bg-[var(--color-coral-bg)] p-4 sm:m-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold text-[var(--color-coral-text)]">
              {plural("images.failed.other", failedResults.length)}
            </p>
            <button
              type="button"
              onClick={() => onRetryFailed(failedResults.map((r) => r.sourcePath))}
              className="inline-flex items-center gap-1.5 rounded-[22px] border-2 border-[var(--color-coral-border)] bg-[var(--color-control)] px-3 py-1.5 text-xs font-bold text-[var(--color-coral-text)] transition-colors hover:bg-[var(--color-coral-bg)]"
            >
              <RotateCcw size={13} strokeWidth={2} className="shrink-0" />{t("resultPanel.tryAgain")}{" "}</button>
          </div>
          <ul className="mt-2 space-y-1 text-sm leading-5 text-[var(--color-coral-text)]">
            {failedResults.map((r) => (
              <li key={r.sourcePath}>
                <b>{fileNameFromPath(r.sourcePath)}:</b> {text(r.error)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
