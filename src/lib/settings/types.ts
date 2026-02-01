/**
 * Settings type definitions
 *
 * Defines types for global application settings and per-workspace settings.
 */

import type { ThemeName } from "./themes";
export type { ThemeName } from "./themes";
import type { CopyFormat } from "../clipboard/copyFormatted";
export type { CopyFormat } from "../clipboard/copyFormatted";

/**
 * A recent workspace entry
 */
export interface RecentWorkspace {
  /** Full path to the workspace directory */
  path: string;
  /** Display name (folder name) */
  name: string;
  /** Last opened timestamp (Unix ms) */
  lastOpened: number;
}

/**
 * Layout preferences for panels
 */
export interface LayoutPreferences {
  /** Sidebar width in pixels */
  sidebarWidth: number;
  /** Whether sidebar is visible */
  sidebarOpen: boolean;
}

/**
 * Grammar check dialect type
 */
export type GrammarDialect = "american" | "british" | "canadian" | "australian";

/**
 * Appearance preferences for theme and typography
 */
export interface AppearancePreferences {
  /** Color theme: light, dark, or follow system (legacy, maps to themeName) */
  theme: "light" | "dark" | "system";
  /** Theme preset name (paper, midnight, sepia, highContrast, olive) */
  themeName: ThemeName;
  /** Custom accent color ID (null uses theme default) */
  accentColorId: string | null;
  /** Editor font family */
  fontFamily: "serif" | "sans" | "mono";
  /** Font size in pixels */
  fontSize: number;
  /** Line height multiplier (e.g., 1.5, 1.75) */
  lineHeight: number;
  /** Maximum line width in characters */
  maxLineWidth: number;
  /** Typewriter mode (keeps current line centered) */
  typewriterMode: boolean;
  /** Default copy format (formatted = rich text, markdown = plain text) */
  defaultCopyFormat: CopyFormat;
  /** Whether spell checking is enabled */
  spellCheckEnabled: boolean;
  /** Spell check language code (e.g., "en_US", "fr_FR") */
  spellCheckLanguage: string;
  /** Whether grammar checking is enabled */
  grammarCheckEnabled: boolean;
  /** Grammar check dialect */
  grammarDialect: GrammarDialect;
}

/**
 * Persisted tab state for session restore
 */
export interface PersistedTab {
  /** Full file path */
  filePath: string;
  /** Whether tab is pinned */
  isPinned: boolean;
}

/**
 * State for restoring open tabs
 */
export interface PersistedTabState {
  /** Ordered list of tabs */
  tabs: PersistedTab[];
  /** Active tab's file path (null if no active tab) */
  activeTabPath: string | null;
}

/**
 * Global application settings
 *
 * Stored in the app data directory (platform-specific).
 * These settings persist across all workspaces.
 */
export interface GlobalAppSettings {
  /** List of recently opened workspaces (max 10, most recent first) */
  recentWorkspaces: RecentWorkspace[];
  /** Default workspace to open on startup (null = show welcome) */
  defaultWorkspacePath: string | null;
  /** Layout preferences (panel sizes, visibility) */
  layout?: LayoutPreferences;
  /** Appearance preferences (theme, font) */
  appearance?: AppearancePreferences;
  /** Open tabs state for session restore */
  openTabs?: PersistedTabState;
  /** Schema version for migrations */
  version: number;
}

/**
 * Per-workspace settings
 *
 * Stored in .jot/config.json within each workspace.
 * These settings are specific to one workspace.
 */
export interface WorkspaceSettings {
  /** Schema version for migrations */
  version: number;
  // Future: theme override, editor preferences, etc.
}

/**
 * Default layout preferences
 */
export const DEFAULT_LAYOUT_PREFERENCES: LayoutPreferences = {
  sidebarWidth: 260,
  sidebarOpen: true,
};

/**
 * Default appearance preferences
 */
export const DEFAULT_APPEARANCE_PREFERENCES: AppearancePreferences = {
  theme: "system",
  themeName: "paper",
  accentColorId: null,
  fontFamily: "serif",
  fontSize: 18,
  lineHeight: 1.8,
  maxLineWidth: 72,
  typewriterMode: false,
  defaultCopyFormat: "formatted",
  spellCheckEnabled: true,
  spellCheckLanguage: "en_US",
  grammarCheckEnabled: true,
  grammarDialect: "american",
};

/**
 * Default global settings
 */
export const DEFAULT_GLOBAL_SETTINGS: GlobalAppSettings = {
  recentWorkspaces: [],
  defaultWorkspacePath: null,
  layout: DEFAULT_LAYOUT_PREFERENCES,
  appearance: DEFAULT_APPEARANCE_PREFERENCES,
  version: 1,
};

/**
 * Default workspace settings
 */
export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  version: 1,
};

/**
 * Maximum number of recent workspaces to keep
 */
export const MAX_RECENT_WORKSPACES = 10;
