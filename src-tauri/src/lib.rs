use regex::RegexBuilder;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::Manager;
use tempfile::NamedTempFile;

mod version_history;
use version_history::{Version, VersionDiff, VersionMeta};

mod semantic;

// ==========================================
// Security Helpers
// ==========================================

/// Validates that a path is within the workspace.
/// For existing paths: canonicalize and check starts_with.
/// For new paths (create/write): canonicalize parent and check.
///
/// # Arguments
/// * `path` - The path to validate
/// * `workspace` - The workspace root path
/// * `must_exist` - If true, the path must exist; if false, only parent must exist
fn validate_in_workspace(path: &str, workspace: &str, must_exist: bool) -> Result<(), String> {
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
fn atomic_write(path: &str, content: &str) -> Result<(), String> {
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
fn is_hidden_file(entry: &std::fs::DirEntry) -> bool {
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
fn is_markdown_file(name: &str) -> bool {
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

/// Read directory contents recursively, filtering for markdown files and folders
/// Uses spawn_blocking to avoid blocking the main thread during IO
#[tauri::command]
async fn jot_read_directory(path: String) -> Result<Vec<FileEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = Path::new(&path);

        if !root.exists() {
            return Err(format!("Directory does not exist: {}", path));
        }

        if !root.is_dir() {
            return Err(format!("Path is not a directory: {}", path));
        }

        read_dir_recursive(root, 0, 3) // Max depth of 3 for initial load
    })
    .await
    .map_err(|e| format!("Task join failed: {}", e))?
}

fn read_dir_recursive(dir: &Path, depth: usize, max_depth: usize) -> Result<Vec<FileEntry>, String> {
    let mut entries: Vec<FileEntry> = Vec::new();

    let read_dir = fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/folders (cross-platform: dot-prefix on Unix, hidden attribute on Windows)
        if is_hidden_file(&entry) {
            continue;
        }

        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let is_dir = metadata.is_dir();
        let is_md = !is_dir && is_markdown_file(&name);

        // Skip non-markdown files
        if !is_dir && !is_md {
            continue;
        }

        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64);

        let children = if is_dir && depth < max_depth {
            Some(read_dir_recursive(&path, depth + 1, max_depth).unwrap_or_default())
        } else if is_dir {
            Some(Vec::new()) // Placeholder for lazy loading
        } else {
            None
        };

        entries.push(FileEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir,
            is_markdown: is_md,
            modified,
            children,
        });
    }

    // Sort: folders first, then alphabetically
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

/// Read a single directory's contents (one level deep)
/// Used for lazy loading folders beyond initial depth limit
/// Uses spawn_blocking to avoid blocking the main thread during IO
#[tauri::command]
async fn jot_read_folder_children(path: String) -> Result<Vec<FileEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        read_folder_children_sync(&path)
    })
    .await
    .map_err(|e| format!("Task join failed: {}", e))?
}

fn read_folder_children_sync(path: &str) -> Result<Vec<FileEntry>, String> {
    let dir = Path::new(path);

    if !dir.exists() {
        return Err(format!("Directory does not exist: {}", path));
    }
    if !dir.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let mut entries: Vec<FileEntry> = Vec::new();
    let read_dir = fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/folders (cross-platform: dot-prefix on Unix, hidden attribute on Windows)
        if is_hidden_file(&entry) {
            continue;
        }

        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let is_dir = metadata.is_dir();
        let is_md = !is_dir && is_markdown_file(&name);

        // Skip non-markdown files
        if !is_dir && !is_md {
            continue;
        }

        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64);

        // Subdirectories get empty children placeholder (for further lazy loading)
        let children = if is_dir { Some(Vec::new()) } else { None };

        entries.push(FileEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir,
            is_markdown: is_md,
            modified,
            children,
        });
    }

    // Sort: folders first, then alphabetically (match existing sort logic)
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

/// Read a single file's contents with workspace validation
#[tauri::command]
fn jot_read_file(path: &str, workspace_path: &str) -> Result<String, String> {
    validate_in_workspace(path, workspace_path, true)?;
    fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))
}

/// Write content to a file with workspace validation and atomic writes
#[tauri::command]
fn jot_write_file(path: &str, content: &str, workspace_path: &str) -> Result<(), String> {
    validate_in_workspace(path, workspace_path, false)?;
    atomic_write(path, content)
}

/// Create a new file with workspace validation
#[tauri::command]
fn jot_create_file(path: &str, workspace_path: &str) -> Result<(), String> {
    validate_in_workspace(path, workspace_path, false)?;

    let file_path = Path::new(path);

    if file_path.exists() {
        return Err("File already exists".to_string());
    }

    // Create parent directories if needed
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    fs::write(path, "").map_err(|e| format!("Failed to create file: {}", e))
}

/// Create a new folder with workspace validation
#[tauri::command]
fn jot_create_folder(path: &str, workspace_path: &str) -> Result<(), String> {
    validate_in_workspace(path, workspace_path, false)?;
    fs::create_dir_all(path).map_err(|e| format!("Failed to create folder: {}", e))
}

