use serde_json::Value;
use tauri::{AppHandle, Emitter, State};
use crate::engine::types::*;
use crate::engine::{FormatRegistry, ConversionPipeline, WorkerPool, QueueStats};

/// Application state shared across all Tauri commands
pub struct AppState {
    pub registry: FormatRegistry,
    pub pipeline: ConversionPipeline,
    pub worker_pool: WorkerPool,
}

/// Get all supported formats with metadata
#[tauri::command]
pub fn get_supported_formats(state: State<'_, AppState>) -> Vec<FormatDescriptor> {
    state.registry.all().into_iter().cloned().collect()
}

/// Get formats by category
#[tauri::command]
pub fn get_formats_by_category(state: State<'_, AppState>, category: String) -> Vec<FormatDescriptor> {
    let cat = match category.to_lowercase().as_str() {
        "document" => FormatCategory::Document,
        "image" => FormatCategory::Image,
        "data" => FormatCategory::Data,
        _ => return Vec::new(),
    };
    state.registry.by_category(cat).into_iter().cloned().collect()
}

/// Start a file conversion
#[tauri::command]
pub async fn convert_file(
    app: AppHandle,
    state: State<'_, AppState>,
    source_format: String,
    target_format: String,
    input_path: String,
    output_path: Option<String>,
    quality: Option<u8>,
    width: Option<u32>,
    height: Option<u32>,
) -> Result<ConversionResult, String> {
    let request = ConversionRequest {
        id: uuid::Uuid::new_v4().to_string(),
        source_format,
        target_format,
        input_path,
        output_path,
        options: Some(ConversionOptions {
            quality,
            width,
            height,
            preserve_metadata: None,
            page_range: None,
        }),
    };

    let _conv_id = request.id.clone();

    // Create progress channel
    let (progress_tx, mut progress_rx) = tokio::sync::mpsc::unbounded_channel::<ConversionProgress>();

    // Spawn progress forwarding to frontend
    let app_clone = app.clone();
    tokio::spawn(async move {
        while let Some(progress) = progress_rx.recv().await {
            let _ = app_clone.emit("conversion-progress", &progress);
        }
    });

    // Execute conversion
    let result = state.pipeline.execute(request, progress_tx).await;

    Ok(result)
}

/// Cancel an active conversion
#[tauri::command]
pub fn cancel_conversion(state: State<'_, AppState>, conversion_id: String) -> bool {
    state.pipeline.cancel(&conversion_id)
}

/// Get worker pool statistics (queue status)
#[tauri::command]
pub fn get_worker_stats(state: State<'_, AppState>) -> QueueStats {
    state.worker_pool.stats()
}

/// Pause the global task queue (暂停所有任务)
#[tauri::command]
pub fn pause_queue(state: State<'_, AppState>) -> bool {
    state.worker_pool.task_queue.toggle_global_pause()
}

/// Resume the global task queue (恢复所有任务)
#[tauri::command]
pub fn resume_queue(state: State<'_, AppState>) -> bool {
    if state.worker_pool.task_queue.stats().globally_paused {
        state.worker_pool.task_queue.toggle_global_pause();
    }
    !state.worker_pool.task_queue.stats().globally_paused
}

/// Pause a specific task
#[tauri::command]
pub fn pause_task(state: State<'_, AppState>, task_id: String) -> bool {
    state.worker_pool.task_queue.pause_task(&task_id)
}

/// Resume a specific task
#[tauri::command]
pub fn resume_task(state: State<'_, AppState>, task_id: String) -> bool {
    state.worker_pool.task_queue.resume_task(&task_id)
}

/// Cancel a specific task
#[tauri::command]
pub fn cancel_task(state: State<'_, AppState>, task_id: String) -> bool {
    state.worker_pool.task_queue.cancel_task(&task_id)
}

/// 0-Copy binary file read — returns raw bytes without JSON serialization.
/// Uses tauri::ipc::Response for direct binary transfer to the frontend.
#[tauri::command]
pub async fn read_file_bytes(path: String) -> Result<tauri::ipc::Response, String> {
    let data = tokio::fs::read(&path).await
        .map_err(|e| format!("读取文件失败: {}", e))?;
    Ok(tauri::ipc::Response::new(data))
}

/// AI 友好：将任意支持的文件读取并转换为 Markdown 格式
#[tauri::command]
pub fn read_as_markdown(path: String) -> Result<String, String> {
    crate::readers::read_as_markdown(&path)
}

/// 获取最近 N 条日志
#[tauri::command]
pub fn get_recent_logs(n: usize) -> Vec<String> {
    crate::logger::recent_logs(n)
}

/// Magic Bytes 文件格式嗅探 (前置校验)
#[tauri::command]
pub fn detect_file_format(path: String) -> Result<Value, String> {
    use serde_json::json;
    use crate::engine::sniffer::FileSniffer;

    let ext = std::path::Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let sniffed = FileSniffer::detect(&path);

    let mime_type = match &sniffed {
        crate::engine::sniffer::DetectionResult::TextOnly => {
            match ext.as_str() {
                "json" => "application/json",
                "csv" => "text/csv",
                "yaml" | "yml" => "text/yaml",
                "toml" => "text/toml",
                "xml" => "application/xml",
                "md" | "markdown" => "text/markdown",
                "html" | "htm" => "text/html",
                "txt" => "text/plain",
                _ => "application/octet-stream",
            }.to_string()
        }
        crate::engine::sniffer::DetectionResult::Invalid(msg) => {
            return Err(msg.clone());
        }
        _ => {
            let mut file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
            let mut buf = [0u8; 512];
            let n = std::io::Read::read(&mut file, &mut buf).map_err(|e| e.to_string())?;
            if let Some(kind) = infer::get(&buf[..n]) {
                kind.mime_type().to_string()
            } else {
                "application/octet-stream".to_string()
            }
        }
    };

    let expected_ext = ext.clone();
    let is_mismatched = {
        let image_exts = ["png", "jpg", "jpeg", "webp", "gif", "svg"];
        (image_exts.contains(&expected_ext.as_str()) && !mime_type.starts_with("image/"))
            || (expected_ext == "pdf" && mime_type != "application/pdf")
    };

    Ok(json!({
        "extension": expected_ext,
        "mimeType": mime_type,
        "isMismatched": is_mismatched,
    }))
}

