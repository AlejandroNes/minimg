use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;

/// Locale-independent IPC error. Internal workers retain String errors, encoded
/// as this envelope, so nested diagnostics and local logs have stable codes.
#[derive(Clone, Debug, Serialize, serde::Deserialize)]
pub struct AppError {
    pub code: String,
    pub params: BTreeMap<String, Value>,
}
impl AppError {
    pub fn new(code: &str, params: BTreeMap<String, Value>) -> Self {
        Self {
            code: code.into(),
            params,
        }
    }
}
impl From<String> for AppError {
    fn from(detail: String) -> Self {
        serde_json::from_str(&detail).unwrap_or_else(|_| {
            Self::new(
                "unknown",
                BTreeMap::from([("detail".into(), Value::String(detail))]),
            )
        })
    }
}
impl From<&str> for AppError {
    fn from(detail: &str) -> Self {
        detail.to_string().into()
    }
}

pub fn diagnostic(value: String) -> Value {
    serde_json::from_str::<AppError>(&value)
        .map(|error| serde_json::to_value(error).expect("serializable error"))
        .unwrap_or(Value::String(value))
}

macro_rules! app_error {
    ($code:literal $(, $name:ident : $value:expr)* $(,)?) => {{
        let params = std::collections::BTreeMap::from([
            $((stringify!($name).to_string(), crate::errors::diagnostic(($value).to_string()))),*
        ]);
        serde_json::to_string(&crate::errors::AppError::new($code, params))
            .expect("serializable error")
    }};
}
pub(crate) use app_error;

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn nested_errors_preserve_codes_and_context() {
        let inner = app_error!("image_invalid", detail: "decoder detail");
        let outer: AppError = app_error!("inspection_failed", detail: inner).into();
        assert_eq!(outer.code, "inspection_failed");
        assert_eq!(outer.params["detail"]["code"], "image_invalid");
        assert_eq!(outer.params["detail"]["params"]["detail"], "decoder detail");
    }
    #[test]
    fn system_errors_remain_diagnostic_details() {
        let error: AppError = "Permission denied".into();
        assert_eq!(error.code, "unknown");
        assert_eq!(error.params["detail"], "Permission denied");
    }
}
