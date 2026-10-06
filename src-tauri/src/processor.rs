use std::io::Write;
use std::path::{Path, PathBuf};

use image::{ExtendedColorType, GenericImageView, ImageDecoder, ImageEncoder};

use crate::commands::{
    ConversionResult, OptimizationEffort, OptimizationMode, OutputFormat, WatermarkPosition,
};

use crate::security;

const HIGH_VISUAL_QUALITY: f64 = 0.99;

struct EncodedCandidate {
    bytes: Vec<u8>,
    quality_used: String,
    visual_score: Option<f64>,
    quality: u8,
    format: OutputFormat,
}

pub struct ConversionOptions<'a> {
    pub mode: OptimizationMode,
    pub output_format: OutputFormat,
    pub effort: OptimizationEffort,
    pub filename_suffix: &'a str,
    pub overwrite_existing: bool,
    pub protected_sources: &'a [PathBuf],
    pub apply_orientation: bool,
    pub target_size_kb: Option<u64>,
    pub resize_width: Option<u32>,
    pub resize_height: Option<u32>,
    pub keep_aspect_ratio: bool,
}

pub struct WatermarkOptions<'a> {
    pub position: WatermarkPosition,
    pub size_percent: u8,
    pub opacity: u8,
    pub custom_x_percent: Option<f32>,
    pub custom_y_percent: Option<f32>,
    pub filename_suffix: &'a str,
    pub overwrite_existing: bool,
    pub protected_sources: &'a [PathBuf],
}

fn write_file_atomically(output_path: &Path, bytes: &[u8], overwrite: bool) -> Result<(), String> {
    write_file_atomically_using(output_path, bytes, overwrite, |file, bytes| {
        file.write_all(bytes)?;
        file.sync_all()
    })
}

fn write_file_atomically_using(
    output_path: &Path,
    bytes: &[u8],
    overwrite: bool,
    write: impl FnOnce(&mut std::fs::File, &[u8]) -> std::io::Result<()>,
) -> Result<(), String> {
    let parent = output_path
        .parent()
        .ok_or_else(|| format!("Ruta de salida inválida: {}", output_path.display()))?;
    if output_path.file_name().is_none() {
        return Err("Nombre de salida inválido".into());
    }
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |duration| duration.as_nanos());
    let temporary_path = parent.join(format!(".MinIMG-{}-{nonce}.tmp", std::process::id()));
    let write_result = (|| {
        let mut temporary = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary_path)
            .map_err(|error| format!("No se pudo preparar {}: {error}", output_path.display()))?;
        write(&mut temporary, bytes)
            .map_err(|error| format!("No se pudo guardar {}: {error}", output_path.display()))?;
        if overwrite {
            std::fs::rename(&temporary_path, output_path)
                .map_err(|error| format!("No se pudo finalizar {}: {error}", output_path.display()))
        } else {
            // Crear el destino de forma indivisible: rename reemplaza archivos en Unix.
            if std::fs::hard_link(&temporary_path, output_path).is_err() {
                // FAT/exFAT no admiten enlaces duros. create_new mantiene la garantía
                // de no reemplazar un archivo que haya aparecido durante el proceso.
                publish_without_replacing(output_path, bytes)?;
            }
            std::fs::remove_file(&temporary_path)
                .map_err(|error| format!("No se pudo retirar el archivo temporal: {error}"))
        }
    })();
    if write_result.is_err() {
        let _ = std::fs::remove_file(&temporary_path);
    }
    write_result
}

fn publish_without_replacing(output_path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(output_path)
        .map_err(|error| format!("No se pudo guardar sin sobrescribir: {error}"))?;
    let result = file.write_all(bytes).and_then(|_| file.sync_all());
    drop(file);
    if result.is_err() {
        let _ = std::fs::remove_file(output_path);
    }
    result.map_err(|error| format!("No se pudo finalizar el archivo: {error}"))
}

struct CandidateRequest<'a> {
    format: OutputFormat,
    mode: OptimizationMode,
    effort: OptimizationEffort,
    source: &'a Path,
    image: &'a image::DynamicImage,
    original_size: u64,
    require_lighter: bool,
    target_size_kb: Option<u64>,
}

fn safe_suffix(suffix: &str) -> String {
    suffix
        .trim()
        .chars()
        .filter(|character| {
            !character.is_control()
                && !matches!(
                    character,
                    '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
                )
        })
        .take(80)
        .collect()
}

fn available_output_path(
    source: &Path,
    output_dir: &Path,
    suffix: &str,
    extension: &str,
    overwrite_existing: bool,
    protected_sources: &[PathBuf],
) -> Result<PathBuf, String> {
    let stem = source
        .file_stem()
        .and_then(|value| value.to_str())
        .ok_or_else(|| format!("Nombre de archivo inválido: {}", source.display()))?;

    let suffix = safe_suffix(suffix);
    let mut base_name = format!("{stem}{suffix}");
    // Reserva espacio para extensión y numeración; no cortar un carácter UTF-8.
    let mut end = base_name.len().min(240);
    while !base_name.is_char_boundary(end) {
        end -= 1;
    }
    base_name.truncate(end);
    let initial = output_dir.join(format!("{base_name}.{extension}"));
    let source_resolved = source.canonicalize().map_err(|error| error.to_string())?;
    let same_source = initial
        .canonicalize()
        .is_ok_and(|path| path == source_resolved || protected_sources.contains(&path));
    if !same_source && (overwrite_existing || std::fs::symlink_metadata(&initial).is_err()) {
        return Ok(initial);
    }

    for suffix in 1..=10_000 {
        let candidate = output_dir.join(format!("{base_name} ({suffix}).{extension}"));
        if std::fs::symlink_metadata(&candidate).is_err() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "No se encontró un nombre disponible para {base_name}.{extension}"
    ))
}

#[allow(clippy::too_many_arguments)]
fn preserve_original(
    source: &Path,
    output_dir: &Path,
    suffix: &str,
    overwrite_existing: bool,
    original_size: u64,
    width: u32,
    height: u32,
    protected_sources: &[PathBuf],
) -> Result<ConversionResult, String> {
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .ok_or_else(|| format!("Extensión inválida: {}", source.display()))?;
    let output_path = available_output_path(
        source,
        output_dir,
        suffix,
        extension,
        overwrite_existing,
        protected_sources,
    )?;

    let same_path = source
        .canonicalize()
        .ok()
        .zip(output_path.canonicalize().ok())
        .is_some_and(|(source, output)| source == output);
    if !same_path {
        let bytes = security::read_image_bytes(source)?;
        write_file_atomically(&output_path, &bytes, overwrite_existing)?;
    }

    Ok(ConversionResult {
        source_path: source.to_string_lossy().into_owned(),
        output_path: Some(output_path.to_string_lossy().into_owned()),
        original_size,
        converted_size: Some(original_size),
        savings_percent: Some(0.0),
        final_width: Some(width),
        final_height: Some(height),
        quality_used: Some("Original".to_string()),
        visual_score: Some(1.0),
        visual_rating: Some("100% optimizada".to_string()),
        output_format: extension.to_ascii_uppercase(),
        preserved_original: true,
        optimized: false,
        success: true,
        error: None,
    })
}

