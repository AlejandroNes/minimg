import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Channel, invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  CheckCircle2,
  CircleAlert,
  FolderOpen,
  ImagePlus,
  Images,
  LoaderCircle,
  MapPin,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { fileNameFromPath, formatBytes } from "./formatters";
import { StepHeading } from "./components/StepHeading";
import { useSettings } from "./hooks/useSettings";
import { playFinishSound } from "./settings";
import { loadImageItems } from "./imageLoading";
import { getProcessingActivity as getImageActivity, trackImageTask } from "./updater/imageActivity";
import type {
  ConversionProgress,
  ConversionResult,
  ImageItem,
  WatermarkPosition,
  WatermarkRequest,
} from "./types";

const EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

function previewPosition(
  position: WatermarkPosition,
  customX: number,
  customY: number,
): React.CSSProperties {
  if (position === "custom")
    return {
      left: `${customX}%`,
      top: `${customY}%`,
      transform: "translate(-50%, -50%)",
    };
  const horizontal = position.includes("Left")
    ? { left: 0 }
    : position.includes("Right")
      ? { right: 0 }
      : { left: "50%", transform: "translateX(-50%)" };
  const vertical = position.startsWith("top")
    ? { top: 0 }
    : position.startsWith("bottom")
      ? { bottom: 0 }
      : {
        top: "50%",
        transform: `${"transform" in horizontal ? horizontal.transform : ""} translateY(-50%)`.trim(),
      };
  return { ...horizontal, ...vertical };
}

