
import { useTranslation } from "./i18n/useTranslation";
import { message, renderMessage } from "./i18n/index";
import { useState } from "react";
import type { ConversionResult } from "./types";
import { CircleAlert, FolderOutput, Images, SlidersHorizontal, X } from "lucide-react";
import { useImageProcessor } from "./hooks/useImageProcessor";
import { useSettings } from "./hooks/useSettings";
import { getProcessingActivity as getImageActivity } from "./updater/imageActivity";
import { useUpdater } from "./hooks/useUpdater";
import { UpdateDialog } from "./components/UpdateDialog";
import { WatermarkTool } from "./WatermarkTool";
import { getFormatPickerOptions } from "./components/FormatPicker";
import { getModePickerOptions } from "./components/ModePicker";

// Components
import { AppHeader } from "./components/AppHeader";
import { StepHeading } from "./components/StepHeading";
import { DropZone } from "./components/DropZone";
import { ImageGrid } from "./components/ImageGrid";
import { FormatPicker } from "./components/FormatPicker";
import { ModePicker } from "./components/ModePicker";
import { OutputPicker } from "./components/OutputPicker";
import { ResizePanel } from "./components/ResizePanel";
import { AdvancedPanel } from "./components/AdvancedPanel";
import { ProgressCard } from "./components/ProgressCard";
import { ResultPanel } from "./components/ResultPanel";
import { SummaryAside } from "./components/SummaryAside";
import { ImageComparisonModal } from "./components/ImageComparisonModal";
import { SettingsDrawer } from "./components/SettingsDrawer";