pub(crate) fn load_image(
    source: &Path,
    apply_orientation: bool,
) -> Result<image::DynamicImage, String> {
    load_image_with_transform(source, apply_orientation).map(|(image, _)| image)
}

fn load_image_with_transform(
    source: &Path,
    apply_orientation: bool,
) -> Result<(image::DynamicImage, bool), String> {
    let mut decoder = security::image_reader(source)?
        .into_decoder()
        .map_err(|error| format!("No se pudo decodificar la imagen: {error}"))?;
    let (width, height) = decoder.dimensions();
    security::validate_dimensions(width, height)?;
    if decoder.total_bytes() > security::MAX_INPUT_BYTES {
        return Err("La imagen decodificada supera el límite de 512 MB".into());
    }
    let orientation = decoder
        .orientation()
        .map_err(|error| format!("No se pudo leer la orientación: {error}"))?;
    let mut image = image::DynamicImage::from_decoder(decoder)
        .map_err(|error| format!("No se pudo decodificar {}: {error}", source.display()))?;
    if apply_orientation {
        image.apply_orientation(orientation);
    }
    Ok((
        image,
        apply_orientation && orientation != image::metadata::Orientation::NoTransforms,
    ))
}

pub fn convert_one<F>(
    source: &Path,
    output_dir: &Path,
    options: ConversionOptions<'_>,
    is_cancelled: F,
) -> Result<ConversionResult, String>
where
    F: Fn() -> bool,
{
    let _work = security::image_work()?;
    let original_size = std::fs::metadata(source)
        .map_err(|error| format!("No se pudo leer {}: {error}", source.display()))?
        .len();
    if is_cancelled() {
        return Err("Conversión cancelada".to_string());
    }
    let (mut image, orientation_changed) =
        load_image_with_transform(source, options.apply_orientation)?;
    let original_dimensions = (image.width(), image.height());
    if is_cancelled() {
        return Err("Conversión cancelada".to_string());
    }

    if let (Some(w), Some(h)) = (options.resize_width, options.resize_height) {
        if image.width() > w || image.height() > h {
            image = if options.keep_aspect_ratio {
                image.resize(w, h, image::imageops::FilterType::Lanczos3)
            } else {
                image.resize_exact(w, h, image::imageops::FilterType::Lanczos3)
            };
        }
    } else if let Some(w) = options.resize_width {
        if image.width() > w {
            image = image.resize(w, u32::MAX, image::imageops::FilterType::Lanczos3);
        }
    } else if let Some(h) = options.resize_height
        && image.height() > h
    {
        image = image.resize(u32::MAX, h, image::imageops::FilterType::Lanczos3);
    }

    let final_width = image.width();
    let final_height = image.height();
    let requires_transformation =
        orientation_changed || (final_width, final_height) != original_dimensions;

    if is_cancelled() {
        return Err("Conversión cancelada".to_string());
    }
    let candidate = if options.output_format == OutputFormat::Automatic {
        select_candidate(
            CandidateRequest {
                format: OutputFormat::Webp,
                mode: options.mode,
                effort: options.effort,
                source,
                image: &image,
                original_size,
                require_lighter: !requires_transformation,
                target_size_kb: options.target_size_kb,
            },
            &is_cancelled,
        )?
    } else {
        select_candidate(
            CandidateRequest {
                format: options.output_format,
                mode: options.mode,
                effort: options.effort,
                source,
                image: &image,
                original_size,
                require_lighter: false,
                target_size_kb: options.target_size_kb,
            },
            &is_cancelled,
        )?
    };
    if is_cancelled() {
        return Err("Conversión cancelada".to_string());
    }
    let Some(candidate) = candidate else {
        return preserve_original(
            source,
            output_dir,
            options.filename_suffix,
            options.overwrite_existing,
            original_size,
            final_width,
            final_height,
            options.protected_sources,
        );
    };
    let converted_size = candidate.bytes.len() as u64;
    if converted_size >= original_size
        && options.output_format == OutputFormat::Automatic
        && !requires_transformation
    {
        return preserve_original(
            source,
            output_dir,
            options.filename_suffix,
            options.overwrite_existing,
            original_size,
            final_width,
            final_height,
            options.protected_sources,
        );
    }

    let output_path = available_output_path(
        source,
        output_dir,
        options.filename_suffix,
        extension_for(candidate.format),
        options.overwrite_existing,
        options.protected_sources,
    )?;
    if is_cancelled() {
        return Err("Conversión cancelada".to_string());
    }
    write_file_atomically(&output_path, &candidate.bytes, options.overwrite_existing)?;
    let savings_percent = if original_size == 0 {
        0.0
    } else {
        ((original_size as f64 - converted_size as f64) / original_size as f64) * 100.0
    };

    Ok(ConversionResult {
        source_path: source.to_string_lossy().into_owned(),
        output_path: Some(output_path.to_string_lossy().into_owned()),
        original_size,
        converted_size: Some(converted_size),
        savings_percent: Some(savings_percent),
        final_width: Some(final_width),
        final_height: Some(final_height),
        quality_used: Some(candidate.quality_used),
        visual_score: candidate.visual_score,
        visual_rating: Some(
            candidate
                .visual_score
                .map_or("Alta (según calidad)", visual_rating)
                .to_string(),
        ),
        output_format: label_for(candidate.format).to_string(),
        preserved_original: false,
        optimized: converted_size < original_size,
        success: true,
        error: None,
    })
}

