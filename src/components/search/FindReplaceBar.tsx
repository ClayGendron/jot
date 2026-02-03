/**
 * FindReplaceBar Component
 *
 * Floating search bar for in-document find and replace.
 * Positioned at top-right of the editor, appears when Cmd+F is pressed.
 *
 * Supports both TipTap (HTML) and CodeMirror 6 (Markdown) editors.
 */

import { useEffect, useRef, useCallback } from "react";
import {
  Search,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Editor } from "@tiptap/react";
import type { EditorView } from "@codemirror/view";
import { useSearchStore } from "@/stores/searchStore";
import type { SearchAndReplaceStorage } from "@/components/editor/extensions/SearchAndReplace";
import {
  setSearchQuery as cmSetSearchQuery,
  findNext as cmFindNext,
  findPrevious as cmFindPrevious,
  replaceOne as cmReplaceOne,
  replaceAll as cmReplaceAll,
  clearSearch as cmClearSearch,
  getSearchState as cmGetSearchState,
} from "@/components/editor/codemirror/extensions/search";

/**
 * Helper to safely access SearchAndReplace storage from TipTap editor
 */
function getSearchStorage(editor: Editor | null): SearchAndReplaceStorage | null {
  if (!editor) return null;
  return (editor.storage as { searchAndReplace?: SearchAndReplaceStorage }).searchAndReplace ?? null;
}

interface FindReplaceBarProps {
  /** TipTap editor instance (for HTML mode) */
  editor?: Editor | null;
  /** CodeMirror EditorView (for Markdown mode) */
  cmView?: EditorView | null;
  /** Callback when bar should close */
  onClose: () => void;
}