function App() {
  const { t } = useTranslation();
  const {
    settings,
    setTheme,
    setUsername,
    setSoundOnFinish,
    reset,
    isOpen: isSettingsOpen,
    open: openSettings,
    close: closeSettings,
  } = useSettings();
  const {
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
  } = useImageProcessor(settings);

  const [comparingResult, setComparingResult] = useState<ConversionResult | null>(null);
  const [cacheResetKey, setCacheResetKey] = useState(0);
  const updater = useUpdater(isConverting || isLoading);

  const handleClearCache = () => {
    if (getImageActivity() || isConverting || isLoading) return;
    setComparingResult(null);
    // 1. Clear image processing state and revoke thumbnail blob URLs
    clearCache();

    // 2. Clear browser/webview session storage and Cache API
    try {
      sessionStorage.clear();
      if (typeof window !== "undefined" && "caches" in window) {
        void window.caches.keys().then((names) => Promise.all(names.map((name) => window.caches.delete(name)))).catch(() => {});
      }
    } catch {
      // safe fallback
    }

    // 3. Reset watermark tool instance if mounted
    setCacheResetKey((prev) => prev + 1);

    // 4. Set feedback notice
    setNotice(message("app.cacheAndMemoryClearedYourWorkspace"));
  };

  const selectedMode = getModePickerOptions(t).find((item) => item.value === mode);
  const selectedFormat = getFormatPickerOptions(t).find((item) => item.value === outputFormat);

  const maxWidth = images.length > 0 ? Math.max(...images.map((img) => img.width || 0)) : 1920;

  return (
    <main className="min-h-screen text-[var(--color-text)]">
      <AppHeader
        activeTool={activeTool}
        busy={updater.isProcessing || updater.state.phase === "downloading" || updater.state.phase === "installing"}
        onToolChange={(tool) => { if (!getImageActivity() && !isConverting && !isLoading) setActiveTool(tool); }}
        onOpenSettings={openSettings}
        onClearCache={handleClearCache}
        username={settings.username.trim() || undefined}
      />

      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-8 sm:py-8">
        {/* Page intro */}
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--color-accent-text)]">{t("app.batchOptimization")}{" "}</p>
          <h2 className="mt-2.5 text-2xl font-black tracking-[-0.03em] text-[var(--color-text)] sm:text-3xl">{t("app.lighterImagesStepByStep")}{" "}</h2>
          <p className="mt-2.5 text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base">{t("app.addYourFilesChooseHowTo")}{" "}</p>
        </div>

        {/* Notice */}
        {notice && (
          <div
            role="alert"
            className="animate-slide-up mb-6 flex items-start gap-3 rounded-[22px] border-2 border-[var(--color-amarillo-border)] bg-[var(--color-amarillo-bg)] px-4 py-3.5 text-sm text-[var(--color-amarillo-text)]"
          >
            <CircleAlert size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-[var(--color-amarillo-text)]" />
            <span className="flex-1 font-medium leading-5">{renderMessage(notice)}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="rounded-[22px] p-1 text-[var(--color-amarillo-text)] hover:bg-[var(--color-amarillo-border)]/30"
              aria-label={t("app.dismissMessage")}
            >
              <X size={17} strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Compress tool */}
        <div
          className={
            activeTool === "compress"
              ? "grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_390px]"
              : "hidden"
          }
        >
          <div className="space-y-5">
            {/* Step 1: Add images */}
            <section data-step="1" data-complete={images.length > 0} className="step-section p-5 sm:p-6">
              <StepHeading
                number={1}
                completed={images.length > 0}
                icon={<Images size={19} strokeWidth={2} />}
                title={t("app.addImages")}
                description={t("app.selectSeveralImagesAtOnceOr")}
              />
              <DropZone
                isDragging={isDragging}
                isLoading={isLoading}
                disabled={isConverting || isLoading}
                onClick={() => void chooseImages()}
              />
              <ImageGrid
                images={images}
                disabled={isConverting || isLoading}
                totalOriginalSize={totalOriginalSize}
                onAdd={() => void chooseImages()}
                onClear={clearImages}
                onRemove={removeImage}
                resizeWidth={resizeWidth ? parseInt(resizeWidth) : null}
                resizeHeight={null}
                keepAspectRatio={true}
              />
            </section>

            {/* Step 2: Format */}
            <section data-step="2" data-complete={!!selectedFormat} className="step-section p-5 sm:p-6">
              <StepHeading
                number={2}
                completed={!!selectedFormat}
                icon={<SlidersHorizontal size={19} strokeWidth={2} />}
                title={t("app.chooseTheFormat")}
                description={t("app.youCanKeepTheRecommendedAutomatic")}
              />
              <div className="mt-5">
                <FormatPicker
                  value={outputFormat}
                  onChange={(v) => {
                    setOutputFormat(v);
                    setResults([]);
                  }}
                  disabled={isConverting}
                />
              </div>
            </section>

            <ModePicker
              value={mode}
              onChange={(v) => {
                setMode(v);
                setResults([]);
              }}
              disabled={isConverting}
            />
            <ResizePanel
              resizeWidth={resizeWidth}
              setResizeWidth={setResizeWidth}
              maxWidth={maxWidth}
              disabled={isConverting}
              completed={images.length > 0}
            />

            {/* Step 5: Output folder + Advanced */}
            <section data-step="5" data-complete={!!outputDir} className="step-section p-5 sm:p-6">
              <StepHeading
                number={5}
                completed={!!outputDir}
                icon={<FolderOutput size={19} strokeWidth={2} />}
                title={t("app.chooseWhereToSaveTheResults")}
                description={t("app.yourOriginalImagesWillRemainIntact")}
              />
              <OutputPicker
                outputDir={outputDir}
                disabled={isConverting || isLoading}
                onChoose={() => void chooseOutputDir()}
              />
              <AdvancedPanel
                filenameSuffix={filenameSuffix}
                setFilenameSuffix={setFilenameSuffix}
                targetSizeKb={targetSizeKb}
                setTargetSizeKb={setTargetSizeKb}
                effort={effort}
                setEffort={setEffort}
                outputFormat={outputFormat}
                applyOrientation={applyOrientation}
                setApplyOrientation={setApplyOrientation}
                overwriteExisting={overwriteExisting}
                setOverwriteExisting={setOverwriteExisting}
                enabled={advancedEnabled}
                onEnabledChange={(value) => {
                  setAdvancedEnabled(value);
                  setResults([]);
                }}
                disabled={isConverting}
              />
            </section>

            {/* Progress */}
            {(isConverting || results.length > 0) && (
              <ProgressCard
                isConverting={isConverting}
                isCancelling={isCancelling}
                wasCancelled={wasCancelled}
                progress={progress}
                processed={results.length}
                total={images.length}
                onCancel={() => void cancelConversion()}
              />
            )}

            {/* Results */}
            {hasFinished && (
              <ResultPanel
                results={results}
                wasCancelled={wasCancelled}
                onShowFiles={() => void showOptimizedFiles()}
                onRetryFailed={(paths) => void convertImages(paths, true)}
                onShowFile={(path) => void showFile(path)}
                onCompare={(result) => setComparingResult(result)}
              />
            )}
          </div>

          {/* Sidebar */}
          <aside className="sticky top-[96px] space-y-4">
            <SummaryAside
              images={images}
              totalOriginalSize={totalOriginalSize}
              selectedFormatLabel={selectedFormat?.label}
              selectedFormatDesc={selectedFormat?.description}
              selectedModeLabel={selectedMode?.label}
              selectedModeDesc={selectedMode?.description}
              outputDir={outputDir}
              isConverting={isConverting}
              canConvert={canConvert}
              hasFinished={hasFinished}
              completed={hasFinished && !wasCancelled && results.every((result) => result.success)}
              onConvert={() => void convertImages()}
              onHideResults={() => {
                setResults([]);
                setProgress(0);
              }}
            />
          </aside>
        </div>

        {/* Watermark tool */}
        {activeTool === "watermark" && <WatermarkTool key={cacheResetKey} settings={settings} />}
      </div>

      {/* Modals */}
      {comparingResult && comparingResult.outputPath && (
        <ImageComparisonModal
          sourcePath={comparingResult.sourcePath}
          outputPath={comparingResult.outputPath}
          onClose={() => setComparingResult(null)}
        />
      )}

      {/* Settings drawer */}
      {isSettingsOpen && (
        <SettingsDrawer
          settings={settings}
          onThemeChange={setTheme}
          onUsernameChange={setUsername}
          onSoundOnFinishChange={setSoundOnFinish}
          onReset={reset}
          onClose={closeSettings}
          updater={updater}
        />
      )}
      {updater.state.promptOpen && !updater.isProcessing && <UpdateDialog updater={updater} />}
    </main>
  );
}

export default App;
