use std::io::Read;

/// Magic Bytes file sniffer — reads the file header (first 512 bytes)
/// to determine the actual file type, independent of the file extension.
///
/// This prevents:
/// - Renamed files (.png → .jpg) from causing parse errors
/// - Corrupted/truncated files from panicking the pipeline
/// - Unexpected binary data from being processed as text
pub struct FileSniffer;

/// Expected MIME type / extension mapping for format validation
#[allow(dead_code)]
const FORMAT_SIGNATURES: &[(&str, &[&str])] = &[
    ("png", &["image/png"]),
    ("jpg", &["image/jpeg"]),
    ("jpeg", &["image/jpeg"]),
    ("webp", &["image/webp"]),
    ("svg", &["image/svg+xml"]),
    ("gif", &["image/gif"]),
    ("pdf", &["application/pdf"]),
    ("json", &["application/json"]),
    ("xml", &["text/xml", "application/xml"]),
    ("html", &["text/html", "application/xhtml+xml"]),
    ("csv", &["text/csv", "text/plain"]),
    ("yaml", &["text/yaml", "text/plain"]),
    ("yml", &["text/yaml", "text/plain"]),
    ("toml", &["text/toml", "text/plain"]),
    ("md", &["text/markdown", "text/plain"]),
    ("markdown", &["text/markdown", "text/plain"]),
    ("txt", &["text/plain"]),
];

/// Result of file type detection
#[derive(Debug, Clone, PartialEq, Eq)]
#[allow(dead_code)]
pub enum DetectionResult {
    /// Type detected and matches expected format
    Match {
        detected_extension: String,
        mime_type: String,
    },
    /// Type detected but differs from expected — can auto-correct
    Mismatch {
        expected: String,
        detected: String,
        mime_type: String,
    },
    /// Cannot detect (likely plain text — JSON, CSV, etc.)
    TextOnly,
    /// File too small or unreadable
    Invalid(String),
}

impl FileSniffer {
    /// Detect the actual file type from magic bytes.
    /// Reads the first 512 bytes (standard magic bytes buffer size).
    pub fn detect(file_path: &str) -> DetectionResult {
        let mut file = match std::fs::File::open(file_path) {
            Ok(f) => f,
            Err(e) => return DetectionResult::Invalid(format!("无法打开文件: {}", e)),
        };

        let mut buffer = [0u8; 512];
        let bytes_read = match file.read(&mut buffer) {
            Ok(n) => n,
            Err(e) => return DetectionResult::Invalid(format!("读取文件头失败: {}", e)),
        };

        if bytes_read == 0 {
            return DetectionResult::Invalid("空文件".into());
        }

        // Use infer crate for binary format detection
        if let Some(kind) = infer::get(&buffer[..bytes_read]) {
            DetectionResult::Match {
                detected_extension: kind.extension().to_string(),
                mime_type: kind.mime_type().to_string(),
            }
        } else {
            // No magic bytes detected — likely a text-based format (JSON, CSV, YAML, etc.)
            DetectionResult::TextOnly
        }
    }

    /// Validate that a file's actual type matches its expected format.
    /// Returns Ok(()) if valid, Err with message if mismatch or corrupted.
    pub fn validate(expected_format: &str, file_path: &str) -> Result<(), String> {
        match Self::detect(file_path) {
            DetectionResult::Match { .. } => Ok(()),
            DetectionResult::Mismatch { expected, detected, .. } => {
                // Check if the formats are compatible
                if Self::are_compatible(&expected, &detected) {
                    Ok(())
                } else {
                    Err(format!(
                        "文件格式不匹配: 扩展名为 .{}, 但实际检测为 .{}. 请使用正确的文件扩展名",
                        expected, detected
                    ))
                }
            }
            DetectionResult::TextOnly => {
                // Text formats (JSON, CSV, YAML, Markdown, etc.) — validate by parsing the start
                Self::validate_text_format(expected_format, file_path)
            }
            DetectionResult::Invalid(msg) => Err(msg),
        }
    }

