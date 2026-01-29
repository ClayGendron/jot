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
 * Read file contents
 */
export async function readFile(path: string): Promise<string> {
  return invoke<string>("jot_read_file", { path });
}

/**
 * Write content to file
 */
export async function writeFile(path: string, content: string): Promise<void> {
  return invoke("jot_write_file", { path, content });
}

/**
 * Create new file
 */
export async function createFile(path: string): Promise<void> {
  return invoke("jot_create_file", { path });
}

/**
 * Create new folder
 */
export async function createFolder(path: string): Promise<void> {
  return invoke("jot_create_folder", { path });
}

/**
 * Rename file or folder
 */
export async function renamePath(
  oldPath: string,
  newPath: string
): Promise<void> {
  return invoke("jot_rename_path", { oldPath, newPath });
}

/**
 * Delete file or folder
 */
export async function deletePath(path: string): Promise<void> {
  return invoke("jot_delete_path", { path });
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

/**
 * Get the file name from a path
 */
export function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

/**
 * Get the parent directory from a path
 */
export function getParentDir(path: string): string {
  const parts = path.split(/[/\\]/);
  parts.pop();
  return parts.join("/") || "/";
}

/**
 * Join path segments
 */
export function joinPath(...segments: string[]): string {
  return segments.join("/").replace(/\/+/g, "/");
}