pub fn watermark_one<F>(
    source: &Path,
    output_dir: &Path,
    watermark: &image::DynamicImage,
    options: WatermarkOptions<'_>,
    is_cancelled: F,
) -> Result<ConversionResult, String>
where
    F: Fn() -> bool,
{
    let _work = security::image_work()?;
    let original_size = std::fs::metadata(source)
        .map_err(|error| format!("No se pudo leer {}: {error}", source.display()))?
        .len();
    if is_cancelled() {
        return Err("Aplicación cancelada".to_string());
    }
    let mut image = load_image(source, true)?.to_rgba8();
    let max_width = (u64::from(image.width()) * u64::from(options.size_percent.clamp(1, 100)) / 100)
        .clamp(1, u64::from(image.width())) as u32;
    let scaled_height = (u64::from(watermark.height()) * u64::from(max_width)
        / u64::from(watermark.width()).max(1))
    .max(1)
    .min(u64::from(u32::MAX)) as u32;
    security::validate_dimensions(max_width, scaled_height)?;
    let mut mark = watermark
        .resize(max_width, u32::MAX, image::imageops::FilterType::Lanczos3)
        .to_rgba8();
    let opacity = u16::from(options.opacity.min(100));
    for pixel in mark.pixels_mut() {
        pixel.0[3] = ((u16::from(pixel.0[3]) * opacity) / 100) as u8;
    }
    let (x, y) = watermark_coordinates(
        image.width(),
        image.height(),
        mark.width(),
        mark.height(),
        &options,
    );
    if is_cancelled() {
        return Err("Aplicación cancelada".to_string());
    }
    image::imageops::overlay(&mut image, &mark, i64::from(x), i64::from(y));
    let output_format = source_output_format(source)?;
    let composite = image::DynamicImage::ImageRgba8(image);
    let bytes = match output_format {
        OutputFormat::Webp => encode_webp(&composite, false, 92)?,
        OutputFormat::Jpeg => encode_jpeg(&flatten_on_white(&composite), 92)?,
        OutputFormat::Png => encode_png(&composite)?,
        OutputFormat::Automatic => unreachable!(),
    };
    if is_cancelled() {
        return Err("Aplicación cancelada".to_string());
    }
    let output_path = available_output_path(
        source,
        output_dir,
        options.filename_suffix,
        extension_for(output_format),
        options.overwrite_existing,
        options.protected_sources,
    )?;
    write_file_atomically(&output_path, &bytes, options.overwrite_existing)?;
    let converted_size = bytes.len() as u64;
    Ok(ConversionResult {
        source_path: source.to_string_lossy().into_owned(),
        output_path: Some(output_path.to_string_lossy().into_owned()),
        original_size,
        converted_size: Some(converted_size),
        savings_percent: (original_size > 0).then(|| {
            ((original_size as f64 - converted_size as f64) / original_size as f64) * 100.0
        }),
        final_width: Some(composite.width()),
        final_height: Some(composite.height()),
        quality_used: Some("Marca de agua".to_string()),
        visual_score: None,
        visual_rating: None,
        output_format: label_for(output_format).to_string(),
        preserved_original: false,
        optimized: converted_size < original_size,
        success: true,
        error: None,
    })
}

fn source_output_format(source: &Path) -> Result<OutputFormat, String> {
    match source
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("jpg" | "jpeg") => Ok(OutputFormat::Jpeg),
        Some("png") => Ok(OutputFormat::Png),
        Some("webp") => Ok(OutputFormat::Webp),
        _ => Err(format!(
            "Formato de salida no compatible: {}",
            source.display()
        )),
    }
}

fn watermark_coordinates(
    width: u32,
    height: u32,
    mark_width: u32,
    mark_height: u32,
    options: &WatermarkOptions<'_>,
) -> (u32, u32) {
    let x_right = width.saturating_sub(mark_width);
    let y_bottom = height.saturating_sub(mark_height);
    let x_center = width.saturating_sub(mark_width) / 2;
    let y_center = height.saturating_sub(mark_height) / 2;
    match options.position {
        WatermarkPosition::TopLeft => (0, 0),
        WatermarkPosition::TopCenter => (x_center, 0),
        WatermarkPosition::TopRight => (x_right, 0),
        WatermarkPosition::CenterLeft => (0, y_center),
        WatermarkPosition::Center => (x_center, y_center),
        WatermarkPosition::CenterRight => (x_right, y_center),
        WatermarkPosition::BottomLeft => (0, y_bottom),
        WatermarkPosition::BottomCenter => (x_center, y_bottom),
        WatermarkPosition::BottomRight => (x_right, y_bottom),
        WatermarkPosition::Custom => {
            let x = (options.custom_x_percent.unwrap_or(50.0).clamp(0.0, 100.0) / 100.0
                * width as f32) as i64
                - i64::from(mark_width) / 2;
            let y = (options.custom_y_percent.unwrap_or(50.0).clamp(0.0, 100.0) / 100.0
                * height as f32) as i64
                - i64::from(mark_height) / 2;
            (
                x.clamp(0, i64::from(width.saturating_sub(mark_width))) as u32,
                y.clamp(0, i64::from(height.saturating_sub(mark_height))) as u32,
            )
        }
    }
}

fn select_candidate(
    request: CandidateRequest<'_>,
    is_cancelled: &impl Fn() -> bool,
) -> Result<Option<EncodedCandidate>, String> {
    let CandidateRequest {
        format,
        mode,
        effort,
        source,
        image,
        original_size,
        require_lighter,
        target_size_kb,
    } = request;
    if format == OutputFormat::Png {
        let candidate = make_candidate(image, format, true, 100)?;
        if is_cancelled() {
            return Err("Conversión cancelada".to_string());
        }
        return Ok(
            (!require_lighter || (candidate.bytes.len() as u64) < original_size)
                .then_some(candidate),
        );
    }

    let (lossless, preferred_quality) = settings_for(mode, source, image);
    let mut best_lighter: Option<EncodedCandidate> = None;

    if lossless {
        let candidate = make_candidate(image, format, true, 100)?;
        if is_cancelled() {
            return Err("Conversión cancelada".to_string());
        }
        if (!require_lighter || (candidate.bytes.len() as u64) < original_size)
            && target_size_kb
                .is_none_or(|target| candidate.bytes.len() as u64 <= target.saturating_mul(1024))
        {
            return Ok(Some(candidate));
        }
    }

    let qualities: &[u8] = match effort {
        OptimizationEffort::Fast => &[95, 85, 75, 55, 30, 10, 1],
        OptimizationEffort::Balanced => &[95, 92, 90, 85, 80, 75, 65, 55, 45, 35, 25, 15, 5, 1],
        OptimizationEffort::Maximum => &[
            100, 98, 95, 92, 90, 88, 85, 82, 80, 77, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25,
            20, 15, 10, 5, 1,
        ],
    };
    for &quality in qualities
        .iter()
        .filter(|&&quality| quality <= preferred_quality)
    {
        if is_cancelled() {
            return Err("Conversión cancelada".to_string());
        }
        let candidate = make_candidate(image, format, false, quality)?;
        if is_cancelled() {
            return Err("Conversión cancelada".to_string());
        }
        if require_lighter && candidate.bytes.len() as u64 >= original_size {
            continue;
        }
        let meets_visual_target = candidate
            .visual_score
            .is_none_or(|score| score >= HIGH_VISUAL_QUALITY);
        let meets_size_target = target_size_kb
            .is_none_or(|target| candidate.bytes.len() as u64 <= target.saturating_mul(1024));
        if meets_size_target
            && (meets_visual_target || !matches!(mode, OptimizationMode::Automatic))
        {
            return Ok(Some(candidate));
        }
        if best_lighter.is_none()
            || candidate
                .visual_score
                .unwrap_or(f64::from(candidate.quality) / 100.0)
                > best_lighter.as_ref().map_or(0.0, |item| {
                    item.visual_score.unwrap_or(f64::from(item.quality) / 100.0)
                })
        {
            best_lighter = Some(candidate);
        }
    }
    Ok(best_lighter)
}

