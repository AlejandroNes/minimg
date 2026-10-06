import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Info, Monitor, Moon, RotateCcw, Sun, User, Volume2 } from "lucide-react";
import { playFinishSound, type AppSettings, type Theme } from "../settings";
import { APP_NAME, APP_DESCRIPTION, APP_DEVELOPER, APP_COPYRIGHT, APP_LICENSE, APP_LINKS } from "../appMetadata";
import type { AppUpdater } from "../hooks/useUpdater";
import { UpdatePanel } from "./UpdatePanel";
import logoUrl from "../assets/logo.png";

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

function SectionHeading({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-control)] text-[var(--color-celeste-text)]">
        {icon}
      </span>
      <div>
        <h3 className="text-base font-extrabold text-[var(--color-text)]">{title}</h3>
        <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>
      </div>
    </div>
  );
}

export function SettingsPanel({
  settings,
  onThemeChange,
  onUsernameChange,
  onSoundOnFinishChange,
  onReset,
  updater,
}: {
  settings: AppSettings;
  onThemeChange: (theme: Theme) => void;
  onUsernameChange: (username: string) => void;
  onSoundOnFinishChange: (value: boolean) => void;
  onReset: () => void;
  updater: AppUpdater;
}) {
  const { username, theme, soundOnFinish } = settings;
  const [version, setVersion] = useState("");
  const [linkError, setLinkError] = useState("");
  const links = [
    { label: "Sitio web oficial", url: APP_LINKS.website },
    { label: "Términos y condiciones", url: APP_LINKS.terms },
    { label: "Política de privacidad", url: APP_LINKS.privacy },
    ...(APP_LINKS.github ? [{ label: "GitHub", url: APP_LINKS.github }] : []),
  ];

  async function openExternalLink(url: string) {
    setLinkError("");
    try {
      await openUrl(url);
    } catch {
      setLinkError("No se pudo abrir el enlace en el navegador. Inténtalo de nuevo.");
    }
  }

  useEffect(() => {
    let active = true;
    getVersion()
      .then((value) => {
        if (active) setVersion(value);
      })
      .catch(() => {
        if (active) setVersion("");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Profile */}
      <section className="rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] p-5">
        <SectionHeading
          icon={<User size={19} strokeWidth={2} />}
          title="Perfil"
          description="Tu nombre aparece en el encabezado."
        />
        <label className="mt-4 block text-xs font-bold text-[var(--color-text)]">
          Nombre de usuario
          <input
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
            placeholder="Ej.: Ana"
            maxLength={40}
            className="form-input mt-2"
          />
        </label>
      </section>

      {/* Appearance */}
      <section className="rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] p-5">
        <SectionHeading
          icon={<Sun size={19} strokeWidth={2} />}
          title="Apariencia"
          description="Elige el tema de la aplicación."
        />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onThemeChange(option.value)}
                className={`flex flex-col items-center gap-2 rounded-[22px] border-2 px-3 py-3 text-xs font-bold transition-all ${
                  selected
                    ? "border-[var(--color-border-hover)] bg-[var(--color-control)] text-[var(--color-celeste-text)]"
                    : "border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]"
                }`}
              >
                <Icon size={20} strokeWidth={2} className={selected ? "text-[var(--color-accent)]" : ""} />
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Behavior */}
      <section className="rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] p-5">
        <SectionHeading
          icon={<Volume2 size={19} strokeWidth={2} />}
          title="Comportamiento"
          description="Avisos al finalizar un lote."
        />
        <div className="mt-4 flex items-center justify-between gap-3">
          <label className="option-toggle cursor-pointer">
            <input
              type="checkbox"
              checked={soundOnFinish}
              onChange={(event) => onSoundOnFinishChange(event.target.checked)}
            />
            <span>
              <b>Sonido al terminar</b>
              <small>Reproduce un aviso cuando termina un lote completo.</small>
            </span>
          </label>
          <button
            type="button"
            onClick={() => playFinishSound()}
            className="shrink-0 rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-control)] px-3 py-2 text-xs font-bold text-[var(--color-celeste-text)] transition-colors hover:bg-[var(--color-celeste-bg)]"
          >
            Probar
          </button>
        </div>
      </section>

      {/* About */}
      <section className="rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] p-5">
        <SectionHeading
          icon={<Info size={19} strokeWidth={2} />}
          title="Acerca de"
          description="Información de la aplicación."
        />
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[var(--color-text-secondary)]">Aplicación</dt>
            <dd className="flex items-center gap-2 font-bold text-[var(--color-text)]">
              <img src={logoUrl} alt="" className="size-5 object-contain" />
              {APP_NAME}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--color-text-secondary)]">Versión</dt>
            <dd className="font-bold text-[var(--color-text)]">{version || "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--color-text-secondary)]">Licencia</dt>
            <dd className="font-bold text-[var(--color-text)]">{APP_LICENSE}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-[var(--color-text-secondary)]">{APP_DESCRIPTION}</p>
        <p className="mt-2 text-sm font-bold text-[var(--color-text)]">Desarrollado por {APP_DEVELOPER}</p>
        <nav aria-label="Enlaces de Minimg" className="mt-4 flex flex-col items-start gap-2">
          {links.map(({ label, url }) => (
            <a key={label} href={url} onClick={(event) => {
              event.preventDefault();
              void openExternalLink(url);
            }} className="text-sm font-bold text-[var(--color-celeste-text)] underline underline-offset-4 hover:text-[var(--color-accent)]">
              {label}
            </a>
          ))}
        </nav>
        {linkError && <p role="alert" className="mt-3 text-sm text-[var(--color-text)]">{linkError}</p>}
        <p className="mt-4 text-xs text-[var(--color-text-secondary)]">Las imágenes se procesan localmente en tu dispositivo.</p>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{APP_COPYRIGHT}</p>
        <UpdatePanel updater={updater} embedded />
      </section>

      {/* Reset */}
      <section className="rounded-[22px] border-2 border-[var(--color-coral-border)] bg-[var(--color-coral-bg)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-[22px] border-2 border-[var(--color-coral-border)] bg-[var(--color-control)] text-[var(--color-coral-text)]">
              <RotateCcw size={19} strokeWidth={2} />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-[var(--color-text)]">
                Restaurar configuración
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Vuelve a los valores originales.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="rounded-[22px] border-2 border-[var(--color-coral-border)] bg-[var(--color-control)] px-4 py-2.5 text-xs font-bold text-[var(--color-coral-text)] transition-colors hover:bg-[var(--color-coral-bg)]"
          >
            Restaurar
          </button>
        </div>
      </section>
    </div>
  );
}
