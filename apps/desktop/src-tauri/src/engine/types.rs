use serde::{Deserialize, Serialize};
use std::fmt;

/// Supported format categories
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum FormatCategory {
    Document,
    Image,
    Audio,
    Video,
    Data,
    Code,
    Color,
}

impl fmt::Display for FormatCategory {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FormatCategory::Document => write!(f, "document"),
            FormatCategory::Image => write!(f, "image"),
            FormatCategory::Audio => write!(f, "audio"),
            FormatCategory::Video => write!(f, "video"),
            FormatCategory::Data => write!(f, "data"),
            FormatCategory::Code => write!(f, "code"),
            FormatCategory::Color => write!(f, "color"),
        }
    }
}

/// Format metadata descriptor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormatDescriptor {
    pub id: String,
    pub name: String,
    pub category: FormatCategory,
    pub extensions: Vec<String>,
    pub mime_types: Vec<String>,
    pub description: String,
    pub previewable: bool,
}

/// Conversion request from frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversionRequest {
    pub id: String,
    pub source_format: String,
    pub target_format: String,
    pub input_path: String,
    pub output_path: Option<String>,
    pub options: Option<ConversionOptions>,
}

/// Optional conversion parameters
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ConversionOptions {
    pub quality: Option<u8>,        // 0-100, for lossy formats
    pub width: Option<u32>,         // Resize width (images)
    pub height: Option<u32>,        // Resize height (images)
    pub preserve_metadata: Option<bool>,
    pub page_range: Option<String>, // "1-5" for PDFs
}

/// Pipeline stage
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum StageType {
    Preprocess,
    Parse,
    Transform,
    Serialize,
    Postprocess,
}

/// Conversion status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ConversionStatus {
    Queued,
    Preprocessing,
    Converting,
    Postprocessing,
    Completed,
    Failed,
    Cancelled,
}

/// Progress update sent to frontend via Tauri events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversionProgress {
    pub conversion_id: String,
    pub status: ConversionStatus,
    pub progress: f64, // 0.0 – 1.0
    pub message: String,
    pub stage: Option<StageType>,
}

/// Final conversion result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversionResult {
    pub success: bool,
    pub conversion_id: String,
    pub output_path: Option<String>,
    pub error: Option<String>,
    pub duration_ms: u64,
    pub original_size_bytes: Option<u64>,
    pub result_size_bytes: Option<u64>,
}

/// Structured error with machine-readable code
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct RichError {
    /// Machine-readable error code
    pub code: String,
    pub message: String,
    pub details: Option<String>,
}

impl RichError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self { code: code.into(), message: message.into(), details: None }
    }

    pub fn with_details(code: impl Into<String>, message: impl Into<String>, details: impl Into<String>) -> Self {
        Self { code: code.into(), message: message.into(), details: Some(details.into()) }
    }
}

/// Standardized error codes
#[allow(dead_code, non_snake_case)]
pub mod error_code {
    pub const FILE_NOT_FOUND: &str = "FILE_NOT_FOUND";
    pub const FORMAT_MISMATCH: &str = "FORMAT_MISMATCH";
    pub const PARSE_ERROR: &str = "PARSE_ERROR";
    pub const CONVERSION_FAILED: &str = "CONVERSION_FAILED";
    pub const UNSUPPORTED_FORMAT: &str = "UNSUPPORTED_FORMAT";
    pub const TIMEOUT: &str = "TIMEOUT";
    pub const INTERNAL_ERROR: &str = "INTERNAL_ERROR";
    pub const INVALID_REQUEST: &str = "INVALID_REQUEST";
    pub const OOM: &str = "OOM";
    pub const FILE_CORRUPTED: &str = "FILE_CORRUPTED";
}

/// Engine-level errors
#[derive(Debug, thiserror::Error)]
#[allow(dead_code)]
pub enum ConversionError {
    #[error("Unsupported conversion: {0} → {1}")]
    UnsupportedConversion(String, String),

    #[error("Input file not found: {0}")]
    InputNotFound(String),

    #[error("Plugin execution failed: {0}")]
    PluginError(String),

    #[error("Conversion cancelled")]
    Cancelled,

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
}

#[allow(dead_code)]
impl ConversionRequest {
    pub fn new(source_format: String, target_format: String, input_path: String) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            source_format,
            target_format,
            input_path,
            output_path: None,
            options: None,
        }
    }
}

