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
}

const initialDocumentState: DocumentState = {
  filePath: null,
  content: "",
  isDirty: false,
  lastSaved: null,
  saveStatus: "idle",
  saveError: null,
};

const initialUIState: EditorUIState = {
  sidebarOpen: true,
  focusMode: false,
  theme: "system",
  sourceMode: false,
  showLineNumbers: false,
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
});