fn make_candidate(
    image: &image::DynamicImage,
    format: OutputFormat,
    lossless: bool,
    quality: u8,
) -> Result<EncodedCandidate, String> {
    let comparison_image = if format == OutputFormat::Jpeg {
        flatten_on_white(image)
    } else {
        image.clone()
    };
    let bytes = encode_image(&comparison_image, format, lossless, quality)?;
    let decoded = image::load_from_memory(&bytes)
        .map_err(|error| format!("No se pudo validar el archivo generado: {error}"))?;
    let visual_score = Some(structural_similarity(&comparison_image, &decoded)?);
    Ok(EncodedCandidate {
        bytes,
        quality_used: if lossless {
            "Lossless".to_string()
        } else {
            quality.to_string()
        },
        visual_score,
        quality,
        format,
    })
}

fn extension_for(format: OutputFormat) -> &'static str {
    match format {
        OutputFormat::Automatic | OutputFormat::Webp => "webp",
        OutputFormat::Jpeg => "jpg",
        OutputFormat::Png => "png",
    }
}

fn label_for(format: OutputFormat) -> &'static str {
    match format {
        OutputFormat::Automatic => "Automático",
        OutputFormat::Webp => "WebP",
        OutputFormat::Jpeg => "JPEG",
        OutputFormat::Png => "PNG",
    }
}

fn flatten_on_white(image: &image::DynamicImage) -> image::DynamicImage {
    let rgba = image.to_rgba8();
    let rgb = image::RgbImage::from_fn(rgba.width(), rgba.height(), |x, y| {
        let pixel = rgba.get_pixel(x, y).0;
        let alpha = u16::from(pixel[3]);
        let blend = |channel: u8| ((u16::from(channel) * alpha + 255 * (255 - alpha)) / 255) as u8;
        image::Rgb([blend(pixel[0]), blend(pixel[1]), blend(pixel[2])])
    });
    image::DynamicImage::ImageRgb8(rgb)
}

fn encode_image(
    image: &image::DynamicImage,
    format: OutputFormat,
    lossless: bool,
    quality: u8,
) -> Result<Vec<u8>, String> {
    match format {
        OutputFormat::Automatic | OutputFormat::Webp => encode_webp(image, lossless, quality),
        OutputFormat::Jpeg => encode_jpeg(image, quality),
        OutputFormat::Png => encode_png(image),
    }
}

fn encode_jpeg(image: &image::DynamicImage, quality: u8) -> Result<Vec<u8>, String> {
    let rgb = image.to_rgb8();
    let mut bytes = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut bytes, quality)
        .write_image(
            rgb.as_raw(),
            rgb.width(),
            rgb.height(),
            ExtendedColorType::Rgb8,
        )
        .map_err(|error| format!("No se pudo codificar JPEG: {error}"))?;
    Ok(bytes)
}

fn encode_png(image: &image::DynamicImage) -> Result<Vec<u8>, String> {
    let rgba = image.to_rgba8();
    let mut bytes = Vec::new();
    image::codecs::png::PngEncoder::new_with_quality(
        &mut bytes,
        image::codecs::png::CompressionType::Best,
        image::codecs::png::FilterType::Adaptive,
    )
    .write_image(
        rgba.as_raw(),
        rgba.width(),
        rgba.height(),
        ExtendedColorType::Rgba8,
    )
    .map_err(|error| format!("No se pudo codificar PNG: {error}"))?;
    Ok(bytes)
}

fn settings_for(mode: OptimizationMode, source: &Path, image: &image::DynamicImage) -> (bool, u8) {
    match mode {
        OptimizationMode::Automatic => (false, 95),
        OptimizationMode::Lossless => (true, 100),
        OptimizationMode::MaximumQuality => (false, 95),
        OptimizationMode::Recommended => (false, 85),
        OptimizationMode::MaximumCompression => (false, 75),
        OptimizationMode::Smart => {
            let is_png = source
                .extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| extension.eq_ignore_ascii_case("png"));
            if is_png && (image.color().has_alpha() || has_simple_graphics(image)) {
                (true, 100)
            } else {
                (false, 90)
            }
        }
    }
}

fn structural_similarity(
    original: &image::DynamicImage,
    optimized: &image::DynamicImage,
) -> Result<f64, String> {
    if original.dimensions() != optimized.dimensions() {
        return Err("El archivo generado cambió las dimensiones de la imagen".to_string());
    }

    let original = original.to_rgba8();
    let optimized = optimized.to_rgba8();
    let pixels = original.as_raw().len() / 4;
    let step = pixels.div_ceil(65_536).max(1);
    if pixels == 0 {
        return Err("La imagen no contiene píxeles para comparar".to_string());
    }

    let mut original_mean = [0.0; 4];
    let mut optimized_mean = [0.0; 4];
    let mut sample_counts = [0_usize; 4];
    for pixel_index in (0..pixels).step_by(step) {
        let offset = pixel_index * 4;
        for channel in 0..4 {
            if channel < 3
                && original.as_raw()[offset + 3] == 0
                && optimized.as_raw()[offset + 3] == 0
            {
                continue;
            }
            original_mean[channel] += f64::from(original.as_raw()[offset + channel]);
            optimized_mean[channel] += f64::from(optimized.as_raw()[offset + channel]);
            sample_counts[channel] += 1;
        }
    }
    for channel in 0..4 {
        let samples = sample_counts[channel].max(1) as f64;
        original_mean[channel] /= samples;
        optimized_mean[channel] /= samples;
    }

    let mut original_variance = [0.0; 4];
    let mut optimized_variance = [0.0; 4];
    let mut covariance = [0.0; 4];
    for pixel_index in (0..pixels).step_by(step) {
        let offset = pixel_index * 4;
        for channel in 0..4 {
            if channel < 3
                && original.as_raw()[offset + 3] == 0
                && optimized.as_raw()[offset + 3] == 0
            {
                continue;
            }
            let original_delta =
                f64::from(original.as_raw()[offset + channel]) - original_mean[channel];
            let optimized_delta =
                f64::from(optimized.as_raw()[offset + channel]) - optimized_mean[channel];
            original_variance[channel] += original_delta * original_delta;
            optimized_variance[channel] += optimized_delta * optimized_delta;
            covariance[channel] += original_delta * optimized_delta;
        }
    }

    let c1 = (0.01_f64 * 255.0).powi(2);
    let c2 = (0.03_f64 * 255.0).powi(2);
    let mut score = 0.0;
    for channel in 0..4 {
        let divisor = sample_counts[channel].saturating_sub(1).max(1) as f64;
        let original_variance = original_variance[channel] / divisor;
        let optimized_variance = optimized_variance[channel] / divisor;
        let covariance = covariance[channel] / divisor;
        score += ((2.0 * original_mean[channel] * optimized_mean[channel] + c1)
            * (2.0 * covariance + c2))
            / ((original_mean[channel].powi(2) + optimized_mean[channel].powi(2) + c1)
                * (original_variance + optimized_variance + c2));
    }
    Ok((score / 4.0).clamp(0.0, 1.0))
}

