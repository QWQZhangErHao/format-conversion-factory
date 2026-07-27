/// Wasm Plugin Architecture — dynamic format extension via WebAssembly.
///
/// ## Design
///
/// Instead of compiling every possible format converter into the main binary,
/// this allows loading converter plugins as `.wasm` files at runtime.
/// Each plugin exports a standard interface that the host calls.
///
/// ## Plugin Interface (Wasm exports)
///
/// A converter plugin must export these functions:
///
/// ```wasm
/// (func $plugin_name (export "plugin_name") (result i32))
/// (func $source_formats (export "source_formats") (result i32))     // JSON array string
/// (func $target_formats (export "target_formats") (result i32))     // JSON array string
/// (func $can_convert (export "can_convert") (param i32 i32) (result i32))  // source, target ptrs
/// (func $convert (export "convert") (param i32 i32 i32) (result i32))      // input, input_len, out_ptr
/// ```
///
/// ## Usage Flow
///
/// 1. User drops a `.wasm` plugin into `~/.format-conversion-factory/plugins/`
/// 2. On startup, the host loads all plugins from the directory
/// 3. Each plugin is registered in the PluginRegistry alongside native plugins
/// 4. When a conversion request matches a Wasm plugin, the host:
///    a. Reads the input file into guest memory
///    b. Calls the plugin's `convert` function
///    c. Reads the output from guest memory
///    d. Writes the result to the output path
///
/// ## Security
///
/// - Plugins run in a sandboxed Wasm runtime (no filesystem/network access by default)
/// - Resource limits: 256MB memory, 30s execution time
/// - Plugin manifests can request specific capabilities (opt-in)
///
/// ## Dependency
///
/// This module requires `wasmtime` crate. Add to Cargo.toml when network is available:
/// ```toml
/// wasmtime = { version = "24", features = ["async"] }
/// wasmtime-wasi = "24"
/// ```

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use async_trait::async_trait;
use super::{ConversionPlugin, PluginResult};
use crate::engine::types::{ConversionProgress, ConversionRequest};

/// A Wasm-based conversion plugin loaded at runtime
#[allow(dead_code)]
pub struct WasmPluginInstance {
    name: String,
    path: PathBuf,
    source_formats: Vec<String>,
    target_formats: Vec<String>,
    // wasmtime components (when crate is available):
    // engine: wasmtime::Engine,
    // module: wasmtime::Module,
    // linker: wasmtime::Linker,
}

#[allow(dead_code)]
impl WasmPluginInstance {
    /// Load a Wasm plugin from a `.wasm` file
    pub fn load(path: &Path) -> Result<Self, String> {
        let name = path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string();

        // TODO: Use wasmtime::Engine::new() + Module::new() when wasmtime is available
        // For now, return a stub that reports the plugin exists but can't be loaded
        Err(format!(
            "Wasm 插件加载需要 wasmtime crate。请添加依赖后重试: {}",
            name
        ))
    }

    /// Scan a directory for `.wasm` plugin files
    pub fn scan_directory(dir: &Path) -> Vec<PathBuf> {
        let mut plugins = Vec::new();
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("wasm") {
                    plugins.push(path);
                }
            }
        }
        plugins
    }
}

/// Registry for dynamically loaded Wasm plugins
#[allow(dead_code)]
pub struct WasmPluginRegistry {
    plugins: HashMap<String, WasmPluginInstance>,
}

#[allow(dead_code)]
impl WasmPluginRegistry {
    pub fn new() -> Self {
        Self { plugins: HashMap::new() }
    }

    /// Load all `.wasm` plugins from the default plugin directory
    pub fn load_all() -> Self {
        let mut registry = Self::new();

        // 默认插件目录
        let plugin_dirs = vec![
            dirs_or_default(),
        ];

        for dir in plugin_dirs {
            let wasm_files = WasmPluginInstance::scan_directory(&dir);
            for wasm_path in wasm_files {
                match WasmPluginInstance::load(&wasm_path) {
                    Ok(plugin) => {
                        registry.plugins.insert(plugin.name.clone(), plugin);
                    }
                    Err(e) => {
                        tracing::warn!("[WasmPlugin] 加载失败: {}", e);
                    }
                }
            }
        }

        registry
    }
}

fn dirs_or_default() -> PathBuf {
    // 默认: {TEMP}/format-conversion-factory/plugins/
    std::env::temp_dir()
        .join("format-conversion-factory")
        .join("plugins")
}