impl ConversionProgress {
    pub fn new(conversion_id: &str) -> Self {
        Self {
            conversion_id: conversion_id.to_string(),
            status: ConversionStatus::Queued,
            progress: 0.0,
            message: String::new(),
            stage: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // -----------------------------------------------------------------------
    //  ConversionRequest::new
    // -----------------------------------------------------------------------
    #[test]
    fn test_conversion_request_new_creates_correct_request() {
        let req = ConversionRequest::new(
            "markdown".into(),
            "html".into(),
            "/path/to/file.md".into(),
        );

        // ID should be a valid UUID
        assert!(!req.id.is_empty(), "id should not be empty");
        uuid::Uuid::parse_str(&req.id).expect("id should be a valid UUID");

        assert_eq!(req.source_format, "markdown");
        assert_eq!(req.target_format, "html");
        assert_eq!(req.input_path, "/path/to/file.md");
        assert!(req.output_path.is_none(), "output_path should default to None");
        assert!(req.options.is_none(), "options should default to None");
    }

    #[test]
    fn test_conversion_request_new_unique_ids() {
        let req1 = ConversionRequest::new("a".into(), "b".into(), "/x".into());
        let req2 = ConversionRequest::new("a".into(), "b".into(), "/x".into());
        assert_ne!(req1.id, req2.id, "each request should have a unique id");
    }

    // -----------------------------------------------------------------------
    //  ConversionProgress::new
    // -----------------------------------------------------------------------
    #[test]
    fn test_conversion_progress_new_creates_with_defaults() {
        let prog = ConversionProgress::new("test-conversion");

        assert_eq!(prog.conversion_id, "test-conversion");
        assert_eq!(prog.status, ConversionStatus::Queued);
        assert_eq!(prog.progress, 0.0);
        assert!(prog.message.is_empty(), "message should be empty by default");
        assert!(prog.stage.is_none(), "stage should be None by default");
    }

    // -----------------------------------------------------------------------
    //  FormatCategory Display
    // -----------------------------------------------------------------------
    #[test]
    fn test_format_category_display_document() {
        assert_eq!(FormatCategory::Document.to_string(), "document");
    }

    #[test]
    fn test_format_category_display_image() {
        assert_eq!(FormatCategory::Image.to_string(), "image");
    }

    #[test]
    fn test_format_category_display_audio() {
        assert_eq!(FormatCategory::Audio.to_string(), "audio");
    }

    #[test]
    fn test_format_category_display_video() {
        assert_eq!(FormatCategory::Video.to_string(), "video");
    }

    #[test]
    fn test_format_category_display_data() {
        assert_eq!(FormatCategory::Data.to_string(), "data");
    }

    #[test]
    fn test_format_category_display_code() {
        assert_eq!(FormatCategory::Code.to_string(), "code");
    }

    #[test]
    fn test_format_category_display_color() {
        assert_eq!(FormatCategory::Color.to_string(), "color");
    }

    // -----------------------------------------------------------------------
    //  ConversionError Display
    // -----------------------------------------------------------------------
    #[test]
    fn test_conversion_error_display_unsupported_conversion() {
        let err = ConversionError::UnsupportedConversion("a".into(), "b".into());
        let msg = err.to_string();
        assert!(msg.contains("Unsupported conversion"), "got: {}", msg);
        assert!(msg.contains("a"), "got: {}", msg);
        assert!(msg.contains("b"), "got: {}", msg);
    }

    #[test]
    fn test_conversion_error_display_input_not_found() {
        let err = ConversionError::InputNotFound("missing.txt".into());
        let msg = err.to_string();
        assert!(msg.contains("Input file not found"), "got: {}", msg);
        assert!(msg.contains("missing.txt"), "got: {}", msg);
    }

    #[test]
    fn test_conversion_error_display_plugin_error() {
        let err = ConversionError::PluginError("something went wrong".into());
        let msg = err.to_string();
        assert!(msg.contains("Plugin execution failed"), "got: {}", msg);
        assert!(msg.contains("something went wrong"), "got: {}", msg);
    }

    #[test]
    fn test_conversion_error_display_cancelled() {
        let err = ConversionError::Cancelled;
        assert_eq!(err.to_string(), "Conversion cancelled");
    }

    #[test]
    fn test_conversion_error_display_io() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let err = ConversionError::Io(io_err);
        let msg = err.to_string();
        assert!(msg.contains("I/O error"), "got: {}", msg);
    }

    // -----------------------------------------------------------------------
    //  ConversionOptions Default
    // -----------------------------------------------------------------------
    #[test]
    fn test_conversion_options_default() {
        let opts = ConversionOptions::default();
        assert!(opts.quality.is_none());
        assert!(opts.width.is_none());
        assert!(opts.height.is_none());
        assert!(opts.preserve_metadata.is_none());
        assert!(opts.page_range.is_none());
    }
}
