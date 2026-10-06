use std::{
    fs::File,
    io::{BufReader, Read},
    path::{Path, PathBuf},
    sync::{Mutex, MutexGuard},
};

use image::{ImageDecoder, ImageFormat, ImageReader};

pub const MAX_INPUT_BYTES: u64 = 512 * 1024 * 1024;
pub const MAX_IMAGE_PIXELS: u64 = 100_000_000;
pub const MAX_BATCH_IMAGES: usize = 10_000;

// Compartido por ambas herramientas y las miniaturas. Un lote no debe multiplicar
// las copias de imágenes de 100 MP por cada núcleo del equipo.
static IMAGE_WORK: Mutex<()> = Mutex::new(());

pub fn image_work() -> Result<MutexGuard<'static, ()>, String> {
    IMAGE_WORK
        .lock()
        .map_err(|_| "No se pudo reservar memoria para procesar la imagen".into())
}

pub fn validate_batch(paths: &[String]) -> Result<(), String> {
    if paths.len() > MAX_BATCH_IMAGES {
        return Err("Selecciona como máximo 10 000 imágenes por lote".into());
    }
    Ok(())
}

pub fn validate_dimensions(width: u32, height: u32) -> Result<(), String> {
    if width == 0 || height == 0 || u64::from(width) * u64::from(height) > MAX_IMAGE_PIXELS {
        return Err("La imagen debe tener dimensiones válidas y no superar 100 megapíxeles".into());
    }
    Ok(())
}

pub fn directory(path: &Path) -> Result<PathBuf, String> {
    if !path.is_absolute() {
        return Err("La carpeta debe tener una ruta absoluta".into());
    }
    let path = path
        .canonicalize()
        .map_err(|_| "La carpeta no existe o no es válida")?;
    if !path.is_dir() {
        return Err("La ruta no corresponde a una carpeta".into());
    }
    Ok(path)
}

pub fn open_image_file(path: &Path) -> Result<File, String> {
    if !path.is_absolute() {
        return Err("La imagen debe tener una ruta absoluta".into());
    }
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    if !["jpg", "jpeg", "png", "webp"]
        .iter()
        .any(|value| extension.eq_ignore_ascii_case(value))
    {
        return Err("Formato no compatible: selecciona JPG, JPEG, PNG o WebP".into());
    }
    let check = |metadata: std::fs::Metadata| {
        if !metadata.is_file() {
            return Err("La imagen no es un archivo regular".to_string());
        }
        if metadata.len() > MAX_INPUT_BYTES {
            return Err("La imagen supera el límite de 512 MB".to_string());
        }
        Ok(())
    };
    check(std::fs::metadata(path).map_err(|error| format!("No se pudo leer la imagen: {error}"))?)?;
    let file = File::open(path).map_err(|error| format!("No se pudo abrir la imagen: {error}"))?;
    check(
        file.metadata()
            .map_err(|error| format!("No se pudo comprobar la imagen: {error}"))?,
    )?;
    Ok(file)
}

pub fn image_reader(path: &Path) -> Result<ImageReader<BufReader<File>>, String> {
    let mut reader = ImageReader::new(BufReader::new(open_image_file(path)?))
        .with_guessed_format()
        .map_err(|error| format!("Imagen inválida: {error}"))?;
    if !matches!(
        reader.format(),
        Some(ImageFormat::Jpeg | ImageFormat::Png | ImageFormat::WebP)
    ) {
        return Err("El contenido del archivo no es una imagen JPG, PNG o WebP".into());
    }
    reader.limits(image::Limits::default());
    Ok(reader)
}

pub fn inspect_image(path: &Path) -> Result<(u64, u32, u32), String> {
    let reader = image_reader(path)?;
    let size = std::fs::metadata(path)
        .map_err(|error| error.to_string())?
        .len();
    let decoder = reader
        .into_decoder()
        .map_err(|error| format!("Imagen inválida: {error}"))?;
    let (width, height) = decoder.dimensions();
    validate_dimensions(width, height)?;
    if decoder.total_bytes() > MAX_INPUT_BYTES {
        return Err("La imagen decodificada supera el límite de 512 MB".into());
    }
    Ok((size, width, height))
}

