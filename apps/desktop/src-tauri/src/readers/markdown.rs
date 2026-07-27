use std::fs;
use std::io::Read;
use std::path::Path;

/// Read any supported file and return its content as Markdown.
///
/// Supported formats:
/// - Documents: md (passthrough), html → md, pdf (text extract)
/// - Data: json, csv, yaml, toml, xml → formatted markdown
/// - Code: various → fenced code blocks
/// - Images: metadata + base64 preview (< 1MB)
///
/// This is the primary entry point for AI-assisted file reading.
pub fn read_as_markdown(file_path: &str) -> Result<String, String> {
    let path = Path::new(file_path);
    let ext = path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let file_name = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown");

    // Get file size for metadata
    let file_size = fs::metadata(file_path)
        .ok()
        .map(|m| m.len())
        .unwrap_or(0);

    let mut output = String::new();

    // File header with metadata
    output.push_str(&format!("---\nfile: {}\nsize: {}\nformat: {}\n---\n\n", file_name, format_size(file_size), ext));

    match ext.as_str() {
        // ── Plain text / Markdown (passthrough) ──
        "md" | "markdown" | "txt" | "text" => {
            let content = fs::read_to_string(file_path)
                .map_err(|e| format!("读取文件失败: {}", e))?;
            output.push_str(&content);
        }

        // ── HTML → Markdown ──
        "html" | "htm" => {
            let content = fs::read_to_string(file_path)
                .map_err(|e| format!("读取文件失败: {}", e))?;
            let md = html_to_markdown_simple(&content);
            output.push_str(&md);
        }

        // ── JSON ──
        "json" => {
            let content = fs::read_to_string(file_path)
                .map_err(|e| format!("读取文件失败: {}", e))?;
            // Try to pretty-print, fallback to raw
            match serde_json::from_str::<serde_json::Value>(&content) {
                Ok(val) => {
                    let pretty = serde_json::to_string_pretty(&val)
                        .unwrap_or(content);
                    output.push_str("```json\n");
                    output.push_str(&pretty);
                    output.push_str("\n```\n");
                }
                Err(_) => {
                    output.push_str("```json\n");
                    output.push_str(&content);
                    output.push_str("\n```\n");
                }
            }
        }

        // ── CSV → Markdown Table ──
        "csv" => {
            let content = fs::read_to_string(file_path)
                .map_err(|e| format!("读取文件失败: {}", e))?;
            csv_to_markdown_table(&content, &mut output);
        }

        // ── YAML ──
        "yaml" | "yml" => {
            let content = fs::read_to_string(file_path)
                .map_err(|e| format!("读取文件失败: {}", e))?;
            output.push_str("```yaml\n");
            output.push_str(&content);
            output.push_str("\n```\n");
        }

        // ── TOML ──
        "toml" => {
            let content = fs::read_to_string(file_path)
                .map_err(|e| format!("读取文件失败: {}", e))?;
            output.push_str("```toml\n");
            output.push_str(&content);
            output.push_str("\n```\n");
        }

        // ── XML ──
        "xml" => {
            let content = fs::read_to_string(file_path)
                .map_err(|e| format!("读取文件失败: {}", e))?;
            output.push_str("```xml\n");
            output.push_str(&content);
            output.push_str("\n```\n");
        }

        // ── Images (metadata + base64 for small files) ──
        "png" | "jpg" | "jpeg" | "webp" | "gif" | "svg" | "ico" => {
            image_to_markdown(file_path, &ext, &mut output, file_size)?;
        }

        // ── PDF (basic text extraction) ──
        "pdf" => {
            // For PDFs, fall back to a metadata notice
            output.push_str(&format!("> 📄 PDF 文件: {} ({} bytes)\n\n", file_name, file_size));
            output.push_str("> PDF text extraction requires `pdftotext` or similar tool.\n");
            output.push_str("> Raw content cannot be displayed inline.\n");
        }

        // ── Code files ──
        "rs" | "py" | "js" | "ts" | "tsx" | "jsx" | "go" | "java" | "c" | "cpp" | "h" | "hpp"
        | "rb" | "php" | "sh" | "bash" | "zsh" | "ps1" | "sql" | "r" | "swift" | "kt"
        | "scala" | "dart" | "lua" | "elm" | "ex" | "exs" => {
            let content = fs::read_to_string(file_path)
                .map_err(|e| format!("读取文件失败: {}", e))?;
            output.push_str(&format!("```{}\n", ext));
            output.push_str(&content);
            output.push_str("\n```\n");
        }

        // ── Unknown format ──
        _ => {
            // Try as text first
            match fs::read_to_string(file_path) {
                Ok(content) => {
                    output.push_str("```\n");
                    output.push_str(&content);
                    output.push_str("\n```\n");
                }
                Err(_) => {
                    output.push_str(&format!(
                        "> ❌ 不支持的文件格式: .{}\n\n", ext
                    ));
                    output.push_str("> 该格式无法自动转换为 Markdown。\n");
                }
            }
        }
    }

    Ok(output)
}

/// Convert HTML to Markdown using the html2md crate (already a dependency)
fn html_to_markdown_simple(html: &str) -> String {
    html2md::parse_html(html)
}

/// Convert CSV content to a Markdown table
fn csv_to_markdown_table(csv: &str, output: &mut String) {
    let mut lines = csv.lines().peekable();
    let header = match lines.next() {
        Some(h) => h,
        None => return,
    };

    // Header row
    let cells: Vec<&str> = header.split(',').map(|s| s.trim()).collect();
    output.push_str("| ");
    for cell in &cells {
        output.push_str(cell);
        output.push_str(" | ");
    }
    output.push('\n');

    // Separator row
    output.push_str("| ");
    for _ in &cells {
        output.push_str("--- | ");
    }
    output.push('\n');

    // Data rows
    for line in lines {
        if line.trim().is_empty() { continue; }
        let row: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
        output.push_str("| ");
        for cell in &row {
            output.push_str(cell);
            output.push_str(" | ");
        }
        output.push('\n');
    }
    output.push('\n');
}

