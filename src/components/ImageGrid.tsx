import { useTranslation } from "../i18n/useTranslation";

import { ArrowRight, Images, Plus, Trash2, X } from "lucide-react";
import { formatBytes, resizedDimensions } from "../formatters";
import type { ImageItem } from "../types";

export function ImageGrid({
  disabled = false,
  images,
  totalOriginalSize,
  onAdd,
  onClear,
  onRemove,
  resizeWidth,
  resizeHeight,
  keepAspectRatio,
}: {
  disabled?: boolean;
  images: ImageItem[];
  totalOriginalSize: number;
  onAdd: () => void;
  onClear: () => void;
  onRemove: (path: string) => void;
  resizeWidth?: number | null;
  resizeHeight?: number | null;
  keepAspectRatio?: boolean;
}) {
  const { t, plural, number } = useTranslation();
  if (images.length === 0) return null;

  return (
    <div className="mt-5 animate-scale-in overflow-hidden rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-control)] text-[var(--color-celeste-text)]">
            <Images size={17} strokeWidth={2} />
          </span>
          <div>
            <p className="text-xs font-extrabold text-[var(--color-text)]">
              {plural("images.selected.other", images.length)}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-[var(--color-text-dim)]">{t("imageGrid.totalSize")}{" "}{formatBytes(totalOriginalSize)}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            disabled={disabled}
            type="button"
            onClick={onAdd}
            className="compact-button rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-control)] text-[var(--color-celeste-text)] hover:border-[var(--color-border-hover)]"
          >
            <Plus size={14} strokeWidth={2} />{t("imageGrid.addMore")}{" "}</button>
          <button
            disabled={disabled}
            type="button"
            onClick={onClear}
            className="compact-button rounded-[22px] border-2 border-[var(--color-coral-border)] bg-[var(--color-coral-bg)] text-[var(--color-coral-text)] hover:border-[var(--color-coral-text)]"
          >
            <Trash2 size={14} strokeWidth={2} />{t("watermarkTool.removeAll")}{" "}</button>
        </div>
      </div>

      {/* Image list */}
      <ul className="grid max-h-[360px] gap-2.5 overflow-y-auto bg-[var(--color-celeste-bg)] p-3 sm:grid-cols-2">
        {images.map((image) => (
          <li
            key={image.path}
            className="group flex min-w-0 items-center gap-3 rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-control)] p-2.5 transition-all hover:border-[var(--color-border-hover)]"
          >
            <div className="relative shrink-0 overflow-hidden rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)]">
              <img
                src={image.thumbnailUrl}
                alt={t("imageGrid.previewOf", { p0: image.name })}
                className="size-14 object-cover"
              />
              <span className="absolute bottom-0.5 left-0.5 rounded-[22px] bg-slate-950/75 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white">
                {image.path.split(".").pop()?.toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-xs font-bold text-[var(--color-text)]"
                title={image.name}
              >
                {image.name}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-dim)]">
                {(() => {
                  const [w, h] = resizedDimensions(image.width, image.height, resizeWidth, resizeHeight, keepAspectRatio);
                  if (w !== image.width || h !== image.height) {
                    return (
                      <>
                        <span className="line-through opacity-70">{number(image.width)} × {number(image.height)} px</span>
                        <ArrowRight size={12} strokeWidth={2} className="mx-1 inline align-baseline text-[var(--color-accent-text)]" />
                        <span className="font-bold text-[var(--color-accent-text)]">{number(w)} × {number(h)} px</span>
                      </>
                    );
                  }
                  return `${number(image.width)} × ${number(image.height)} px`;
                })()}
              </p>
              <p className="mt-0.5 text-xs font-bold text-[var(--color-text-secondary)]">
                {formatBytes(image.size)}
              </p>
            </div>
            <button
              disabled={disabled}
              type="button"
              onClick={() => onRemove(image.path)}
              className="grid size-8 shrink-0 place-items-center rounded-[22px] border-2 border-transparent text-[var(--color-text-dim)] opacity-0 transition-all hover:border-[var(--color-coral-border)] hover:bg-[var(--color-coral-bg)] hover:text-[var(--color-coral-text)] focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-0"
              aria-label={t("watermarkTool.remove", { p0: image.name })}
            >
              <X size={15} strokeWidth={2} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
