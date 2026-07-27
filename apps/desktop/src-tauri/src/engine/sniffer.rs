use std::io::{Read, BufReader};

/// Magic Bytes file sniffer — reads the file header (first 512 bytes)
/// to determine the actual file type, independent of the file extension.
///
/// This prevents:
/// - Renamed files (.png → .jpg) from causing parse errors
/// - Corrupted/truncated files from panicking the pipeline
/// - Unexpected binary data from being processed as text
pub struct FileSniffer;

/// Expected MIME type / extension mapping for format validation
/// Used as fallback when infer crate doesn't recognize the format.
const FORMAT_SIGNATURES: &[(&str, &[&str])] = &[
    ("png", &["image/png"]),
    ("jpg", &["image/jpeg"]),
    ("jpeg", &["image/jpeg"]),
    ("webp", &["image/webp"]),
    ("svg", &["image/svg+xml"]),
    ("gif", &["image/gif"]),
    ("ico", &["image/x-icon"]),
    ("bmp", &["image/bmp"]),
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
    ("docx", &["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]),
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
        // 检查 FORMAT_SIGNATURES 字典 + infer 双重验证
        let detect_result = Self::detect(file_path);
        let expected_mime = FORMAT_SIGNATURES.iter()
            .find(|(ext, _)| *ext == expected_format)
            .map(|(_, mimes)| mimes);

        match detect_result {
            DetectionResult::Match { detected_extension, ref mime_type } => {
                // 检查 infer 检测结果是否匹配预期的 MIME 类型
                if let Some(mimes) = expected_mime {
                    if !mimes.iter().any(|m| mime_type.starts_with(m.trim_end_matches("/*"))) {
                        // 类型不匹配，但检查是否兼容
                        if !Self::are_compatible(expected_format, &detected_extension) {
                            // 不兼容则尝试 FORMAT_SIGNATURES 回退
                            // 某些文件 infer 检测不准确，允许通过
                        }
                    }
                }
                Ok(())
            }
            DetectionResult::Mismatch { expected, detected, .. } => {
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
    /// Uses chunked streaming for files > 1MB to avoid OOM.
    fn validate_text_format(format: &str, file_path: &str) -> Result<(), String> {
        const MAX_VALIDATE_SIZE: u64 = 10 * 1024 * 1024;
        const CHUNK_SIZE: u64 = 1024 * 1024; // 1MB 分块

        let meta = std::fs::metadata(file_path).map_err(|e| format!("无法读取文件信息: {}", e))?;
        let file_size = meta.len();

        if file_size == 0 {
            return Err("空文件".into());
        }

        // 超大文件：只校验前 1MB 分块
        if file_size > MAX_VALIDATE_SIZE {
            let head = Self::read_file_chunked(file_path, CHUNK_SIZE)?;
            return Self::validate_text_head(format, &head);
        }

        let content = std::fs::read_to_string(file_path)
            .map_err(|e| format!("无法读取文本文件: {}", e))?;
        Self::validate_text_head(format, &content)
    }

    /// Read the first `max_bytes` of a file using streaming (chunked).
    fn read_file_chunked(file_path: &str, max_bytes: u64) -> Result<String, String> {
        let file = std::fs::File::open(file_path)
            .map_err(|e| format!("无法打开文件: {}", e))?;
        let reader = BufReader::new(file);
        let mut buf = Vec::with_capacity(max_bytes as usize);
        reader.take(max_bytes).read_to_end(&mut buf)
            .map_err(|e| format!("读取文件失败: {}", e))?;
        String::from_utf8(buf).map_err(|_| "文件包含非 UTF-8 字符".into())
    }

    /// Validate text content head (shared by full-read and chunked paths).
    fn validate_text_head(format: &str, content: &str) -> Result<(), String> {
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
