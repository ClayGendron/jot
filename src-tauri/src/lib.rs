use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

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
pub fn read_directory(path: &str) -> Result<Vec<FileEntry>, String> {
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
pub fn read_file(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))
}

/// Write content to a file
#[tauri::command]
pub fn write_file(path: &str, content: &str) -> Result<(), String> {
    // Create parent directories if they don't exist
    if let Some(parent) = Path::new(path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    fs::write(path, content).map_err(|e| format!("Failed to write file: {}", e))
}

/// Create a new file
#[tauri::command]
pub fn create_file(path: &str) -> Result<(), String> {
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

/// Create a new folder
#[tauri::command]
pub fn create_folder(path: &str) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| format!("Failed to create folder: {}", e))
}

/// Rename a file or folder
#[tauri::command]
pub fn rename_path(old_path: &str, new_path: &str) -> Result<(), String> {
    if Path::new(new_path).exists() {
        return Err("A file with that name already exists".to_string());
    }

    fs::rename(old_path, new_path).map_err(|e| format!("Failed to rename: {}", e))
}

/// Delete a file or folder permanently
/// WARNING: This permanently deletes files, not moves to trash
/// TODO: Consider using the `trash` crate for safer deletion
#[tauri::command]
pub fn delete_path(path: &str) -> Result<(), String> {
    let path = Path::new(path);

    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|e| format!("Failed to delete folder: {}", e))
    } else {
        fs::remove_file(path).map_err(|e| format!("Failed to delete file: {}", e))
    }
}

/// Get file metadata
#[tauri::command]
pub fn get_file_info(path: &str) -> Result<FileEntry, String> {
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
pub fn path_exists(path: &str) -> bool {
    Path::new(path).exists()
}

/// Watch for file changes (placeholder for future implementation)
#[tauri::command]
pub fn watch_directory(_path: &str) -> Result<(), String> {
    // TODO: Implement file watching with notify crate
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            read_directory,
            read_file,
            write_file,
            create_file,
            create_folder,
            rename_path,
            delete_path,
            get_file_info,
            path_exists,
            watch_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
