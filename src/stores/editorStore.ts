import { create } from "zustand";
import type { ThemeName } from "@/lib/settings/themes";

/**
 * Editor state management using Zustand
 *
 * Design: Separates document state from UI state for testability.
 * Pure state updates, side effects handled in components/hooks.
 */

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface DocumentState {
  /** Current file path (null if untitled) */
  filePath: string | null;
  /** Document content as Markdown */
  content: string;
  /** Whether document has unsaved changes */
  isDirty: boolean;
  /** Last saved timestamp */
  lastSaved: Date | null;
  /** Current save operation status */
  saveStatus: SaveStatus;
  /** Error message if save failed */
  saveError: string | null;
}

/** Layout state for panels and zen mode */
export interface LayoutState {
  /** Sidebar width in pixels */
  sidebarWidth: number;
  /** Whether zen mode (distraction-free) is active */
  zenMode: boolean;
}

export type FontFamily = "serif" | "sans" | "mono";

export interface EditorUIState {
  /** Whether sidebar is visible */
  sidebarOpen: boolean;
  /** Whether editor is in focus mode */
  focusMode: boolean;
  /** Current theme (legacy: light/dark/system) */
  theme: "light" | "dark" | "system";
  /** Theme preset name */
  themeName: ThemeName;
  /** Custom accent color ID (null uses theme default) */
  accentColorId: string | null;
  /** Editor font family */
  fontFamily: FontFamily;
  /** Font size in pixels */
  fontSize: number;
  /** Line height multiplier */
  lineHeight: number;
  /** Maximum line width in characters */
  maxLineWidth: number;
  /** Typewriter mode (keeps current line centered) */
  typewriterMode: boolean;
  /** Show raw markdown vs WYSIWYG */
  sourceMode: boolean;
  /** Show line numbers in code blocks */
  showLineNumbers: boolean;
  /** Whether filesystem is case-sensitive (Linux: true, Windows/macOS: false) */
  isCaseSensitiveFs: boolean;
}

export interface EditorState extends DocumentState, EditorUIState, LayoutState {
  // Document actions
  setContent: (content: string) => void;
  setFilePath: (path: string | null) => void;
  markSaved: () => void;
  markDirty: () => void;
  resetDocument: () => void;
  setSaveStatus: (status: SaveStatus, error?: string | null) => void;

  // UI actions
  toggleSidebar: () => void;
  toggleFocusMode: () => void;
  toggleSourceMode: () => void;
  toggleLineNumbers: () => void;
  toggleTypewriterMode: () => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setThemeName: (themeName: ThemeName) => void;
  setAccentColorId: (accentColorId: string | null) => void;
  setFontFamily: (fontFamily: FontFamily) => void;
  setFontSize: (size: number) => void;
  setLineHeight: (height: number) => void;
  setMaxLineWidth: (width: number) => void;
  setSidebarWidth: (width: number) => void;
  toggleZenMode: () => void;
  setLayoutState: (layout: Partial<LayoutState>) => void;
  setIsCaseSensitiveFs: (value: boolean) => void;
}

const initialDocumentState: DocumentState = {
  filePath: null,
  content: "",
  isDirty: false,
  lastSaved: null,
  saveStatus: "idle",
  saveError: null,
};

/** Default sidebar width in pixels */
export const DEFAULT_SIDEBAR_WIDTH = 260;

/** Minimum sidebar width in pixels */
export const MIN_SIDEBAR_WIDTH = 180;

/** Maximum sidebar width in pixels */
export const MAX_SIDEBAR_WIDTH = 500;

const initialUIState: EditorUIState = {
  sidebarOpen: true,
  focusMode: false,
  theme: "system",
  themeName: "paper",
  accentColorId: null,
  fontFamily: "serif",
  fontSize: 18,
  lineHeight: 1.8,
  maxLineWidth: 72,
  typewriterMode: false,
  sourceMode: false,
  showLineNumbers: false,
  isCaseSensitiveFs: false, // Default to case-insensitive (Windows/macOS), updated at startup
};

const initialLayoutState: LayoutState = {
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  zenMode: false,
};

export const useEditorStore = create<EditorState>((set) => ({
  // Initial state
  ...initialDocumentState,
  ...initialUIState,
  ...initialLayoutState,

  // Document actions
  setContent: (content) =>
    set((state) => ({
      content,
      isDirty: content !== state.content || state.isDirty,
    })),

  setFilePath: (filePath) => set({ filePath }),

  markSaved: () =>
    set({
      isDirty: false,
      lastSaved: new Date(),
    }),

  markDirty: () => set({ isDirty: true }),

  resetDocument: () => set(initialDocumentState),

  setSaveStatus: (status, error = null) =>
    set({
      saveStatus: status,
      saveError: error,
    }),

  // UI actions
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),

  toggleSourceMode: () => set((state) => ({ sourceMode: !state.sourceMode })),

  toggleLineNumbers: () =>
    set((state) => ({ showLineNumbers: !state.showLineNumbers })),

  toggleTypewriterMode: () =>
    set((state) => ({ typewriterMode: !state.typewriterMode })),

  setTheme: (theme) => set({ theme }),

  setThemeName: (themeName) => set({ themeName }),

  setAccentColorId: (accentColorId) => set({ accentColorId }),

  setFontFamily: (fontFamily) => set({ fontFamily }),

  setFontSize: (fontSize) => set({ fontSize }),

  setLineHeight: (lineHeight) => set({ lineHeight }),

  setMaxLineWidth: (maxLineWidth) => set({ maxLineWidth }),

  setSidebarWidth: (sidebarWidth) =>
    set({
      sidebarWidth: Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, sidebarWidth)
      ),
    }),

  toggleZenMode: () => set((state) => ({ zenMode: !state.zenMode })),

  setLayoutState: (layout) => set(layout),

  setIsCaseSensitiveFs: (isCaseSensitiveFs) => set({ isCaseSensitiveFs }),
}));