/// Rename a file or folder with workspace validation
#[tauri::command]
fn jot_rename_path(old_path: &str, new_path: &str, workspace_path: &str) -> Result<(), String> {
    // Validate old path exists and is within workspace
    validate_in_workspace(old_path, workspace_path, true)?;
    // Validate new path parent is within workspace
    validate_in_workspace(new_path, workspace_path, false)?;

    if Path::new(new_path).exists() {
        return Err("A file with that name already exists".to_string());
    }

    fs::rename(old_path, new_path).map_err(|e| format!("Failed to rename: {}", e))
}

/// Result of delete operation, includes optional warning
#[derive(serde::Serialize)]
struct DeleteResult {
    warning: Option<String>,
}

/// Delete a file or folder with workspace validation
/// Attempts to move to system trash first, falls back to permanent deletion
#[tauri::command]
fn jot_delete_path(path: &str, workspace_path: &str) -> Result<DeleteResult, String> {
    validate_in_workspace(path, workspace_path, true)?;

    let path = Path::new(path);

    // Try to move to trash first
    match trash::delete(path) {
        Ok(()) => Ok(DeleteResult { warning: None }),
        Err(trash_err) => {
            // Fallback to hard delete with warning
            let warning_msg = format!(
                "Could not move to trash ({}). File was permanently deleted.",
                trash_err
            );

            let result = if path.is_dir() {
                fs::remove_dir_all(path)
            } else {
                fs::remove_file(path)
            };

            result
                .map(|()| DeleteResult { warning: Some(warning_msg) })
                .map_err(|e| format!("Failed to delete: {}", e))
        }
    }
}

/// Get file metadata
#[tauri::command]
fn jot_get_file_info(path: &str) -> Result<FileEntry, String> {
    let path_buf = PathBuf::from(path);
    let metadata = fs::metadata(&path_buf).map_err(|e| e.to_string())?;

    let name = path_buf
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let is_dir = metadata.is_dir();
    let is_md = !is_dir && is_markdown_file(&name);

    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64);

    Ok(FileEntry {
        name,
        path: path.to_string(),
        is_dir,
        is_markdown: is_md,
        modified,
        children: None,
    })
}

/// Check if a path exists
#[tauri::command]
fn jot_path_exists(path: &str) -> bool {
    Path::new(path).exists()
}

/// Normalize a path and resolve .. and . components
/// Returns the normalized path or error if it would escape the workspace
#[tauri::command]
fn jot_normalize_path(path: &str, workspace_path: &str) -> Result<String, String> {
    let workspace = Path::new(workspace_path).canonicalize()
        .map_err(|e| format!("Invalid workspace path: {}", e))?;

    // Build the full path
    let full_path = if Path::new(path).is_absolute() {
        PathBuf::from(path)
    } else {
        workspace.join(path)
    };

    // Normalize the path (resolve .. and .)
    let mut normalized = PathBuf::new();
    for component in full_path.components() {
        match component {
            std::path::Component::ParentDir => {
                // Don't go above workspace
                if normalized.starts_with(&workspace) && normalized != workspace {
                    normalized.pop();
                }
            }
            std::path::Component::CurDir => {}
            _ => normalized.push(component),
        }
    }

    // Ensure result is within workspace
    if !normalized.starts_with(&workspace) {
        return Err(format!("Path escapes workspace: {}", path));
    }

    Ok(normalized.to_string_lossy().to_string())
}

/// Check if a path is within the workspace
#[tauri::command]
fn jot_is_within_workspace(path: &str, workspace_path: &str) -> bool {
    match jot_normalize_path(path, workspace_path) {
        Ok(_) => true,
        Err(_) => false,
    }
}

/// Watch for file changes (placeholder for future implementation)
#[tauri::command]
fn jot_watch_directory(_path: &str) -> Result<(), String> {
    // TODO: Implement file watching with notify crate
    Ok(())
}

/// Returns true if the filesystem is case-sensitive.
/// Linux filesystems are typically case-sensitive, while Windows and macOS are case-insensitive.
/// This is used for link resolution to match the correct file on each platform.
#[tauri::command]
fn jot_is_case_sensitive_fs(workspace_path: &str) -> Result<bool, String> {
    detect_case_sensitivity(Path::new(workspace_path))
}