export function FindReplaceBar({ editor, cmView, onClose }: FindReplaceBarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Determine which editor mode we're in
  const isCM6 = !!cmView;

  // Individual selectors to avoid React 19 + Zustand issues
  const searchTerm = useSearchStore((s) => s.documentSearchTerm);
  const replaceTerm = useSearchStore((s) => s.documentReplaceTerm);
  const caseSensitive = useSearchStore((s) => s.documentCaseSensitive);
  const useRegex = useSearchStore((s) => s.documentUseRegex);
  const currentMatch = useSearchStore((s) => s.documentCurrentMatch);
  const totalMatches = useSearchStore((s) => s.documentTotalMatches);

  const setSearchTerm = useSearchStore((s) => s.setDocumentSearchTerm);
  const setReplaceTerm = useSearchStore((s) => s.setDocumentReplaceTerm);
  const toggleCaseSensitive = useSearchStore((s) => s.toggleDocumentCaseSensitive);
  const toggleUseRegex = useSearchStore((s) => s.toggleDocumentUseRegex);
  const setMatchInfo = useSearchStore((s) => s.setDocumentMatchInfo);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);

  // Update search when term, case sensitivity, or regex mode changes - TipTap
  useEffect(() => {
    if (isCM6 || !editor) return;

    if (!searchTerm) {
      editor.commands.clearSearch();
      setMatchInfo(0, 0);
      return;
    }

    // Sync useRegex state with editor first
    editor.commands.setUseRegex(useRegex);
    editor.commands.setSearchTerm(searchTerm, caseSensitive);

    // Update match counts from storage
    const storage = getSearchStorage(editor);
    if (storage) {
      const total = storage.results.length;
      const current = total > 0 ? storage.resultIndex + 1 : 0;
      setMatchInfo(current, total);
    }
  }, [editor, searchTerm, caseSensitive, useRegex, setMatchInfo, isCM6]);

  // Update search when term, case sensitivity, or regex mode changes - CM6
  useEffect(() => {
    if (!isCM6 || !cmView) return;

    if (!searchTerm) {
      cmClearSearch(cmView);
      setMatchInfo(0, 0);
      return;
    }

    cmSetSearchQuery(cmView, {
      search: searchTerm,
      replace: replaceTerm,
      caseSensitive,
      regexp: useRegex,
    });

    // Update match counts from CM6 state
    const state = cmGetSearchState(cmView);
    setMatchInfo(state.currentMatch, state.matchCount);
  }, [cmView, searchTerm, replaceTerm, caseSensitive, useRegex, setMatchInfo, isCM6]);

  // Sync match counts when document changes - TipTap
  useEffect(() => {
    if (isCM6 || !editor || !searchTerm) return;

    const updateMatchCounts = () => {
      const storage = getSearchStorage(editor);
      if (storage) {
        const total = storage.results.length;
        const current = total > 0 ? storage.resultIndex + 1 : 0;
        setMatchInfo(current, total);
      }
    };

    // Listen for editor updates (includes document changes)
    editor.on("update", updateMatchCounts);

    return () => {
      editor.off("update", updateMatchCounts);
    };
  }, [editor, searchTerm, setMatchInfo, isCM6]);

  // Sync match counts when document changes - CM6
  useEffect(() => {
    if (!isCM6 || !cmView || !searchTerm) return;

    // CM6 doesn't have an event system like TipTap
    // We update counts in the handlers instead
  }, [cmView, searchTerm, isCM6]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (isCM6 && cmView) {
      cmFindNext(cmView);
      const state = cmGetSearchState(cmView);
      setMatchInfo(state.currentMatch, state.matchCount);
    } else if (editor) {
      editor.commands.nextSearchResult();
      const storage = getSearchStorage(editor);
      if (storage && storage.results.length > 0) {
        setMatchInfo(storage.resultIndex + 1, storage.results.length);
      }
    }
  }, [editor, cmView, isCM6, setMatchInfo]);

  const handlePrevious = useCallback(() => {
    if (isCM6 && cmView) {
      cmFindPrevious(cmView);
      const state = cmGetSearchState(cmView);
      setMatchInfo(state.currentMatch, state.matchCount);
    } else if (editor) {
      editor.commands.previousSearchResult();
      const storage = getSearchStorage(editor);
      if (storage && storage.results.length > 0) {
        setMatchInfo(storage.resultIndex + 1, storage.results.length);
      }
    }
  }, [editor, cmView, isCM6, setMatchInfo]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          handlePrevious();
        } else {
          handleNext();
        }
      } else if (e.key === "F3" || (e.key === "g" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        if (e.shiftKey) {
          handlePrevious();
        } else {
          handleNext();
        }
      }
    },
    [onClose, handleNext, handlePrevious]
  );

  const handleReplace = useCallback(() => {
    if (isCM6 && cmView) {
      // Update replace term first
      cmSetSearchQuery(cmView, {
        search: searchTerm,
        replace: replaceTerm,
        caseSensitive,
        regexp: useRegex,
      });
      cmReplaceOne(cmView);
      const state = cmGetSearchState(cmView);
      setMatchInfo(state.currentMatch, state.matchCount);
    } else if (editor) {
      editor.commands.setReplaceTerm(replaceTerm);
      editor.commands.replace();

      // Update match counts
      const storage = getSearchStorage(editor);
      if (storage) {
        const total = storage.results.length;
        const current = total > 0 ? storage.resultIndex + 1 : 0;
        setMatchInfo(current, total);
      }
    }
  }, [editor, cmView, isCM6, searchTerm, replaceTerm, caseSensitive, useRegex, setMatchInfo]);

  const handleReplaceAll = useCallback(() => {
    if (isCM6 && cmView) {
      // Update replace term first
      cmSetSearchQuery(cmView, {
        search: searchTerm,
        replace: replaceTerm,
        caseSensitive,
        regexp: useRegex,
      });
      cmReplaceAll(cmView);
      setMatchInfo(0, 0);
    } else if (editor) {
      editor.commands.setReplaceTerm(replaceTerm);
      editor.commands.replaceAll();
      setMatchInfo(0, 0);
    }
  }, [editor, cmView, isCM6, searchTerm, replaceTerm, caseSensitive, useRegex, setMatchInfo]);

  const handleToggleCaseSensitive = useCallback(() => {
    toggleCaseSensitive();
    // The search will update via the useEffect when caseSensitive changes
  }, [toggleCaseSensitive]);

  const handleToggleUseRegex = useCallback(() => {
    toggleUseRegex();
    // The search will update via the useEffect when useRegex changes
  }, [toggleUseRegex]);

  const handleClose = useCallback(() => {
    if (isCM6 && cmView) {
      cmClearSearch(cmView);
    } else if (editor) {
      editor.commands.clearSearch();
    }
    onClose();
  }, [editor, cmView, isCM6, onClose]);

  return (
    <div
      className="absolute top-14 right-4 z-[110] flex flex-col gap-1.5 px-3 py-2.5 bg-[var(--color-paper)] border border-[var(--color-border)] rounded-lg shadow-md min-w-[380px]"
      role="search"
      aria-label="Find and replace"
      onKeyDown={handleKeyDown}
    >
      {/* Search row */}
      <div className="flex items-center gap-2">
        <div className="flex items-center flex-1 gap-1.5 px-2 py-1.5 bg-[var(--color-paper-warm)] border border-[var(--color-border)] rounded transition-colors focus-within:border-[var(--color-accent)]">
          <Search className="h-3.5 w-3.5 text-[var(--color-ink-muted)] shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            className="flex-1 border-none bg-transparent font-sans text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-muted)]"
            placeholder="Find..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search text"
          />
        </div>

        {/* Match counter */}
        <span className="font-mono text-xs text-[var(--color-ink-muted)] min-w-16 text-center" aria-live="polite">
          {totalMatches > 0 ? `${currentMatch}/${totalMatches}` : "No results"}
        </span>

        {/* Navigation */}
        <div className="flex gap-0.5">
          <button
            type="button"
            className="flex items-center justify-center p-1 border-none bg-transparent rounded text-[var(--color-ink-light)] cursor-pointer transition-colors hover:not-disabled:bg-[var(--color-paper-warm)] hover:not-disabled:text-[var(--color-ink)] disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handlePrevious}
            disabled={totalMatches === 0}
            title="Previous (Shift+Enter)"
            aria-label="Previous match"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="flex items-center justify-center p-1 border-none bg-transparent rounded text-[var(--color-ink-light)] cursor-pointer transition-colors hover:not-disabled:bg-[var(--color-paper-warm)] hover:not-disabled:text-[var(--color-ink)] disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleNext}
            disabled={totalMatches === 0}
            title="Next (Enter)"
            aria-label="Next match"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Options */}
        <button
          type="button"
          className={cn(
            "flex items-center justify-center px-1.5 py-1 border-none bg-transparent rounded font-mono text-xs font-semibold text-[var(--color-ink-light)] cursor-pointer transition-colors",
            "hover:bg-[var(--color-paper-warm)] hover:text-[var(--color-ink)]",
            caseSensitive && "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
          )}
          onClick={handleToggleCaseSensitive}
          title="Case sensitive"
          aria-label="Toggle case sensitivity"
          aria-pressed={caseSensitive}
        >
          Aa
        </button>
        <button
          type="button"
          className={cn(
            "flex items-center justify-center px-1.5 py-1 border-none bg-transparent rounded font-mono text-xs font-semibold text-[var(--color-ink-light)] cursor-pointer transition-colors",
            "hover:bg-[var(--color-paper-warm)] hover:text-[var(--color-ink)]",
            useRegex && "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
          )}
          onClick={handleToggleUseRegex}
          title="Use regular expression"
          aria-label="Toggle regex mode"
          aria-pressed={useRegex}
        >
          .*
        </button>

        {/* Close */}
        <button
          type="button"
          className="flex items-center justify-center p-1 ml-1 border-none bg-transparent rounded text-[var(--color-ink-light)] cursor-pointer transition-colors hover:bg-[var(--color-paper-warm)] hover:text-[var(--color-ink)]"
          onClick={handleClose}
          title="Close (Escape)"
          aria-label="Close search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Replace row */}
      <div className="flex items-center gap-2 pt-1 border-t border-[var(--color-border)] mt-0.5">
        <div className="flex items-center flex-1 gap-1.5 px-2 py-1.5 bg-[var(--color-paper-warm)] border border-[var(--color-border)] rounded transition-colors focus-within:border-[var(--color-accent)]">
          <ArrowUpDown className="h-3.5 w-3.5 text-[var(--color-ink-muted)] shrink-0" />
          <input
            ref={replaceInputRef}
            type="text"
            className="flex-1 border-none bg-transparent font-sans text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-muted)]"
            placeholder="Replace..."
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            aria-label="Replacement text"
          />
        </div>

        {/* Replace actions */}
        <div className="flex gap-1 ml-auto">
          <button
            type="button"
            className="flex items-center justify-center px-2 py-1 font-sans text-xs bg-[var(--color-paper-warm)] border border-[var(--color-border)] rounded text-[var(--color-ink-light)] cursor-pointer transition-colors hover:not-disabled:bg-[var(--color-border)] disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleReplace}
            disabled={totalMatches === 0}
            title="Replace current"
          >
            Replace
          </button>
          <button
            type="button"
            className="flex items-center justify-center px-2 py-1 font-sans text-xs bg-[var(--color-paper-warm)] border border-[var(--color-border)] rounded text-[var(--color-ink-light)] cursor-pointer transition-colors hover:not-disabled:bg-[var(--color-border)] disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleReplaceAll}
            disabled={totalMatches === 0}
            title="Replace all"
          >
            All
          </button>
        </div>
      </div>
    </div>
  );
}

export default FindReplaceBar;
