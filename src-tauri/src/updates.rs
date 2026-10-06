use tauri::{AppHandle, Runtime};

pub fn configured<R: Runtime>(app: &AppHandle<R>) -> bool {
    let Some(config) = app.config().plugins.0.get("updater") else {
        return false;
    };
    let has_key = config
        .get("pubkey")
        .and_then(|value| value.as_str())
        .is_some_and(|key| !key.trim().is_empty());
    let has_endpoints = config
        .get("endpoints")
        .and_then(|value| value.as_array())
        .is_some_and(|endpoints| {
            !endpoints.is_empty()
                && endpoints.iter().all(|endpoint| {
                    endpoint
                        .as_str()
                        .is_some_and(|url| url.starts_with("https://"))
                })
        });
    has_key && has_endpoints
}

#[tauri::command]
pub fn updates_configured(app: AppHandle) -> bool {
    cfg!(any(target_os = "macos", windows)) && configured(&app)
}