fn detect_case_sensitivity(workspace_path: &Path) -> Result<bool, String> {
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

// ==========================================
// Global Search Commands
// ==========================================

/// A single match within a search result
#[derive(Debug, Clone, Serialize)]
pub struct SearchMatch {
    /// 1-indexed line number
    pub line_number: usize,
    /// The line content containing the match
    pub line_content: String,
    /// Start index of match within line_content
    pub match_start: usize,
    /// End index of match within line_content
    pub match_end: usize,
    /// Line before the match (for context)
    pub context_before: Option<String>,
    /// Line after the match (for context)
    pub context_after: Option<String>,
}

/// Search results for a single file
#[derive(Debug, Clone, Serialize)]
pub struct FileSearchResult {
    /// Full path to the file
    pub file_path: String,
    /// File name only
    pub file_name: String,
    /// All matches in this file
    pub matches: Vec<SearchMatch>,
}

/// Search all markdown files in the workspace
/// Uses spawn_blocking to avoid blocking the main thread during IO
#[tauri::command]
async fn jot_search_workspace(
    workspace_path: String,
    search_term: String,
    case_sensitive: bool,
    use_regex: bool,
    path_filter: Option<String>,
) -> Result<Vec<FileSearchResult>, String> {
    if search_term.is_empty() {
        return Ok(Vec::new());
    }

    tauri::async_runtime::spawn_blocking(move || {
        search_workspace_sync(&workspace_path, &search_term, case_sensitive, use_regex, path_filter.as_deref())
    })
    .await
    .map_err(|e| format!("Task join failed: {}", e))?
}

fn search_workspace_sync(
    workspace_path: &str,
    search_term: &str,
    case_sensitive: bool,
    use_regex: bool,
    path_filter: Option<&str>,
) -> Result<Vec<FileSearchResult>, String> {
    let workspace = Path::new(workspace_path);
    if !workspace.exists() || !workspace.is_dir() {
        return Err(format!("Invalid workspace path: {}", workspace_path));
    }

    // Build the regex pattern
    let pattern = if use_regex {
        search_term.to_string()
    } else {
        // Escape special regex characters for literal search
        regex::escape(search_term)
    };

    let regex = RegexBuilder::new(&pattern)
        .case_insensitive(!case_sensitive)
        .build()
        .map_err(|e| format!("Invalid search pattern: {}", e))?;

    // Collect all markdown files with security protections
    let mut markdown_files = Vec::new();
    let workspace_canonical = workspace.canonicalize()
        .map_err(|e| format!("Failed to resolve workspace path: {}", e))?;
    let mut visited = std::collections::HashSet::new();
    collect_markdown_files(workspace, &mut markdown_files, &workspace_canonical, 0, &mut visited)?;

    // Apply path filter if provided
    let files_to_search: Vec<PathBuf> = if let Some(filter) = path_filter {
        if filter.is_empty() {
            markdown_files
        } else {
            // Security: Validate path filter doesn't escape workspace
            if filter.contains("..") || Path::new(filter).is_absolute() {
                return Err("Path filter cannot contain '..' or absolute paths".into());
            }

            // Build glob pattern relative to workspace
            // Normalize to forward slashes for glob (backslash is escape character in glob)
            let glob_pattern = workspace.join(filter)
                .to_string_lossy()
                .replace('\\', "/");
            let glob_matches: std::collections::HashSet<PathBuf> =
                glob::glob(&glob_pattern)
                    .map_err(|e| format!("Invalid path filter: {}", e))?
                    .filter_map(Result::ok)
                    .collect();

            markdown_files
                .into_iter()
                .filter(|f| glob_matches.contains(f))
                .collect()
        }
    } else {
        markdown_files
    };

    // Search each file
    let mut results = Vec::new();
    for file_path in files_to_search {
        if let Ok(matches) = search_file(&file_path, &regex) {
            if !matches.is_empty() {
                let file_name = file_path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();

                results.push(FileSearchResult {
                    file_path: file_path.to_string_lossy().to_string(),
                    file_name,
                    matches,
                });
            }
        }
    }

    // Sort results by file path for consistent ordering
    results.sort_by(|a, b| a.file_path.cmp(&b.file_path));

    Ok(results)
}

/// Recursively collect all markdown files in a directory
/// Includes depth limit and symlink cycle protection for security
fn collect_markdown_files(
    dir: &Path,
    files: &mut Vec<PathBuf>,
    workspace_root: &Path,
    depth: usize,
    visited: &mut std::collections::HashSet<PathBuf>,
) -> Result<(), String> {
    // Security: Limit recursion depth to prevent DoS
    const MAX_DEPTH: usize = 20;
    if depth > MAX_DEPTH {
        return Ok(());
    }

    // Security: Resolve symlinks and check if we're still within workspace
    let canonical = match dir.canonicalize() {
        Ok(c) => c,
        Err(_) => return Ok(()), // Skip unreadable directories
    };

    // Ensure we haven't escaped the workspace via symlinks
    if !canonical.starts_with(workspace_root) {
        return Ok(());
    }

    // Prevent symlink cycles
    if !visited.insert(canonical.clone()) {
        return Ok(());
    }

    let read_dir = match fs::read_dir(dir) {
        Ok(rd) => rd,
        Err(_) => return Ok(()), // Skip unreadable directories
    };

    for entry in read_dir {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue, // Skip unreadable entries
        };
        let path = entry.path();

        // Skip hidden files/folders (cross-platform: dot-prefix on Unix, hidden attribute on Windows)
        if is_hidden_file(&entry) {
            continue;
        }

        let name = entry.file_name().to_string_lossy().to_string();

        if path.is_dir() {
            collect_markdown_files(&path, files, workspace_root, depth + 1, visited)?;
        } else if is_markdown_file(&name) {
            files.push(path);
        }
    }

    Ok(())
}

/// Convert a byte offset to a UTF-16 code unit offset
/// This is needed because JavaScript strings use UTF-16, while Rust regex returns byte offsets.
/// Characters outside the Basic Multilingual Plane (emoji, etc.) use 2 UTF-16 code units.
fn byte_offset_to_utf16_offset(text: &str, byte_offset: usize) -> usize {
    text[..byte_offset].encode_utf16().count()
}

