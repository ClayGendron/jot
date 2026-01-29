import { create } from "zustand";

/**
 * Editor state management using Zustand
 *
 * Design: Separates document state from UI state for testability.
 * Pure state updates, side effects handled in components/hooks.
 */

export interface DocumentState {
  /** Current file path (null if untitled) */
  filePath: string | null;
  /** Document content as HTML (TipTap's internal format) */
  content: string;
  /** Whether document has unsaved changes */
  isDirty: boolean;
  /** Last saved timestamp */
  lastSaved: Date | null;
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
}

export interface EditorState extends DocumentState, EditorUIState {
  // Document actions
  setContent: (content: string) => void;
  setFilePath: (path: string | null) => void;
  markSaved: () => void;
  markDirty: () => void;
  resetDocument: () => void;

  // UI actions
  toggleSidebar: () => void;
  toggleFocusMode: () => void;
  toggleSourceMode: () => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
}

const initialDocumentState: DocumentState = {
  filePath: null,
  content: "",
  isDirty: false,
  lastSaved: null,
};

const initialUIState: EditorUIState = {
  sidebarOpen: true,
  focusMode: false,
  theme: "system",
  sourceMode: false,
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

  // UI actions
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),

  toggleSourceMode: () => set((state) => ({ sourceMode: !state.sourceMode })),

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
});

export const selectUIState = (state: EditorState): EditorUIState => ({
  sidebarOpen: state.sidebarOpen,
  focusMode: state.focusMode,
  theme: state.theme,
  sourceMode: state.sourceMode,
});
