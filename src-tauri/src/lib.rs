use regex::RegexBuilder;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

mod version_history;
use version_history::{Version, VersionDiff, VersionMeta};

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
#[tauri::command]
fn jot_read_directory(path: &str) -> Result<Vec<FileEntry>, String> {
    let root = Path::new(path);

    if !root.exists() {
        return Err(format!("Directory does not exist: {}", path));
    }

    if !root.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    read_dir_recursive(root, 0, 3) // Max depth of 3 for initial load
}

fn read_dir_recursive(dir: &Path, depth: usize, max_depth: usize) -> Result<Vec<FileEntry>, String> {
    let mut entries: Vec<FileEntry> = Vec::new();

    let read_dir = fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/folders and .jot directory
        if name.starts_with('.') {
            continue;
        }

        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let is_dir = metadata.is_dir();
        let is_markdown = !is_dir && name.ends_with(".md");

        // Skip non-markdown files
        if !is_dir && !is_markdown {
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
            is_markdown,
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

/// Read a single file's contents
#[tauri::command]
fn jot_read_file(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))
}

/// Write content to a file
#[tauri::command]
fn jot_write_file(path: &str, content: &str) -> Result<(), String> {
    // Create parent directories if they don't exist
    if let Some(parent) = Path::new(path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    fs::write(path, content).map_err(|e| format!("Failed to write file: {}", e))
}

/// Create a new file
#[tauri::command]
fn jot_create_file(path: &str) -> Result<(), String> {
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

/// Create a new file with workspace validation (safe version)
/// Validates that the path is within the workspace before creating
#[tauri::command]
fn jot_create_file_safe(path: &str, workspace_path: &str) -> Result<(), String> {
    // Validate path is within workspace
    if !jot_is_within_workspace(path, workspace_path) {
        return Err(format!("Path '{}' is outside workspace", path));
    }

    // Delegate to regular create file
    jot_create_file(path)
}

/// Create a new folder
#[tauri::command]
fn jot_create_folder(path: &str) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| format!("Failed to create folder: {}", e))
}

/// Rename a file or folder
#[tauri::command]
fn jot_rename_path(old_path: &str, new_path: &str) -> Result<(), String> {
    if Path::new(new_path).exists() {
        return Err("A file with that name already exists".to_string());
    }

    fs::rename(old_path, new_path).map_err(|e| format!("Failed to rename: {}", e))
}

/// Delete a file or folder permanently
/// WARNING: This permanently deletes files, not moves to trash
/// TODO: Consider using the `trash` crate for safer deletion
#[tauri::command]
fn jot_delete_path(path: &str) -> Result<(), String> {
    let path = Path::new(path);

    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|e| format!("Failed to delete folder: {}", e))
    } else {
        fs::remove_file(path).map_err(|e| format!("Failed to delete file: {}", e))
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
    let is_markdown = !is_dir && name.ends_with(".md");

    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64);

    Ok(FileEntry {
        name,
        path: path.to_string(),
        is_dir,
        is_markdown,
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
#[tauri::command]
fn jot_search_workspace(
    workspace_path: &str,
    search_term: &str,
    case_sensitive: bool,
    use_regex: bool,
    path_filter: Option<&str>,
) -> Result<Vec<FileSearchResult>, String> {
    if search_term.is_empty() {
        return Ok(Vec::new());
    }

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

    // Collect all markdown files
    let mut markdown_files = Vec::new();
    collect_markdown_files(workspace, &mut markdown_files)?;

    // Apply path filter if provided
    let files_to_search: Vec<PathBuf> = if let Some(filter) = path_filter {
        if filter.is_empty() {
            markdown_files
        } else {
            // Build glob pattern relative to workspace
            let glob_pattern = workspace.join(filter).to_string_lossy().to_string();
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
fn collect_markdown_files(dir: &Path, files: &mut Vec<PathBuf>) -> Result<(), String> {
    let read_dir = fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/folders and .jot directory
        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            collect_markdown_files(&path, files)?;
        } else if name.ends_with(".md") {
            files.push(path);
        }
    }

    Ok(())
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

            matches.push(SearchMatch {
                line_number: line_idx + 1, // 1-indexed
                line_content: line.to_string(),
                match_start: mat.start(),
                match_end: mat.end(),
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            jot_read_directory,
            jot_read_file,
            jot_write_file,
            jot_create_file,
            jot_create_file_safe,
            jot_create_folder,
            jot_rename_path,
            jot_delete_path,
            jot_get_file_info,
            jot_path_exists,
            jot_watch_directory,
            jot_normalize_path,
            jot_is_within_workspace,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
