use std::sync::{Arc, Mutex};
use std::time::Instant;
use super::types::*;
use crate::plugins::PluginRegistry;

/// The main conversion pipeline — orchestrates multi-stage conversion flow.
pub struct ConversionPipeline {
    plugin_registry: Arc<PluginRegistry>,
    active_conversions: Arc<Mutex<Vec<ActiveConversion>>>,
}

struct ActiveConversion {
    id: String,
    #[allow(dead_code)]
    started_at: Instant,
    cancelled: bool,
    /// Channel to send cancel signal to the running conversion task
    cancel_tx: Option<tokio::sync::mpsc::UnboundedSender<()>>,
}

impl ConversionPipeline {
    pub fn new(plugin_registry: Arc<PluginRegistry>) -> Self {
        Self {
            plugin_registry,
            active_conversions: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// Execute a conversion request through the pipeline.
    /// Returns a stream-like channel receiver for progress updates.
    pub async fn execute(
        &self,
        request: ConversionRequest,
        progress_tx: tokio::sync::mpsc::UnboundedSender<ConversionProgress>,
    ) -> ConversionResult {
        let start = Instant::now();
        let conv_id = request.id.clone();
        let mut prog = ConversionProgress::new(&conv_id);

        // Track active conversion (恢复中毒的 mutex 而非 panic)
        {
            let mut active = self.active_conversions.lock().unwrap_or_else(|e| {
                tracing::warn!("active_conversions mutex 中毒，已恢复");
                e.into_inner()
            });
            active.push(ActiveConversion {
                id: conv_id.clone(),
                started_at: Instant::now(),
                cancelled: false,
                cancel_tx: None,
            });
        }

        // Helper to send progress
        let send_progress = |prog: &mut ConversionProgress, status: ConversionStatus, progress: f64, message: &str, stage: Option<StageType>| {
            prog.status = status.clone();
            prog.progress = progress;
            prog.message = message.to_string();
            prog.stage = stage.clone();
            let _ = progress_tx.send(prog.clone());
        };

        // Step 1: Preprocess + Magic Bytes validation
        // Emit task-status-changed event
        let _ = progress_tx.send(ConversionProgress {
            status: ConversionStatus::Queued,
            progress: 0.0,
            message: "任务已入队".into(),
            stage: None,
            ..prog.clone()
        });

        tracing::info!(
            conversion_id = %conv_id,
            source = %request.source_format,
            target = %request.target_format,
            path = %request.input_path,
            "开始转换"
        );

        send_progress(&mut prog, ConversionStatus::Preprocessing, 0.05, "验证文件格式...", Some(StageType::Preprocess));

        // Validate input exists
        if !std::path::Path::new(&request.input_path).exists() {
            tracing::warn!(path = %request.input_path, "输入文件不存在");
            send_progress(&mut prog, ConversionStatus::Failed, 0.0, "输入文件不存在", None);
            return ConversionResult {
                success: false,
                conversion_id: conv_id,
                output_path: None,
                error: Some("输入文件不存在".into()),
                duration_ms: start.elapsed().as_millis() as u64,
                original_size_bytes: None,
                result_size_bytes: None,
            };
        }

        // Magic Bytes file format validation (Fail Fast)
        if let Err(err_msg) = crate::engine::sniffer::FileSniffer::validate(&request.source_format, &request.input_path) {
            send_progress(&mut prog, ConversionStatus::Failed, 0.0, &err_msg, None);
            return ConversionResult {
                success: false,
                conversion_id: conv_id,
                output_path: None,
                error: Some(err_msg),
                duration_ms: start.elapsed().as_millis() as u64,
                original_size_bytes: None,
                result_size_bytes: None,
            };
        }

        // Step 2: Find appropriate plugin
        send_progress(&mut prog, ConversionStatus::Converting, 0.15, "匹配转换引擎...", Some(StageType::Parse));

        let plugin = self.plugin_registry.find_plugin(&request.source_format, &request.target_format);
        let plugin = match plugin {
            Some(p) => p,
            None => {
                send_progress(&mut prog, ConversionStatus::Failed, 0.0, &format!("不支持的转换: {} → {}", request.source_format, request.target_format), None);
                return ConversionResult {
                    success: false,
                    conversion_id: conv_id,
                    output_path: None,
                    error: Some(format!("不支持的转换: {} → {}", request.source_format, request.target_format)),
                    duration_ms: start.elapsed().as_millis() as u64,
                    original_size_bytes: None,
                    result_size_bytes: None,
                };
            }
        };

        // Step 3: Check if cancelled
        if self.is_cancelled(&conv_id) {
            send_progress(&mut prog, ConversionStatus::Cancelled, 0.0, "转换已取消", None);
            return ConversionResult {
                success: false,
                conversion_id: conv_id,
                output_path: None,
                error: Some("转换已取消".into()),
                duration_ms: start.elapsed().as_millis() as u64,
                original_size_bytes: None,
                result_size_bytes: None,
            };
        }

        // Step 4: Execute the conversion (超时 + 取消双重保护)
        send_progress(&mut prog, ConversionStatus::Converting, 0.3, &format!("转换为 {}...", request.target_format), Some(StageType::Transform));

        // 创建取消 signal：当 cancel() 被调用时，通知执行中的转换
        let (cancel_tx, mut cancel_rx) = tokio::sync::mpsc::unbounded_channel::<()>();
        {
            if let Ok(mut active) = self.active_conversions.lock() {
                // 为当前转换存储 cancel_tx，供 cancel() 调用时发送信号
                if let Some(conv) = active.iter_mut().find(|a: &&mut ActiveConversion| a.id == conv_id) {
                    conv.cancel_tx = Some(cancel_tx);
                }
            }
        }

        let timeout_dur = std::time::Duration::from_secs(300);
        let plugin_fut = plugin.convert(&request, &progress_tx);

        let result = tokio::select! {
            // biased: 优先检查取消信号
            biased;
            _ = cancel_rx.recv() => {
                tracing::warn!(%conv_id, "转换被取消 (hard kill)");
                Err("转换已取消".into())
            }
            res = tokio::time::timeout(timeout_dur, plugin_fut) => {
                match res {
                    Ok(Ok(path)) => Ok(path),
                    Ok(Err(e)) => Err(e),
                    Err(_) => Err("转换超时 (超过5分钟)".into()),
                }
            }
        };

        // Step 5: Postprocess
        send_progress(&mut prog, ConversionStatus::Postprocessing, 0.9, "完成处理...", Some(StageType::Postprocess));

        let duration_ms = start.elapsed().as_millis() as u64;

        // Cleanup active tracking (恢复中毒的 mutex 而非 panic)
        {
            let mut active = self.active_conversions.lock().unwrap_or_else(|e| {
                tracing::warn!("active_conversions mutex 中毒(cleanup)，已恢复");
                e.into_inner()
            });
            active.retain(|a| a.id != conv_id);
        }

        let final_result = match result {
            Ok(output_path) => {
                let original_size = std::fs::metadata(&request.input_path).ok().map(|m| m.len());
                let result_size = std::fs::metadata(&output_path).ok().map(|m| m.len());
                send_progress(&mut prog, ConversionStatus::Completed, 1.0, "转换完成", None);
                ConversionResult {
                    success: true,
                    conversion_id: conv_id,
                    output_path: Some(output_path),
                    error: None,
                    duration_ms,
                    original_size_bytes: original_size,
                    result_size_bytes: result_size,
                }
            }
            Err(e) => {
                send_progress(&mut prog, ConversionStatus::Failed, 0.0, &e, None);
                ConversionResult {
                    success: false,
                    conversion_id: conv_id,
                    output_path: None,
                    error: Some(e),
                    duration_ms,
                    original_size_bytes: None,
                    result_size_bytes: None,
                }
            }
        };

        let _ = progress_tx.send(prog);
        final_result
    }

    /// Cancel an active conversion
    pub fn cancel(&self, conversion_id: &str) -> bool {
        if let Ok(mut active) = self.active_conversions.lock() {
            if let Some(conv) = active.iter_mut().find(|a| a.id == conversion_id) {
                conv.cancelled = true;
                // 发送硬取消信号到 tokio::select!，立即中断执行
                if let Some(tx) = conv.cancel_tx.take() {
                    let _ = tx.send(());
                }
                return true;
            }
        }
        false
    }

    fn is_cancelled(&self, conversion_id: &str) -> bool {
        if let Ok(active) = self.active_conversions.lock() {
            active.iter().any(|a| a.id == conversion_id && a.cancelled)
        } else {
            false
        }
    }

    #[cfg(test)]
    fn active_count(&self) -> usize {
        self.active_conversions.lock().map(|a| a.len()).unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugins::{PluginResult, ConversionPlugin};
    use async_trait::async_trait;
    use std::sync::Arc;
    use std::time::Duration;

    /// A minimal mock plugin used for pipeline integration tests.
    struct MockPlugin;

    #[async_trait]
    impl ConversionPlugin for MockPlugin {
        fn name(&self) -> &'static str {
            "MockPlugin"
        }

        fn source_formats(&self) -> Vec<&'static str> {
            vec!["txt"]
        }

        fn target_formats(&self) -> Vec<&'static str> {
            vec!["html"]
        }

        fn can_convert(&self, source: &str, target: &str) -> bool {
            source == "txt" && target == "html"
        }

        async fn convert(
            &self,
            request: &ConversionRequest,
            _progress_tx: &tokio::sync::mpsc::UnboundedSender<ConversionProgress>,
        ) -> PluginResult {
            let output_path = request
                .output_path
                .clone()
                .unwrap_or_else(|| "output.html".to_string());
            std::fs::write(&output_path, "<p>hello</p>")
                .map_err(|e| format!("write failed: {}", e))?;
            Ok(output_path)
        }
    }

