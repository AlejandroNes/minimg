import { useState } from "react";
import { Check, RotateCcw, Settings } from "lucide-react";
import type { ActiveTool } from "../types";
import { APP_NAME } from "../appMetadata";
import logoUrl from "../assets/logo.png";

export function AppHeader({
  activeTool,
  onToolChange,
  onOpenSettings,
  onClearCache,
  username,
  busy = false,
}: {
  activeTool: ActiveTool;
  onToolChange: (tool: ActiveTool) => void;
  onOpenSettings: () => void;
  onClearCache: () => void;
  username?: string;
  busy?: boolean;
}) {
  const [isClearing, setIsClearing] = useState(false);
  const [isCleaned, setIsCleaned] = useState(false);

  const handleClear = () => {
    if (isClearing) return;
    setIsClearing(true);
    try {
      onClearCache();
    } finally {
      setTimeout(() => {
        setIsClearing(false);
        setIsCleaned(true);
        setTimeout(() => {
          setIsCleaned(false);
        }, 1800);
      }, 350);
    }
  };

  return (
    <header className="app-header sticky top-0 z-20 border-b border-[var(--color-border-light)]">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-3.5">
          <div className="grid size-11 place-items-center overflow-hidden rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)]">
            <img src={logoUrl} alt={APP_NAME} className="size-8 object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-[var(--color-text)]">
              {APP_NAME}
            </h1>
            <p className="mt-0.5 text-xs font-medium text-[var(--color-text-dim)]">
              Reduce el peso sin complicaciones
            </p>
          </div>
        </div>

        {/* Tool tabs */}
        <nav aria-label="Herramientas" className="hidden items-center gap-1 rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] p-1 sm:flex">
          <button
            type="button"
            disabled={busy}
            onClick={() => onToolChange("compress")}
            className={`rounded-[22px] border-2 px-3.5 py-1.5 text-sm font-bold transition-all ${
              activeTool === "compress"
                ? "border-[var(--color-celeste-border)] bg-[var(--color-control)] text-[var(--color-celeste-text)]"
                : "border-transparent text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            }`}
          >
            Optimizar imágenes
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onToolChange("watermark")}
            className={`rounded-[22px] border-2 px-3.5 py-1.5 text-sm font-bold transition-all ${
              activeTool === "watermark"
                ? "border-[var(--color-lila-border)] bg-[var(--color-control)] text-[var(--color-lila-text)]"
                : "border-transparent text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            }`}
          >
            Marca de agua
          </button>
        </nav>

        <div className="flex items-center gap-2">
          {username && (
            <div className="hidden rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] px-3.5 py-1.5 text-xs font-bold text-[var(--color-celeste-text)] md:block">
              Hola, {username}
            </div>
          )}
          <button
            type="button"
            onClick={handleClear}
            disabled={isClearing || busy}
            aria-label="Limpiar caché y memoria"
            title="Limpiar caché y memoria de la aplicación"
            className="group flex items-center gap-1.5 rounded-[22px] border-2 border-[var(--color-menta-border)] bg-[var(--color-menta-bg)] px-3 py-1.5 text-xs font-bold text-[var(--color-menta-text)] transition-all duration-200 hover:brightness-95 active:scale-95 disabled:pointer-events-none"
          >
            {isCleaned ? (
              <>
                <Check size={14} strokeWidth={2.5} className="shrink-0 text-[var(--color-menta-text)]" />
                <span className="hidden sm:inline">¡Todo limpio!</span>
              </>
            ) : (
              <>
                <RotateCcw
                  size={14}
                  strokeWidth={2}
                  className={`shrink-0 transition-transform duration-500 ${
                    isClearing ? "animate-spin" : "group-hover:-rotate-90"
                  }`}
                />
                <span className="hidden sm:inline">Limpiar caché</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Abrir configuración"
            title="Configuración"
            className="grid size-10 place-items-center rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] text-[var(--color-celeste-text)] transition-colors hover:border-[var(--color-border-hover)]"
          >
            <Settings size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Mobile tool tabs */}
      <nav aria-label="Herramientas" className="flex border-t-2 border-[var(--color-celeste-border)] sm:hidden">
        <button
          type="button"
          disabled={busy}
          onClick={() => onToolChange("compress")}
          className={`flex-1 border-b-2 py-3 text-xs font-bold transition ${activeTool === "compress"
              ? "border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] text-[var(--color-celeste-text)]"
              : "border-transparent text-[var(--color-text-dim)]"
            }`}
        >
          Optimizar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onToolChange("watermark")}
          className={`flex-1 border-b-2 py-3 text-xs font-bold transition ${activeTool === "watermark"
              ? "border-[var(--color-lila-border)] bg-[var(--color-lila-bg)] text-[var(--color-lila-text)]"
              : "border-transparent text-[var(--color-text-dim)]"
            }`}
        >
          Marca de agua
        </button>
      </nav>
    </header>
  );
}
