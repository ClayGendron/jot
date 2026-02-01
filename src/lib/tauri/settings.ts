import { invoke } from "@tauri-apps/api/core";
import type {
  GlobalAppSettings,
  WorkspaceSettings,
  LayoutPreferences,
  AppearancePreferences,
  PersistedTabState,
  ThemeName,
  CopyFormat,
} from "@/lib/settings/types";
import type { FontFamily } from "@/stores/editorStore";

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

interface RustPersistedTab {
  file_path: string;
  is_pinned: boolean;
}

interface RustPersistedTabState {
  tabs: RustPersistedTab[];
  active_tab_path: string | null;
}

interface RustAppearancePreferences {
  theme: string;
  theme_name: string;
  accent_color_id: string | null;
  font_family: string;
  font_size: number;
  line_height: number;
  max_line_width: number;
  typewriter_mode: boolean;
  default_copy_format?: string;
  spell_check_enabled?: boolean;
  spell_check_language?: string;
}

interface RustGlobalAppSettings {
  recent_workspaces: RustRecentWorkspace[];
  default_workspace_path: string | null;
  layout?: RustLayoutPreferences;
  appearance?: RustAppearancePreferences;
  open_tabs?: RustPersistedTabState;
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
 * Convert Rust appearance (snake_case) to TypeScript (camelCase)
 */
function fromRustAppearance(rust: RustAppearancePreferences): AppearancePreferences {
  return {
    theme: rust.theme as "light" | "dark" | "system",
    themeName: rust.theme_name as ThemeName,
    accentColorId: rust.accent_color_id,
    fontFamily: rust.font_family as FontFamily,
    fontSize: rust.font_size,
    lineHeight: rust.line_height,
    maxLineWidth: rust.max_line_width,
    typewriterMode: rust.typewriter_mode,
    defaultCopyFormat: (rust.default_copy_format as CopyFormat) || "formatted",
    spellCheckEnabled: rust.spell_check_enabled ?? true,
    spellCheckLanguage: rust.spell_check_language ?? "en_US",
  };
}

/**
 * Convert TypeScript appearance (camelCase) to Rust (snake_case)
 */
function toRustAppearance(ts: AppearancePreferences): RustAppearancePreferences {
  return {
    theme: ts.theme,
    theme_name: ts.themeName ?? "paper",
    accent_color_id: ts.accentColorId ?? null,
    font_family: ts.fontFamily,
    font_size: ts.fontSize,
    line_height: ts.lineHeight,
    max_line_width: ts.maxLineWidth,
    typewriter_mode: ts.typewriterMode,
    default_copy_format: ts.defaultCopyFormat ?? "formatted",
    spell_check_enabled: ts.spellCheckEnabled ?? true,
    spell_check_language: ts.spellCheckLanguage ?? "en_US",
  };
}

/**
 * Convert Rust open tabs (snake_case) to TypeScript (camelCase)
 */
function fromRustOpenTabs(rust: RustPersistedTabState): PersistedTabState {
  return {
    tabs: rust.tabs.map((t) => ({
      filePath: t.file_path,
      isPinned: t.is_pinned,
    })),
    activeTabPath: rust.active_tab_path,
  };
}

/**
 * Convert TypeScript open tabs (camelCase) to Rust (snake_case)
 */
function toRustOpenTabs(ts: PersistedTabState): RustPersistedTabState {
  return {
    tabs: ts.tabs.map((t) => ({
      file_path: t.filePath,
      is_pinned: t.isPinned,
    })),
    active_tab_path: ts.activeTabPath,
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
    appearance: rust.appearance ? fromRustAppearance(rust.appearance) : undefined,
    openTabs: rust.open_tabs ? fromRustOpenTabs(rust.open_tabs) : undefined,
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
    appearance: ts.appearance ? toRustAppearance(ts.appearance) : undefined,
    open_tabs: ts.openTabs ? toRustOpenTabs(ts.openTabs) : undefined,
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