pub fn read_image_bytes(path: &Path) -> Result<Vec<u8>, String> {
    inspect_image(path)?;
    let mut bytes = Vec::new();
    open_image_file(path)?
        .take(MAX_INPUT_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("No se pudo leer la imagen: {error}"))?;
    if bytes.len() as u64 > MAX_INPUT_BYTES {
        return Err("La imagen supera el límite de 512 MB".into());
    }
    let reader = ImageReader::new(std::io::Cursor::new(&bytes))
        .with_guessed_format()
        .map_err(|error| error.to_string())?;
    if !matches!(
        reader.format(),
        Some(ImageFormat::Jpeg | ImageFormat::Png | ImageFormat::WebP)
    ) {
        return Err("El archivo ya no contiene una imagen compatible".into());
    }
    let decoder = reader
        .into_decoder()
        .map_err(|error| format!("Imagen inválida: {error}"))?;
    let (width, height) = decoder.dimensions();
    validate_dimensions(width, height)?;
    if decoder.total_bytes() > MAX_INPUT_BYTES {
        return Err("La imagen decodificada supera el límite de 512 MB".into());
    }
    drop(decoder);
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_dir(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("minimg-security-{name}-{}", std::process::id()))
    }

    #[test]
    fn rejects_arbitrary_files_and_fake_images() -> Result<(), Box<dyn std::error::Error>> {
        let dir = test_dir("content");
        std::fs::create_dir_all(&dir)?;
        let secret = dir.join("credentials.json");
        std::fs::write(&secret, b"synthetic test data")?;
        assert!(read_image_bytes(&secret).is_err());
        let fake = dir.join("fake.png");
        std::fs::write(&fake, b"<html>not an image</html>")?;
        assert!(inspect_image(&fake).is_err());
        assert!(read_image_bytes(&fake).is_err());
        assert!(open_image_file(&dir).is_err());
        assert!(open_image_file(Path::new("relative.png")).is_err());
        std::fs::remove_dir_all(dir)?;
        Ok(())
    }

    #[test]
    fn rejects_oversized_file_before_parsing_or_allocating()
    -> Result<(), Box<dyn std::error::Error>> {
        let dir = test_dir("size");
        std::fs::create_dir_all(&dir)?;
        let path = dir.join("large.png");
        File::create(&path)?.set_len(MAX_INPUT_BYTES + 1)?;
        assert!(open_image_file(&path).unwrap_err().contains("512 MB"));
        std::fs::remove_dir_all(dir)?;
        Ok(())
    }

    #[test]
    fn checks_pixel_and_batch_limits_without_overflow() {
        assert!(validate_dimensions(10_000, 10_000).is_ok());
        assert!(validate_dimensions(u32::MAX, u32::MAX).is_err());
        assert!(validate_dimensions(0, 10).is_err());
        assert!(validate_batch(&vec![String::new(); MAX_BATCH_IMAGES + 1]).is_err());
    }

    #[test]
    fn compatible_images_remain_readable_and_corrupt_images_fail()
    -> Result<(), Box<dyn std::error::Error>> {
        let dir = test_dir("formats");
        std::fs::create_dir_all(&dir)?;
        for extension in ["png", "jpg", "webp"] {
            let path = dir.join(format!("image.{extension}"));
            image::RgbImage::from_pixel(16, 12, image::Rgb([10, 20, 30])).save(&path)?;
            assert_eq!(inspect_image(&path)?.1, 16);
            assert_eq!(read_image_bytes(&path)?, std::fs::read(&path)?);
            let bytes = std::fs::read(&path)?;
            std::fs::write(&path, &bytes[..8.min(bytes.len())])?;
            assert!(inspect_image(&path).is_err());
        }
        std::fs::remove_dir_all(dir)?;
        Ok(())
    }

    #[test]
    fn directory_opening_rejects_files_and_relative_paths() -> Result<(), Box<dyn std::error::Error>>
    {
        let dir = test_dir("directory");
        std::fs::create_dir_all(&dir)?;
        let path = dir.join("file.txt");
        std::fs::write(&path, b"test")?;
        assert!(directory(&path).is_err());
        assert!(directory(Path::new(".")).is_err());
        assert_eq!(directory(&dir)?, dir.canonicalize()?);
        std::fs::remove_dir_all(dir)?;
        Ok(())
    }
}
