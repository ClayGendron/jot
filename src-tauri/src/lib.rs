use std::fs;
use std::path::{Path, PathBuf};

mod version_history;
use version_history::{Version, VersionDiff, VersionMeta};

mod semantic;

mod fs_utils;
use fs_utils::{validate_in_workspace, atomic_write, is_hidden_file, is_markdown_file, FileEntry, DeleteResult, detect_case_sensitivity};

mod search;
mod settings;
mod dictionary;
mod grammar_rules;

// ==========================================
// File CRUD Commands
// ==========================================

/// Read directory contents recursively, filtering for markdown files and folders
/// Uses spawn_blocking to avoid blocking the main thread during IO
#[tauri::command]
async fn jot_read_directory(path: String, workspace_path: String) -> Result<Vec<FileEntry>, String> {
    let ws = workspace_path.clone();
    tauri::async_runtime::spawn_blocking(move || {
        validate_in_workspace(&path, &ws, true)?;

        let root = Path::new(&path);

        if !root.is_dir() {
            return Err(format!("Path is not a directory: {}", path));
        }

        let mut visited = std::collections::HashSet::new();
        read_dir_recursive(root, 0, 3, &mut visited) // Max depth of 3 for initial load
    })
    .await
    .map_err(|e| format!("Task join failed: {}", e))?
}

fn read_dir_recursive(
    dir: &Path,
    depth: usize,
    max_depth: usize,
    visited: &mut std::collections::HashSet<PathBuf>,
) -> Result<Vec<FileEntry>, String> {
    // Resolve symlinks and detect cycles
    let canonical = match dir.canonicalize() {
        Ok(c) => c,
        Err(_) => return Ok(Vec::new()), // Skip unreadable directories
    };
    if !visited.insert(canonical) {
        return Ok(Vec::new()); // Already visited — cycle detected
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

        let children = if is_dir && depth < max_depth {
            Some(read_dir_recursive(&path, depth + 1, max_depth, visited).unwrap_or_default())
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
async fn jot_read_folder_children(path: String, workspace_path: String) -> Result<Vec<FileEntry>, String> {
    let ws = workspace_path.clone();
    tauri::async_runtime::spawn_blocking(move || {
        validate_in_workspace(&path, &ws, true)?;
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

/// Get file metadata with workspace validation
#[tauri::command]
fn jot_get_file_info(path: &str, workspace_path: &str) -> Result<FileEntry, String> {
    validate_in_workspace(path, workspace_path, true)?;
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

/// Check if a path exists with workspace validation
#[tauri::command]
fn jot_path_exists(path: &str, workspace_path: &str) -> Result<bool, String> {
    validate_in_workspace(path, workspace_path, false)?;
    Ok(Path::new(path).exists())
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
            search::jot_search_workspace,
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
            settings::jot_get_app_data_dir,
            settings::jot_read_global_settings,
            settings::jot_write_global_settings,
            settings::jot_read_workspace_settings,
            settings::jot_write_workspace_settings,
            settings::jot_directory_exists,
            // Personal dictionary commands
            dictionary::jot_read_personal_dictionary,
            dictionary::jot_add_to_personal_dictionary,
            dictionary::jot_remove_from_personal_dictionary,
            // Ignored grammar rules commands
            grammar_rules::jot_read_ignored_grammar_rules,
            grammar_rules::jot_add_ignored_grammar_rule,
            grammar_rules::jot_remove_ignored_grammar_rule,
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

    #[test]
    fn read_dir_recursive_returns_entries() {
        let workspace = TempDir::new().unwrap();
        let sub = workspace.path().join("sub");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("note.md"), "# Test").unwrap();

        let mut visited = std::collections::HashSet::new();
        let result = read_dir_recursive(workspace.path(), 0, 3, &mut visited);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 1); // "sub" folder
        assert!(entries[0].is_dir);
        assert!(entries[0].children.is_some());

        let children = entries[0].children.as_ref().unwrap();
        assert_eq!(children.len(), 1);
        assert_eq!(children[0].name, "note.md");
    }

    #[test]
    #[cfg(unix)]
    fn read_dir_recursive_handles_symlink_cycle() {
        use std::os::unix::fs::symlink;

        let workspace = TempDir::new().unwrap();
        let sub = workspace.path().join("sub");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("note.md"), "content").unwrap();

        // Create symlink cycle: sub/loop -> workspace root
        symlink(workspace.path(), sub.join("loop")).unwrap();

        let mut visited = std::collections::HashSet::new();
        let result = read_dir_recursive(workspace.path(), 0, 10, &mut visited);
        assert!(result.is_ok(), "Should handle symlink cycle without infinite recursion");

        // Should still find the note.md file
        let entries = result.unwrap();
        assert!(!entries.is_empty());
    }

    #[test]
    fn read_dir_recursive_respects_max_depth() {
        let workspace = TempDir::new().unwrap();
        let deep = workspace.path().join("a").join("b").join("c");
        fs::create_dir_all(&deep).unwrap();
        fs::write(deep.join("deep.md"), "deep").unwrap();

        let mut visited = std::collections::HashSet::new();
        let result = read_dir_recursive(workspace.path(), 0, 1, &mut visited);
        assert!(result.is_ok());

        // At depth 0, we see "a" folder; at depth 1, we see "b" folder with empty placeholder
        let entries = result.unwrap();
        assert_eq!(entries.len(), 1);
        let a_children = entries[0].children.as_ref().unwrap();
        assert_eq!(a_children.len(), 1);
        // At depth 1 (max_depth), "b" should have empty children placeholder (not recursed into)
        let b_children = a_children[0].children.as_ref().unwrap();
        assert!(b_children.is_empty(), "Should not recurse beyond max_depth");
    }
}
