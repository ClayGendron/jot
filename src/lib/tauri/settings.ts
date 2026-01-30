import { invoke } from "@tauri-apps/api/core";
import type {
  GlobalAppSettings,
  WorkspaceSettings,
  LayoutPreferences,
} from "@/lib/settings/types";

/**
 * Tauri settings response types (matching Rust structs with snake_case)
 */
interface RustRecentWorkspace {
  path: string;
  name: string;
  last_opened: number;
}

interface RustLayoutPreferences {
  sidebar_width: number;
  sidebar_open: boolean;
}

interface RustGlobalAppSettings {
  recent_workspaces: RustRecentWorkspace[];
  default_workspace_path: string | null;
  layout?: RustLayoutPreferences;
  version: number;
}

interface RustWorkspaceSettings {
  version: number;
}

/**
 * Convert Rust layout (snake_case) to TypeScript (camelCase)
 */
function fromRustLayout(rust: RustLayoutPreferences): LayoutPreferences {
  return {
    sidebarWidth: rust.sidebar_width,
    sidebarOpen: rust.sidebar_open,
  };
}

/**
 * Convert TypeScript layout (camelCase) to Rust (snake_case)
 */
function toRustLayout(ts: LayoutPreferences): RustLayoutPreferences {
  return {
    sidebar_width: ts.sidebarWidth,
    sidebar_open: ts.sidebarOpen,
  };
}

/**
 * Convert Rust settings (snake_case) to TypeScript (camelCase)
 */
function fromRustGlobalSettings(rust: RustGlobalAppSettings): GlobalAppSettings {
  return {
    recentWorkspaces: rust.recent_workspaces.map((rw) => ({
      path: rw.path,
      name: rw.name,
      lastOpened: rw.last_opened,
    })),
    defaultWorkspacePath: rust.default_workspace_path,
    layout: rust.layout ? fromRustLayout(rust.layout) : undefined,
    version: rust.version,
  };
}

/**
 * Convert TypeScript settings (camelCase) to Rust (snake_case)
 */
function toRustGlobalSettings(ts: GlobalAppSettings): RustGlobalAppSettings {
  return {
    recent_workspaces: ts.recentWorkspaces.map((rw) => ({
      path: rw.path,
      name: rw.name,
      last_opened: rw.lastOpened,
    })),
    default_workspace_path: ts.defaultWorkspacePath,
    layout: ts.layout ? toRustLayout(ts.layout) : undefined,
    version: ts.version,
  };
}

/**
 * Get the application data directory path
 */
export async function getAppDataDir(): Promise<string> {
  return invoke<string>("jot_get_app_data_dir");
}

/**
 * Read global application settings
 *
 * Returns null if settings file doesn't exist yet.
 */
export async function readGlobalSettings(): Promise<GlobalAppSettings | null> {
  const result = await invoke<RustGlobalAppSettings | null>("jot_read_global_settings");
  return result ? fromRustGlobalSettings(result) : null;
}

/**
 * Write global application settings
 */
export async function writeGlobalSettings(settings: GlobalAppSettings): Promise<void> {
  return invoke("jot_write_global_settings", { settings: toRustGlobalSettings(settings) });
}

/**
 * Read per-workspace settings
 *
 * Returns null if .jot/config.json doesn't exist yet.
 */
export async function readWorkspaceSettings(
  workspacePath: string
): Promise<WorkspaceSettings | null> {
  return invoke<RustWorkspaceSettings | null>("jot_read_workspace_settings", { workspacePath });
}

/**
 * Write per-workspace settings
 */
export async function writeWorkspaceSettings(
  workspacePath: string,
  settings: WorkspaceSettings
): Promise<void> {
  return invoke("jot_write_workspace_settings", { workspacePath, settings });
}

/**
 * Check if a directory exists
 */
export async function directoryExists(path: string): Promise<boolean> {
  return invoke<boolean>("jot_directory_exists", { path });
}
