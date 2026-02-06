use regex::RegexBuilder;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

use crate::fs_utils::{is_hidden_file, is_markdown_file};

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
pub(crate) async fn jot_search_workspace(
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
