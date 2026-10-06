use std::{
    io::{Cursor, Write},
    path::PathBuf,
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicUsize, Ordering},
    },
};

use image::ImageFormat;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use tauri::{ipc::Channel, ipc::Response};

use crate::{processor, security};
use tauri_plugin_opener::OpenerExt;

#[derive(Clone, Default)]
pub struct ConversionState {
    cancelled: Arc<AtomicBool>,
    active: Arc<AtomicBool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageInfo {
    path: String,
    name: String,
    width: u32,
    height: u32,
    size: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversionRequest {
    paths: Vec<String>,
    output_dir: String,
    mode: OptimizationMode,
    #[serde(default)]
    output_format: OutputFormat,
    #[serde(default)]
    filename_suffix: String,
    #[serde(default)]
    overwrite_existing: bool,
    #[serde(default = "default_apply_orientation")]
    apply_orientation: bool,
    #[serde(default)]
    target_size_kb: Option<u64>,
    #[serde(default)]
    effort: OptimizationEffort,
    #[serde(default)]
    resize_width: Option<u32>,
    #[serde(default)]
    resize_height: Option<u32>,
    #[serde(default = "default_keep_aspect_ratio")]
    keep_aspect_ratio: bool,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum OutputFormat {
    #[default]
    Automatic,
    Webp,
    Jpeg,
    Png,
}

fn default_apply_orientation() -> bool {
    true
}

fn default_keep_aspect_ratio() -> bool {
    true
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OptimizationMode {
    Automatic,
    Smart,
    Lossless,
    MaximumQuality,
    Recommended,
    MaximumCompression,
}

#[derive(Clone, Copy, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OptimizationEffort {
    Fast,
    #[default]
    Balanced,
    Maximum,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WatermarkPosition {
    TopLeft,
    TopCenter,
    TopRight,
    CenterLeft,
    Center,
    CenterRight,
    BottomLeft,
    BottomCenter,
    BottomRight,
    Custom,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatermarkRequest {
    paths: Vec<String>,
    watermark_path: String,
    output_dir: String,
    position: WatermarkPosition,
    size_percent: u8,
    opacity: u8,
    #[serde(default)]
    custom_x_percent: Option<f32>,
    #[serde(default)]
    custom_y_percent: Option<f32>,
    #[serde(default = "default_watermark_suffix")]
    filename_suffix: String,
    #[serde(default)]
    overwrite_existing: bool,
}

fn default_watermark_suffix() -> String {
    "-marca".to_string()
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversionResult {
    pub source_path: String,
    pub output_path: Option<String>,
    pub original_size: u64,
    pub converted_size: Option<u64>,
    pub savings_percent: Option<f64>,
    pub final_width: Option<u32>,
    pub final_height: Option<u32>,
    pub quality_used: Option<String>,
    pub visual_score: Option<f64>,
    pub visual_rating: Option<String>,
    pub output_format: String,
    pub preserved_original: bool,
    pub optimized: bool,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversionProgress {
    completed: usize,
    total: usize,
    result: ConversionResult,
}

struct ActiveConversion(Arc<AtomicBool>);

impl Drop for ActiveConversion {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

impl ConversionState {
    fn begin(&self) -> Result<ActiveConversion, String> {
        self.active
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| "Ya hay un procesamiento de imágenes en curso".to_string())?;
        self.cancelled.store(false, Ordering::Release);
        Ok(ActiveConversion(self.active.clone()))
    }
}

fn validate_conversion_request(request: &ConversionRequest) -> Result<(), String> {
    security::validate_batch(&request.paths)?;
    if request.resize_width == Some(0) || request.resize_height == Some(0) {
        return Err("El tamaño de redimensionado debe ser mayor que cero".into());
    }
    if let (Some(width), Some(height)) = (request.resize_width, request.resize_height) {
        security::validate_dimensions(width, height)?;
    }
    if request.target_size_kb == Some(0)
        || request
            .target_size_kb
            .is_some_and(|value| value > u64::MAX / 1024)
    {
        return Err("El peso objetivo no es válido".into());
    }
    Ok(())
}

fn validate_watermark_request(request: &WatermarkRequest) -> Result<(), String> {
    security::validate_batch(&request.paths)?;
    if request.size_percent == 0
        || request.size_percent > 100
        || request.opacity > 100
        || [request.custom_x_percent, request.custom_y_percent]
            .into_iter()
            .flatten()
            .any(|value| !value.is_finite() || !(0.0..=100.0).contains(&value))
    {
        return Err("El tamaño, la opacidad o la posición de la marca no son válidos".into());
    }
    Ok(())
}

fn append_error_log(output_dir: &std::path::Path, source: &str, error: &str) {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |duration| duration.as_secs());
    let log_path = output_dir.join("MinIMG-errors.log");
    if std::fs::symlink_metadata(&log_path).is_ok_and(|metadata| {
        !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() >= 1024 * 1024
    }) {
        return;
    }
    let name = std::path::Path::new(source)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy();
    let clean = |value: &str| {
        value
            .chars()
            .filter(|character| !character.is_control())
            .take(2048)
            .collect::<String>()
    };
    let error = error
        .replace(source, &name)
        .replace(&output_dir.to_string_lossy().to_string(), "[destino]");
    if let Ok(mut log) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
    {
        let _ = writeln!(log, "[{timestamp}] {}: {}", clean(&name), clean(&error));
    }
}

#[tauri::command]
pub async fn inspect_images(paths: Vec<String>) -> Result<Vec<ImageInfo>, String> {
    security::validate_batch(&paths)?;
    tauri::async_runtime::spawn_blocking(move || {
        paths
            .into_iter()
            .map(|path_string| {
                let path = PathBuf::from(&path_string);
                let _work = security::image_work()?;
                let (size, width, height) = security::inspect_image(&path)?;
                let name = path
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or("Imagen")
                    .to_string();

                Ok(ImageInfo {
                    path: path
                        .canonicalize()
                        .map_err(|error| error.to_string())?
                        .to_string_lossy()
                        .into_owned(),
                    name,
                    width,
                    height,
                    size,
                })
            })
            .collect()
    })
    .await
    .map_err(|error| format!("Falló la lectura de imágenes: {error}"))?
}

#[tauri::command]
pub async fn get_thumbnail(path: String) -> Result<Response, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = PathBuf::from(path);
        let _work = security::image_work()?;
        let image = processor::load_image(&path, false)?;
        let thumbnail = image.thumbnail(160, 160);
        let mut bytes = Vec::new();
        thumbnail
            .write_to(&mut Cursor::new(&mut bytes), ImageFormat::Png)
            .map_err(|error| format!("No se pudo codificar la miniatura: {error}"))?;
        Ok(Response::new(bytes))
    })
    .await
    .map_err(|error| format!("Falló la miniatura: {error}"))?
}

#[tauri::command]
pub async fn convert_images(
    request: ConversionRequest,
    on_progress: Channel<ConversionProgress>,
    state: tauri::State<'_, ConversionState>,
) -> Result<Vec<ConversionResult>, String> {
    if request.paths.is_empty() {
        return Err("No hay imágenes para convertir".to_string());
    }
    validate_conversion_request(&request)?;
    let active = state.begin()?;
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _active = active;
        let total = request.paths.len();
        let output_dir = security::directory(std::path::Path::new(&request.output_dir))?;

        let protected_sources: Vec<PathBuf> = request
            .paths
            .iter()
            .filter_map(|path| PathBuf::from(path).canonicalize().ok())
            .collect();
        let completed = Arc::new(AtomicUsize::new(0));
        let results: Vec<ConversionResult> = request
            .paths
            .into_par_iter()
            .map(|source| {
                if state.cancelled.load(Ordering::Acquire) {
                    return None;
                }
                let source_path = PathBuf::from(&source);
                let conversion = {
                    let options = processor::ConversionOptions {
                        mode: request.mode,
                        output_format: request.output_format,
                        effort: request.effort,
                        filename_suffix: &request.filename_suffix,
                        overwrite_existing: request.overwrite_existing,
                        protected_sources: &protected_sources,
                        apply_orientation: request.apply_orientation,
                        target_size_kb: request.target_size_kb,
                        resize_width: request.resize_width,
                        resize_height: request.resize_height,
                        keep_aspect_ratio: request.keep_aspect_ratio,
                    };
                    processor::convert_one(&source_path, &output_dir, options, || {
                        state.cancelled.load(Ordering::Acquire)
                    })
                };
                if state.cancelled.load(Ordering::Acquire) && conversion.is_err() {
                    return None;
                }
                let result = conversion.unwrap_or_else(|error| {
                    append_error_log(&output_dir, &source, &error);
                    ConversionResult {
                        source_path: source,
                        output_path: None,
                        original_size: 0,
                        converted_size: None,
                        savings_percent: None,
                        final_width: None,
                        final_height: None,
                        quality_used: None,
                        visual_score: None,
                        visual_rating: None,
                        output_format: "Sin generar".to_string(),
                        preserved_original: false,
                        optimized: false,
                        success: false,
                        error: Some(error),
                    }
                });

                let current_completed = completed.fetch_add(1, Ordering::SeqCst) + 1;
                let _send_result = on_progress.send(ConversionProgress {
                    completed: current_completed,
                    total,
                    result: result.clone(),
                });
                Some(result)
            })
            .flatten()
            .collect();

        Ok(results)
    })
    .await
    .map_err(|error| format!("Falló el procesamiento por lotes: {error}"))?
}

#[tauri::command]
pub async fn apply_watermark(
    request: WatermarkRequest,
    on_progress: Channel<ConversionProgress>,
    state: tauri::State<'_, ConversionState>,
) -> Result<Vec<ConversionResult>, String> {
    if request.paths.is_empty() {
        return Err("No hay imágenes para marcar".to_string());
    }
    validate_watermark_request(&request)?;
    let active = state.begin()?;
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _active = active;
        let output_dir = security::directory(std::path::Path::new(&request.output_dir))?;
        let watermark_path = PathBuf::from(&request.watermark_path);
        let watermark = {
            let _work = security::image_work()?;
            processor::load_image(&watermark_path, false)?
        };
        let total = request.paths.len();

        let protected_sources: Vec<PathBuf> = request
            .paths
            .iter()
            .chain(std::iter::once(&request.watermark_path))
            .filter_map(|path| PathBuf::from(path).canonicalize().ok())
            .collect();
        let completed = Arc::new(AtomicUsize::new(0));
        let results: Vec<ConversionResult> = request
            .paths
            .into_par_iter()
            .map(|source| {
                if state.cancelled.load(Ordering::Acquire) {
                    return None;
                }
                let source_path = PathBuf::from(&source);
                let result = processor::watermark_one(
                    &source_path,
                    &output_dir,
                    &watermark,
                    processor::WatermarkOptions {
                        position: request.position,
                        size_percent: request.size_percent,
                        opacity: request.opacity,
                        custom_x_percent: request.custom_x_percent,
                        custom_y_percent: request.custom_y_percent,
                        filename_suffix: &request.filename_suffix,
                        overwrite_existing: request.overwrite_existing,
                        protected_sources: &protected_sources,
                    },
                    || state.cancelled.load(Ordering::Acquire),
                );
                if state.cancelled.load(Ordering::Acquire) && result.is_err() {
                    return None;
                }
                let result = result.unwrap_or_else(|error| {
                    append_error_log(&output_dir, &source, &error);
                    ConversionResult {
                        source_path: source,
                        output_path: None,
                        original_size: 0,
                        converted_size: None,
                        savings_percent: None,
                        final_width: None,
                        final_height: None,
                        quality_used: None,
                        visual_score: None,
                        visual_rating: None,
                        output_format: "Sin generar".to_string(),
                        preserved_original: false,
                        optimized: false,
                        success: false,
                        error: Some(error),
                    }
                });

                let current_completed = completed.fetch_add(1, Ordering::SeqCst) + 1;
                let _ = on_progress.send(ConversionProgress {
                    completed: current_completed,
                    total,
                    result: result.clone(),
                });
                Some(result)
            })
            .flatten()
            .collect();

        Ok(results)
    })
    .await
    .map_err(|error| format!("Falló la aplicación de marcas: {error}"))?
}

