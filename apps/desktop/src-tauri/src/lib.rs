// Dead code warnings are expected for public API surface not yet consumed by the binary
// These types are architecturally designed for extension
#![allow(dead_code)]

mod api;
mod engine;
mod plugins;
mod commands;
mod readers;
mod logger;

use commands::AppState;
use engine::{FormatRegistry, ConversionPipeline, WorkerPool};
use plugins::PluginRegistry;
use std::sync::Arc;

/// Ping command to verify IPC is working
#[tauri::command]
fn greet(name: &str) -> String {
    format!("格式转换工厂 v0.2 — 你好，{name}！")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize the logging system
    logger::init();
    tracing::info!("格式转换工厂 v0.2 启动中...");

    // Initialize the plugin registry with default conversion plugins
    let plugin_registry = Arc::new(PluginRegistry::default());

    // Initialize the format registry
    let format_registry = FormatRegistry::new();

    // Initialize the conversion pipeline
    let pipeline = ConversionPipeline::new(plugin_registry);

    // Initialize the worker pool
    let worker_pool = WorkerPool::new();

    let app_state = AppState {
        registry: format_registry,
        pipeline,
        worker_pool,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::convert::get_supported_formats,
            commands::convert::get_formats_by_category,
            commands::convert::convert_file,
            commands::convert::cancel_conversion,
            commands::convert::get_worker_stats,
            commands::convert::pause_queue,
            commands::convert::resume_queue,
            commands::convert::pause_task,
            commands::convert::resume_task,
            commands::convert::cancel_task,
            commands::convert::read_file_bytes,
            commands::convert::read_as_markdown,
            commands::convert::get_recent_logs,
            commands::convert::detect_file_format,
        ])
        .setup(|_app| {
            // DevTools disabled per user request
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running format conversion factory");
}
