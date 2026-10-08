export type Language = "es" | "en";
export const LANGUAGE_KEY = "minimg-language-v1";
const SETTINGS_KEY = "image-compressor-settings-v1";
const PREFERENCES_KEY = "image-compressor-preferences-v1";

export function detectLanguage(languages: readonly string[] = typeof navigator === "undefined" ? [] : navigator.languages): Language {
  for (const language of languages) {
    const base = language.toLowerCase().split(/[-_]/)[0];
    if (base === "es" || base === "en") return base;
  }
  return "es";
}

export function resolveLanguage(saved: unknown, existingInstallation: boolean, languages?: readonly string[]): Language {
  if (saved === "es" || saved === "en") return saved;
  return existingInstallation ? "es" : detectLanguage(languages);
}

export function loadLanguage(): Language {
  try {
    const settings = localStorage.getItem(SETTINGS_KEY);
    let legacy: unknown;
    try { legacy = JSON.parse(settings ?? "null")?.language; } catch { /* Invalid legacy settings. */ }
    return resolveLanguage(localStorage.getItem(LANGUAGE_KEY) ?? legacy, settings !== null || localStorage.getItem(PREFERENCES_KEY) !== null);
  } catch {
    return detectLanguage();
  }
}

let current: Language | undefined;
const listeners = new Set<() => void>();
export function getLanguage(): Language { return current ??= loadLanguage(); }
export function subscribeLanguage(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function setLanguage(language: Language) {
  current = language;
  try { localStorage.setItem(LANGUAGE_KEY, language); } catch { /* Keep the choice for this session. */ }
  applyLanguage(language);
  listeners.forEach(listener => listener());
}
export function applyLanguage(language = getLanguage()) {
  if (typeof document !== "undefined") document.documentElement.lang = language;
}
