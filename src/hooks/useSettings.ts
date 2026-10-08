import { useTranslation } from "../i18n/useTranslation";
import { detectLanguage } from "../i18n/language";

import { useCallback, useEffect, useState } from "react";
import {
  applyTheme,
  loadSettings,
  type AppSettings,
  SETTINGS_KEY,
  DEFAULT_SETTINGS,
} from "../settings";

export function useSettings() {
  const { language, setLanguage } = useTranslation();
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, language })); } catch { /* Preferencias válidas en memoria. */ }
  }, [settings]);

  useEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(settings.theme);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [settings.theme]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const setTheme = useCallback((theme: AppSettings["theme"]) => {
    setSettings((current) => ({ ...current, theme }));
  }, []);

  const setUsername = useCallback((username: string) => {
    setSettings((current) => ({ ...current, username }));
  }, []);

  const setSoundOnFinish = useCallback((soundOnFinish: boolean) => {
    setSettings((current) => ({ ...current, soundOnFinish }));
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const reset = useCallback(() => {
    setLanguage(detectLanguage());
    try { localStorage.removeItem(SETTINGS_KEY); } catch { /* El restablecimiento sigue disponible. */ }
    setSettings({ ...DEFAULT_SETTINGS, watermarkDefaults: { ...DEFAULT_SETTINGS.watermarkDefaults } });
  }, []);

  return {
    settings: { ...settings, language },
    setLanguage,
    setTheme,
    setUsername,
    setSoundOnFinish,
    reset,
    isOpen,
    open,
    close,
  };
}
