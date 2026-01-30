import { create } from "zustand";

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
  /** Document content as HTML (TipTap's internal format) */
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

export interface EditorUIState {
  /** Whether sidebar is visible */
  sidebarOpen: boolean;
  /** Whether editor is in focus mode */
  focusMode: boolean;
  /** Current theme */
  theme: "light" | "dark" | "system";
  /** Show raw markdown vs WYSIWYG */
  sourceMode: boolean;
  /** Show line numbers in code blocks */
  showLineNumbers: boolean;
  /** Sidebar width in pixels */
  sidebarWidth: number;
  /** Whether zen mode (distraction-free) is active */
  zenMode: boolean;
}

export interface EditorState extends DocumentState, EditorUIState {
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
  setTheme: (theme: "light" | "dark" | "system") => void;
  setSidebarWidth: (width: number) => void;
  toggleZenMode: () => void;
  setLayoutState: (layout: Partial<LayoutState>) => void;
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
  sourceMode: false,
  showLineNumbers: false,
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  zenMode: false,
};

export const useEditorStore = create<EditorState>((set) => ({
  // Initial state
  ...initialDocumentState,
  ...initialUIState,

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

  setTheme: (theme) => set({ theme }),

  setSidebarWidth: (sidebarWidth) =>
    set({
      sidebarWidth: Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, sidebarWidth)
      ),
    }),

  toggleZenMode: () => set((state) => ({ zenMode: !state.zenMode })),

  setLayoutState: (layout) => set(layout),
}));

/**
 * Selector functions for optimized re-renders
 */
export const selectDocument = (state: EditorState): DocumentState => ({
  filePath: state.filePath,
  content: state.content,
  isDirty: state.isDirty,
  lastSaved: state.lastSaved,
  saveStatus: state.saveStatus,
  saveError: state.saveError,
});

export const selectUIState = (state: EditorState): EditorUIState => ({
  sidebarOpen: state.sidebarOpen,
  focusMode: state.focusMode,
  theme: state.theme,
  sourceMode: state.sourceMode,
  showLineNumbers: state.showLineNumbers,
  sidebarWidth: state.sidebarWidth,
  zenMode: state.zenMode,
});

export const selectLayoutState = (state: EditorState): LayoutState => ({
  sidebarWidth: state.sidebarWidth,
  zenMode: state.zenMode,
});