#[cfg(test)]
mod tests {
    use crate::engine::FormatRegistry;
    use crate::engine::types::*;

    // -----------------------------------------------------------------------
    //  get_formats_by_category underlying logic
    //
    //  The command function calls:
    //    state.registry.by_category(cat)
    //  We test the same logic through FormatRegistry directly since
    //  Tauri State is not available in unit tests.
    // -----------------------------------------------------------------------
    #[test]
    fn test_get_formats_by_category_returns_formats() {
        let registry = FormatRegistry::new();

        let documents = registry.by_category(FormatCategory::Document);
        assert!(!documents.is_empty(), "should have document formats");
        assert!(documents.iter().any(|f| f.id == "markdown"));
        assert!(documents.iter().any(|f| f.id == "html"));
        assert!(documents.iter().any(|f| f.id == "pdf"));
        assert!(documents.iter().any(|f| f.id == "docx"));

        // Image category
        let images = registry.by_category(FormatCategory::Image);
        assert!(!images.is_empty(), "should have image formats");
        assert!(images.iter().any(|f| f.id == "png"));
        assert!(images.iter().any(|f| f.id == "jpeg"));
        assert!(images.iter().any(|f| f.id == "webp"));
        assert!(images.iter().any(|f| f.id == "svg"));

        // Data category
        let data = registry.by_category(FormatCategory::Data);
        assert!(!data.is_empty(), "should have data formats");
        assert!(data.iter().any(|f| f.id == "json"));
        assert!(data.iter().any(|f| f.id == "csv"));
        assert!(data.iter().any(|f| f.id == "yaml"));
        assert!(data.iter().any(|f| f.id == "xml"));
        assert!(data.iter().any(|f| f.id == "toml"));
    }

    // -----------------------------------------------------------------------
    //  Categories with no registered formats (Audio, Video, Code, Color)
    //  map to the `_ => Vec::new()` arm in the command function.
    // -----------------------------------------------------------------------
    #[test]
    fn test_get_formats_by_category_invalid_returns_empty() {
        let registry = FormatRegistry::new();

        // No built-in Audio formats
        let audio = registry.by_category(FormatCategory::Audio);
        assert!(audio.is_empty(), "no built-in audio formats");

        // No built-in Video formats
        let video = registry.by_category(FormatCategory::Video);
        assert!(video.is_empty(), "no built-in video formats");

        // No built-in Code formats
        let code = registry.by_category(FormatCategory::Code);
        assert!(code.is_empty(), "no built-in code formats");

        // No built-in Color formats
        let color = registry.by_category(FormatCategory::Color);
        assert!(color.is_empty(), "no built-in color formats");
    }

    // -----------------------------------------------------------------------
    //  Verify the command's category string matching
    // -----------------------------------------------------------------------
    #[test]
    fn test_get_formats_by_category_string_matching() {
        let registry = FormatRegistry::new();

        // "document" → Document
        let result: Vec<FormatDescriptor> = match "document".to_lowercase().as_str() {
            "document" => registry.by_category(FormatCategory::Document)
                .into_iter().cloned().collect(),
            "image" => registry.by_category(FormatCategory::Image)
                .into_iter().cloned().collect(),
            "data" => registry.by_category(FormatCategory::Data)
                .into_iter().cloned().collect(),
            _ => Vec::new(),
        };
        assert!(!result.is_empty());
        assert!(result.iter().any(|f| f.id == "markdown"));

        // "image" → Image
        let result: Vec<FormatDescriptor> = match "image".to_lowercase().as_str() {
            "document" => registry.by_category(FormatCategory::Document)
                .into_iter().cloned().collect(),
            "image" => registry.by_category(FormatCategory::Image)
                .into_iter().cloned().collect(),
            "data" => registry.by_category(FormatCategory::Data)
                .into_iter().cloned().collect(),
            _ => Vec::new(),
        };
        assert!(!result.is_empty());
        assert!(result.iter().any(|f| f.id == "png"));

        // "audio" (not supported) → empty
        let result: Vec<FormatDescriptor> = match "audio".to_lowercase().as_str() {
            "document" => registry.by_category(FormatCategory::Document)
                .into_iter().cloned().collect(),
            "image" => registry.by_category(FormatCategory::Image)
                .into_iter().cloned().collect(),
            "data" => registry.by_category(FormatCategory::Data)
                .into_iter().cloned().collect(),
            _ => Vec::new(),
        };
        assert!(result.is_empty());

        // "" (empty string) → empty
        let result: Vec<FormatDescriptor> = match "".to_lowercase().as_str() {
            "document" => registry.by_category(FormatCategory::Document)
                .into_iter().cloned().collect(),
            "image" => registry.by_category(FormatCategory::Image)
                .into_iter().cloned().collect(),
            "data" => registry.by_category(FormatCategory::Data)
                .into_iter().cloned().collect(),
            _ => Vec::new(),
        };
        assert!(result.is_empty());
    }
}
