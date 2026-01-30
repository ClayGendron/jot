/**
 * Theme preset definitions for Jot
 *
 * Each theme is a carefully curated color palette designed to create
 * a specific writing atmosphere. Colors are chosen for readability,
 * aesthetic harmony, and distinctiveness.
 */

/**
 * Available theme names
 */
export type ThemeName = "paper" | "midnight" | "sepia" | "highContrast" | "olive";

/**
 * Theme color palette definition
 */
export interface ThemeColors {
  /** Main background color */
  paper: string;
  /** Secondary/warm background (code blocks, sidebars) */
  paperWarm: string;
  /** Primary text color */
  ink: string;
  /** Secondary text color */
  inkLight: string;
  /** Muted text (placeholders, metadata) */
  inkMuted: string;
  /** Accent color (links, buttons, highlights) */
  accent: string;
  /** Soft accent (hover states, selections) */
  accentSoft: string;
  /** Highlight/mark background */
  highlight: string;
  /** Subtle border color */
  border: string;
  /** Strong border color */
  borderStrong: string;
}

/**
 * Complete theme definition
 */
export interface ThemePreset {
  /** Unique identifier */
  id: ThemeName;
  /** Display name */
  name: string;
  /** Brief description */
  description: string;
  /** Whether this is a dark theme */
  isDark: boolean;
  /** Color palette */
  colors: ThemeColors;
  /** Curated accent color options that work with this theme */
  accentOptions: AccentColor[];
}

/**
 * Accent color option
 */
export interface AccentColor {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Primary accent color (links, buttons) */
  color: string;
  /** Soft variant (hover, selection) */
  soft: string;
}

/**
 * Paper theme - Warm cream tones for a classic writing experience
 * Inspired by quality writing paper with a terracotta accent
 */
const paperTheme: ThemePreset = {
  id: "paper",
  name: "Paper",
  description: "Warm cream tones, like quality stationery",
  isDark: false,
  colors: {
    paper: "#faf8f5",
    paperWarm: "#f5f2eb",
    ink: "#1a1a1a",
    inkLight: "#4a4a4a",
    inkMuted: "#8a8a8a",
    accent: "#c45d3e",
    accentSoft: "#e8b4a4",
    highlight: "#fff3cd",
    border: "#e5e2dc",
    borderStrong: "#d0cdc5",
  },
  accentOptions: [
    { id: "terracotta", name: "Terracotta", color: "#c45d3e", soft: "#e8b4a4" },
    { id: "forest", name: "Forest", color: "#2d6a4f", soft: "#95d5b2" },
    { id: "ocean", name: "Ocean", color: "#1d4e89", soft: "#a8c5db" },
    { id: "plum", name: "Plum", color: "#7b2d5b", soft: "#d4a5c9" },
    { id: "amber", name: "Amber", color: "#b45309", soft: "#fcd9a0" },
  ],
};

/**
 * Midnight theme - Deep dark mode for focused writing
 * Rich blacks with a warm coral accent
 */
const midnightTheme: ThemePreset = {
  id: "midnight",
  name: "Midnight",
  description: "Deep dark mode for focused writing",
  isDark: true,
  colors: {
    paper: "#1a1a1a",
    paperWarm: "#222222",
    ink: "#e8e6e3",
    inkLight: "#b0ada8",
    inkMuted: "#6a6a6a",
    accent: "#e07a5f",
    accentSoft: "#5c3d34",
    highlight: "#3d3520",
    border: "#2a2a2a",
    borderStrong: "#3a3a3a",
  },
  accentOptions: [
    { id: "coral", name: "Coral", color: "#e07a5f", soft: "#5c3d34" },
    { id: "mint", name: "Mint", color: "#6bbd99", soft: "#2d4a3a" },
    { id: "sky", name: "Sky", color: "#7eb8da", soft: "#2d4254" },
    { id: "lavender", name: "Lavender", color: "#b794c0", soft: "#4a3650" },
    { id: "gold", name: "Gold", color: "#e2b75f", soft: "#4a3d20" },
  ],
};

/**
 * Sepia theme - Aged paper tones for relaxed reading
 * Inspired by old books and manuscripts
 */
const sepiaTheme: ThemePreset = {
  id: "sepia",
  name: "Sepia",
  description: "Aged paper tones for relaxed reading",
  isDark: false,
  colors: {
    paper: "#f4ecd8",
    paperWarm: "#ebe3ca",
    ink: "#3d3028",
    inkLight: "#5c5040",
    inkMuted: "#8a7e6a",
    accent: "#8b5a2b",
    accentSoft: "#d4b896",
    highlight: "#e6d5a8",
    border: "#d9cfb8",
    borderStrong: "#c4b89e",
  },
  accentOptions: [
    { id: "sienna", name: "Sienna", color: "#8b5a2b", soft: "#d4b896" },
    { id: "sage", name: "Sage", color: "#5f7355", soft: "#b5c4a8" },
    { id: "slate", name: "Slate", color: "#5a6574", soft: "#a8b5c4" },
    { id: "wine", name: "Wine", color: "#7a3b3b", soft: "#c9a8a8" },
    { id: "bronze", name: "Bronze", color: "#8c6e42", soft: "#d4c4a0" },
  ],
};

