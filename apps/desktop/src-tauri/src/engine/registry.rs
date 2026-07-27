use std::collections::HashMap;
use super::types::{FormatDescriptor, FormatCategory};

/// Central format registry — single source of truth for all supported formats.
pub struct FormatRegistry {
    formats: HashMap<String, FormatDescriptor>,
}

#[allow(dead_code)]
impl FormatRegistry {
    pub fn new() -> Self {
        let mut reg = Self { formats: HashMap::new() };
        reg.register_builtins();
        reg
    }

    pub fn register(&mut self, format: FormatDescriptor) {
        self.formats.insert(format.id.clone(), format);
    }

    pub fn get(&self, id: &str) -> Option<&FormatDescriptor> {
        self.formats.get(id)
    }

    pub fn all(&self) -> Vec<&FormatDescriptor> {
        self.formats.values().collect()
    }

    pub fn by_category(&self, category: FormatCategory) -> Vec<&FormatDescriptor> {
        self.formats.values().filter(|f| f.category == category).collect()
    }

    pub fn exists(&self, id: &str) -> bool {
        self.formats.contains_key(id)
    }

    /// Register the built-in format definitions
    fn register_builtins(&mut self) {
        let builtins = vec![
            // ── Documents ──
            FormatDescriptor {
                id: "markdown".into(), name: "Markdown".into(), category: FormatCategory::Document,
                extensions: vec![".md".into(), ".mdx".into()], mime_types: vec!["text/markdown".into()],
                description: "Markdown 文档格式".into(), previewable: true,
            },
            FormatDescriptor {
                id: "html".into(), name: "HTML".into(), category: FormatCategory::Document,
                extensions: vec![".html".into(), ".htm".into()], mime_types: vec!["text/html".into()],
                description: "超文本标记语言".into(), previewable: true,
            },
            FormatDescriptor {
                id: "pdf".into(), name: "PDF".into(), category: FormatCategory::Document,
                extensions: vec![".pdf".into()], mime_types: vec!["application/pdf".into()],
                description: "便携式文档格式".into(), previewable: true,
            },
            FormatDescriptor {
                id: "docx".into(), name: "Word 文档".into(), category: FormatCategory::Document,
                extensions: vec![".docx".into()], mime_types: vec!["application/vnd.openxmlformats-officedocument.wordprocessingml.document".into()],
                description: "Microsoft Word 文档".into(), previewable: false,
            },
            // ── Images ──
            FormatDescriptor {
                id: "png".into(), name: "PNG".into(), category: FormatCategory::Image,
                extensions: vec![".png".into()], mime_types: vec!["image/png".into()],
                description: "便携式网络图形".into(), previewable: true,
            },
            FormatDescriptor {
                id: "jpeg".into(), name: "JPEG".into(), category: FormatCategory::Image,
                extensions: vec![".jpg".into(), ".jpeg".into()], mime_types: vec!["image/jpeg".into()],
                description: "JPEG 图像".into(), previewable: true,
            },
            FormatDescriptor {
                id: "webp".into(), name: "WebP".into(), category: FormatCategory::Image,
                extensions: vec![".webp".into()], mime_types: vec!["image/webp".into()],
                description: "WebP 图像格式".into(), previewable: true,
            },
            FormatDescriptor {
                id: "svg".into(), name: "SVG".into(), category: FormatCategory::Image,
                extensions: vec![".svg".into()], mime_types: vec!["image/svg+xml".into()],
                description: "可缩放矢量图形".into(), previewable: true,
            },
            FormatDescriptor {
                id: "gif".into(), name: "GIF".into(), category: FormatCategory::Image,
                extensions: vec![".gif".into()], mime_types: vec!["image/gif".into()],
                description: "GIF 图像".into(), previewable: true,
            },
            FormatDescriptor {
                id: "bmp".into(), name: "BMP".into(), category: FormatCategory::Image,
                extensions: vec![".bmp".into()], mime_types: vec!["image/bmp".into()],
                description: "BMP 图像".into(), previewable: true,
            },
            FormatDescriptor {
                id: "ico".into(), name: "ICO".into(), category: FormatCategory::Image,
                extensions: vec![".ico".into()], mime_types: vec!["image/x-icon".into()],
                description: "ICO 图标".into(), previewable: true,
            },
            // ── Data ──
            FormatDescriptor {
                id: "json".into(), name: "JSON".into(), category: FormatCategory::Data,
                extensions: vec![".json".into()], mime_types: vec!["application/json".into()],
                description: "JavaScript 对象表示法".into(), previewable: true,
            },
            FormatDescriptor {
                id: "csv".into(), name: "CSV".into(), category: FormatCategory::Data,
                extensions: vec![".csv".into()], mime_types: vec!["text/csv".into()],
                description: "逗号分隔值".into(), previewable: true,
            },
            FormatDescriptor {
                id: "yaml".into(), name: "YAML".into(), category: FormatCategory::Data,
                extensions: vec![".yaml".into(), ".yml".into()], mime_types: vec!["text/yaml".into()],
                description: "YAML 数据格式".into(), previewable: true,
            },
            FormatDescriptor {
                id: "xml".into(), name: "XML".into(), category: FormatCategory::Data,
                extensions: vec![".xml".into()], mime_types: vec!["application/xml".into()],
                description: "可扩展标记语言".into(), previewable: true,
            },
            FormatDescriptor {
                id: "toml".into(), name: "TOML".into(), category: FormatCategory::Data,
                extensions: vec![".toml".into()], mime_types: vec!["text/toml".into()],
                description: "TOML 配置文件格式".into(), previewable: true,
            },
            FormatDescriptor {
                id: "tsv".into(), name: "TSV".into(), category: FormatCategory::Data,
                extensions: vec![".tsv".into()], mime_types: vec!["text/tab-separated-values".into()],
                description: "制表符分隔值".into(), previewable: true,
            },
            // ── Document extras ──
            FormatDescriptor {
                id: "txt".into(), name: "纯文本".into(), category: FormatCategory::Document,
                extensions: vec![".txt".into()], mime_types: vec!["text/plain".into()],
                description: "纯文本格式".into(), previewable: true,
            },
        ];
        for fmt in builtins {
            self.formats.insert(fmt.id.clone(), fmt);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // -----------------------------------------------------------------------
    //  Pre-existing tests (kept)
    // -----------------------------------------------------------------------
    #[test]
    fn test_registry_contains_builtins() {
        let registry = FormatRegistry::new();
        assert!(registry.exists("markdown"));
        assert!(registry.exists("png"));
        assert!(registry.exists("json"));
        assert!(registry.exists("nonexistent") == false);
    }

    #[test]
    fn test_registry_by_category() {
        let registry = FormatRegistry::new();
        let images = registry.by_category(FormatCategory::Image);
        assert!(images.len() >= 3);
        assert!(images.iter().any(|f| f.id == "png"));
    }

    // -----------------------------------------------------------------------
    //  Register and retrieve a format
    // -----------------------------------------------------------------------
    #[test]
    fn test_register_and_get() {
        let mut registry = FormatRegistry::new();
        let fmt = FormatDescriptor {
            id: "custom_fmt".into(),
            name: "Custom Format".into(),
            category: FormatCategory::Data,
            extensions: vec![".custom".into()],
            mime_types: vec!["application/x-custom".into()],
            description: "A custom test format".into(),
            previewable: false,
        };
        registry.register(fmt);

        let retrieved = registry.get("custom_fmt");
        assert!(retrieved.is_some(), "should find the registered format");
        assert_eq!(retrieved.unwrap().name, "Custom Format");
    }

    // -----------------------------------------------------------------------
    //  Re-registering the same id overwrites
    // -----------------------------------------------------------------------
    #[test]
    fn test_register_overwrite() {
        let mut registry = FormatRegistry::new();
        let fmt1 = FormatDescriptor {
            id: "dup".into(),
            name: "First".into(),
            category: FormatCategory::Document,
            extensions: vec![],
            mime_types: vec![],
            description: "".into(),
            previewable: false,
        };
        let fmt2 = FormatDescriptor {
            id: "dup".into(),
            name: "Second".into(),
            category: FormatCategory::Image,
            extensions: vec![],
            mime_types: vec![],
            description: "".into(),
            previewable: false,
        };
        registry.register(fmt1);
        registry.register(fmt2);

        let retrieved = registry.get("dup").unwrap();
        assert_eq!(retrieved.name, "Second");
        assert_eq!(retrieved.category, FormatCategory::Image);
    }

    // -----------------------------------------------------------------------
    //  all() returns every registered format
    // -----------------------------------------------------------------------
    #[test]
    fn test_all_return_all_formats() {
        let registry = FormatRegistry::new();
        let all = registry.all();
        // Builtins: markdown, html, pdf, docx, png, jpeg, webp, svg,
        //           json, csv, yaml, xml, toml  →  13 formats
        assert!(
            all.len() >= 17,
            "expected at least 17 builtin formats, got {}",
            all.len()
        );
        // Spot-check that key formats are present
        let ids: Vec<&str> = all.iter().map(|f| f.id.as_str()).collect();
        assert!(ids.contains(&"markdown"));
        assert!(ids.contains(&"png"));
        assert!(ids.contains(&"json"));
        assert!(ids.contains(&"toml"));
    }

    // -----------------------------------------------------------------------
    //  exists() returns false for missing id
    // -----------------------------------------------------------------------
    #[test]
    fn test_exists_returns_false_for_missing() {
        let registry = FormatRegistry::new();
        assert!(!registry.exists("definitely_not_a_real_format_id"));
        assert!(!registry.exists(""));
    }

    // -----------------------------------------------------------------------
    //  by_category with no matches returns empty
    // -----------------------------------------------------------------------
    #[test]
    fn test_by_category_with_no_matches() {
        let registry = FormatRegistry::new();
        // Builtins only include Document, Image, Data
        let audio = registry.by_category(FormatCategory::Audio);
        assert!(
            audio.is_empty(),
            "expected no Audio formats among builtins, got {}",
            audio.len()
        );

        let video = registry.by_category(FormatCategory::Video);
        assert!(video.is_empty());

        let code = registry.by_category(FormatCategory::Code);
        assert!(code.is_empty());

        let color = registry.by_category(FormatCategory::Color);
        assert!(color.is_empty());
    }
}
