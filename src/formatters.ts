export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.max(0, Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1));
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function resizedDimensions(width: number, height: number, targetWidth: number | null | undefined, targetHeight: number | null | undefined, keepAspectRatio: boolean | undefined): [number, number] {
  const needsResize = targetWidth && targetHeight ? width > targetWidth || height > targetHeight
    : targetWidth ? width > targetWidth : targetHeight ? height > targetHeight : false;
  if (!needsResize) return [width, height];
  if (!keepAspectRatio && targetWidth && targetHeight) return [targetWidth, targetHeight];
  const ratio = Math.min(targetWidth ? targetWidth / width : Infinity, targetHeight ? targetHeight / height : Infinity);
  return [Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio))];
}
