import { useTranslation } from "../i18n/useTranslation";

import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

export function StepHeading({
  number,
  title,
  description,
  icon,
  completed = false,
}: {
  number: number;
  title: string;
  description: string;
  icon?: ReactNode;
  completed?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-3.5">
      <span className={`grid size-10 shrink-0 place-items-center rounded-[22px] border-2 text-lg font-black ${completed ? "border-[var(--color-menta-border)] bg-[var(--color-menta-bg)] text-[var(--color-menta-text)]" : "border-[var(--color-celeste-border)] bg-[var(--color-control)] text-[var(--color-celeste-text)]"}`} aria-label={t("stepHeading.step", { p0: number })}>
        {number}
      </span>
      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-[var(--color-text)]">
            {icon && <span className={completed ? "text-[var(--color-menta-text)]" : "text-[var(--color-celeste-text)]"} aria-hidden="true">{icon}</span>}
            {title}
          </h2>
          {completed && <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-menta-text)]"><CheckCircle2 size={14} aria-hidden="true" />{t("stepHeading.done")}</span>}
        </div>
        <p className="mt-1 text-sm leading-5 text-[var(--color-text-secondary)]">
          {description}
        </p>
      </div>
    </div>
  );
}
