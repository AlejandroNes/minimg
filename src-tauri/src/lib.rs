mod commands;
mod processor;
mod security;
mod updates;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(commands::ConversionState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            #[cfg(any(target_os = "macos", windows))]
            {
                _app.handle().plugin(tauri_plugin_process::init())?;
                // Sin configuración real, no registrar ni consultar el actualizador.
                if updates::configured(_app.handle()) {
                    _app.handle()
                        .plugin(tauri_plugin_updater::Builder::new().build())?;
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::inspect_images,
            commands::get_thumbnail,
            commands::convert_images,
            commands::apply_watermark,
            commands::cancel_conversion,
            commands::read_file_bytes,
            commands::open_output_directory,
            updates::updates_configured
        ])
        .run(tauri::generate_context!())
        .expect("error al ejecutar Minimg");
}
