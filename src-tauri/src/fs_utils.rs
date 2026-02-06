use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tempfile::NamedTempFile;

/// Validates that a path is within the workspace.
/// For existing paths: canonicalize and check starts_with.
/// For new paths (create/write): canonicalize parent and check.
///
/// # Arguments
/// * `path` - The path to validate
/// * `workspace` - The workspace root path
/// * `must_exist` - If true, the path must exist; if false, only parent must exist
pub(crate) fn validate_in_workspace(path: &str, workspace: &str, must_exist: bool) -> Result<(), String> {
    let workspace_canonical = std::fs::canonicalize(workspace)
        .map_err(|e| format!("Cannot resolve workspace: {}", e))?;

    if must_exist {
        // Path must exist - canonicalize it directly
        let path_canonical = std::fs::canonicalize(path)
            .map_err(|e| format!("Cannot resolve path: {}", e))?;
        if !path_canonical.starts_with(&workspace_canonical) {
            return Err("Path is outside workspace".to_string());
        }
    } else {
        // Path may not exist - canonicalize parent directory
        let target = Path::new(path);
        let parent = target.parent()
            .ok_or("Invalid path: no parent directory")?;

        // Parent must exist for us to validate
        let parent_canonical = std::fs::canonicalize(parent)
            .map_err(|e| format!("Cannot resolve parent directory: {}", e))?;

        if !parent_canonical.starts_with(&workspace_canonical) {
            return Err("Path is outside workspace".to_string());
        }
    }
    Ok(())
}

/// Atomic write helper - writes to temp file then renames.
/// Uses backup-on-delete pattern for crash safety on Windows.
///
/// Strategy for Windows compatibility (persist() doesn't overwrite):
/// 1. Rename existing file to .jot-bak (if it exists)
/// 2. Persist new temp file to target
/// 3. Delete backup on success
///
/// Recovery: If crash occurs between steps 1 and 2, user can manually
/// rename .jot-bak back to the original file.
pub(crate) fn atomic_write(path: &str, content: &str) -> Result<(), String> {
    let target = Path::new(path);
    let parent = target.parent()
        .ok_or("Invalid path: no parent directory")?;

    fs::create_dir_all(parent)
        .map_err(|e| format!("Failed to create directories: {}", e))?;

    // Create temp file in same directory for atomic rename
    let mut temp = NamedTempFile::new_in(parent)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    temp.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write content: {}", e))?;

    // Flush to ensure all data is written
    temp.flush()
        .map_err(|e| format!("Failed to flush content: {}", e))?;

    // Sync to disk before persist - ensures data survives power failure
    temp.as_file().sync_data()
        .map_err(|e| format!("Failed to sync to disk: {}", e))?;

    // Windows compatibility: persist() doesn't overwrite existing files.
    // Use backup pattern for crash safety:
    // 1. Rename existing to .jot-bak (if exists)
    // 2. Persist new file
    // 3. Delete backup on success
    let mut backup_name = target.as_os_str().to_os_string();
    backup_name.push(".jot-bak");
    let backup = PathBuf::from(backup_name);
    let had_backup = if target.exists() {
        // Remove any stale backup first
        let _ = fs::remove_file(&backup);
        // Rename current file to backup - fail fast if this fails
        fs::rename(target, &backup)
            .map_err(|e| format!("Failed to create backup: {}", e))?;
        true
    } else {
        false
    };

    let result = temp.persist(target)
        .map_err(|e| format!("Failed to persist file: {}", e));

    if result.is_ok() && had_backup {
        // Clean up backup on success
        let _ = fs::remove_file(&backup);
    } else if result.is_err() && had_backup {
        // Restore backup on failure to prevent data loss
        if let Err(restore_err) = fs::rename(&backup, target) {
            return Err(format!(
                "Failed to save file AND restore backup. Your data is at: {}. Restore error: {}",
                backup.display(), restore_err
            ));
        }
    }

    result.map(|_| ())
}

/// Check if a file is hidden (cross-platform)
/// On Unix: checks for dot-prefix names
/// On Windows: also checks FILE_ATTRIBUTE_HIDDEN flag
pub(crate) fn is_hidden_file(entry: &std::fs::DirEntry) -> bool {
    let name = entry.file_name().to_string_lossy().to_string();

    // Unix convention: dot-prefix (also applies on Windows for consistency)
    if name.starts_with('.') {
        return true;
    }

    // Windows: check hidden attribute
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_HIDDEN: u32 = 0x02;

        if let Ok(metadata) = entry.metadata() {
            if metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0 {
                return true;
            }
        }
    }

    false
}

/// Check if a filename has a markdown extension (case-insensitive).
/// Accepts .md, .MD, .Md, etc.
pub(crate) fn is_markdown_file(name: &str) -> bool {
    name.to_lowercase().ends_with(".md")
}

/// Represents a file or folder in the file tree
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_markdown: bool,
    pub modified: Option<i64>, // Unix timestamp
    pub children: Option<Vec<FileEntry>>,
}

/// Result of delete operation, includes optional warning
#[derive(serde::Serialize)]
pub struct DeleteResult {
    pub warning: Option<String>,
}

/// Returns true if the filesystem is case-sensitive.
/// Linux filesystems are typically case-sensitive, while Windows and macOS are case-insensitive.
/// This is used for link resolution to match the correct file on each platform.
pub(crate) fn detect_case_sensitivity(workspace_path: &Path) -> Result<bool, String> {
    if !workspace_path.exists() || !workspace_path.is_dir() {
        return Err("Invalid workspace path".to_string());
    }

    let pid = std::process::id();

    for attempt in 0..5 {
        let name = format!(".jot-case-test-{}-{}", pid, attempt);
        let alt_name = name.to_uppercase();

        if name == alt_name {
            continue;
        }

        let path = workspace_path.join(&name);
        let alt_path = workspace_path.join(&alt_name);

        if path.exists() || alt_path.exists() {
            continue;
        }

        fs::write(&path, "").map_err(|e| format!("Failed to create test file: {}", e))?;
        let alt_exists = alt_path.exists();
        let _ = fs::remove_file(&path);

        return Ok(!alt_exists);
    }

    Err("Unable to determine filesystem case sensitivity".to_string())
}
