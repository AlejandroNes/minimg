import type { ConversionRequest } from "./types";

export type SavedPreferences = Pick<ConversionRequest,
  "mode" | "outputFormat" | "filenameSuffix" | "overwriteExisting" | "applyOrientation" |
  "effort" | "targetSizeKb" | "resizeWidth" | "resizeHeight" | "keepAspectRatio"
> & { outputDir: string; advancedEnabled: boolean };

export function loadPreferences(): Partial<SavedPreferences> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem("image-compressor-preferences-v1") ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const stored = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of ["filenameSuffix", "outputDir"]) if (typeof stored[key] === "string") result[key] = stored[key];
    for (const key of ["overwriteExisting", "applyOrientation", "keepAspectRatio", "advancedEnabled"]) if (typeof stored[key] === "boolean") result[key] = stored[key];
    for (const [key, choices] of [
      ["mode", ["automatic", "smart", "lossless", "maximumQuality", "recommended", "maximumCompression"]],
      ["outputFormat", ["automatic", "webp", "jpeg", "png"]],
      ["effort", ["fast", "balanced", "maximum"]],
    ] as const) if ((choices as readonly unknown[]).includes(stored[key])) result[key] = stored[key];
    for (const key of ["targetSizeKb", "resizeWidth", "resizeHeight"]) {
      const item = stored[key];
      if (item === null || (typeof item === "number" && Number.isSafeInteger(item) && item > 0 && (key === "targetSizeKb" || item <= 0xffff_ffff))) result[key] = item;
    }
    return result as Partial<SavedPreferences>;
  } catch {
    return {};
  }
}