/**
 * High Contrast theme - Maximum readability for accessibility
 * Pure blacks and whites with a vivid blue accent
 */
const highContrastTheme: ThemePreset = {
  id: "highContrast",
  name: "High Contrast",
  description: "Maximum readability for accessibility",
  isDark: false,
  colors: {
    paper: "#ffffff",
    paperWarm: "#f5f5f5",
    ink: "#000000",
    inkLight: "#333333",
    inkMuted: "#666666",
    accent: "#0052cc",
    accentSoft: "#cce0ff",
    highlight: "#fff176",
    border: "#cccccc",
    borderStrong: "#999999",
  },
  accentOptions: [
    { id: "blue", name: "Blue", color: "#0052cc", soft: "#cce0ff" },
    { id: "green", name: "Green", color: "#006644", soft: "#b3e6cc" },
    { id: "purple", name: "Purple", color: "#5e35b1", soft: "#d1c4e9" },
    { id: "red", name: "Red", color: "#c62828", soft: "#ffcdd2" },
    { id: "black", name: "Black", color: "#000000", soft: "#e0e0e0" },
  ],
};

/**
 * Olive theme - Muted sage tones for a calming experience
 * Inspired by nature and tranquility
 */
const oliveTheme: ThemePreset = {
  id: "olive",
  name: "Olive",
  description: "Muted sage tones for calm writing",
  isDark: false,
  colors: {
    paper: "#f5f7f4",
    paperWarm: "#edf0ea",
    ink: "#2d3329",
    inkLight: "#4a5245",
    inkMuted: "#7a8574",
    accent: "#5f7a5e",
    accentSoft: "#b8cab5",
    highlight: "#e5ecd8",
    border: "#d4dbd0",
    borderStrong: "#bfc8b8",
  },
  accentOptions: [
    { id: "olive", name: "Olive", color: "#5f7a5e", soft: "#b8cab5" },
    { id: "teal", name: "Teal", color: "#3d7a7a", soft: "#a8caca" },
    { id: "rust", name: "Rust", color: "#8b5c42", soft: "#d4baa8" },
    { id: "navy", name: "Navy", color: "#3d4a5c", soft: "#a8b5c4" },
    { id: "moss", name: "Moss", color: "#4a6642", soft: "#a8c4a0" },
  ],
};

/**
 * All available theme presets
 */
export const THEME_PRESETS: Record<ThemeName, ThemePreset> = {
  paper: paperTheme,
  midnight: midnightTheme,
  sepia: sepiaTheme,
  highContrast: highContrastTheme,
  olive: oliveTheme,
};

/**
 * Ordered list of themes for UI display
 */
export const THEME_LIST: ThemePreset[] = [
  paperTheme,
  midnightTheme,
  sepiaTheme,
  highContrastTheme,
  oliveTheme,
];

/**
 * Default theme
 */
export const DEFAULT_THEME: ThemeName = "paper";

/**
 * Get a theme preset by name
 */
export function getTheme(name: ThemeName): ThemePreset {
  return THEME_PRESETS[name];
}

/**
 * Get the default accent color for a theme
 */
export function getDefaultAccent(themeName: ThemeName): AccentColor {
  const theme = getTheme(themeName);
  return theme.accentOptions[0];
}

/**
 * Find an accent color by ID within a theme
 */
export function findAccentColor(
  themeName: ThemeName,
  accentId: string
): AccentColor | undefined {
  const theme = getTheme(themeName);
  return theme.accentOptions.find((a) => a.id === accentId);
}

/**
 * Get the effective accent color for a theme
 * Returns the custom accent if valid, otherwise the default
 */
export function getEffectiveAccent(
  themeName: ThemeName,
  customAccentId?: string | null
): AccentColor {
  if (customAccentId) {
    const custom = findAccentColor(themeName, customAccentId);
    if (custom) return custom;
  }
  return getDefaultAccent(themeName);
}

/**
 * Convert theme colors to CSS custom properties
 */
export function themeToCSSProperties(
  theme: ThemePreset,
  accent?: AccentColor
): Record<string, string> {
  const effectiveAccent = accent ?? theme.accentOptions[0];

  return {
    "--color-paper": theme.colors.paper,
    "--color-paper-warm": theme.colors.paperWarm,
    "--color-ink": theme.colors.ink,
    "--color-ink-light": theme.colors.inkLight,
    "--color-ink-muted": theme.colors.inkMuted,
    "--color-accent": effectiveAccent.color,
    "--color-accent-soft": effectiveAccent.soft,
    "--color-highlight": theme.colors.highlight,
    "--color-border": theme.colors.border,
    "--color-border-strong": theme.colors.borderStrong,
  };
}

/**
 * Determine if system prefers dark mode
 */
export function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Resolve "system" theme preference to an actual theme
 * Maps to paper (light) or midnight (dark) based on system preference
 */
export function resolveSystemTheme(): ThemeName {
  return systemPrefersDark() ? "midnight" : "paper";
}
