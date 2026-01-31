import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

/**
 * File entry type matching Rust struct
 */
export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_markdown: boolean;
  modified: number | null;
  children: FileEntry[] | null;
}

/**
 * Read directory contents (markdown files and folders only)
 */
export async function readDirectory(path: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("jot_read_directory", { path });
}

/**
 * Read a single folder's children (one level, no recursion)
 * Used for lazy loading folders beyond initial depth limit
 */
export async function readFolderChildren(path: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("jot_read_folder_children", { path });
}

/**
 * Read file contents with workspace validation
 */
export async function readFile(path: string, workspacePath: string): Promise<string> {
  return invoke<string>("jot_read_file", { path, workspacePath });
}

/**
 * Write content to file with workspace validation and atomic writes
 */
export async function writeFile(path: string, content: string, workspacePath: string): Promise<void> {
  return invoke("jot_write_file", { path, content, workspacePath });
}

/**
 * Create new file with workspace validation
 */
export async function createFile(path: string, workspacePath: string): Promise<void> {
  return invoke("jot_create_file", { path, workspacePath });
}

/**
 * Create new folder with workspace validation
 */
export async function createFolder(path: string, workspacePath: string): Promise<void> {
  return invoke("jot_create_folder", { path, workspacePath });
}

/**
 * Rename file or folder with workspace validation
 */
export async function renamePath(
  oldPath: string,
  newPath: string,
  workspacePath: string
): Promise<void> {
  return invoke("jot_rename_path", { oldPath, newPath, workspacePath });
}

/**
 * Result of delete operation, includes optional warning
 */
export interface DeleteResult {
  warning: string | null;
}

/**
 * Delete file or folder with workspace validation.
 * Attempts to move to system trash first, falls back to permanent deletion.
 * @returns DeleteResult with optional warning if trash failed
 */
export async function deletePath(path: string, workspacePath: string): Promise<DeleteResult> {
  return invoke<DeleteResult>("jot_delete_path", { path, workspacePath });
}

/**
 * Get file info
 */
export async function getFileInfo(path: string): Promise<FileEntry> {
  return invoke<FileEntry>("jot_get_file_info", { path });
}

/**
 * Check if path exists
 */
export async function pathExists(path: string): Promise<boolean> {
  return invoke<boolean>("jot_path_exists", { path });
}

/**
 * Open folder picker dialog
 */
export async function openFolderDialog(): Promise<string | null> {
  const result = await open({
    directory: true,
    multiple: false,
    title: "Open Workspace",
  });

  return result as string | null;
}

/**
 * Open file picker dialog for markdown files
 */
export async function openFileDialog(): Promise<string | null> {
  const result = await open({
    directory: false,
    multiple: false,
    title: "Open File",
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });

  return result as string | null;
}

// Re-export path utilities for backward compatibility
// These are now implemented in @/lib/path/pathUtils
export { getFileName, getParentPath as getParentPathFs } from "@/lib/path/pathUtils";

/**
 * Check if the filesystem is case-sensitive (Linux: true, Windows/macOS: false)
 * Used for link resolution to match the correct file on each platform.
 */
export async function isCaseSensitiveFs(workspacePath: string): Promise<boolean> {
  return invoke<boolean>("jot_is_case_sensitive_fs", { workspacePath });
}