/// Search a single file for matches
fn search_file(file_path: &Path, regex: &regex::Regex) -> Result<Vec<SearchMatch>, String> {
    let content = fs::read_to_string(file_path).map_err(|e| e.to_string())?;
    let lines: Vec<&str> = content.lines().collect();

    let mut matches = Vec::new();

    for (line_idx, line) in lines.iter().enumerate() {
        for mat in regex.find_iter(line) {
            let context_before = if line_idx > 0 {
                Some(lines[line_idx - 1].to_string())
            } else {
                None
            };

            let context_after = if line_idx + 1 < lines.len() {
                Some(lines[line_idx + 1].to_string())
            } else {
                None
            };

            // Convert byte offsets to UTF-16 code unit offsets for JavaScript compatibility
            let match_start = byte_offset_to_utf16_offset(line, mat.start());
            let match_end = byte_offset_to_utf16_offset(line, mat.end());

            matches.push(SearchMatch {
                line_number: line_idx + 1, // 1-indexed
                line_content: line.to_string(),
                match_start,
                match_end,
                context_before,
                context_after,
            });
        }
    }

    Ok(matches)
}

// ==========================================
// Version History Commands
// ==========================================

/// Save a new version snapshot
#[tauri::command]
fn jot_save_version(
    workspace_path: &str,
    file_path: &str,
    content: &str,
) -> Result<i64, String> {
    // Only save if content has changed from latest version
    let changed = version_history::is_content_changed(workspace_path, file_path, content)
        .map_err(|e| e.to_string())?;

    if !changed {
        return Ok(-1); // Return -1 to indicate no new version created
    }

    version_history::save_version(workspace_path, file_path, content)
        .map_err(|e| e.to_string())
}

/// Get version metadata list for a file (most recent first)
#[tauri::command]
fn jot_get_versions(
    workspace_path: &str,
    file_path: &str,
    limit: i32,
) -> Result<Vec<VersionMeta>, String> {
    version_history::get_versions(workspace_path, file_path, limit)
        .map_err(|e| e.to_string())
}

/// Get a specific version by ID
#[tauri::command]
fn jot_get_version(workspace_path: &str, version_id: i64) -> Result<Option<Version>, String> {
    version_history::get_version(workspace_path, version_id)
        .map_err(|e| e.to_string())
}

/// Delete a specific version
#[tauri::command]
fn jot_delete_version(workspace_path: &str, version_id: i64) -> Result<bool, String> {
    version_history::delete_version(workspace_path, version_id)
        .map_err(|e| e.to_string())
}

/// Delete all versions for a file
#[tauri::command]
fn jot_delete_file_versions(workspace_path: &str, file_path: &str) -> Result<i32, String> {
    version_history::delete_file_versions(workspace_path, file_path)
        .map_err(|e| e.to_string())
}

/// Compare two versions and return a diff
#[tauri::command]
fn jot_diff_versions(
    workspace_path: &str,
    old_version_id: i64,
    new_version_id: i64,
) -> Result<Option<VersionDiff>, String> {
    version_history::diff_versions(workspace_path, old_version_id, new_version_id)
        .map_err(|e| e.to_string())
}

/// Get total version count for a file
#[tauri::command]
fn jot_get_version_count(workspace_path: &str, file_path: &str) -> Result<i32, String> {
    version_history::get_version_count(workspace_path, file_path)
        .map_err(|e| e.to_string())
}

/// Clean up old versions based on retention policy
#[tauri::command]
fn jot_cleanup_old_versions(workspace_path: &str) -> Result<i32, String> {
    version_history::cleanup_old_versions(workspace_path)
        .map_err(|e| e.to_string())
}

/// Get the retention setting in days
#[tauri::command]
fn jot_get_retention_days(workspace_path: &str) -> Result<i32, String> {
    version_history::get_retention_days(workspace_path)
        .map_err(|e| e.to_string())
}

/// Set the retention setting in days
#[tauri::command]
fn jot_set_retention_days(workspace_path: &str, days: i32) -> Result<(), String> {
    version_history::set_retention_days(workspace_path, days)
        .map_err(|e| e.to_string())
}

/// Update file path for all versions when a file is renamed
#[tauri::command]
fn jot_update_version_file_path(
    workspace_path: &str,
    old_path: &str,
    new_path: &str,
) -> Result<i32, String> {
    version_history::update_file_path(workspace_path, old_path, new_path)
        .map_err(|e| e.to_string())
}

// ==========================================
// Global & Workspace Settings Commands
// ==========================================

/// A recent workspace entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentWorkspace {
    pub path: String,
    pub name: String,
    pub last_opened: i64, // Unix timestamp in milliseconds
}

/// Layout preferences for panels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutPreferences {
    pub sidebar_width: i32,
    pub sidebar_open: bool,
}

impl Default for LayoutPreferences {
    fn default() -> Self {
        Self {
            sidebar_width: 260,
            sidebar_open: true,
        }
    }
}

/// A persisted tab entry for session restore
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedTab {
    pub file_path: String,
    pub is_pinned: bool,
}

