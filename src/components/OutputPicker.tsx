import { FolderCheck, FolderOpen } from "lucide-react";

export function OutputPicker({
  disabled = false,
  outputDir,
  onChoose,
}: {
  disabled?: boolean;
  outputDir: string;
  onChoose: () => void;
}) {
  return (
    <button
      disabled={disabled}
      type="button"
      onClick={onChoose}
      className={`mt-5 flex w-full items-center gap-3.5 rounded-[22px] border-2 px-4 py-4 text-left transition-all ${
        outputDir
          ? "border-[var(--color-menta-border)] bg-[var(--color-menta-bg)]"
          : "border-dashed border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] hover:border-[var(--color-border-hover)]"
      }`}
    >
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-[22px] border-2 transition-colors ${
          outputDir
            ? "border-[var(--color-menta-border)] bg-[var(--color-control)] text-[var(--color-menta-text)]"
            : "border-[var(--color-celeste-border)] bg-[var(--color-control)] text-[var(--color-celeste-text)]"
        }`}
      >
        {outputDir ? <FolderCheck size={20} strokeWidth={2} /> : <FolderOpen size={20} strokeWidth={2} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-[var(--color-text)]">
          {outputDir ? "Carpeta de destino seleccionada" : "Seleccionar carpeta de destino"}
        </span>
        <span className="mt-1 block truncate text-sm text-[var(--color-text-secondary)]">
          {outputDir || "Aquí se guardarán las imágenes optimizadas"}
        </span>
      </span>
      <span
        className={`shrink-0 rounded-[22px] border-2 px-3 py-1 text-xs font-bold ${
          outputDir
            ? "border-[var(--color-menta-border)] bg-[var(--color-control)] text-[var(--color-menta-text)]"
            : "border-[var(--color-celeste-border)] bg-[var(--color-control)] text-[var(--color-celeste-text)]"
        }`}
      >
        {outputDir ? "Cambiar" : "Elegir"}
      </span>
    </button>
  );
}
