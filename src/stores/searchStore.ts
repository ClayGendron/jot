import { create } from "zustand";

/**
 * A single match within a file for global search
 */
export interface GlobalSearchMatch {
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
  contextBefore: string | null;
  contextAfter: string | null;
}

/**
 * Search results for a single file
 */
export interface GlobalSearchResult {
  filePath: string;
  fileName: string;
  matches: GlobalSearchMatch[];
}

/**
 * Search state management
 *
 * Manages both document-level search (Cmd+F) and
 * workspace-wide global search (Cmd+Shift+F) state.
 */
export interface SearchState {
  // Document search state
  documentSearchOpen: boolean;
  documentSearchTerm: string;
  documentReplaceTerm: string;
  documentCaseSensitive: boolean;
  documentUseRegex: boolean;
  documentCurrentMatch: number;
  documentTotalMatches: number;

  // Global search state
  globalSearchOpen: boolean;
  globalSearchTerm: string;
  globalCaseSensitive: boolean;
  globalUseRegex: boolean;
  globalPathFilter: string;
  globalResults: GlobalSearchResult[];
  globalIsSearching: boolean;
}

export interface SearchActions {
  // Document search actions
  openDocumentSearch: () => void;
  closeDocumentSearch: () => void;
  setDocumentSearchTerm: (term: string) => void;
  setDocumentReplaceTerm: (term: string) => void;
  toggleDocumentCaseSensitive: () => void;
  toggleDocumentUseRegex: () => void;
  setDocumentMatchInfo: (current: number, total: number) => void;

  // Global search actions
  openGlobalSearch: () => void;
  closeGlobalSearch: () => void;
  setGlobalSearchTerm: (term: string) => void;
  toggleGlobalCaseSensitive: () => void;
  toggleGlobalUseRegex: () => void;
  setGlobalPathFilter: (filter: string) => void;
  setGlobalResults: (results: GlobalSearchResult[]) => void;
  setGlobalIsSearching: (isSearching: boolean) => void;
  clearGlobalResults: () => void;

  // Reset
  reset: () => void;
}

const initialState: SearchState = {
  // Document search
  documentSearchOpen: false,
  documentSearchTerm: "",
  documentReplaceTerm: "",
  documentCaseSensitive: false,
  documentUseRegex: false,
  documentCurrentMatch: 0,
  documentTotalMatches: 0,

  // Global search
  globalSearchOpen: false,
  globalSearchTerm: "",
  globalCaseSensitive: false,
  globalUseRegex: false,
  globalPathFilter: "",
  globalResults: [],
  globalIsSearching: false,
};

export const useSearchStore = create<SearchState & SearchActions>((set) => ({
  ...initialState,

  // Document search actions
  openDocumentSearch: () =>
    set({
      documentSearchOpen: true,
      // Close global search when opening document search
      globalSearchOpen: false,
    }),

  closeDocumentSearch: () =>
    set({
      documentSearchOpen: false,
      documentSearchTerm: "",
      documentReplaceTerm: "",
      documentCurrentMatch: 0,
      documentTotalMatches: 0,
    }),

  setDocumentSearchTerm: (term) => set({ documentSearchTerm: term }),

  setDocumentReplaceTerm: (term) => set({ documentReplaceTerm: term }),

  toggleDocumentCaseSensitive: () =>
    set((state) => ({ documentCaseSensitive: !state.documentCaseSensitive })),

  toggleDocumentUseRegex: () =>
    set((state) => ({ documentUseRegex: !state.documentUseRegex })),

  setDocumentMatchInfo: (current, total) =>
    set({ documentCurrentMatch: current, documentTotalMatches: total }),

  // Global search actions
  openGlobalSearch: () =>
    set({
      globalSearchOpen: true,
      // Close document search when opening global search
      documentSearchOpen: false,
    }),

  closeGlobalSearch: () =>
    set({
      globalSearchOpen: false,
      globalSearchTerm: "",
      globalResults: [],
      globalPathFilter: "",
      globalIsSearching: false,
    }),

  setGlobalSearchTerm: (term) => set({ globalSearchTerm: term }),

  toggleGlobalCaseSensitive: () =>
    set((state) => ({ globalCaseSensitive: !state.globalCaseSensitive })),

  toggleGlobalUseRegex: () =>
    set((state) => ({ globalUseRegex: !state.globalUseRegex })),

  setGlobalPathFilter: (filter) => set({ globalPathFilter: filter }),

  setGlobalResults: (results) =>
    set({ globalResults: results, globalIsSearching: false }),

  setGlobalIsSearching: (isSearching) => set({ globalIsSearching: isSearching }),

  clearGlobalResults: () => set({ globalResults: [] }),

  // Reset
  reset: () => set(initialState),
}));
