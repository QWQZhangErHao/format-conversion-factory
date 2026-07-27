/// RAII Temp File Guard — ensures temporary files are cleaned up
/// when the guard goes out of scope, even if the caller panics.
///
/// Usage:
///   let _guard = TempFileGuard::new(&temp_path)?;
///   // ... do work ...
///   // file auto-deleted when _guard drops
///
/// To keep the file on success, call `.keep()` before the guard drops.

use std::path::{Path, PathBuf};

pub struct TempFileGuard {
    path: Option<PathBuf>,
    label: String,
}

impl TempFileGuard {
    /// Create a new guard for a temp file path.
    /// Returns Ok(guard) if the path is valid.
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self {
            path: Some(path.into()),
            label: String::new(),
        }
    }

    /// Create with a label for logging
    pub fn new_with_label(path: impl Into<PathBuf>, label: impl Into<String>) -> Self {
        Self {
            path: Some(path.into()),
            label: label.into(),
        }
    }

    /// Get the underlying path
    pub fn path(&self) -> Option<&Path> {
        self.path.as_deref()
    }

    /// Mark the file to be kept (don't delete on drop)
    pub fn keep(&mut self) {
        self.path = None;
    }

    /// Explicitly delete the temp file now (before drop)
    pub fn delete_now(&mut self) -> std::io::Result<()> {
        if let Some(ref p) = self.path {
            if p.exists() {
                std::fs::remove_file(p)?;
                let label = if self.label.is_empty() { "" } else { &self.label };
                tracing::debug!("[TempGuard] 已清理临时文件{}: {:?}", label, p);
            }
        }
        self.path = None;
        Ok(())
    }
}

impl Drop for TempFileGuard {
    fn drop(&mut self) {
        if let Some(ref p) = self.path {
            if p.exists() {
                let _ = std::fs::remove_file(p);
                let label = if self.label.is_empty() { "" } else { &self.label };
                tracing::debug!("[TempGuard] Drop 时清理临时文件{}: {:?}", label, p);
            }
        }
    }
}

/// Multiple temp file guard — cleans up a set of files
pub struct TempDirGuard {
    dir: Option<PathBuf>,
}

impl TempDirGuard {
    pub fn new(dir: impl Into<PathBuf>) -> Self {
        Self { dir: Some(dir.into()) }
    }

    pub fn keep(&mut self) {
        self.dir = None;
    }
}

impl Drop for TempDirGuard {
    fn drop(&mut self) {
        if let Some(ref d) = self.dir {
            if d.exists() {
                let _ = std::fs::remove_dir_all(d);
                tracing::debug!("[TempGuard] Drop 时清理临时目录: {:?}", d);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_temp_guard_deletes_on_drop() {
        let path = std::env::temp_dir().join("test_guard_delete.txt");
        fs::write(&path, "test content").unwrap();
        assert!(path.exists());

        {
            let _guard = TempFileGuard::new(path.clone());
            // guard drops here → file should be deleted
        }

        assert!(!path.exists(), "文件应在 guard drop 后删除");
    }

    #[test]
    fn test_temp_guard_keep() {
        let path = std::env::temp_dir().join("test_guard_keep.txt");
        fs::write(&path, "test content").unwrap();

        {
            let mut guard = TempFileGuard::new(path.clone());
            guard.keep();
            // guard drops here but file should survive
        }

        assert!(path.exists(), "文件应在 keep() 后保留");
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn test_temp_guard_delete_now() {
        let path = std::env::temp_dir().join("test_guard_delete_now.txt");
        fs::write(&path, "test content").unwrap();

        {
            let mut guard = TempFileGuard::new(path.clone());
            guard.delete_now().unwrap();
            assert!(!path.exists(), "delete_now 应立即删除");
            // guard drops here, file already gone — no error
        }
    }
}
