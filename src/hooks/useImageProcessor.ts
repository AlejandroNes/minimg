import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Channel, invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import type {
  ActiveTool,
  ConversionProgress,
  ConversionRequest,
  ConversionResult,
  ImageItem,
  OptimizationEffort,
  OptimizationMode,
  OutputFormat,
} from "../types";
import { loadSettings, playFinishSound } from "../settings";
import { loadImageItems } from "../imageLoading";
import { loadPreferences, type SavedPreferences } from "../preferences";
import { getProcessingActivity as getImageActivity, trackImageTask } from "../updater/imageActivity";

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const PREFERENCES_KEY = "image-compressor-preferences-v1";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useImageProcessor() {
  const savedPreferences = useMemo(loadPreferences, []);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [mode, setMode] = useState<OptimizationMode>(savedPreferences.mode ?? "smart");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>(
    savedPreferences.outputFormat ?? "automatic"
  );
  const [effort, setEffort] = useState<OptimizationEffort>(
    savedPreferences.effort ?? "balanced"
  );
  const [filenameSuffix, setFilenameSuffix] = useState(
    savedPreferences.filenameSuffix ?? "-optimizada"
  );
  const [overwriteExisting, setOverwriteExisting] = useState(
    savedPreferences.overwriteExisting ?? false
  );
  const [applyOrientation, setApplyOrientation] = useState(
    savedPreferences.applyOrientation ?? true
  );
  const [targetSizeKb, setTargetSizeKb] = useState<number | null>(
    savedPreferences.targetSizeKb ?? null
  );
  const [resizeWidth, setResizeWidth] = useState(
    savedPreferences.resizeWidth?.toString() ?? ""
  );
  const [resizeHeight, setResizeHeight] = useState(
    savedPreferences.resizeHeight?.toString() ?? ""
  );
  const [keepAspectRatio, setKeepAspectRatio] = useState(
    savedPreferences.keepAspectRatio ?? true
  );
  const [outputDir, setOutputDir] = useState(savedPreferences.outputDir ?? "");
  const [advancedEnabled, setAdvancedEnabled] = useState(
    savedPreferences.advancedEnabled ?? false
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ConversionResult[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [wasCancelled, setWasCancelled] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>("compress");
  const thumbnailUrls = useRef(new Set<string>());
  const imagesRef = useRef(images);
  imagesRef.current = images;
  const mounted = useRef(true);
  const generation = useRef(0);
  const loading = useRef(false);
  const converting = useRef(false);
  const cancelling = useRef(false);
  const dialog = useRef(false);

  const totalOriginalSize = useMemo(
    () => images.reduce((total, image) => total + image.size, 0),
    [images]
  );
  const successfulResults = results.filter((result) => result.success);

  const addPaths = useCallback(async (incomingPaths: string[]) => {
    if (!mounted.current || loading.current || converting.current || getImageActivity()) return;
    loading.current = true;
    const token = ++generation.current;
    const current = () => mounted.current && token === generation.current;
    setIsLoading(true);
    setNotice(null);
    try {
      const loaded = await trackImageTask(() => loadImageItems(incomingPaths, imagesRef.current.map((item) => item.path), {
        inspect: (paths) => invoke("inspect_images", { paths }),
        thumbnail: (path) => invoke("get_thumbnail", { path }),
        createUrl: (bytes) => URL.createObjectURL(new Blob([bytes], { type: "image/png" })),
        revokeUrl: (url) => URL.revokeObjectURL(url),
      }, current));
      if (!current()) { loaded.items.forEach((item) => URL.revokeObjectURL(item.thumbnailUrl)); return; }
      for (const item of loaded.items) thumbnailUrls.current.add(item.thumbnailUrl);
      if (loaded.items.length) {
        const updated = [...imagesRef.current, ...loaded.items];
        imagesRef.current = updated;
        setImages(updated);
        setResults([]);
        setProgress(0);
        setWasCancelled(false);
        setResizeWidth(String(updated.reduce((maximum, item) => Math.max(maximum, item.width), 0)));
      }
      if (loaded.errors.length) setNotice(`Algunos archivos no se pudieron añadir. ${loaded.errors.slice(0, 3).join(" ")}`);
    } catch (error) {
      if (current()) setNotice(`No pudimos leer las imágenes. ${errorMessage(error)}`);
    } finally {
      loading.current = false;
      if (current()) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    
    // Global dropzone applied to the entire window
    void getCurrentWebviewWindow()
      .onDragDropEvent((event) => {
        if (activeTool !== "compress" || converting.current || loading.current || getImageActivity()) return;
        if (event.payload.type === "over") setIsDragging(true);
        if (event.payload.type === "leave") setIsDragging(false);
        if (event.payload.type === "drop") {
          setIsDragging(false);
          void addPaths(event.payload.paths);
        }
      })
      .then((cleanup) => {
        if (disposed) cleanup();
        else unlisten = cleanup;
      }).catch((error) => { if (!disposed) setNotice(`No pudimos activar el arrastre. ${errorMessage(error)}`); });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [addPaths, activeTool]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      for (const url of thumbnailUrls.current) URL.revokeObjectURL(url);
      thumbnailUrls.current.clear();
    };
  }, []);

  useEffect(() => {
    const preferences: SavedPreferences = {
      mode,
      outputFormat,
      effort,
      filenameSuffix,
      overwriteExisting,
      applyOrientation,
      targetSizeKb,
      outputDir,
      advancedEnabled,
      resizeWidth: resizeWidth ? parseInt(resizeWidth) : null,
      resizeHeight: resizeHeight ? parseInt(resizeHeight) : null,
      keepAspectRatio,
    };
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); } catch { /* Mantener preferencias en memoria. */ }
  }, [
    applyOrientation,
    effort,
    filenameSuffix,
    mode,
    outputDir,
    outputFormat,
    overwriteExisting,
    targetSizeKb,
    advancedEnabled,
    resizeWidth,
    resizeHeight,
    keepAspectRatio,
  ]);

  async function chooseImages() {
    if (dialog.current || loading.current || converting.current || getImageActivity()) return;
    dialog.current = true;
    try {
      const selected = await open({ multiple: true, directory: false, title: "Seleccionar imágenes", filters: [{ name: "Imágenes compatibles", extensions: IMAGE_EXTENSIONS }] });
      if (mounted.current && selected) await addPaths(Array.isArray(selected) ? selected : [selected]);
    } catch (error) {
      if (mounted.current) setNotice(`No pudimos abrir la selección. ${errorMessage(error)}`);
    } finally { dialog.current = false; }
  }

  async function chooseOutputDir() {
    if (dialog.current || loading.current || converting.current || getImageActivity()) return;
    dialog.current = true;
    try {
      const selected = await open({ directory: true, multiple: false, title: "Elegir carpeta de destino" });
      if (mounted.current && typeof selected === "string") {
        setOutputDir(selected);
        if (selected !== outputDir) { setResults([]); setProgress(0); }
      }
    } catch (error) {
      if (mounted.current) setNotice(`No pudimos elegir la carpeta. ${errorMessage(error)}`);
    } finally { dialog.current = false; }
  }

  function removeImage(path: string) {
    if (!mounted.current || loading.current || converting.current || getImageActivity()) return;
    const removed = imagesRef.current.find((image) => image.path === path);
    if (removed) { URL.revokeObjectURL(removed.thumbnailUrl); thumbnailUrls.current.delete(removed.thumbnailUrl); }
    const remaining = imagesRef.current.filter((image) => image.path !== path);
    imagesRef.current = remaining;
    setImages(remaining);
    const maxWidth = remaining.reduce((maximum, item) => Math.max(maximum, item.width), 0);
    setResizeWidth((previous) => maxWidth ? String(Math.min(parseInt(previous, 10) || maxWidth, maxWidth)) : "");
    setResults([]); setProgress(0); setWasCancelled(false);
  }

  function clearImages() {
    if (!mounted.current || loading.current || converting.current || getImageActivity()) return;
    imagesRef.current = [];
    setWasCancelled(false);
    for (const image of images) {
      URL.revokeObjectURL(image.thumbnailUrl);
      thumbnailUrls.current.delete(image.thumbnailUrl);
    }
    setImages([]);
    setResizeWidth("");
    setResults([]);
    setProgress(0);
  }

  const clearCache = useCallback(() => {
    if (!mounted.current || loading.current || converting.current || getImageActivity()) return;
    imagesRef.current = [];
    setWasCancelled(false);
    for (const url of thumbnailUrls.current) {
      URL.revokeObjectURL(url);
    }
    thumbnailUrls.current.clear();
    setImages([]);
    setResizeWidth("");
    setResults([]);
    setProgress(0);
    setNotice(null);
  }, []);

  async function convertImages(
    paths = images.map((image) => image.path),
    keepSuccessful = false
  ) {
    if (paths.length === 0 || !outputDir || converting.current || loading.current || getImageActivity()) return;
    converting.current = true;
    const token = ++generation.current;
    const retained = keepSuccessful ? results.filter((result) => result.success) : [];
    paths = [...new Set(paths)];
    const total = retained.length + paths.length;
    setIsConverting(true);
    setIsCancelling(false);
    setResults(retained);
    setProgress(0);
    setNotice(null);
    setWasCancelled(false);

    const channel = new Channel<ConversionProgress>();
    channel.onmessage = (message) => {
      if (!mounted.current || token !== generation.current || !converting.current) return;
      setProgress((previous) => Math.max(previous, Math.min(100, ((retained.length + message.completed) / total) * 100)));
      setResults((current) => [...current.filter((item) => item.sourcePath !== message.result.sourcePath), message.result]);
    };
    const request: ConversionRequest = {
      paths,
      outputDir,
      mode,
      outputFormat,
      filenameSuffix: advancedEnabled ? filenameSuffix : "",
      overwriteExisting: advancedEnabled ? overwriteExisting : false,
      applyOrientation: advancedEnabled ? applyOrientation : false,
      targetSizeKb: advancedEnabled ? targetSizeKb : null,
      effort: advancedEnabled ? effort : "balanced",
      resizeWidth: resizeWidth ? parseInt(resizeWidth) : null,
      resizeHeight: null,
      keepAspectRatio: true,
    };

    try {
      const completed = await trackImageTask(() => invoke<ConversionResult[]>("convert_images", {
        request,
        onProgress: channel,
      }));
      if (!mounted.current || token !== generation.current) return;
      setResults([...retained, ...completed]);
      setProgress(((retained.length + completed.length) / total) * 100);
      if (completed.length < paths.length) {
        setWasCancelled(true);
        setNotice(`Proceso cancelado. Se completaron ${completed.length} de ${paths.length} imágenes.`);
      } else if (completed.every((result) => result.success) && loadSettings().soundOnFinish) {
        playFinishSound();
      }
    } catch (error) {
      if (mounted.current) setNotice(`El proceso se interrumpió. ${errorMessage(error)}`);
    } finally {
      converting.current = false;
      cancelling.current = false;
      if (mounted.current) { setIsConverting(false); setIsCancelling(false); }
    }
  }

  async function cancelConversion() {
    if (cancelling.current || !converting.current) return;
    cancelling.current = true;
    setIsCancelling(true);
    setNotice("Deteniendo el proceso de forma segura…");
    try {
      await invoke("cancel_conversion");
    } catch (error) {
      cancelling.current = false;
      setIsCancelling(false);
      setNotice(`No pudimos detener el proceso. ${errorMessage(error)}`);
    }
  }

  async function showOptimizedFiles() {
    const paths = successfulResults
      .map((result) => result.outputPath)
      .filter((path): path is string => path !== null);
    try {
      if (paths.length > 0) await revealItemInDir(paths);
      else if (outputDir) await invoke("open_output_directory", { path: outputDir });
      else setNotice("Primero debes elegir una carpeta de destino.");
    } catch (error) {
      setNotice(`No pudimos mostrar los archivos en el Explorador. ${errorMessage(error)}`);
    }
  }

  async function showFile(path: string) {
    try {
      await revealItemInDir(path);
    } catch (error) {
      setNotice(`No pudimos mostrar el archivo en el Explorador. ${errorMessage(error)}`);
    }
  }

  const canConvert = images.length > 0 && outputDir.length > 0 && !isConverting && !isLoading && !getImageActivity();
  const hasFinished = !isConverting && results.length > 0;

  return {
    // State
    images,
    mode,
    outputFormat,
    effort,
    filenameSuffix,
    overwriteExisting,
    applyOrientation,
    targetSizeKb,
    resizeWidth,
    resizeHeight,
    keepAspectRatio,
    outputDir,
    advancedEnabled,
    isDragging,
    isLoading,
    isConverting,
    isCancelling,
    progress,
    results,
    notice,
    wasCancelled,
    activeTool,
    totalOriginalSize,
    canConvert,
    hasFinished,
    
    // Setters
    setMode,
    setOutputFormat,
    setEffort,
    setFilenameSuffix,
    setOverwriteExisting,
    setApplyOrientation,
    setTargetSizeKb,
    setResizeWidth,
    setResizeHeight,
    setKeepAspectRatio,
    setAdvancedEnabled,
    setNotice,
    setActiveTool,
    setResults,
    setProgress,

    // Actions
    chooseImages,
    chooseOutputDir,
    removeImage,
    clearImages,
    clearCache,
    convertImages,
    cancelConversion,
    showOptimizedFiles,
    showFile,
  };
}