    /// Create a temporary test directory that auto-cleans on drop.
    struct TempDir(std::path::PathBuf);

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn test_dir() -> (std::path::PathBuf, TempDir) {
        let dir = std::env::temp_dir().join(format!(
            "pipeline_test_{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let p = dir.clone();
        (p, TempDir(dir))
    }

    // -----------------------------------------------------------------------
    //  Success path
    // -----------------------------------------------------------------------
    #[tokio::test]
    async fn test_execute_success() {
        let (base, _guard) = test_dir();
        let input = base.join("input.txt");
        let output = base.join("output.html");
        std::fs::write(&input, "hello world").unwrap();

        let mut reg = PluginRegistry::new();
        reg.register(Box::new(MockPlugin));
        let registry = Arc::new(reg);
        let pipeline = ConversionPipeline::new(registry);

        let (tx, _rx) = tokio::sync::mpsc::unbounded_channel();
        let request = ConversionRequest {
            id: uuid::Uuid::new_v4().to_string(),
            source_format: "txt".into(),
            target_format: "html".into(),
            input_path: input.to_str().unwrap().to_string(),
            output_path: Some(output.to_str().unwrap().to_string()),
            options: None,
        };

        let result = pipeline.execute(request, tx).await;
        assert!(
            result.success,
            "expected success, got error: {:?}",
            result.error
        );
        assert!(result.output_path.is_some(), "output_path should be set");
        assert!(result.error.is_none(), "error should be None on success");
        assert!(result.duration_ms > 0, "duration should be positive");
        assert!(
            std::fs::metadata(output).is_ok(),
            "output file should exist"
        );

        // active_conversions should be cleaned up after execution
        assert_eq!(pipeline.active_count(), 0);
    }

    // -----------------------------------------------------------------------
    //  Input file not found
    // -----------------------------------------------------------------------
    #[tokio::test]
    async fn test_execute_input_not_found() {
        let registry = Arc::new(PluginRegistry::new());
        let pipeline = ConversionPipeline::new(registry);
        let (tx, _rx) = tokio::sync::mpsc::unbounded_channel();

        let request = ConversionRequest::new(
            "txt".into(),
            "html".into(),
            "/nonexistent/path/input.txt".into(),
        );

        let result = pipeline.execute(request, tx).await;
        assert!(!result.success);
        assert_eq!(result.error.as_deref(), Some("输入文件不存在"));
        assert!(result.output_path.is_none());
    }

    // -----------------------------------------------------------------------
    //  No matching plugin
    // -----------------------------------------------------------------------
    #[tokio::test]
    async fn test_execute_no_plugin() {
        let (base, _guard) = test_dir();
        let input = base.join("input.txt");
        std::fs::write(&input, "hello").unwrap();

        // Empty registry – no plugins registered
        let registry = Arc::new(PluginRegistry::new());
        let pipeline = ConversionPipeline::new(registry);
        let (tx, _rx) = tokio::sync::mpsc::unbounded_channel();

        let request = ConversionRequest::new(
            "txt".into(),
            "html".into(),
            input.to_str().unwrap().to_string(),
        );

        let result = pipeline.execute(request, tx).await;
        assert!(!result.success);
        let err = result.error.as_deref().unwrap();
        assert!(
            err.contains("不支持的转换"),
            "expected unsupported conversion error, got: {}",
            err
        );
    }

    // -----------------------------------------------------------------------
    //  Cancel an active conversion (best-effort timing based)
    // -----------------------------------------------------------------------
    #[tokio::test]
    async fn test_execute_cancelled() {
        let (base, _guard) = test_dir();
        let input = base.join("input.txt");
        let output = base.join("output.html");
        std::fs::write(&input, "hello").unwrap();

        let mut reg = PluginRegistry::new();
        reg.register(Box::new(MockPlugin));
        let registry = Arc::new(reg);
        let pipeline = Arc::new(ConversionPipeline::new(registry));

        let (tx, _rx) = tokio::sync::mpsc::unbounded_channel();
        let request = ConversionRequest {
            id: uuid::Uuid::new_v4().to_string(),
            source_format: "txt".into(),
            target_format: "html".into(),
            input_path: input.to_str().unwrap().to_string(),
            output_path: Some(output.to_str().unwrap().to_string()),
            options: None,
        };
        let conv_id = request.id.clone();

        let pipeline_clone = pipeline.clone();
        let handle = tokio::spawn(async move {
            pipeline_clone.execute(request, tx).await
        });

        // Allow the spawned task to register the conversion.
        tokio::time::sleep(Duration::from_millis(20)).await;

        // Cancel the conversion (should succeed if registered).
        let cancelled = pipeline.cancel(&conv_id);
        assert!(cancelled, "cancel should succeed for active conversion");

        let result = handle.await.unwrap();

        // Due to the synchronous execution path between registering the
        // conversion and the cancellation check, the conversion may complete
        // before cancellation takes effect. In either case the pipeline
        // returns a well-formed result without panicking.
        if result.success {
            // Conversion completed before the cancellation check.
            assert!(result.output_path.is_some());
            assert!(std::fs::metadata(output).is_ok());
        } else {
            // Conversion was cancelled.
            assert_eq!(result.error.as_deref(), Some("转换已取消"));
        }
    }

    // -----------------------------------------------------------------------
    //  Cancel returns false for unknown / non-existent id
    // -----------------------------------------------------------------------
    #[test]
    fn test_cancel_nonexistent() {
        let registry = Arc::new(PluginRegistry::new());
        let pipeline = ConversionPipeline::new(registry);
        assert!(!pipeline.cancel("i-do-not-exist"));
    }
}