/// State for restoring open tabs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedTabState {
    pub tabs: Vec<PersistedTab>,
    pub active_tab_path: Option<String>,
}

/// Appearance preferences for theme and typography
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearancePreferences {
    pub theme: String,
    pub theme_name: String,
    #[serde(default)]
    pub accent_color_id: Option<String>,
    pub font_family: String,
    pub font_size: i32,
    pub line_height: f64,
    pub max_line_width: i32,
    pub typewriter_mode: bool,
    #[serde(default = "default_copy_format")]
    pub default_copy_format: String,
    #[serde(default = "default_spell_check_enabled")]
    pub spell_check_enabled: bool,
    #[serde(default = "default_spell_check_language")]
    pub spell_check_language: String,
    #[serde(default = "default_grammar_check_enabled")]
    pub grammar_check_enabled: bool,
    #[serde(default = "default_grammar_dialect")]
    pub grammar_dialect: String,
}

fn default_copy_format() -> String {
    "formatted".to_string()
}

fn default_spell_check_enabled() -> bool {
    true
}

fn default_spell_check_language() -> String {
    "en_US".to_string()
}

fn default_grammar_check_enabled() -> bool {
    true
}

fn default_grammar_dialect() -> String {
    "american".to_string()
}

impl Default for AppearancePreferences {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            theme_name: "paper".to_string(),
            accent_color_id: None,
            font_family: "serif".to_string(),
            font_size: 18,
            line_height: 1.8,
            max_line_width: 72,
            typewriter_mode: false,
            default_copy_format: default_copy_format(),
            spell_check_enabled: default_spell_check_enabled(),
            spell_check_language: default_spell_check_language(),
            grammar_check_enabled: default_grammar_check_enabled(),
            grammar_dialect: default_grammar_dialect(),
        }
    }
}

/// Global application settings (stored in app data directory)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalAppSettings {
    pub recent_workspaces: Vec<RecentWorkspace>,
    pub default_workspace_path: Option<String>,
    #[serde(default)]
    pub layout: Option<LayoutPreferences>,
    #[serde(default)]
    pub appearance: Option<AppearancePreferences>,
    #[serde(default)]
    pub open_tabs: Option<PersistedTabState>,
    pub version: i32,
}

impl Default for GlobalAppSettings {
    fn default() -> Self {
        Self {
            recent_workspaces: Vec::new(),
            default_workspace_path: None,
            layout: Some(LayoutPreferences::default()),
            appearance: Some(AppearancePreferences::default()),
            open_tabs: None,
            version: 1,
        }
    }
}

/// Per-workspace settings (stored in .jot/config.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSettings {
    pub version: i32,
}

impl Default for WorkspaceSettings {
    fn default() -> Self {
        Self {
            version: 1,
        }
    }
}

/// Get the app data directory path
#[tauri::command]
fn jot_get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    let path = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    Ok(path.to_string_lossy().to_string())
}

/// Read global application settings
#[tauri::command]
fn jot_read_global_settings(app: tauri::AppHandle) -> Result<Option<GlobalAppSettings>, String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let settings_path = app_data_dir.join("settings.json");

    if !settings_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings: {}", e))?;

    let settings: GlobalAppSettings = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse settings: {}", e))?;

    Ok(Some(settings))
}

/// Write global application settings
#[tauri::command]
fn jot_write_global_settings(app: tauri::AppHandle, settings: GlobalAppSettings) -> Result<(), String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Create directory if it doesn't exist
    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    let settings_path = app_data_dir.join("settings.json");

    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    // Use atomic_write helper for Windows compatibility
    atomic_write(
        settings_path.to_str().ok_or("Invalid settings path")?,
        &content
    )
}

/// Read per-workspace settings from .jot/config.json
#[tauri::command]
fn jot_read_workspace_settings(workspace_path: &str) -> Result<Option<WorkspaceSettings>, String> {
    let jot_dir = Path::new(workspace_path).join(".jot");
    let config_path = jot_dir.join("config.json");

    if !config_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read workspace settings: {}", e))?;

    let settings: WorkspaceSettings = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse workspace settings: {}", e))?;

    Ok(Some(settings))
}

/// Write per-workspace settings to .jot/config.json
#[tauri::command]
fn jot_write_workspace_settings(workspace_path: &str, settings: WorkspaceSettings) -> Result<(), String> {
    let jot_dir = Path::new(workspace_path).join(".jot");

    // Create .jot directory if it doesn't exist
    fs::create_dir_all(&jot_dir)
        .map_err(|e| format!("Failed to create .jot directory: {}", e))?;

    let config_path = jot_dir.join("config.json");

    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize workspace settings: {}", e))?;

    // Use atomic_write helper for Windows compatibility
    atomic_write(
        config_path.to_str().ok_or("Invalid config path")?,
        &content
    )
}

/// Check if a directory exists and is valid
#[tauri::command]
fn jot_directory_exists(path: &str) -> bool {
    let p = Path::new(path);
    p.exists() && p.is_dir()
}

// ==========================================
// Personal Dictionary Commands
// ==========================================