fn visual_rating(score: f64) -> &'static str {
    if score >= 0.99 {
        "Excelente"
    } else if score >= 0.97 {
        "Muy buena"
    } else if score >= 0.94 {
        "Buena"
    } else {
        "Revisar"
    }
}

fn has_simple_graphics(image: &image::DynamicImage) -> bool {
    const MAX_DISTINCT_COLORS: usize = 256;
    let rgba = image.to_rgba8();
    let step = (rgba.width() as usize)
        .saturating_mul(rgba.height() as usize)
        .div_ceil(16_384)
        .max(1);
    let mut colors = std::collections::HashSet::new();
    for pixel in rgba.pixels().step_by(step) {
        colors.insert(pixel.0);
        if colors.len() > MAX_DISTINCT_COLORS {
            return false;
        }
    }
    true
}

fn encode_webp(
    image: &image::DynamicImage,
    lossless: bool,
    quality: u8,
) -> Result<Vec<u8>, String> {
    let mut config = webp::WebPConfig::new()
        .map_err(|error| format!("No se pudo configurar libwebp: {error:?}"))?;
    config.lossless = i32::from(lossless);
    config.quality = f32::from(quality);
    config.method = 6;
    config.thread_level = 1;
    config.alpha_compression = 1;
    config.alpha_filtering = 2;
    config.alpha_quality = 100;
    config.exact = i32::from(image.color().has_alpha());

    if image.color().has_alpha() {
        let rgba = image.to_rgba8();
        let encoded = webp::Encoder::from_rgba(rgba.as_raw(), rgba.width(), rgba.height())
            .encode_advanced(&config)
            .map_err(|error| format!("No se pudo codificar WebP: {error:?}"))?;
        Ok(encoded.to_vec())
    } else {
        let rgb = image.to_rgb8();
        let encoded = webp::Encoder::from_rgb(rgb.as_raw(), rgb.width(), rgb.height())
            .encode_advanced(&config)
            .map_err(|error| format!("No se pudo codificar WebP: {error:?}"))?;
        Ok(encoded.to_vec())
    }
}

#[cfg(test)]
mod tests {
    use std::cell::Cell;

    use super::*;

