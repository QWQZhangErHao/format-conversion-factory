pub mod document;
pub mod image;
pub mod data;

use async_trait::async_trait;
use std::collections::HashMap;
use crate::engine::types::{ConversionRequest, ConversionProgress};

/// Result type for plugin conversions
pub type PluginResult = Result<String, String>; // String = output path

/// Abstract conversion plugin trait.
/// Each format adapter implements this trait.
#[async_trait]
#[allow(dead_code)]
pub trait ConversionPlugin: Send + Sync {
    fn name(&self) -> &'static str;
    fn source_formats(&self) -> Vec<&'static str>;
    fn target_formats(&self) -> Vec<&'static str>;
    fn can_convert(&self, source: &str, target: &str) -> bool;
    async fn convert(
        &self,
        request: &ConversionRequest,
        progress_tx: &tokio::sync::mpsc::UnboundedSender<ConversionProgress>,
    ) -> PluginResult;
}

/// Registry of all conversion plugins
pub struct PluginRegistry {
    plugins: Vec<Box<dyn ConversionPlugin>>,
    /// Quick lookup: (source, target) → plugin index
    route_cache: HashMap<(String, String), usize>,
}

impl PluginRegistry {
    pub fn new() -> Self {
        Self {
            plugins: Vec::new(),
            route_cache: HashMap::new(),
        }
    }

    /// Register a plugin and rebuild the route cache
    pub fn register(&mut self, plugin: Box<dyn ConversionPlugin>) {
        let idx = self.plugins.len();
        for src in plugin.source_formats() {
            for tgt in plugin.target_formats() {
                // 只缓存 can_convert 返回 true 的配对，避免绕过后面的校验
                if plugin.can_convert(src, tgt) {
                    self.route_cache.insert((src.to_string(), tgt.to_string()), idx);
                }
            }
        }
        self.plugins.push(plugin);
    }

    /// Find a plugin that can handle the given conversion
    pub fn find_plugin(&self, source: &str, target: &str) -> Option<&dyn ConversionPlugin> {
        // Direct route cache hit
        if let Some(&idx) = self.route_cache.get(&(source.to_string(), target.to_string())) {
            // 再次验证缓存项仍匹配（防御性检查，防止注册后修改）
            if self.plugins[idx].can_convert(source, target) {
                return Some(self.plugins[idx].as_ref());
            }
        }
        // Fallback: linear scan (handles reverse lookups, cross-format)
        self.plugins.iter().find(|p| p.can_convert(source, target)).map(|p| p.as_ref())
    }

    #[allow(dead_code)]
    pub fn all(&self) -> &[Box<dyn ConversionPlugin>] {
        &self.plugins
    }

    /// Build the default plugin set
    pub fn register_defaults(&mut self) {
        self.register(Box::new(document::DocumentPlugin));
        self.register(Box::new(image::ImagePlugin));
        self.register(Box::new(data::DataPlugin));
    }

    #[allow(dead_code)]
    pub fn is_empty(&self) -> bool {
        self.plugins.is_empty()
    }

    #[allow(dead_code)]
    pub fn len(&self) -> usize {
        self.plugins.len()
    }
}

impl Default for PluginRegistry {
    fn default() -> Self {
        let mut reg = Self::new();
        reg.register_defaults();
        reg
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // -----------------------------------------------------------------------
    //  Empty registry
    // -----------------------------------------------------------------------
    #[test]
    fn test_new_registry_is_empty() {
        let registry = PluginRegistry::new();
        assert!(registry.is_empty());
        assert_eq!(registry.len(), 0);
        assert!(registry.all().is_empty());
    }

    // -----------------------------------------------------------------------
    //  Register a plugin
    // -----------------------------------------------------------------------
    #[test]
    fn test_register_plugin_adds_to_registry() {
        let mut registry = PluginRegistry::new();
        registry.register(Box::new(document::DocumentPlugin));
        assert!(!registry.is_empty());
        assert_eq!(registry.len(), 1);
        assert_eq!(registry.all().len(), 1);
        assert_eq!(registry.all()[0].name(), "Document Converter");
    }

    // -----------------------------------------------------------------------
    //  register_defaults adds three plugins
    // -----------------------------------------------------------------------
    #[test]
    fn test_register_defaults_adds_plugins() {
        let mut registry = PluginRegistry::new();
        registry.register_defaults();
        assert_eq!(registry.len(), 3);

        let names: Vec<&str> = registry.all().iter().map(|p| p.name()).collect();
        assert!(names.contains(&"Document Converter"));
        assert!(names.contains(&"Image Converter"));
        assert!(names.contains(&"Data Converter"));
    }

    // -----------------------------------------------------------------------
    //  register_defaults len
    // -----------------------------------------------------------------------
    #[test]
    fn test_register_defaults_len() {
        let mut registry = PluginRegistry::new();
        registry.register_defaults();
        assert_eq!(registry.len(), 3);
    }

    // -----------------------------------------------------------------------
    //  find_plugin — cache hit
    // -----------------------------------------------------------------------
    #[test]
    fn test_find_plugin_route_cache_hit() {
        let mut registry = PluginRegistry::new();
        registry.register_defaults();

        // DocumentPlugin registers source/target: ["markdown", "html"]
        // The route cache has ("markdown", "markdown"), ("markdown", "html"),
        // ("html", "markdown"), ("html", "html")
        let plugin = registry.find_plugin("markdown", "html");
        assert!(plugin.is_some(), "should find document converter");
        assert_eq!(plugin.unwrap().name(), "Document Converter");
    }

    // -----------------------------------------------------------------------
    //  find_plugin — cache miss falls back to linear scan
    // -----------------------------------------------------------------------
    #[test]
    fn test_find_plugin_linear_scan_fallback() {
        let mut registry = PluginRegistry::new();
        registry.register(Box::new(document::DocumentPlugin));

        // ("txt", "html") is not in the document plugin's source/target lists,
        // so the route cache misses and the linear scan via can_convert runs.
        let plugin = registry.find_plugin("txt", "html");
        assert!(plugin.is_none(), "no plugin should handle txt -> html");

        // Same for ("markdown", "png") — cache miss + linear scan = None
        let plugin = registry.find_plugin("markdown", "png");
        assert!(plugin.is_none());
    }

    // -----------------------------------------------------------------------
    //  Default impl
    // -----------------------------------------------------------------------
    #[test]
    fn test_registry_default_has_plugins() {
        let registry = PluginRegistry::default();
        assert_eq!(registry.len(), 3);
    }
}
