use serde::Serialize;

/// Unified API response envelope.
/// Every Tauri command returns this type, ensuring consistent frontend handling.
#[derive(Debug, Clone, Serialize)]
#[allow(dead_code)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
    /// Machine-readable error code (for programmatic handling)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<&'static str>,
    /// Request timing in ms
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timing_ms: Option<u128>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            code: None,
            timing_ms: None,
        }
    }

    pub fn ok_with_timing(data: T, start: std::time::Instant) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            code: None,
            timing_ms: Some(start.elapsed().as_millis()),
        }
    }

    pub fn err(message: impl Into<String>, code: &'static str) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message.into()),
            code: Some(code),
            timing_ms: None,
        }
    }

    /// Convert to a Result for ? operator usage
    pub fn into_result(self) -> Result<T, String> {
        match self.success {
            true => Ok(self.data.expect("ApiResponse: success without data")),
            false => Err(self.error.unwrap_or_else(|| "未知错误".into())),
        }
    }
}

/// Standard error codes for machine-readable error handling
#[allow(dead_code, non_snake_case)]
pub mod ErrorCode {
    pub const FILE_NOT_FOUND: &str = "FILE_NOT_FOUND";
    pub const FORMAT_MISMATCH: &str = "FORMAT_MISMATCH";
    pub const PARSE_ERROR: &str = "PARSE_ERROR";
    pub const CONVERSION_FAILED: &str = "CONVERSION_FAILED";
    pub const UNSUPPORTED_FORMAT: &str = "UNSUPPORTED_FORMAT";
    pub const TIMEOUT: &str = "TIMEOUT";
    pub const INTERNAL_ERROR: &str = "INTERNAL_ERROR";
    pub const INVALID_REQUEST: &str = "INVALID_REQUEST";
    pub const QUEUE_FULL: &str = "QUEUE_FULL";
    pub const NOT_FOUND: &str = "NOT_FOUND";
}
