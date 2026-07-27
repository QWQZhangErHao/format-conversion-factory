use async_trait::async_trait;
use super::{ConversionPlugin, PluginResult};
use crate::engine::types::{ConversionProgress, ConversionRequest, ConversionStatus, StageType};

/// Document format conversion plugin.
/// Handles: Markdown ↔ HTML, TXT → HTML/Markdown, HTML/Markdown → TXT, DOCX → TXT/Markdown/HTML
pub struct DocumentPlugin;

#[async_trait]
impl ConversionPlugin for DocumentPlugin {
    fn name(&self) -> &'static str {
        "Document Converter"
    }

    fn source_formats(&self) -> Vec<&'static str> {
        vec!["markdown", "html", "txt"]
    }

    fn target_formats(&self) -> Vec<&'static str> {
        vec!["markdown", "html", "txt"]
    }

    fn can_convert(&self, source: &str, target: &str) -> bool {
        match (source, target) {
            ("markdown", "html") | ("html", "markdown")
            | ("txt", "html") | ("txt", "markdown")
            | ("html", "txt") | ("markdown", "txt")
            | ("txt", "txt") => true,
            _ => false,
        }
    }

    async fn convert(
        &self,
        request: &ConversionRequest,
        progress_tx: &tokio::sync::mpsc::UnboundedSender<ConversionProgress>,
    ) -> PluginResult {
        let input_path = &request.input_path;
        let content = std::fs::read_to_string(input_path)
            .map_err(|e| format!("读取文件失败: {}", e))?;

        let prog = ConversionProgress::new(&request.id);

        let _ = progress_tx.send(ConversionProgress {
            status: ConversionStatus::Converting,
            progress: 0.3,
            message: "解析文档...".into(),
            stage: Some(StageType::Parse),
            ..prog.clone()
        });

        match (request.source_format.as_str(), request.target_format.as_str()) {
            ("markdown", "html") => {
                let output = markdown_to_html(&content);
                let output_path = request.output_path.clone()
                    .unwrap_or_else(|| replace_ext(input_path, "html"));

                let _ = progress_tx.send(ConversionProgress {
                    status: ConversionStatus::Converting,
                    progress: 0.7,
                    message: "生成 HTML...".into(),
                    stage: Some(StageType::Serialize),
                    ..prog.clone()
                });

                std::fs::write(&output_path, output)
                    .map_err(|e| format!("写入文件失败: {}", e))?;
                Ok(output_path)
            }
            ("html", "markdown") => {
                let output = html_to_markdown(&content);
                let output_path = request.output_path.clone()
                    .unwrap_or_else(|| replace_ext(input_path, "md"));

                std::fs::write(&output_path, output)
                    .map_err(|e| format!("写入文件失败: {}", e))?;
                Ok(output_path)
            }
            ("txt", "html") => {
                let lines: Vec<&str> = content.lines().collect();
                let mut html = String::from("<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Converted</title></head><body>\n");
                for line in &lines {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    html.push_str(&format!("<p>{}</p>\n", html_escape(trimmed)));
                }
                html.push_str("</body></html>");
                let output_path = request.output_path.clone()
                    .unwrap_or_else(|| {
                        let stem = std::path::Path::new(input_path).file_stem().and_then(|s| s.to_str()).unwrap_or("output");
                        format!("{}.html", stem)
                    });
                std::fs::write(&output_path, html)
                    .map_err(|e| format!("写入文件失败: {}", e))?;
                Ok(output_path)
            }
            ("txt", "markdown") | ("txt", "txt") => {
                let output_path = request.output_path.clone()
                    .unwrap_or_else(|| {
                        let ext = if request.target_format == "markdown" { "md" } else { "txt" };
                        let stem = std::path::Path::new(input_path).file_stem().and_then(|s| s.to_str()).unwrap_or("output");
                        format!("{}.{}", stem, ext)
                    });
                std::fs::write(&output_path, &content)
                    .map_err(|e| format!("写入文件失败: {}", e))?;
                Ok(output_path)
            }
            ("html", "txt") | ("markdown", "txt") => {
                let output = strip_to_plain_text(&content, &request.source_format);
                let output_path = request.output_path.clone()
                    .unwrap_or_else(|| {
                        let stem = std::path::Path::new(input_path).file_stem()
                            .and_then(|s| s.to_str())
                            .unwrap_or("output");
                        format!("{}.txt", stem)
                    });
                std::fs::write(&output_path, output)
                    .map_err(|e| format!("写入文件失败: {}", e))?;
                Ok(output_path)
            }
            (s, t) => Err(format!("不支持的文档转换: {} → {}", s, t)),
        }
    }
}