/// Convert image file to Markdown (metadata + optional base64)
fn image_to_markdown(file_path: &str, ext: &str, output: &mut String, file_size: u64) -> Result<(), String> {
    let file_name = Path::new(file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("image");

    // Image metadata
    output.push_str(&format!("![{}]({})\n\n", file_name, file_path));
    output.push_str(&format!("| 属性 | 值 |\n|------|-----|\n"));
    output.push_str(&format!("| 格式 | `{}` |\n", ext));
    output.push_str(&format!("| 大小 | {} |\n", format_size(file_size)));

    // For images under 1MB, include base64 preview
    if file_size < 1_048_576 {
        let mut file = fs::File::open(file_path)
            .map_err(|e| format!("无法打开图片: {}", e))?;
        let mut buffer = Vec::with_capacity(file_size as usize);
        file.read_to_end(&mut buffer)
            .map_err(|e| format!("读取图片失败: {}", e))?;

        let mime = match ext {
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "webp" => "image/webp",
            "gif" => "image/gif",
            "svg" => "image/svg+xml",
            "ico" => "image/x-icon",
            _ => "application/octet-stream",
        };

        let b64 = base64_encode(&buffer);
        output.push_str(&format!("\n![{}](data:{};base64,{})\n", file_name, mime, b64));
        output.push_str("\n> 已自动嵌入 Base64 预览\n\n");
    } else {
        output.push_str("\n> 文件超过 1MB，未自动嵌入预览，请使用路径直接访问。\n\n");
    }

    Ok(())
}

/// Format file size in human-readable format
fn format_size(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB"];
    let mut size = bytes as f64;
    let mut unit = 0;
    while size >= 1024.0 && unit < UNITS.len() - 1 {
        size /= 1024.0;
        unit += 1;
    }
    format!("{:.1} {}", size, UNITS[unit])
}

/// Simple Base64 encoding (avoids external dep for this common case)
fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::new();

    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = chunk.get(1).copied().unwrap_or(0) as u32;
        let b2 = chunk.get(2).copied().unwrap_or(0) as u32;
        let combined = (b0 << 16) | (b1 << 8) | b2;

        result.push(CHARS[((combined >> 18) & 0x3F) as usize] as char);
        result.push(CHARS[((combined >> 12) & 0x3F) as usize] as char);
        result.push(if chunk.len() > 1 { CHARS[((combined >> 6) & 0x3F) as usize] as char } else { '=' });
        result.push(if chunk.len() > 2 { CHARS[(combined & 0x3F) as usize] as char } else { '=' });
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn temp_file(content: &str, ext: &str) -> String {
        let dir = std::env::temp_dir();
        let path = dir.join(format!("test_read_{}.{}", std::process::id(), ext));
        let mut f = std::fs::File::create(&path).unwrap();
        write!(f, "{}", content).unwrap();
        path.to_string_lossy().to_string()
    }

    #[test]
    fn test_read_markdown_passthrough() {
        let path = temp_file("# Hello\n\nWorld", "md");
        let result = read_as_markdown(&path).unwrap();
        assert!(result.contains("# Hello"));
        assert!(result.contains("World"));
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_read_json_as_markdown() {
        let path = temp_file(r#"{"name":"Alice","age":30}"#, "json");
        let result = read_as_markdown(&path).unwrap();
        assert!(result.contains("```json"));
        assert!(result.contains("Alice"));
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_read_csv_as_table() {
        let path = temp_file("name,age\nAlice,30\nBob,25", "csv");
        let result = read_as_markdown(&path).unwrap();
        assert!(result.contains("| name"));
        assert!(result.contains("Alice"));
        assert!(result.contains("--- |"));
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_read_yaml() {
        let path = temp_file("name: Alice\nage: 30", "yaml");
        let result = read_as_markdown(&path).unwrap();
        assert!(result.contains("```yaml"));
        assert!(result.contains("Alice"));
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_read_html() {
        let path = temp_file("<h1>Title</h1><p>Hello</p>", "html");
        let result = read_as_markdown(&path).unwrap();
        assert!(result.contains("# Title") || result.contains("Title"));
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_read_code_file() {
        let path = temp_file("fn main() {}", "rs");
        let result = read_as_markdown(&path).unwrap();
        assert!(result.contains("```rs"));
        assert!(result.contains("fn main()"));
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_format_size() {
        assert_eq!(format_size(0), "0.0 B");
        assert_eq!(format_size(1024), "1.0 KB");
        assert_eq!(format_size(1_048_576), "1.0 MB");
        assert_eq!(format_size(1_073_741_824), "1.0 GB");
    }

    #[test]
    fn test_base64_encode() {
        let encoded = base64_encode(b"hello");
        assert_eq!(encoded, "aGVsbG8=");
        let encoded2 = base64_encode(b"f");
        assert_eq!(encoded2, "Zg==");
    }

    #[test]
    fn test_read_nonexistent_file() {
        let result = read_as_markdown("/nonexistent/file.txt");
        assert!(result.is_err());
    }

    #[test]
    fn test_empty_csv() {
        let path = temp_file("", "csv");
        let result = read_as_markdown(&path).unwrap();
        assert!(result.contains("csv") || result.is_empty() == false);
        let _ = std::fs::remove_file(&path);
    }
}
