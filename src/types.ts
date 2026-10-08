import type { NativeError } from "./i18n/index";
export type ActiveTool = "compress" | "watermark";

export interface ImageInfo {
  path: string;
  name: string;
  width: number;
  height: number;
  encodedWidth?: number;
  encodedHeight?: number;
  size: number;
}

export interface ImageItem extends ImageInfo {
  thumbnailUrl: string;
}

export interface ConversionRequest {
  paths: string[];
  outputDir: string;
  mode: OptimizationMode;
  outputFormat: OutputFormat;
  filenameSuffix: string;
  overwriteExisting: boolean;
  applyOrientation: boolean;
  targetSizeKb: number | null;
  effort: OptimizationEffort;
  resizeWidth: number | null;
  resizeHeight: number | null;
  keepAspectRatio: boolean;
}

export type OutputFormat = "automatic" | "webp" | "jpeg" | "png";

export type OptimizationEffort = "fast" | "balanced" | "maximum";

export type OptimizationMode =
  | "smart"
  | "automatic"
  | "lossless"
  | "maximumQuality"
  | "recommended"
  | "maximumCompression";

export interface ConversionResult {
  sourcePath: string;
  outputPath: string | null;
  originalSize: number;
  convertedSize: number | null;
  savingsPercent: number | null;
  finalWidth: number | null;
  finalHeight: number | null;
  qualityUsed: string | null;
  visualScore: number | null;
  visualRating: string | null;
  outputFormat: string;
  preservedOriginal: boolean;
  optimized: boolean;
  success: boolean;
  error: NativeError | string | null;
}

export interface ConversionProgress {
  completed: number;
  total: number;
  result: ConversionResult;
}

export type WatermarkPosition = "topLeft" | "topCenter" | "topRight" | "centerLeft" | "center" | "centerRight" | "bottomLeft" | "bottomCenter" | "bottomRight" | "custom";

export interface WatermarkRequest {
  paths: string[];
  watermarkPath: string;
  outputDir: string;
  position: WatermarkPosition;
  sizePercent: number;
  opacity: number;
  customXPercent: number | null;
  customYPercent: number | null;
  filenameSuffix: string;
  overwriteExisting: boolean;
}
