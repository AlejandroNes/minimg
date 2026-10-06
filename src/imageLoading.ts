import type { ImageInfo, ImageItem } from "./types";

export interface ImageLoadingApi {
  inspect: (paths: string[]) => Promise<ImageInfo[]>;
  thumbnail: (path: string) => Promise<ArrayBuffer>;
  createUrl: (bytes: ArrayBuffer) => string;
  revokeUrl: (url: string) => void;
}

// La carga parcial conserva los archivos válidos y limita las solicitudes nativas.
export async function loadImageItems(
  incoming: string[],
  existing: Iterable<string>,
  api: ImageLoadingApi,
  isCurrent: () => boolean = () => true,
): Promise<{ items: ImageItem[]; errors: string[] }> {
  const seen = new Set(existing);
  const paths = [...new Set(incoming)].filter((path) => !seen.has(path));
  const supported = paths.filter((path) => /\.(jpe?g|png|webp)$/i.test(path));
  const errors: string[] = [];
  if (supported.length !== paths.length) errors.push(`${paths.length - supported.length} archivos no compatibles.`);
  if (supported.length + seen.size > 10_000) throw new Error("Selecciona como máximo 10 000 imágenes por lote.");
  if (!supported.length) return { items: [], errors };
  let info: ImageInfo[];
  try {
    info = await api.inspect(supported);
  } catch {
    info = [];
    for (let index = 0; index < supported.length && isCurrent(); index += 4) {
      const batch = await Promise.allSettled(supported.slice(index, index + 4).map((path) => api.inspect([path])));
      batch.forEach((result, offset) => {
        if (result.status === "fulfilled") info.push(...result.value);
        else errors.push(`${supported[index + offset].split(/[\\/]/).pop()}: ${String(result.reason)}`);
      });
    }
  }
  info = info.filter((item) => {
    if (seen.has(item.path)) return false;
    seen.add(item.path);
    return true;
  });
  const items: ImageItem[] = [];
  try {
    for (let index = 0; index < info.length && isCurrent(); index += 4) {
      const batch = await Promise.allSettled(info.slice(index, index + 4).map((item) => api.thumbnail(item.path)));
      if (!isCurrent()) break;
      batch.forEach((result, offset) => {
        const item = info[index + offset];
        if (result.status === "fulfilled") items.push({ ...item, thumbnailUrl: api.createUrl(result.value) });
        else errors.push(`${item.name}: ${String(result.reason)}`);
      });
    }
    if (!isCurrent()) {
      items.forEach((item) => api.revokeUrl(item.thumbnailUrl));
      return { items: [], errors: [] };
    }
    return { items, errors };
  } catch (error) {
    items.forEach((item) => api.revokeUrl(item.thumbnailUrl));
    throw error;
  }
}