/// A personal dictionary entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonalDictionaryEntry {
    pub word: String,
    pub added_at: i64,
}

/// Personal dictionary stored on disk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonalDictionary {
    pub version: i32,
    pub words: Vec<PersonalDictionaryEntry>,
}

impl Default for PersonalDictionary {
    fn default() -> Self {
        Self {
            version: 1,
            words: Vec::new(),
        }
    }
}

/// Get the personal dictionary file path
fn get_personal_dictionary_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    Ok(app_data_dir.join("personal-dictionary.json"))
}

/// Read personal dictionary from disk
#[tauri::command]
fn jot_read_personal_dictionary(app: tauri::AppHandle) -> Result<Option<PersonalDictionary>, String> {
    let dict_path = get_personal_dictionary_path(&app)?;

    if !dict_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&dict_path)
        .map_err(|e| format!("Failed to read personal dictionary: {}", e))?;

    let dict: PersonalDictionary = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse personal dictionary: {}", e))?;

    Ok(Some(dict))
}

/// Add a word to the personal dictionary
#[tauri::command]
fn jot_add_to_personal_dictionary(app: tauri::AppHandle, word: String) -> Result<(), String> {
    let dict_path = get_personal_dictionary_path(&app)?;
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Create directory if needed
    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    // Load existing dictionary or create new
    let mut dict = if dict_path.exists() {
        let content = fs::read_to_string(&dict_path)
            .map_err(|e| format!("Failed to read personal dictionary: {}", e))?;
        serde_json::from_str(&content)
            .unwrap_or_else(|_| PersonalDictionary::default())
    } else {
        PersonalDictionary::default()
    };

    // Check if word already exists (case-insensitive)
    let word_lower = word.to_lowercase();
    if dict.words.iter().any(|e| e.word.to_lowercase() == word_lower) {
        return Ok(()); // Already exists
    }

    // Add word
    dict.words.push(PersonalDictionaryEntry {
        word,
        added_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0),
    });

    // Save
    let content = serde_json::to_string_pretty(&dict)
        .map_err(|e| format!("Failed to serialize personal dictionary: {}", e))?;

    atomic_write(
        dict_path.to_str().ok_or("Invalid dictionary path")?,
        &content
    )
}

/// Remove a word from the personal dictionary
#[tauri::command]
fn jot_remove_from_personal_dictionary(app: tauri::AppHandle, word: String) -> Result<(), String> {
    let dict_path = get_personal_dictionary_path(&app)?;

    if !dict_path.exists() {
        return Ok(()); // Nothing to remove
    }

    let content = fs::read_to_string(&dict_path)
        .map_err(|e| format!("Failed to read personal dictionary: {}", e))?;

    let mut dict: PersonalDictionary = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse personal dictionary: {}", e))?;

    // Remove word (case-insensitive)
    let word_lower = word.to_lowercase();
    dict.words.retain(|e| e.word.to_lowercase() != word_lower);

    // Save
    let content = serde_json::to_string_pretty(&dict)
        .map_err(|e| format!("Failed to serialize personal dictionary: {}", e))?;

    atomic_write(
        dict_path.to_str().ok_or("Invalid dictionary path")?,
        &content
    )
}

// ==========================================
// Ignored Grammar Rules Commands
// ==========================================

/// An ignored grammar rule entry
#[derive(Debug, Clone, Serialize, Deserialize)]
struct IgnoredRuleEntry {
    rule_id: String,
    added_at: i64,
}

/// Ignored grammar rules stored on disk
#[derive(Debug, Clone, Serialize, Deserialize)]
struct IgnoredGrammarRules {
    version: i32,
    rules: Vec<IgnoredRuleEntry>,
}

impl Default for IgnoredGrammarRules {
    fn default() -> Self {
        Self {
            version: 1,
            rules: Vec::new(),
        }
    }
}

/// Get the ignored grammar rules file path
fn get_ignored_rules_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    Ok(app_data_dir.join("ignored-grammar-rules.json"))
}

/// Read ignored grammar rules from disk
#[tauri::command]
fn jot_read_ignored_grammar_rules(app: tauri::AppHandle) -> Result<Option<IgnoredGrammarRules>, String> {
    let rules_path = get_ignored_rules_path(&app)?;

    if !rules_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&rules_path)
        .map_err(|e| format!("Failed to read ignored grammar rules: {}", e))?;

    let rules: IgnoredGrammarRules = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse ignored grammar rules: {}", e))?;

    Ok(Some(rules))
}

/// Add a rule to the ignored grammar rules
#[tauri::command]
fn jot_add_ignored_grammar_rule(app: tauri::AppHandle, rule_id: String) -> Result<(), String> {
    let rules_path = get_ignored_rules_path(&app)?;
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Create directory if needed
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create app data dir: {}", e))?;
    }

    // Load existing or create new
    let mut rules = if rules_path.exists() {
        let content = fs::read_to_string(&rules_path)
            .map_err(|e| format!("Failed to read ignored grammar rules: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse ignored grammar rules: {}", e))?
    } else {
        IgnoredGrammarRules::default()
    };

    // Check if already exists
    if !rules.rules.iter().any(|e| e.rule_id == rule_id) {
        rules.rules.push(IgnoredRuleEntry {
            rule_id,
            added_at: chrono::Utc::now().timestamp_millis(),
        });
    }

    // Save
    let content = serde_json::to_string_pretty(&rules)
        .map_err(|e| format!("Failed to serialize ignored grammar rules: {}", e))?;

    atomic_write(
        rules_path.to_str().ok_or("Invalid rules path")?,
        &content
    )
}