#[tauri::command]
pub fn cancel_conversion(state: tauri::State<'_, ConversionState>) {
    state.cancelled.store(true, Ordering::Release);
}

#[tauri::command]
pub async fn read_file_bytes(path: String) -> Result<Response, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = PathBuf::from(path);
        let _work = security::image_work()?;
        let bytes = security::read_image_bytes(&path)?;
        Ok(Response::new(bytes))
    })
    .await
    .map_err(|error| format!("Falló al leer el archivo: {error}"))?
}

#[tauri::command]
pub async fn open_output_directory(app: tauri::AppHandle, path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = security::directory(std::path::Path::new(&path))?;
        app.opener()
            .open_path(path.to_string_lossy(), None::<&str>)
            .map_err(|error| format!("No se pudo abrir la carpeta: {error}"))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_overflowing_target_and_invalid_resize() {
        let mut request = ConversionRequest {
            paths: vec![],
            output_dir: String::new(),
            mode: OptimizationMode::Smart,
            output_format: OutputFormat::Automatic,
            filename_suffix: String::new(),
            overwrite_existing: false,
            apply_orientation: false,
            target_size_kb: Some(u64::MAX),
            effort: OptimizationEffort::Balanced,
            resize_width: None,
            resize_height: None,
            keep_aspect_ratio: true,
        };
        assert!(validate_conversion_request(&request).is_err());
        request.target_size_kb = Some(100);
        assert!(validate_conversion_request(&request).is_ok());
        request.resize_width = Some(0);
        assert!(validate_conversion_request(&request).is_err());
        request.resize_width = Some(u32::MAX);
        request.resize_height = Some(u32::MAX);
        assert!(validate_conversion_request(&request).is_err());
    }

    #[test]
    fn processing_state_prevents_overlapping_tools_and_releases_on_error() {
        let state = ConversionState::default();
        let active = state.begin().unwrap();
        assert!(state.begin().is_err());
        state.cancelled.store(true, Ordering::Release);
        drop(active);
        let _next = state.begin().unwrap();
        assert!(!state.cancelled.load(Ordering::Acquire));
    }

    #[test]
    fn rejects_invalid_watermark_parameters() {
        let mut request = WatermarkRequest {
            paths: vec![],
            watermark_path: String::new(),
            output_dir: String::new(),
            position: WatermarkPosition::Custom,
            size_percent: 20,
            opacity: 75,
            custom_x_percent: Some(50.0),
            custom_y_percent: Some(50.0),
            filename_suffix: String::new(),
            overwrite_existing: false,
        };
        assert!(validate_watermark_request(&request).is_ok());
        request.custom_x_percent = Some(f32::NAN);
        assert!(validate_watermark_request(&request).is_err());
        request.custom_x_percent = Some(50.0);
        request.size_percent = 101;
        assert!(validate_watermark_request(&request).is_err());
    }
}