    fn options(mode: OptimizationMode) -> ConversionOptions<'static> {
        ConversionOptions {
            mode,
            output_format: OutputFormat::Webp,
            effort: OptimizationEffort::Balanced,
            filename_suffix: "",
            overwrite_existing: false,
            protected_sources: &[],
            apply_orientation: true,
            target_size_kb: None,
            resize_width: None,
            resize_height: None,
            keep_aspect_ratio: true,
        }
    }
    fn format_options(format: OutputFormat) -> ConversionOptions<'static> {
        ConversionOptions {
            output_format: format,
            ..options(OptimizationMode::Recommended)
        }
    }

    #[test]
    fn smart_mode_preserves_transparent_png_dimensions() -> Result<(), Box<dyn std::error::Error>> {
        let test_dir = std::env::temp_dir().join(format!("minimg-test-{}", std::process::id()));
        std::fs::create_dir_all(&test_dir)?;
        let source = test_dir.join("transparent.png");
        let pixels = image::RgbaImage::from_fn(128, 128, |x, y| {
            if (x + y) % 2 == 0 {
                image::Rgba([55, 48, 163, 255])
            } else {
                image::Rgba([255, 255, 255, 0])
            }
        });
        pixels.save(&source)?;

        let result = convert_one(&source, &test_dir, options(OptimizationMode::Smart), || {
            false
        })?;
        assert!(result.converted_size.unwrap_or_default() < result.original_size);
        if let Some(output_path) = result.output_path {
            let decoded = image::open(output_path)?;
            assert_eq!(decoded.width(), 128);
            assert_eq!(decoded.height(), 128);
            assert!(decoded.color().has_alpha());
        }

        std::fs::remove_dir_all(&test_dir)?;
        Ok(())
    }

    #[test]
    fn automatic_mode_reports_ssim_and_uses_a_valid_quality()
    -> Result<(), Box<dyn std::error::Error>> {
        let test_dir =
            std::env::temp_dir().join(format!("minimg-auto-test-{}", std::process::id()));
        std::fs::create_dir_all(&test_dir)?;
        let source = test_dir.join("photo.png");
        image::RgbImage::from_fn(128, 128, |x, y| {
            image::Rgb([
                (x.wrapping_mul(17) ^ y.wrapping_mul(13)) as u8,
                (x.wrapping_mul(7) ^ y.wrapping_mul(23)) as u8,
                (x.wrapping_add(y).wrapping_mul(11)) as u8,
            ])
        })
        .save(&source)?;

        let result = convert_one(
            &source,
            &test_dir,
            options(OptimizationMode::Automatic),
            || false,
        )?;
        assert!(result.visual_score.is_some());
        assert!(result.quality_used.is_some());
        assert!(result.converted_size.unwrap_or_default() < result.original_size);

        std::fs::remove_dir_all(&test_dir)?;
        Ok(())
    }

    #[test]
    fn invalid_filename_characters_are_removed_from_suffix() {
        assert_eq!(safe_suffix(" _web/:*?p "), "_webp");
    }

    #[test]
    fn cancellation_stops_quality_search() {
        let image = image::DynamicImage::new_rgb8(32, 32);
        let result = select_candidate(
            CandidateRequest {
                format: OutputFormat::Webp,
                mode: OptimizationMode::Automatic,
                effort: OptimizationEffort::Maximum,
                source: Path::new("test.png"),
                image: &image,
                original_size: 1,
                require_lighter: true,
                target_size_kb: None,
            },
            &|| true,
        );
        assert!(result.is_err_and(|error| error.contains("cancelada")));
    }

    #[test]
    fn cancellation_after_encoding_does_not_write_a_file() -> Result<(), Box<dyn std::error::Error>>
    {
        let test_dir =
            std::env::temp_dir().join(format!("cancel-after-encoding-test-{}", std::process::id()));
        let input_dir = test_dir.join("input");
        let output_dir = test_dir.join("output");
        std::fs::create_dir_all(&input_dir)?;
        std::fs::create_dir_all(&output_dir)?;
        let source = input_dir.join("photo.png");
        image::RgbImage::from_fn(96, 96, |x, y| {
            image::Rgb([(x * 2) as u8, (y * 2) as u8, ((x + y) * 2) as u8])
        })
        .save(&source)?;
        let checks = Cell::new(0_u8);

        let result = convert_one(
            &source,
            &output_dir,
            options(OptimizationMode::Recommended),
            || {
                let next = checks.get() + 1;
                checks.set(next);
                next >= 4
            },
        );

        assert!(result.is_err_and(|error| error.contains("cancelada")));
        assert_eq!(std::fs::read_dir(&output_dir)?.count(), 0);
        std::fs::remove_dir_all(&test_dir)?;
        Ok(())
    }

    #[test]
    fn already_optimized_original_is_copied_to_destination()
    -> Result<(), Box<dyn std::error::Error>> {
        let test_dir =
            std::env::temp_dir().join(format!("minimg-preserve-test-{}", std::process::id()));
        let input_dir = test_dir.join("input");
        let output_dir = test_dir.join("output");
        std::fs::create_dir_all(&input_dir)?;
        std::fs::create_dir_all(&output_dir)?;
        let source = input_dir.join("tiny.webp");
        image::RgbImage::from_pixel(2, 2, image::Rgb([20, 40, 60])).save(&source)?;
        let original = std::fs::read(&source)?;

        let result = preserve_original(
            &source,
            &output_dir,
            "-optimizada",
            false,
            original.len() as u64,
            2,
            2,
            &[],
        )?;
        assert!(!result.optimized);
        assert_eq!(result.savings_percent, Some(0.0));
        let output = result.output_path.ok_or("Falta la ruta de salida")?;
        assert_eq!(std::fs::read(output)?, original);

        std::fs::remove_dir_all(&test_dir)?;
        Ok(())
    }

    #[test]
    fn manual_formats_generate_the_requested_extension() -> Result<(), Box<dyn std::error::Error>> {
        let test_dir =
            std::env::temp_dir().join(format!("image-formats-test-{}", std::process::id()));
        let input_dir = test_dir.join("input");
        let output_dir = test_dir.join("output");
        std::fs::create_dir_all(&input_dir)?;
        std::fs::create_dir_all(&output_dir)?;
        let source = input_dir.join("sample.png");
        image::RgbaImage::from_fn(48, 48, |x, y| {
            image::Rgba([(x * 5) as u8, (y * 5) as u8, 140, (x + y) as u8])
        })
        .save(&source)?;

        for (format, extension) in [
            (OutputFormat::Webp, "webp"),
            (OutputFormat::Jpeg, "jpg"),
            (OutputFormat::Png, "png"),
        ] {
            let result = convert_one(&source, &output_dir, format_options(format), || false)?;
            let output = result.output_path.ok_or("Falta la ruta de salida")?;
            assert_eq!(
                Path::new(&output)
                    .extension()
                    .and_then(|value| value.to_str()),
                Some(extension)
            );
            assert!(Path::new(&output).is_file());
            assert!(!result.preserved_original);
        }

        std::fs::remove_dir_all(&test_dir)?;
        Ok(())
    }

    #[test]
    fn automatic_format_generates_a_lighter_webp() -> Result<(), Box<dyn std::error::Error>> {
        let test_dir =
            std::env::temp_dir().join(format!("automatic-format-test-{}", std::process::id()));
        std::fs::create_dir_all(&test_dir)?;
        let source = test_dir.join("large.png");
        image::RgbImage::from_fn(192, 192, |x, y| {
            image::Rgb([(x % 255) as u8, (y % 255) as u8, ((x + y) % 255) as u8])
        })
        .save(&source)?;
        let result = convert_one(
            &source,
            &test_dir,
            ConversionOptions {
                output_format: OutputFormat::Automatic,
                ..options(OptimizationMode::Smart)
            },
            || false,
        )?;
        assert_eq!(result.output_format, "WebP");
        assert!(result.converted_size.unwrap_or_default() < result.original_size);
        std::fs::remove_dir_all(&test_dir)?;
        Ok(())
    }

    #[test]
    fn atomic_write_replaces_a_completed_file() -> Result<(), Box<dyn std::error::Error>> {
        let test_dir =
            std::env::temp_dir().join(format!("atomic-write-test-{}", std::process::id()));
        std::fs::create_dir_all(&test_dir)?;
        let output = test_dir.join("result.webp");
        std::fs::write(&output, b"previous")?;

        write_file_atomically(&output, b"complete", true)?;
        assert_eq!(std::fs::read(&output)?, b"complete");
        assert_eq!(std::fs::read_dir(&test_dir)?.count(), 1);

        std::fs::remove_dir_all(&test_dir)?;
        Ok(())
    }

    #[test]
    fn watermark_is_composited_at_the_selected_position() -> Result<(), Box<dyn std::error::Error>>
    {
        let test_dir = std::env::temp_dir().join(format!("watermark-test-{}", std::process::id()));
        std::fs::create_dir_all(&test_dir)?;
        let source = test_dir.join("photo.png");
        image::RgbaImage::from_pixel(100, 100, image::Rgba([220, 30, 30, 255])).save(&source)?;
        let watermark = image::DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(
            10,
            10,
            image::Rgba([20, 40, 240, 255]),
        ));

        let result = watermark_one(
            &source,
            &test_dir,
            &watermark,
            WatermarkOptions {
                position: WatermarkPosition::BottomRight,
                size_percent: 10,
                opacity: 100,
                custom_x_percent: None,
                custom_y_percent: None,
                filename_suffix: "-marca",
                overwrite_existing: false,
                protected_sources: &[],
            },
            || false,
        )?;
        let output = result.output_path.ok_or("Falta la ruta de salida")?;
        let image = image::open(output)?.to_rgba8();
        assert_eq!(image.dimensions(), (100, 100));
        assert_eq!(image.get_pixel(90, 90).0, [20, 40, 240, 255]);
        assert_eq!(image.get_pixel(20, 20).0, [220, 30, 30, 255]);

        std::fs::remove_dir_all(&test_dir)?;
        Ok(())
    }
    #[test]
    fn output_publication_never_replaces_without_permission()
    -> Result<(), Box<dyn std::error::Error>> {
        let dir = std::env::temp_dir().join(format!("minimg-no-clobber-{}", std::process::id()));
        std::fs::create_dir_all(&dir)?;
        let path = dir.join("output.png");
        std::fs::write(&path, b"original")?;
        assert!(write_file_atomically(&path, b"replacement", false).is_err());
        assert!(publish_without_replacing(&path, b"replacement").is_err());
        assert_eq!(std::fs::read(&path)?, b"original");
        let fallback = dir.join("fallback.png");
        publish_without_replacing(&fallback, b"complete")?;
        assert_eq!(std::fs::read(fallback)?, b"complete");
        assert_eq!(std::fs::read_dir(&dir)?.count(), 2);
        std::fs::remove_dir_all(dir)?;
        Ok(())
    }

    #[test]
    fn suffix_cannot_escape_destination_or_inject_control_characters()
    -> Result<(), Box<dyn std::error::Error>> {
        let dir = std::env::temp_dir().join(format!("minimg-suffix-{}", std::process::id()));
        std::fs::create_dir_all(&dir)?;
        let source = dir.join("source.png");
        std::fs::write(&source, b"test")?;
        let path = available_output_path(&source, &dir, "../../escape\n\0", "webp", false, &[])?;
        assert_eq!(path.parent(), Some(dir.as_path()));
        assert!(!path.to_string_lossy().contains('\n'));
        assert!(!safe_suffix("\0").contains('\0'));
        std::fs::remove_dir_all(dir)?;
        Ok(())
    }

    #[cfg(unix)]
    #[test]
    fn directory_alias_never_overwrites_source() -> Result<(), Box<dyn std::error::Error>> {
        let dir = std::env::temp_dir().join(format!("minimg-alias-{}", std::process::id()));
        let original_dir = dir.join("original");
        std::fs::create_dir_all(&original_dir)?;
        let source = original_dir.join("source.png");
        std::fs::write(&source, b"original")?;
        let alias = dir.join("alias");
        std::os::unix::fs::symlink(&original_dir, &alias)?;
        let path = available_output_path(&source, &alias, "", "png", true, &[])?;
        assert_ne!(path.file_name(), source.file_name());
        assert_eq!(std::fs::read(&source)?, b"original");
        std::fs::remove_dir_all(dir)?;
        Ok(())
    }

    #[test]
    fn pathological_watermark_aspect_ratio_is_rejected() -> Result<(), Box<dyn std::error::Error>> {
        let dir =
            std::env::temp_dir().join(format!("minimg-watermark-limit-{}", std::process::id()));
        std::fs::create_dir_all(&dir)?;
        let source = dir.join("source.png");
        image::RgbImage::new(1000, 10).save(&source)?;
        let watermark = image::DynamicImage::new_rgba8(1, 100_000);
        let result = watermark_one(
            &source,
            &dir,
            &watermark,
            WatermarkOptions {
                position: WatermarkPosition::Center,
                size_percent: 100,
                opacity: 75,
                custom_x_percent: None,
                custom_y_percent: None,
                filename_suffix: "-marca",
                overwrite_existing: false,
                protected_sources: &[],
            },
            || false,
        );
        assert!(result.unwrap_err().contains("100 megapíxeles"));
        std::fs::remove_dir_all(dir)?;
        Ok(())
    }
    #[test]
    fn conversion_cannot_replace_another_original_in_the_batch()
    -> Result<(), Box<dyn std::error::Error>> {
        let dir =
            std::env::temp_dir().join(format!("minimg-batch-original-{}", std::process::id()));
        std::fs::create_dir_all(&dir)?;
        let source = dir.join("photo.jpg");
        let other_original = dir.join("photo.png");
        image::RgbImage::from_pixel(16, 12, image::Rgb([20, 40, 60])).save(&source)?;
        image::RgbImage::from_pixel(16, 12, image::Rgb([80, 90, 100])).save(&other_original)?;
        let original_bytes = std::fs::read(&other_original)?;
        let protected = [source.canonicalize()?, other_original.canonicalize()?];
        let result = convert_one(
            &source,
            &dir,
            ConversionOptions {
                output_format: OutputFormat::Png,
                overwrite_existing: true,
                protected_sources: &protected,
                ..options(OptimizationMode::Recommended)
            },
            || false,
        )?;
        assert!(result.success);
        assert_ne!(PathBuf::from(result.output_path.unwrap()), other_original);
        assert_eq!(std::fs::read(&other_original)?, original_bytes);
        std::fs::remove_dir_all(dir)?;
        Ok(())
    }
    #[test]
    fn attainable_target_returns_the_candidate_that_meets_it()
    -> Result<(), Box<dyn std::error::Error>> {
        let image = image::DynamicImage::ImageRgb8(image::RgbImage::from_fn(256, 256, |x, y| {
            let value = x
                .wrapping_mul(1664525)
                .wrapping_add(y.wrapping_mul(1013904223));
            image::Rgb([value as u8, (value >> 8) as u8, (value >> 16) as u8])
        }));
        let high = make_candidate(&image, OutputFormat::Webp, false, 85)?;
        let lower = make_candidate(&image, OutputFormat::Webp, false, 75)?;
        let target = (lower.bytes.len() as u64).div_ceil(1024);
        assert!(high.bytes.len() as u64 > target * 1024);
        let candidate = select_candidate(
            CandidateRequest {
                format: OutputFormat::Webp,
                mode: OptimizationMode::Recommended,
                effort: OptimizationEffort::Balanced,
                source: Path::new("synthetic.jpg"),
                image: &image,
                original_size: u64::MAX,
                require_lighter: false,
                target_size_kb: Some(target),
            },
            &|| false,
        )?
        .ok_or("Falta el resultado")?;
        assert!(candidate.bytes.len() as u64 <= target * 1024);
        Ok(())
    }

    #[test]
    fn long_unicode_names_can_be_processed() -> Result<(), Box<dyn std::error::Error>> {
        let dir = std::env::temp_dir().join(format!("minimg-long-names-{}", std::process::id()));
        std::fs::create_dir_all(&dir)?;
        for stem in ["a".repeat(230), "á東京🙂".repeat(17)] {
            let source = dir.join(format!("{stem}.jpg"));
            image::RgbImage::from_pixel(12, 12, image::Rgb([20, 40, 60])).save(&source)?;
            let result = convert_one(
                &source,
                &dir,
                ConversionOptions {
                    output_format: OutputFormat::Png,
                    filename_suffix: "-optimizada",
                    ..options(OptimizationMode::Recommended)
                },
                || false,
            )?;
            assert!(result.success);
            let output = PathBuf::from(result.output_path.unwrap());
            assert!(output.is_file());
            assert!(output.file_name().unwrap().to_string_lossy().len() <= 255);
        }
        std::fs::remove_dir_all(dir)?;
        Ok(())
    }
    #[test]
    fn disk_full_during_write_preserves_previous_result_and_cleans_temp()
    -> Result<(), Box<dyn std::error::Error>> {
        let dir = std::env::temp_dir().join(format!("minimg-disk-full-{}", std::process::id()));
        std::fs::create_dir_all(&dir)?;
        let output = dir.join("output.png");
        std::fs::write(&output, b"previous complete result")?;
        let result =
            write_file_atomically_using(&output, b"new image bytes", true, |file, bytes| {
                file.write_all(&bytes[..3])?;
                Err(std::io::Error::from_raw_os_error(28))
            });
        assert!(result.is_err());
        assert_eq!(std::fs::read(&output)?, b"previous complete result");
        assert_eq!(std::fs::read_dir(&dir)?.count(), 1);
        std::fs::remove_dir_all(dir)?;
        Ok(())
    }

    #[test]
    fn missing_destination_and_empty_source_return_errors() -> Result<(), Box<dyn std::error::Error>>
    {
        let dir = std::env::temp_dir().join(format!("minimg-missing-{}", std::process::id()));
        std::fs::create_dir_all(&dir)?;
        let source = dir.join("empty.png");
        std::fs::write(&source, b"")?;
        assert!(convert_one(&source, &dir, options(OptimizationMode::Smart), || false).is_err());
        image::RgbImage::from_pixel(12, 12, image::Rgb([20, 40, 60])).save(&source)?;
        let output_dir = dir.join("deleted");
        std::fs::create_dir(&output_dir)?;
        std::fs::remove_dir(&output_dir)?;
        assert!(
            convert_one(
                &source,
                &output_dir,
                ConversionOptions {
                    output_format: OutputFormat::Png,
                    ..options(OptimizationMode::Recommended)
                },
                || false
            )
            .is_err()
        );
        assert_eq!(std::fs::read_dir(&dir)?.count(), 1);
        std::fs::remove_dir_all(dir)?;
        Ok(())
    }

    #[cfg(unix)]
    #[test]
    fn files_and_directories_without_permissions_fail_safely()
    -> Result<(), Box<dyn std::error::Error>> {
        use std::os::unix::fs::PermissionsExt;
        let dir = std::env::temp_dir().join(format!("minimg-permissions-{}", std::process::id()));
        std::fs::create_dir_all(&dir)?;
        let source = dir.join("source.png");
        image::RgbImage::from_pixel(12, 12, image::Rgb([20, 40, 60])).save(&source)?;
        std::fs::set_permissions(&source, std::fs::Permissions::from_mode(0o000))?;
        let read_result = load_image(&source, false);
        std::fs::set_permissions(&source, std::fs::Permissions::from_mode(0o600))?;
        assert!(read_result.is_err());
        let output = dir.join("read-only");
        std::fs::create_dir(&output)?;
        std::fs::set_permissions(&output, std::fs::Permissions::from_mode(0o500))?;
        let write_result = write_file_atomically(&output.join("image.png"), b"complete", false);
        std::fs::set_permissions(&output, std::fs::Permissions::from_mode(0o700))?;
        assert!(write_result.is_err());
        assert_eq!(std::fs::read_dir(&output)?.count(), 0);
        std::fs::remove_dir_all(dir)?;
        Ok(())
    }

    #[test]
    fn forced_process_exit_during_write_keeps_original_untouched()
    -> Result<(), Box<dyn std::error::Error>> {
        let dir = std::env::temp_dir().join(format!("minimg-interrupted-{}", std::process::id()));
        std::fs::create_dir_all(&dir)?;
        let output = dir.join("output.png");
        std::fs::write(&output, b"complete before exit")?;
        let result = std::process::Command::new(std::env::current_exe()?)
            .args([
                "--exact",
                "processor::tests::interrupted_writer_fixture",
                "--ignored",
            ])
            .env("MINIMG_WRITE_TEST_DIR", &dir)
            .output()?;
        assert_eq!(result.status.code(), Some(37));
        assert_eq!(std::fs::read(&output)?, b"complete before exit");
        // La terminación forzada no puede ejecutar limpieza; queda solo un temporal.
        assert_eq!(std::fs::read_dir(&dir)?.count(), 2);
        std::fs::remove_dir_all(dir)?;
        Ok(())
    }

    #[test]
    #[ignore = "Solo se ejecuta como subproceso de la prueba de interrupción"]
    fn interrupted_writer_fixture() {
        let Some(dir) = std::env::var_os("MINIMG_WRITE_TEST_DIR") else {
            return;
        };
        let output = PathBuf::from(dir).join("output.png");
        let _ = write_file_atomically_using(&output, b"incomplete", true, |file, bytes| {
            file.write_all(&bytes[..3])?;
            std::process::exit(37);
        });
    }
    #[test]
    fn automatic_original_size_does_not_disable_preservation()
    -> Result<(), Box<dyn std::error::Error>> {
        let dir = std::env::temp_dir().join(format!("minimg-original-size-{}", std::process::id()));
        std::fs::create_dir_all(&dir)?;
        let source = dir.join("tiny.webp");
        let image = image::DynamicImage::ImageRgb8(image::RgbImage::from_pixel(
            4,
            4,
            image::Rgb([20, 40, 60]),
        ));
        let original = encode_webp(&image, true, 100)?;
        std::fs::write(&source, &original)?;
        let result = convert_one(
            &source,
            &dir,
            ConversionOptions {
                output_format: OutputFormat::Automatic,
                resize_width: Some(4),
                ..options(OptimizationMode::Smart)
            },
            || false,
        )?;
        assert!(result.converted_size.unwrap() <= result.original_size);
        assert!(result.preserved_original);
        assert_eq!(std::fs::read(result.output_path.unwrap())?, original);
        std::fs::remove_dir_all(dir)?;
        Ok(())
    }
    #[test]
    fn automatic_keeps_requested_orientation_and_real_resize()
    -> Result<(), Box<dyn std::error::Error>> {
        let dir = std::env::temp_dir().join(format!("minimg-transform-{}", std::process::id()));
        std::fs::create_dir_all(&dir)?;
        let image = image::DynamicImage::ImageRgb8(image::RgbImage::from_pixel(
            8,
            4,
            image::Rgb([20, 40, 60]),
        ));
        let source = dir.join("rotated.jpg");
        let jpeg = encode_jpeg(&image, 90)?;
        // EXIF Orientation=6 (90 grados), TIFF little-endian.
        let exif = b"Exif\0\0II\x2a\0\x08\0\0\0\x01\0\x12\x01\x03\0\x01\0\0\0\x06\0\0\0\0\0\0\0";
        let mut rotated = jpeg[..2].to_vec();
        rotated.extend_from_slice(&[0xff, 0xe1]);
        rotated.extend_from_slice(&((exif.len() + 2) as u16).to_be_bytes());
        rotated.extend_from_slice(exif);
        rotated.extend_from_slice(&jpeg[2..]);
        std::fs::write(&source, rotated)?;
        let (loaded, transformed) = load_image_with_transform(&source, true)?;
        assert!(transformed);
        assert_eq!((loaded.width(), loaded.height()), (4, 8));
        let oriented = convert_one(
            &source,
            &dir,
            ConversionOptions {
                output_format: OutputFormat::Automatic,
                apply_orientation: true,
                ..options(OptimizationMode::Smart)
            },
            || false,
        )?;
        assert!(!oriented.preserved_original);
        let output = load_image(Path::new(&oriented.output_path.unwrap()), false)?;
        assert_eq!((output.width(), output.height()), (4, 8));
        let source = dir.join("small.webp");
        std::fs::write(&source, encode_webp(&image, true, 100)?)?;
        let resized = convert_one(
            &source,
            &dir,
            ConversionOptions {
                output_format: OutputFormat::Automatic,
                resize_width: Some(4),
                ..options(OptimizationMode::Smart)
            },
            || false,
        )?;
        assert!(!resized.preserved_original);
        let output = load_image(Path::new(&resized.output_path.unwrap()), false)?;
        assert_eq!((output.width(), output.height()), (4, 2));
        std::fs::remove_dir_all(dir)?;
        Ok(())
    }
}
