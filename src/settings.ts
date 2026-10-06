import type { WatermarkPosition } from "./types";

export type Theme = "light" | "dark" | "system";

export interface WatermarkDefaults {
  sizePercent: number;
  opacity: number;
  position: WatermarkPosition;
  filenameSuffix: string;
}

export interface AppSettings {
  theme: Theme;
  username: string;
  soundOnFinish: boolean;
  watermarkDefaults: WatermarkDefaults;
}

export const SETTINGS_KEY = "image-compressor-settings-v1";
export const PREFERENCES_KEY = "image-compressor-preferences-v1";

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  username: "",
  soundOnFinish: true,
  watermarkDefaults: {
    sizePercent: 20,
    opacity: 75,
    position: "bottomRight",
    filenameSuffix: "-marca",
  },
};

export function loadSettings(): AppSettings {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
    const stored = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    const mark = stored.watermarkDefaults && typeof stored.watermarkDefaults === "object"
      ? stored.watermarkDefaults as Record<string, unknown> : {};
    const positions = ["topLeft", "topCenter", "topRight", "centerLeft", "center", "centerRight", "bottomLeft", "bottomCenter", "bottomRight", "custom"];
    const validNumber = (item: unknown, min: number, max: number, fallback: number) =>
      typeof item === "number" && Number.isFinite(item) && item >= min && item <= max ? Math.round(item) : fallback;
    return {
      theme: ["light", "dark", "system"].includes(stored.theme as string) ? stored.theme as Theme : DEFAULT_SETTINGS.theme,
      username: typeof stored.username === "string" ? stored.username : DEFAULT_SETTINGS.username,
      soundOnFinish: typeof stored.soundOnFinish === "boolean" ? stored.soundOnFinish : DEFAULT_SETTINGS.soundOnFinish,
      watermarkDefaults: {
        sizePercent: validNumber(mark.sizePercent, 5, 80, DEFAULT_SETTINGS.watermarkDefaults.sizePercent),
        opacity: validNumber(mark.opacity, 5, 100, DEFAULT_SETTINGS.watermarkDefaults.opacity),
        position: positions.includes(mark.position as string) ? mark.position as WatermarkPosition : DEFAULT_SETTINGS.watermarkDefaults.position,
        filenameSuffix: typeof mark.filenameSuffix === "string" ? mark.filenameSuffix : DEFAULT_SETTINGS.watermarkDefaults.filenameSuffix,
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = resolveTheme(theme);
}

export function loadTheme(): Theme {
  return loadSettings().theme;
}

export function playFinishSound(): void {
  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const now = context.currentTime;
    [880, 1174.66].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      const start = now + index * 0.12;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.45);
    });
    window.setTimeout(() => void context.close().catch(() => {}), 1200);
  } catch {
    // Silently ignore audio errors.
  }
}
