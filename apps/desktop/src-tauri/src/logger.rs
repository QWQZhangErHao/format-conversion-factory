use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;
use tracing_appender::rolling;
use tracing_subscriber::filter::EnvFilter;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::Registry;

static LOG_INIT: OnceLock<()> = OnceLock::new();
static LOG_GUARD: OnceLock<tracing_appender::non_blocking::WorkerGuard> = OnceLock::new();

/// Log directory path — uses Tauri data dir if available, falls back to temp
fn log_dir() -> PathBuf {
    // Try Tauri path resolver first
    if let Ok(var) = std::env::var("TAURI_APP_DATA_DIR") {
        let path = PathBuf::from(var).join("logs");
        fs::create_dir_all(&path).ok();
        return path;
    }
    // Fallback: temp directory
    let mut dir = std::env::temp_dir();
    dir.push("format-conversion-factory");
    dir.push("logs");
    fs::create_dir_all(&dir).ok();
    dir
}

/// Initialize the logging system.
/// Call once at app startup.
pub fn init() {
    LOG_INIT.get_or_init(|| {
        let log_path = log_dir();
        let file_appender = rolling::daily(log_path, "app.log");
        let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);
        let _ = LOG_GUARD.set(guard);

        let subscriber = Registry::default()
            .with(
                EnvFilter::try_from_default_env()
                    .unwrap_or_else(|_| EnvFilter::new("info")),
            )
            .with(
                tracing_subscriber::fmt::layer()
                    .with_writer(std::io::stderr)
                    .with_ansi(true)
                    .with_target(true)
                    .with_thread_ids(true)
                    .with_file(true)
                    .with_line_number(true)
                    .compact(),
            )
            .with(
                tracing_subscriber::fmt::layer()
                    .with_writer(non_blocking)
                    .with_ansi(false)
                    .with_target(true)
                    .with_thread_ids(true)
                    .with_file(true)
                    .with_line_number(true)
                    .json()
                    .with_current_span(true)
                    .with_span_list(true),
            );

        tracing::subscriber::set_global_default(subscriber)
            .expect("Failed to set global logger");

        tracing::info!("日志系统初始化完成");
        tracing::info!("日志目录: {:?}", log_dir());
    });
}

/// Get the current log file path
pub fn current_log_path() -> Option<PathBuf> {
    let dir = log_dir();
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let path = dir.join(format!("app.log.{}", today));
    if path.exists() { Some(path) } else { None }
}

/// Collect recent log entries (last N lines) from the current log file
pub fn recent_logs(n: usize) -> Vec<String> {
    let path = match current_log_path() {
        Some(p) => p,
        None => return vec!["(日志文件尚未生成)".into()],
    };

    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(e) => return vec![format!("(读取日志失败: {})", e)],
    };

    content.lines().rev().take(n).map(|l| l.to_string()).collect::<Vec<_>>()
}

/// Log an event with structured fields
#[macro_export]
macro_rules! log_event {
    ($level:ident, $msg:expr) => {
        tracing::$level!($msg)
    };
    ($level:ident, $msg:expr, $($key:ident = $val:expr),*) => {
        tracing::$level!($msg, $($key = $val),*)
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_log_dir_creation() {
        let dir = log_dir();
        assert!(dir.extension().is_none() || dir.to_string_lossy().contains("logs"));
    }

    #[test]
    fn test_log_init_once() {
        // Should not panic
        init();
        init(); // second call should be no-op
        tracing::info!("test log message");
    }

    #[test]
    fn test_recent_logs_no_panic() {
        let logs = recent_logs(10);
        assert!(!logs.is_empty());
    }
}
