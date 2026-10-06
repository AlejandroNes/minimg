fn main() {
    println!("cargo:rerun-if-changed=icons/icon.png");
    println!("cargo:rerun-if-changed=icons/icon.icns");
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "inspect_images",
            "get_thumbnail",
            "convert_images",
            "apply_watermark",
            "cancel_conversion",
            "read_file_bytes",
            "open_output_directory",
            "updates_configured",
        ]),
    ))
    .expect("No se pudieron generar los permisos de Minimg");
}
