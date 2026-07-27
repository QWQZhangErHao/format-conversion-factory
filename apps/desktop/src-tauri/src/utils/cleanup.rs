/// Startup temp file GC — cleans leftover temp files from previous runs.
///
/// Drop guards (TempFileGuard) are reliable for normal shutdowns, but
/// SIGKILL or power loss can leave garbage in the temp directory.
/// This module scans the app's temp directory on startup and removes
/// files older than 24 hours.

/// Max age for temp files before they're considered stale (24 hours)
const MAX_AGE_SECS: u64 = 24 * 60 * 60;

/// Get the app's temp directory path
pub fn app_temp_dir() -> std::path::PathBuf {
    std::env::temp_dir().join("format-conversion-factory")
}

/// Clean up stale files in the app temp directory.
/// Called once at app startup.
pub fn cleanup_stale_temp_files() {
    let dir = app_temp_dir();
    if !dir.exists() {
        return;
    }

    let now = std::time::SystemTime::now();
    let mut cleaned = 0u64;
    let mut errors = 0u64;

    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();

            // 跳过目录（只清理文件）
            if path.is_dir() {
                // 递归清理子目录
                if let Ok(sub) = std::fs::read_dir(&path) {
                    for sub_entry in sub.flatten() {
                        if let Ok(meta) = sub_entry.metadata() {
                            if let Ok(modified) = meta.modified() {
                                if let Ok(age) = now.duration_since(modified) {
                                    if age.as_secs() > MAX_AGE_SECS {
                                        let _ = std::fs::remove_file(sub_entry.path());
                                        cleaned += 1;
                                    }
                                }
                            }
                        }
                    }
                }
                // 删除空目录
                let _ = std::fs::remove_dir(&path);
                continue;
            }

            // 检查文件修改时间
            let meta = match std::fs::metadata(&path) {
                Ok(m) => m,
                Err(_) => { errors += 1; continue; }
            };

            let modified = match meta.modified() {
                Ok(t) => t,
                Err(_) => { errors += 1; continue; }
            };

            match now.duration_since(modified) {
                Ok(age) if age.as_secs() > MAX_AGE_SECS => {
                    if std::fs::remove_file(&path).is_ok() {
                        cleaned += 1;
                    } else {
                        errors += 1;
                    }
                }
                _ => {} // 未过期的保留
            }
        }
    }

    if cleaned > 0 || errors > 0 {
        tracing::info!(
            "[Cleanup] 临时文件清理: {} 已删除, {} 失败",
            cleaned, errors
        );
    }
}
