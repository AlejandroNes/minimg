import { Check, CircleAlert } from "lucide-react";
import type { OutputFormat } from "../types";

const FORMAT_OPTIONS: {
  value: OutputFormat;
  label: string;
  description: string;
  badge?: string;
}[] = [
    {
      value: "automatic",
      label: "Automático",
      description: "Usa WebP y ajusta la calidad según cada imagen.",
      badge: "Recomendado",
    },
    {
      value: "webp",
      label: "WebP",
      description: "Ligero y compatible con la mayoría de plataformas.",
    },
    {
      value: "jpeg",
      label: "JPEG",
      description: "Ideal para fotografías y máxima compatibilidad.",
    },
    {
      value: "png",
      label: "PNG",
      description: "Conserva transparencia, logotipos y gráficos.",
    },
  ];

export { FORMAT_OPTIONS };

export function FormatPicker({
  value,
  onChange,
  disabled,
}: {
  value: OutputFormat;
  onChange: (format: OutputFormat) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {FORMAT_OPTIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(item.value)}
            className={`format-card ${value === item.value ? "format-card-selected" : ""}`}
          >
            <span className="flex items-center justify-between gap-2">
              <b>{item.label}</b>
              <span
                className={`grid size-5 place-items-center rounded-[22px] border-2 transition-all ${
                  value === item.value
                    ? "border-[var(--color-border-hover)] bg-[var(--color-action)] text-white"
                    : "border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] text-transparent"
                }`}
              >
                <Check size={11} strokeWidth={2.5} />
              </span>
            </span>
            <small>{item.description}</small>
            {item.badge && (
              <span className="mt-2.5 inline-block rounded-[22px] border-2 border-[var(--color-lila-border)] bg-[var(--color-lila-bg)] px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-lila-text)]">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      {value === "jpeg" && (
        <div className="mt-3 flex gap-2.5 rounded-[22px] border-2 border-[var(--color-amarillo-border)] bg-[var(--color-amarillo-bg)] px-3.5 py-3 text-sm leading-5 text-[var(--color-amarillo-text)]">
          <CircleAlert size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-[var(--color-amarillo-text)]" />
          <p>
            JPEG no admite transparencia. Si una imagen tiene zonas transparentes, se colocarán
            sobre un fondo blanco.
          </p>
        </div>
      )}
    </div>
  );
}
