import { useTranslation } from "../i18n/useTranslation";

import { ImagePlus, LoaderCircle } from "lucide-react";

export function DropZone({
  disabled = false,
  isDragging,
  isLoading,
  onClick,
}: {
  disabled?: boolean;
  isDragging: boolean;
  isLoading: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      disabled={disabled}
      type="button"
      onClick={onClick}
      className={`group relative mt-5 flex min-h-[200px] w-full overflow-hidden rounded-[22px] border-2 border-dashed px-6 transition-all ${
        isDragging
          ? "border-[var(--color-border-hover)] bg-[var(--color-celeste-bg)]"
          : "border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] hover:border-[var(--color-border-hover)]"
      }`}
    >
      <span className="m-auto flex flex-col items-center text-center">
        <span
          className={`grid size-16 place-items-center rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-control)] text-[var(--color-celeste-text)] transition-transform ${
            isDragging ? "scale-105 border-[var(--color-border-hover)]" : ""
          }`}
        >
          {isLoading ? (
            <LoaderCircle size={26} strokeWidth={2} className="animate-spin" />
          ) : (
            <ImagePlus size={26} strokeWidth={2} />
          )}
        </span>
        <strong className="mt-5 text-base font-extrabold text-[var(--color-text)]">
          {isDragging
            ? t("watermarkTool.dropImagesHere")
            : t("dropZone.dragImagesOrClickToSelect")}
        </strong>
        <span className="mt-2 text-sm font-medium text-[var(--color-text-dim)]">{t("dropZone.supportedFormatsJpgJpegPngAnd")}{" "}</span>
      </span>
    </button>
  );
}
