import type { Translator } from "../i18n/index";
import { useTranslation } from "../i18n/useTranslation";

import { Check, Info } from "lucide-react";
import type { OptimizationMode } from "../types";
import { StepHeading } from "./StepHeading";

export function getModePickerOptions(t: Translator) {
const OPTIMIZATION_MODES: {
  value: OptimizationMode;
  label: string;
  description: string;
  badge?: string;
}[] = [
    {
      value: "smart",
      label: t("advancedPanel.recommended"),
      description:
        t("modePicker.analyzesEachImageAndAutomaticallySelects"),
      badge: t("modePicker.bestForMostImages"),
    },
    {
      value: "recommended",
      label: t("modePicker.balancedQuality"),
      description:
        t("modePicker.usesQualityForPredictableSmallFiles"),
    },
    {
      value: "maximumCompression",
      label: t("modePicker.smallestFile"),
      description:
        t("modePicker.prioritizesTheSmallestPossibleFileSize"),
    },
  ];
  return OPTIMIZATION_MODES;
}

export function ModePicker({
  value,
  onChange,
  disabled,
}: {
  value: OptimizationMode;
  onChange: (mode: OptimizationMode) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const OPTIMIZATION_MODES = getModePickerOptions(t);
  return (
    <section data-step="3" data-complete={OPTIMIZATION_MODES.some((item) => item.value === value)} className="step-section p-5 sm:p-6">
      <StepHeading number={3} completed={OPTIMIZATION_MODES.some((item) => item.value === value)} title={t("modePicker.whichResultDoYouPrefer")} description={t("modePicker.theRecommendedModeWorksWellFor")} />
      <div className="mt-3.5 grid gap-2.5 lg:grid-cols-3">
        {OPTIMIZATION_MODES.map((item) => (
          <button
            key={item.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(item.value)}
            className={`mode-card relative text-left ${value === item.value ? "mode-card-selected" : ""
              }`}
          >
            <span className="flex items-start justify-between gap-3">
              <span>
                <span className="block text-sm font-extrabold text-[var(--color-text)]">
                  {item.label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--color-text-secondary)]">
                  {item.description}
                </span>
              </span>
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-[22px] border-2 transition-all ${
                  value === item.value
                    ? "border-[var(--color-border-hover)] bg-[var(--color-action)] text-white"
                    : "border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] text-transparent"
                }`}
              >
                <Check size={11} strokeWidth={2.5} />
              </span>
            </span>
            {item.badge && (
              <span className="mt-2.5 inline-flex rounded-[22px] border-2 border-[var(--color-lila-border)] bg-[var(--color-lila-bg)] px-2.5 py-0.5 text-xs font-extrabold text-[var(--color-lila-text)]">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="mt-4 flex gap-2.5 rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] px-3.5 py-3 text-sm leading-5 text-[var(--color-celeste-text)]">
        <Info size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
        <p>{t("modePicker.ifAnImageCannotBeMade")}{" "}<b>{t("modePicker.alreadyOptimized")}</b>.
        </p>
      </div>
    </section>
  );
}