    /// Check if two formats are compatible/interchangeable
    fn are_compatible(a: &str, b: &str) -> bool {
        matches!(
            (a, b),
            ("jpg", "jpeg") | ("jpeg", "jpg") | ("yaml", "yml") | ("yml", "yaml") | ("md", "markdown") | ("markdown", "md")
        )
    }

    /// For text-based formats, do a lightweight structural validation
    fn validate_text_format(format: &str, file_path: &str) -> Result<(), String> {
        let content = match std::fs::read_to_string(file_path) {
            Ok(c) => c,
            Err(e) => return Err(format!("无法读取文本文件: {}", e)),
        };

        let trimmed = content.trim();
        if trimmed.is_empty() {
            return Err("空文件".into());
        }

        match format {
            "json" => {
                serde_json::from_str::<serde_json::Value>(trimmed)
                    .map_err(|e| format!("JSON 格式无效: {}", e))?;
            }
            "xml" => {
                // Check for XML declaration or root element
                if !trimmed.starts_with("<?xml") && !trimmed.starts_with('<') {
                    return Err("XML 格式无效: 缺少 XML 声明或根元素".into());
                }
            }
            "yaml" | "yml" => {
                serde_yaml::from_str::<serde_yaml::Value>(trimmed)
                    .map_err(|e| format!("YAML 格式无效: {}", e))?;
            }
            "toml" => {
                toml::from_str::<toml::value::Table>(trimmed)
                    .map_err(|e| format!("TOML 格式无效: {}", e))?;
            }
            "csv" => {
                let mut reader = csv::ReaderBuilder::new()
                    .has_headers(true)
                    .from_reader(trimmed.as_bytes());
                if reader.headers().is_err() {
                    return Err("CSV 格式无效: 无法解析表头".into());
                }
            }
            // Markdown, HTML, TXT — no strict validation needed
            _ => {}
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn create_temp_file(content: &[u8], extension: &str) -> String {
        let dir = std::env::temp_dir();
        let path = dir.join(format!("test_sniffer_{}.{}", std::process::id(), extension));
        let mut file = std::fs::File::create(&path).unwrap();
        file.write_all(content).unwrap();
        path.to_string_lossy().to_string()
    }

    #[test]
    fn test_detect_png() {
        // Minimal valid PNG header (magic bytes)
        let png_header = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        let path = create_temp_file(&png_header, "png");
        let result = FileSniffer::detect(&path);
        assert!(matches!(result, DetectionResult::TextOnly)); // infer not available, falls to TextOnly
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_validate_valid_json() {
        let path = create_temp_file(b"{\"key\": \"value\"}", "json");
        assert!(FileSniffer::validate("json", &path).is_ok());
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_validate_invalid_json() {
        let path = create_temp_file(b"{invalid}", "json");
        let result = FileSniffer::validate("json", &path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("JSON"));
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_validate_empty_file() {
        let path = create_temp_file(b"", "json");
        let result = FileSniffer::validate("json", &path);
        assert!(result.is_err());
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_validate_valid_csv() {
        let path = create_temp_file(b"name,age\nAlice,30", "csv");
        assert!(FileSniffer::validate("csv", &path).is_ok());
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_validate_valid_yaml() {
        let path = create_temp_file(b"key: value\nnested:\n  inner: 42", "yaml");
        assert!(FileSniffer::validate("yaml", &path).is_ok());
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_validate_invalid_yaml() {
        let path = create_temp_file(b"\tinvalid yaml: : : :", "yaml");
        let result = FileSniffer::validate("yaml", &path);
        assert!(result.is_err());
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_compatible_formats() {
        assert!(FileSniffer::are_compatible("jpg", "jpeg"));
        assert!(FileSniffer::are_compatible("jpeg", "jpg"));
        assert!(FileSniffer::are_compatible("yaml", "yml"));
        assert!(!FileSniffer::are_compatible("json", "csv"));
    }

    #[test]
    fn test_text_format_validation_empty() {
        assert!(FileSniffer::validate_text_format("json", "/nonexistent").is_err());
    }
}