export function WatermarkTool() {
  const { settings } = useSettings();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [watermarkPath, setWatermarkPath] = useState("");
  const [watermarkUrl, setWatermarkUrl] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [position, setPosition] = useState<WatermarkPosition>(
    settings.watermarkDefaults.position,
  );
  const [sizePercent, setSizePercent] = useState(settings.watermarkDefaults.sizePercent);
  const [opacity, setOpacity] = useState(settings.watermarkDefaults.opacity);
  const [customXPercent, setCustomXPercent] = useState(85);
  const [customYPercent, setCustomYPercent] = useState(85);
  const [filenameSuffix, setFilenameSuffix] = useState(
    settings.watermarkDefaults.filenameSuffix,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ConversionResult[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const urls = useRef(new Set<string>());
  const imagesRef = useRef(images); imagesRef.current = images;
  const mounted = useRef(true);
  const generation = useRef(0);
  const loading = useRef(false);
  const applying = useRef(false);
  const cancelling = useRef(false);
  const dialog = useRef(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const [isDraggingMark, setIsDraggingMark] = useState(false);
  const preview = useMemo(() => images[0], [images]);


  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      for (const url of urls.current) URL.revokeObjectURL(url);
      urls.current.clear();
    };
  }, []);

  const processPaths = useCallback(async (incomingPaths: string[]) => {
    if (!mounted.current || loading.current || applying.current || getImageActivity()) return;
    loading.current = true;
    const token = ++generation.current;
    const current = () => mounted.current && token === generation.current;
    setIsLoading(true); setNotice(null);
    try {
      const loaded = await trackImageTask(() => loadImageItems(incomingPaths, imagesRef.current.map((item) => item.path), {
        inspect: (paths) => invoke("inspect_images", { paths }),
        thumbnail: (path) => invoke("get_thumbnail", { path }),
        createUrl: (bytes) => URL.createObjectURL(new Blob([bytes], { type: "image/png" })),
        revokeUrl: (url) => URL.revokeObjectURL(url),
      }, current));
      if (!current()) { loaded.items.forEach((item) => URL.revokeObjectURL(item.thumbnailUrl)); return; }
      for (const item of loaded.items) urls.current.add(item.thumbnailUrl);
      if (loaded.items.length) {
        const updated = [...imagesRef.current, ...loaded.items];
        imagesRef.current = updated;
        setImages(updated); setResults([]); setProgress(0);
      }
      if (loaded.errors.length) setNotice(`Algunos archivos no se pudieron añadir. ${loaded.errors.slice(0, 3).join(" ")}`);
    } catch (error) {
      if (current()) setNotice(`No pudimos leer las imágenes. ${String(error)}`);
    } finally {
      loading.current = false;
      if (current()) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void getCurrentWebviewWindow()
      .onDragDropEvent((event) => {
        if (!mounted.current || loading.current || applying.current || getImageActivity()) return;
        if (event.payload.type === "over") setIsDragging(true);
        if (event.payload.type === "leave") setIsDragging(false);
        if (event.payload.type === "drop") {
          setIsDragging(false);
          void processPaths(event.payload.paths);
        }
      })
      .then((cleanup) => {
        if (disposed) cleanup();
        else unlisten = cleanup;
      }).catch((error) => { if (!disposed) setNotice(`No pudimos activar el arrastre. ${String(error)}`); });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [processPaths]);

  async function addImages() {
    if (dialog.current || loading.current || applying.current || getImageActivity()) return;
    dialog.current = true;
    try {
      const selected = await open({ multiple: true, filters: [{ name: "Imágenes", extensions: EXTENSIONS }] });
      if (mounted.current && selected) await processPaths(Array.isArray(selected) ? selected : [selected]);
    } catch (error) { if (mounted.current) setNotice(`No pudimos abrir la selección. ${String(error)}`); }
    finally { dialog.current = false; }
  }

  async function chooseWatermark() {
    if (dialog.current || loading.current || applying.current || getImageActivity()) return;
    dialog.current = true;
    try {
      const selected = await open({ multiple: false, filters: [{ name: "Marca de agua", extensions: EXTENSIONS }] });
      if (!mounted.current || typeof selected !== "string") return;
      const token = generation.current;
      const bytes = await trackImageTask(() => invoke<ArrayBuffer>("get_thumbnail", { path: selected }));
      if (!mounted.current || token !== generation.current) return;
      const url = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
      if (watermarkUrl) { URL.revokeObjectURL(watermarkUrl); urls.current.delete(watermarkUrl); }
      urls.current.add(url); setWatermarkUrl(url); setWatermarkPath(selected); setResults([]); setProgress(0);
    } catch (error) { if (mounted.current) setNotice(`No pudimos leer la marca. ${String(error)}`); }
    finally { dialog.current = false; }
  }

  async function chooseOutput() {
    if (dialog.current || loading.current || applying.current || getImageActivity()) return;
    dialog.current = true;
    try {
      const selected = await open({ directory: true, multiple: false });
      if (mounted.current && typeof selected === "string") {
        setOutputDir(selected);
        if (selected !== outputDir) { setResults([]); setProgress(0); }
      }
    } catch (error) { if (mounted.current) setNotice(`No pudimos elegir la carpeta. ${String(error)}`); }
    finally { dialog.current = false; }
  }

  function removeImage(path: string) {
    if (!mounted.current || loading.current || applying.current || getImageActivity()) return;
    const removed = imagesRef.current.find((image) => image.path === path);
    if (removed) { URL.revokeObjectURL(removed.thumbnailUrl); urls.current.delete(removed.thumbnailUrl); }
    const remaining = imagesRef.current.filter((image) => image.path !== path);
    imagesRef.current = remaining;
    setImages(remaining); setResults([]); setProgress(0);
  }

  async function apply() {
    if (!images.length || !watermarkPath || !outputDir || applying.current || loading.current || dialog.current || getImageActivity()) return;
    applying.current = true;
    const token = ++generation.current;
    setIsApplying(true);
    setIsCancelling(false);
    setProgress(0);
    setResults([]);
    setNotice(null);
    const channel = new Channel<ConversionProgress>();
    channel.onmessage = (message) => {
      if (!mounted.current || token !== generation.current || !applying.current) return;
      setProgress((previous) => Math.max(previous, Math.min(100, (message.completed / message.total) * 100)));
      setResults((current) => [...current.filter((item) => item.sourcePath !== message.result.sourcePath), message.result]);
    };
    const request: WatermarkRequest = {
      paths: images.map((image) => image.path),
      watermarkPath,
      outputDir,
      position,
      sizePercent,
      opacity,
      customXPercent: position === "custom" ? customXPercent : null,
      customYPercent: position === "custom" ? customYPercent : null,
      filenameSuffix,
      overwriteExisting: false,
    };
    try {
      const completed = await trackImageTask(() => invoke<ConversionResult[]>("apply_watermark", {
        request,
        onProgress: channel,
      }));
      if (!mounted.current || token !== generation.current) return;
      setResults(completed);
      setProgress((completed.length / request.paths.length) * 100);
      const failed = completed.filter((result) => !result.success);
      if (completed.length < request.paths.length) {
        setNotice(`Proceso cancelado. Se completaron ${completed.length} de ${request.paths.length} imágenes.${failed.length ? ` ${failed.length} con errores. ${failed[0].error}` : ""}`);
      } else if (failed.length) {
        setNotice(`${failed.length} imágenes tuvieron problemas. ${failed.slice(0, 3).map((item) => `${fileNameFromPath(item.sourcePath)}: ${item.error}`).join(" ")}`);
      } else if (settings.soundOnFinish) { playFinishSound(); }
    } catch (error) {
      if (mounted.current) setNotice(`No se pudieron aplicar las marcas. ${String(error)}`);
    } finally {
      applying.current = false; cancelling.current = false;
      if (mounted.current) { setIsApplying(false); setIsCancelling(false); }
    }
  }

  async function cancel() {
    if (!applying.current || cancelling.current) return;
    cancelling.current = true; setIsCancelling(true);
    try { await invoke("cancel_conversion"); }
    catch (error) {
      cancelling.current = false;
      if (mounted.current) { setIsCancelling(false); setNotice(`No pudimos detener el proceso. ${String(error)}`); }
    }
  }

  async function showResults() {
    const paths = results.flatMap((result) => result.success && result.outputPath ? [result.outputPath] : []);
    try {
      if (paths.length) await revealItemInDir(paths);
      else if (outputDir) await invoke("open_output_directory", { path: outputDir });
    } catch (error) { if (mounted.current) setNotice(`No pudimos mostrar los resultados. ${String(error)}`); }
  }

  function startNewBatch() {
    if (!mounted.current || loading.current || applying.current || getImageActivity()) return;
    imagesRef.current = [];
    for (const image of images) {
      URL.revokeObjectURL(image.thumbnailUrl);
      urls.current.delete(image.thumbnailUrl);
    }
    setImages([]);
    setResults([]);
    setProgress(0);
    setNotice(null);
  }

  function moveMark(clientX: number, clientY: number) {
    if (applying.current || loading.current || getImageActivity()) return;
    const bounds = previewRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
    setPosition("custom");
    setCustomXPercent(
      Math.round(Math.min(100, Math.max(0, ((clientX - bounds.left) / bounds.width) * 100))),
    );
    setCustomYPercent(
      Math.round(Math.min(100, Math.max(0, ((clientY - bounds.top) / bounds.height) * 100))),
    );
  }

  const ready = images.length > 0 && Boolean(watermarkPath) && Boolean(outputDir) && !isApplying && !isLoading && !getImageActivity();
  const sliders: {
    label: string;
    value: number;
    setValue: (value: number) => void;
    unit: string;
    min: number;
    max: number;
  }[] = [
      { label: "Tamaño", value: sizePercent, setValue: setSizePercent, unit: "%", min: 5, max: 80 },
      { label: "Opacidad", value: opacity, setValue: setOpacity, unit: "%", min: 5, max: 100 },
    ];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_390px]">
      <div className="space-y-5">
        {/* Notice */}
        {notice && (
          <div
            role="alert"
            className="animate-slide-up mb-6 flex items-start gap-3 rounded-[22px] border-2 border-[var(--color-amarillo-border)] bg-[var(--color-amarillo-bg)] px-4 py-3.5 text-sm text-[var(--color-amarillo-text)]"
          >
            <CircleAlert size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-[var(--color-amarillo-text)]" />
            <span className="flex-1 font-medium leading-5">{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="rounded-[22px] p-1 text-[var(--color-amarillo-text)] hover:bg-[var(--color-amarillo-border)]/30"
              aria-label="Cerrar mensaje"
            >
              <X size={17} strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Step 1: Images */}
        <section data-step="watermark-1" data-complete={images.length > 0} className="step-section p-5 sm:p-6">
          <StepHeading
            number={1}
            completed={images.length > 0}
            icon={<Images size={19} strokeWidth={2} />}
            title="Añade las imágenes"
            description="Selecciona todas las imágenes que recibirán la misma marca."
          />
          <button
            type="button"
            disabled={isApplying || isLoading}
            onClick={() => void addImages()}
            className={`mt-4 flex min-h-32 w-full items-center justify-center rounded-[22px] border-2 border-dashed text-sm font-bold transition-all ${
              isDragging
                ? "border-[var(--color-border-hover)] bg-[var(--color-celeste-bg)] text-[var(--color-celeste-text)]"
                : "border-[var(--color-celeste-border)] bg-[var(--color-control)] text-[var(--color-celeste-text)] hover:border-[var(--color-border-hover)]"
            }`}
          >
            {isLoading ? (
              <LoaderCircle size={20} strokeWidth={2} className="animate-spin" />
            ) : (
              <>
                <ImagePlus size={20} strokeWidth={2} className="mr-2" />
                {isDragging ? "Suelta las imágenes aquí" : "Seleccionar o arrastrar imágenes"}
              </>
            )}
          </button>
          {images.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-[var(--color-text)]">
                  {images.length} imágenes ·{" "}
                  {formatBytes(images.reduce((sum, image) => sum + image.size, 0))}
                </p>
                <button
                  type="button"
                  disabled={isApplying || isLoading}
                  onClick={startNewBatch}
                  className="inline-flex items-center rounded-[22px] border-2 border-[var(--color-coral-border)] bg-[var(--color-control)] px-2.5 py-1 text-xs font-bold text-[var(--color-coral-text)] transition-colors hover:bg-[var(--color-coral-bg)]"
                >
                  <Trash2 size={13} strokeWidth={2} className="mr-1 inline align-middle" />
                  Quitar todas
                </button>
              </div>
              <ul className="mt-3 max-h-44 space-y-1 overflow-y-auto rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-control)] p-2">
                {images.map((image) => (
                  <li
                    key={image.path}
                    className="flex items-center gap-2 rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)] p-1.5"
                  >
                    <img
                      src={image.thumbnailUrl}
                      alt=""
                      className="size-8 rounded-[22px] object-cover"
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-bold">
                      {image.name}
                    </span>
                    <button
                      type="button"
                      disabled={isApplying || isLoading}
                      onClick={() => removeImage(image.path)}
                      className="grid size-7 shrink-0 place-items-center rounded-[22px] text-[var(--color-text-dim)] hover:bg-[var(--color-coral-bg)] hover:text-[var(--color-coral-text)] focus-visible:opacity-100"
                      aria-label={`Quitar ${image.name}`}
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Step 2: Watermark */}
        <section data-step="watermark-2" data-complete={!!watermarkPath} data-tone="lila" className="step-section p-5 sm:p-6">
          <StepHeading
            number={2}
            completed={!!watermarkPath}
            icon={<Upload size={19} strokeWidth={2} />}
            title="Elige tu marca de agua"
            description="Añade un logotipo o marca en formato PNG transparente."
          />
          <button
            type="button"
            disabled={isApplying || isLoading}
            onClick={() => void chooseWatermark()}
            className="mt-4 flex w-full items-center gap-3 rounded-[22px] border-2 border-dashed border-[var(--color-lila-border)] bg-[var(--color-control)] p-3.5 text-left transition-all hover:border-[var(--color-lila-text)]"
          >
            <span className="grid size-10 place-items-center rounded-[22px] border-2 border-[var(--color-lila-border)] bg-[var(--color-lila-bg)] text-[var(--color-lila-text)]">
              <Upload size={18} strokeWidth={2} />
            </span>
            <span className="min-w-0">
              <b className="block text-xs text-[var(--color-text)]">
                {watermarkPath ? fileNameFromPath(watermarkPath) : "Seleccionar logo o marca"}
              </b>
              <small className="text-[var(--color-lila-text)]">PNG transparente recomendado</small>
            </span>
          </button>
        </section>

        {/* Step 3: Output */}
        <section data-step="watermark-3" data-complete={!!outputDir} className="step-section p-5 sm:p-6">
          <StepHeading
            number={3}
            completed={!!outputDir}
            icon={<FolderOpen size={19} strokeWidth={2} />}
            title="Guarda los resultados"
            description="Selecciona la carpeta donde se guardarán las imágenes con marca."
          />
          <button
            type="button"
            disabled={isApplying || isLoading}
            onClick={() => void chooseOutput()}
            className="mt-4 flex w-full items-center gap-3 rounded-[22px] border-2 border-dashed border-[var(--color-celeste-border)] bg-[var(--color-control)] p-3.5 text-left transition-all hover:border-[var(--color-border-hover)]"
          >
            <FolderOpen size={18} strokeWidth={2} className="text-[var(--color-celeste-text)]" />
            <span className="truncate text-xs font-bold text-[var(--color-text)]">
              {outputDir || "Seleccionar carpeta de destino"}
            </span>
          </button>
          <label className="mt-4 block text-xs font-bold text-[var(--color-text)]">
            Sufijo
            <input
              value={filenameSuffix}
              onChange={(event) => setFilenameSuffix(event.target.value)}
              className="form-input mt-2"
            />
          </label>
        </section>
      </div>

      {/* Sidebar */}
      <aside className="sticky top-[96px] space-y-4">
        <div className="summary-card overflow-hidden rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-celeste-bg)]">
          <div className="border-b-2 border-[var(--color-celeste-border)] p-5">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--color-celeste-text)]">
              Previsualización
            </p>
            <h2 className="mt-1.5 flex items-center gap-2 text-sm font-black text-[var(--color-text)]">
              <MapPin size={17} strokeWidth={2} className="text-[var(--color-celeste-text)]" />
              Vista previa y ubicación
            </h2>
          </div>
          <div className="p-5">
            {preview ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div
                  ref={previewRef}
                  className="bg-checkerboard relative w-full overflow-hidden rounded-[22px] border-2 border-[var(--color-celeste-border)]"
                  style={{ aspectRatio: `${preview.width} / ${preview.height}` }}
                  onPointerMove={(event) => {
                    if (isDraggingMark) moveMark(event.clientX, event.clientY);
                  }}
                  onPointerUp={() => setIsDraggingMark(false)}
                  onPointerLeave={() => setIsDraggingMark(false)}
                >
                  <img
                    src={preview.thumbnailUrl}
                    className="size-full object-fill"
                    alt="Vista previa de la imagen"
                  />
                  {watermarkUrl && (
                    <img
                      src={watermarkUrl}
                      className={`absolute h-auto touch-none ${isDraggingMark ? "cursor-grabbing" : "cursor-grab"}`}
                      style={{
                        ...previewPosition(position, customXPercent, customYPercent),
                        width: `${sizePercent}%`,
                        opacity: opacity / 100,
                      }}
                      onPointerDown={(event) => {
                        if (applying.current || loading.current || getImageActivity()) return;
                        event.preventDefault();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        setIsDraggingMark(true);
                        moveMark(event.clientX, event.clientY);
                      }}
                      alt="Marca de agua; arrástrala para moverla"
                    />
                  )}
                </div>
                <div>
                  <p className="text-sm leading-5 text-[var(--color-text-secondary)]">
                    Arrastra la marca directamente sobre la imagen para decidir su posición.
                  </p>
                  <div className="mt-4 space-y-3">
                    {sliders.map((slider) => (
                      <label
                        key={slider.label}
                        className="block text-xs font-bold text-[var(--color-text)]"
                      >
                        {slider.label}: {slider.value}
                        {slider.unit}
                        <input
                          className="mt-1.5 h-2 w-full cursor-pointer appearance-none rounded-[22px] bg-[var(--color-celeste-border)] accent-[var(--color-accent)]"
                          disabled={isApplying || isLoading}
                          type="range"
                          min={slider.min}
                          max={slider.max}
                          value={slider.value}
                          onChange={(event) => slider.setValue(Number(event.target.value))}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-xs text-[var(--color-text-secondary)]">
                Añade imágenes para ajustar la marca.
              </p>
            )}
          </div>
          <p className="mb-5 px-5 text-xs leading-5 text-[var(--color-text-dim)]">
            La vista previa conserva la proporción de la imagen seleccionada. La posición se aplica
            proporcionalmente a todo el lote.
          </p>

          {/* Action area */}
          <div className="border-t-2 border-[var(--color-celeste-border)] p-5 bg-[var(--color-celeste-bg)]">
            <button
              type="button"
              disabled={!ready}
              onClick={() => void apply()}
              className="primary-action group w-full"
            >
              {isApplying ? (
                <LoaderCircle className="animate-spin" size={18} strokeWidth={2} />
              ) : (
                <Sparkles size={17} strokeWidth={2} />
              )}
              {isApplying ? `Aplicando… ${Math.round(progress)}%` : "Aplicar marca de agua"}
            </button>

            {/* Cancel */}
            {isApplying && (
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => void cancel()}
                className="mt-3 w-full rounded-[22px] border-2 border-[var(--color-coral-border)] bg-[var(--color-coral-bg)] py-2.5 text-xs font-bold text-[var(--color-coral-text)] transition-colors hover:bg-[var(--color-control)]"
              >
                {isCancelling ? (
                  "Deteniendo…"
                ) : (
                  <>
                    <Square size={11} strokeWidth={2} className="mr-1 inline align-middle" fill="currentColor" /> Detener proceso
                  </>
                )}
              </button>
            )}

            {!ready && !isApplying && (
              <p className="mt-3 text-center text-xs leading-4 text-[var(--color-celeste-text)]">
                Completa los pasos pendientes para activar el botón.
              </p>
            )}
          </div>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <section className="rounded-[22px] border-2 border-[var(--color-menta-border)] bg-[var(--color-menta-bg)] p-4 text-[var(--color-menta-text)]">
            <div className="flex items-center gap-2 text-[var(--color-menta-text)]">
              <CheckCircle2 size={18} strokeWidth={2} />
              <b className="text-xs">
                {results.filter((result) => result.success).length} imágenes guardadas
              </b>
            </div>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={() => void showResults()}
                className="inline-flex items-center rounded-[22px] border-2 border-[var(--color-celeste-border)] bg-[var(--color-control)] px-3 py-1.5 text-xs font-bold text-[var(--color-celeste-text)] transition-colors hover:bg-[var(--color-celeste-bg)]"
              >
                <FolderOpen size={13} strokeWidth={2} className="mr-1 inline align-middle" />
                Mostrar resultados
              </button>
              <button
                type="button"
                disabled={isApplying || isLoading}
                onClick={startNewBatch}
                className="inline-flex items-center rounded-[22px] border-2 border-[var(--color-menta-border)] bg-[var(--color-control)] px-3 py-1.5 text-xs font-bold text-[var(--color-menta-text)] transition-colors hover:bg-[var(--color-menta-bg)]"
              >
                <RotateCcw size={13} strokeWidth={2} className="mr-1 inline align-middle" />
                Nuevo lote
              </button>
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}