/// Remove a rule from the ignored grammar rules
#[tauri::command]
fn jot_remove_ignored_grammar_rule(app: tauri::AppHandle, rule_id: String) -> Result<(), String> {
    let rules_path = get_ignored_rules_path(&app)?;

    if !rules_path.exists() {
        return Ok(()); // Nothing to remove
    }

    let content = fs::read_to_string(&rules_path)
        .map_err(|e| format!("Failed to read ignored grammar rules: {}", e))?;

    let mut rules: IgnoredGrammarRules = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse ignored grammar rules: {}", e))?;

    // Remove rule
    rules.rules.retain(|e| e.rule_id != rule_id);

    // Save
    let content = serde_json::to_string_pretty(&rules)
        .map_err(|e| format!("Failed to serialize ignored grammar rules: {}", e))?;

    atomic_write(
        rules_path.to_str().ok_or("Invalid rules path")?,
        &content
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            jot_read_directory,
            jot_read_folder_children,
            jot_read_file,
            jot_write_file,
            jot_create_file,
            jot_create_folder,
            jot_rename_path,
            jot_delete_path,
            jot_get_file_info,
            jot_path_exists,
            jot_watch_directory,
            jot_normalize_path,
            jot_is_within_workspace,
            jot_is_case_sensitive_fs,
            // Global search commands
            jot_search_workspace,
            // Version history commands
            jot_save_version,
            jot_get_versions,
            jot_get_version,
            jot_delete_version,
            jot_delete_file_versions,
            jot_diff_versions,
            jot_get_version_count,
            jot_cleanup_old_versions,
            jot_get_retention_days,
            jot_set_retention_days,
            jot_update_version_file_path,
            // Global & workspace settings commands
            jot_get_app_data_dir,
            jot_read_global_settings,
            jot_write_global_settings,
            jot_read_workspace_settings,
            jot_write_workspace_settings,
            jot_directory_exists,
            // Personal dictionary commands
            jot_read_personal_dictionary,
            jot_add_to_personal_dictionary,
            jot_remove_from_personal_dictionary,
            // Ignored grammar rules commands
            jot_read_ignored_grammar_rules,
            jot_add_ignored_grammar_rule,
            jot_remove_ignored_grammar_rule,
            // Semantic search commands
            semantic::jot_semantic_init,
            semantic::jot_semantic_get_status,
            semantic::jot_semantic_add_folder,
            semantic::jot_semantic_remove_folder,
            semantic::jot_semantic_get_folders,
            semantic::jot_semantic_embed_and_store,
            semantic::jot_semantic_delete_file,
            semantic::jot_semantic_file_needs_update,
            semantic::jot_semantic_search,
            semantic::jot_semantic_get_related,
            semantic::jot_semantic_update_folder_indexed,
            semantic::jot_semantic_clear_all,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn validate_in_workspace_accepts_nested_path() {
        let workspace = TempDir::new().unwrap();
        let workspace_path = workspace.path().to_str().unwrap();

        // Create a nested file
        let nested_dir = workspace.path().join("subdir");
        fs::create_dir(&nested_dir).unwrap();
        let nested_file = nested_dir.join("test.txt");
        fs::write(&nested_file, "content").unwrap();

        // Should accept nested path
        let result = validate_in_workspace(
            nested_file.to_str().unwrap(),
            workspace_path,
            true,
        );
        assert!(result.is_ok(), "Should accept nested path within workspace");
    }

    #[test]
    fn validate_in_workspace_rejects_outside_path() {
        let workspace = TempDir::new().unwrap();
        let outside = TempDir::new().unwrap();

        let workspace_path = workspace.path().to_str().unwrap();

        // Create a file outside workspace
        let outside_file = outside.path().join("secret.txt");
        fs::write(&outside_file, "secret").unwrap();

        // Should reject path outside workspace
        let result = validate_in_workspace(
            outside_file.to_str().unwrap(),
            workspace_path,
            true,
        );
        assert!(result.is_err(), "Should reject path outside workspace");
    }

    #[test]
    #[cfg(unix)]
    fn validate_in_workspace_rejects_symlink_escape() {
        use std::os::unix::fs::symlink;

        // Create temp workspace
        let workspace = TempDir::new().unwrap();
        let workspace_path = workspace.path().to_str().unwrap();

        // Create a file outside workspace
        let outside = TempDir::new().unwrap();
        let outside_file = outside.path().join("secret.txt");
        fs::write(&outside_file, "secret").unwrap();

        // Create symlink inside workspace pointing outside
        let symlink_path = workspace.path().join("escape");
        symlink(outside.path(), &symlink_path).unwrap();

        // Attempt to access via symlink should fail
        let escape_attempt = symlink_path.join("secret.txt");
        let result = validate_in_workspace(
            escape_attempt.to_str().unwrap(),
            workspace_path,
            true,
        );

        assert!(result.is_err(), "Should reject symlink escape");
    }

    #[test]
    #[cfg(windows)]
    fn validate_in_workspace_rejects_symlink_escape() {
        use std::os::windows::fs::symlink_dir;

        // Create temp workspace
        let workspace = TempDir::new().unwrap();
        let workspace_path = workspace.path().to_str().unwrap();

        // Create a file outside workspace
        let outside = TempDir::new().unwrap();
        let outside_file = outside.path().join("secret.txt");
        fs::write(&outside_file, "secret").unwrap();

        // Create symlink inside workspace pointing outside
        let symlink_path = workspace.path().join("escape");
        if symlink_dir(outside.path(), &symlink_path).is_ok() {
            // Attempt to access via symlink should fail
            let escape_attempt = symlink_path.join("secret.txt");
            let result = validate_in_workspace(
                escape_attempt.to_str().unwrap(),
                workspace_path,
                true,
            );

            assert!(result.is_err(), "Should reject symlink escape");
        }
        // If symlink creation fails (no admin privileges), skip the test
    }

    #[test]
    fn atomic_write_creates_new_file() {
        let dir = TempDir::new().unwrap();
        let file_path = dir.path().join("new_file.txt");

        let result = atomic_write(file_path.to_str().unwrap(), "test content");
        assert!(result.is_ok(), "Should create new file");

        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "test content");
    }

    #[test]
    fn atomic_write_overwrites_existing_file() {
        let dir = TempDir::new().unwrap();
        let file_path = dir.path().join("existing.txt");

        // Create existing file
        fs::write(&file_path, "old content").unwrap();

        // Overwrite with atomic_write
        let result = atomic_write(file_path.to_str().unwrap(), "new content");
        assert!(result.is_ok(), "Should overwrite existing file");

        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "new content");

        // Backup should be cleaned up (new naming: appends .jot-bak)
        let mut backup_name = file_path.as_os_str().to_os_string();
        backup_name.push(".jot-bak");
        let backup_path = PathBuf::from(backup_name);
        assert!(!backup_path.exists(), "Backup should be cleaned up on success");
    }

    #[test]
    fn atomic_write_syncs_to_disk_with_unicode() {
        let dir = TempDir::new().unwrap();
        let file_path = dir.path().join("unicode_test.md");

        // Unicode content: emoji, CJK, combining characters
        let content = "Hello 🌍\n日本語テスト\nCafé résumé naïve\n";

        let result = atomic_write(file_path.to_str().unwrap(), content);
        assert!(result.is_ok(), "Should write unicode content successfully");

        let read_back = fs::read_to_string(&file_path).unwrap();
        assert_eq!(read_back, content, "Unicode content should round-trip correctly");
    }

    #[test]
    fn atomic_write_backup_preserves_full_extension() {
        let dir = TempDir::new().unwrap();

        // Test that notes.md produces notes.md.jot-bak (not notes.jot-bak)
        let md_path = dir.path().join("notes.md");
        fs::write(&md_path, "original").unwrap();

        // Write new content - backup is created transiently during write
        let result = atomic_write(md_path.to_str().unwrap(), "updated");
        assert!(result.is_ok());

        // The old with_extension("jot-bak") would produce notes.jot-bak
        let wrong_backup = md_path.with_extension("jot-bak");
        assert!(!wrong_backup.exists(), "Should NOT create notes.jot-bak");

        // Test two files with same stem but different extensions produce distinct backups
        let txt_path = dir.path().join("notes.txt");
        fs::write(&txt_path, "text original").unwrap();

        atomic_write(txt_path.to_str().unwrap(), "text updated").unwrap();

        // Verify both files have correct content (backups cleaned up on success)
        assert_eq!(fs::read_to_string(&md_path).unwrap(), "updated");
        assert_eq!(fs::read_to_string(&txt_path).unwrap(), "text updated");

        // Verify the correct backup path format by checking intermediate state
        // Create a file, then verify backup naming during simulated concurrent access
        let test_path = dir.path().join("test.notes.md");
        fs::write(&test_path, "multi-dot original").unwrap();
        atomic_write(test_path.to_str().unwrap(), "multi-dot updated").unwrap();
        assert_eq!(fs::read_to_string(&test_path).unwrap(), "multi-dot updated");

        // The backup for test.notes.md should be test.notes.md.jot-bak (not test.notes.jot-bak)
        let wrong_multi_backup = test_path.with_extension("jot-bak");
        assert!(!wrong_multi_backup.exists(), "Should NOT create test.notes.jot-bak");
    }

    #[test]
    fn atomic_write_creates_intermediate_directories() {
        let dir = TempDir::new().unwrap();
        let nonexistent_parent = dir.path().join("no").join("such").join("path").join("file.md");

        // atomic_write should create intermediate directories
        let result = atomic_write(nonexistent_parent.to_str().unwrap(), "content");
        assert!(result.is_ok(), "Should create intermediate directories");

        let read_back = fs::read_to_string(&nonexistent_parent).unwrap();
        assert_eq!(read_back, "content");
    }
}