/// Convert Markdown to sanitized HTML
fn markdown_to_html(markdown: &str) -> String {
    let parser = pulldown_cmark::Parser::new_ext(markdown, pulldown_cmark::Options::all());
    let mut html = String::new();
    pulldown_cmark::html::push_html(&mut html, parser);

    // Sanitize the HTML output
    let sanitized = ammonia::Builder::new()
        .add_allowed_classes("img", &["align", "alt", "src", "width", "height"])
        .clean(&html)
        .to_string();
    sanitized
}

/// Convert HTML to Markdown
fn html_to_markdown(html: &str) -> String {
    // html2md crate handles basic HTML→MD conversion
    html2md::parse_html(html)
}

/// Safe extension replacement using Path API (避免 str::replace 误改目录名)
fn replace_ext(path: &str, new_ext: &str) -> String {
    let p = std::path::Path::new(path);
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("output");
    if let Some(parent) = p.parent() {
        parent.join(format!("{}.{}", stem, new_ext)).to_string_lossy().into_owned()
    } else {
        format!("{}.{}", stem, new_ext)
    }
}

/// Escape HTML special characters
fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Strip HTML or Markdown formatting to plain text
fn strip_to_plain_text(content: &str, source_format: &str) -> String {
    match source_format {
        "html" => {
            // Use ammonia to strip HTML tags, leaving text
            let cleaned = ammonia::Builder::new()
                .rm_tags(&[
                    "script", "style", "nav", "footer", "header",
                ])
                .clean(content)
                .to_string();
            // Remove remaining tags with a simple regex
            let re = regex::Regex::new(r"<[^>]*>").unwrap();
            let text = re.replace_all(&cleaned, "");
            // Decode common HTML entities
            text.replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&nbsp;", " ")
                .lines()
                .map(|l| l.trim())
                .filter(|l| !l.is_empty())
                .collect::<Vec<_>>()
                .join("\n")
        }
        "markdown" => {
            // Strip common Markdown formatting
            let mut text = content.to_string();
            // Remove code fences
            text = text.replace("```", "");
            // Remove image/link syntax but keep text
            let re = regex::Regex::new(r"!\[([^\]]*)\]\([^)]*\)").unwrap();
            text = re.replace_all(&text, "$1").to_string();
            let re = regex::Regex::new(r"\[([^\]]*)\]\([^)]*\)").unwrap();
            text = re.replace_all(&text, "$1").to_string();
            // Remove bold/italic markers
            text = text.replace("**", "").replace("__", "").replace("*", "").replace("_", "");
            // Remove heading markers
            let re = regex::Regex::new(r"^#{1,6}\s+").unwrap();
            text = re.replace_all(&text, "").to_string();
            // Remove list markers
            let re = regex::Regex::new(r"^\s*[-*+]\s+").unwrap();
            text = re.replace_all(&text, "").to_string();
            // Remove blockquotes
            text = text.replace("> ", "").replace(">\t", "");
            text
        }
        _ => content.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_markdown_to_html_basic() {
        let md = "# Hello\n\nThis is **bold** text.";
        let html = markdown_to_html(md);
        assert!(html.contains("<h1>"));
        assert!(html.contains("<strong>"));
    }

    #[test]
    fn test_html_to_markdown_basic() {
        let html = "<h1>Title</h1><p>Paragraph</p>";
        let md = html_to_markdown(html);
        assert!(md.contains("Title"));
    }

    #[test]
    fn test_can_convert_document() {
        let plugin = DocumentPlugin;
        assert!(plugin.can_convert("markdown", "html"));
        assert!(plugin.can_convert("html", "markdown"));
        assert!(plugin.can_convert("txt", "html"));
        assert!(!plugin.can_convert("markdown", "pdf"));
        assert!(!plugin.can_convert("docx", "txt")); // DOCX 由前端提取
    }
}
