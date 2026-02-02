/**
 * FindReplaceBar Component
 *
 * Floating search bar for in-document find and replace.
 * Positioned at top-right of the editor, appears when Cmd+F is pressed.
 */

import { useEffect, useRef, useCallback } from "react";
import {
  Search,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  X,
} from "lucide-react";
import type { Editor } from "@tiptap/react";
import { useSearchStore } from "@/stores/searchStore";
import type { SearchAndReplaceStorage } from "@/components/editor/extensions/SearchAndReplace";

/**
 * Helper to safely access SearchAndReplace storage from editor
 */
function getSearchStorage(editor: Editor | null): SearchAndReplaceStorage | null {
  if (!editor) return null;
  return (editor.storage as { searchAndReplace?: SearchAndReplaceStorage }).searchAndReplace ?? null;
}

interface FindReplaceBarProps {
  editor: Editor | null;
  onClose: () => void;
}

export function FindReplaceBar({ editor, onClose }: FindReplaceBarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

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

  // Update search when term, case sensitivity, or regex mode changes
  useEffect(() => {
    if (!editor) return;

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
  }, [editor, searchTerm, caseSensitive, useRegex, setMatchInfo]);

  // Sync match counts when document changes (decorations update on edit)
  useEffect(() => {
    if (!editor || !searchTerm) return;

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
  }, [editor, searchTerm, setMatchInfo]);

  // Navigation handlers (defined before handleKeyDown which uses them)
  const handleNext = useCallback(() => {
    if (!editor) return;
    editor.commands.nextSearchResult();
    const storage = getSearchStorage(editor);
    if (storage && storage.results.length > 0) {
      setMatchInfo(storage.resultIndex + 1, storage.results.length);
    }
  }, [editor, setMatchInfo]);

  const handlePrevious = useCallback(() => {
    if (!editor) return;
    editor.commands.previousSearchResult();
    const storage = getSearchStorage(editor);
    if (storage && storage.results.length > 0) {
      setMatchInfo(storage.resultIndex + 1, storage.results.length);
    }
  }, [editor, setMatchInfo]);

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
    if (!editor) return;
    editor.commands.setReplaceTerm(replaceTerm);
    editor.commands.replace();

    // Update match counts
    const storage = getSearchStorage(editor);
    if (storage) {
      const total = storage.results.length;
      const current = total > 0 ? storage.resultIndex + 1 : 0;
      setMatchInfo(current, total);
    }
  }, [editor, replaceTerm, setMatchInfo]);

  const handleReplaceAll = useCallback(() => {
    if (!editor) return;
    editor.commands.setReplaceTerm(replaceTerm);
    editor.commands.replaceAll();
    setMatchInfo(0, 0);
  }, [editor, replaceTerm, setMatchInfo]);

  const handleToggleCaseSensitive = useCallback(() => {
    toggleCaseSensitive();
    if (editor && searchTerm) {
      // Re-run search with new case sensitivity
      editor.commands.setCaseSensitive(!caseSensitive);
      const storage = getSearchStorage(editor);
      if (storage) {
        const total = storage.results.length;
        const current = total > 0 ? storage.resultIndex + 1 : 0;
        setMatchInfo(current, total);
      }
    }
  }, [editor, searchTerm, caseSensitive, toggleCaseSensitive, setMatchInfo]);

  const handleToggleUseRegex = useCallback(() => {
    toggleUseRegex();
    if (editor && searchTerm) {
      // Re-run search with new regex mode
      editor.commands.setUseRegex(!useRegex);
      const storage = getSearchStorage(editor);
      if (storage) {
        const total = storage.results.length;
        const current = total > 0 ? storage.resultIndex + 1 : 0;
        setMatchInfo(current, total);
      }
    }
  }, [editor, searchTerm, useRegex, toggleUseRegex, setMatchInfo]);

  const handleClose = useCallback(() => {
    if (editor) {
      editor.commands.clearSearch();
    }
    onClose();
  }, [editor, onClose]);

  return (
    <div
      className="find-replace-bar"
      role="search"
      aria-label="Find and replace"
      onKeyDown={handleKeyDown}
    >
      {/* Search row */}
      <div className="find-replace-row">
        <div className="find-replace-input-group">
          <Search className="h-3.5 w-3.5 find-replace-icon" />
          <input
            ref={searchInputRef}
            type="text"
            className="find-replace-input"
            placeholder="Find..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search text"
          />
        </div>

        {/* Match counter */}
        <span className="find-replace-counter" aria-live="polite">
          {totalMatches > 0 ? `${currentMatch}/${totalMatches}` : "No results"}
        </span>

        {/* Navigation */}
        <div className="find-replace-nav">
          <button
            type="button"
            className="find-replace-btn"
            onClick={handlePrevious}
            disabled={totalMatches === 0}
            title="Previous (Shift+Enter)"
            aria-label="Previous match"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="find-replace-btn"
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
          className={`find-replace-btn find-replace-toggle ${caseSensitive ? "active" : ""}`}
          onClick={handleToggleCaseSensitive}
          title="Case sensitive"
          aria-label="Toggle case sensitivity"
          aria-pressed={caseSensitive}
        >
          Aa
        </button>
        <button
          type="button"
          className={`find-replace-btn find-replace-toggle ${useRegex ? "active" : ""}`}
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
          className="find-replace-btn find-replace-close"
          onClick={handleClose}
          title="Close (Escape)"
          aria-label="Close search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Replace row */}
      <div className="find-replace-row find-replace-row-secondary">
        <div className="find-replace-input-group">
          <ArrowUpDown className="h-3.5 w-3.5 find-replace-icon" />
          <input
            ref={replaceInputRef}
            type="text"
            className="find-replace-input"
            placeholder="Replace..."
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            aria-label="Replacement text"
          />
        </div>

        {/* Replace actions */}
        <div className="find-replace-actions">
          <button
            type="button"
            className="find-replace-btn find-replace-action"
            onClick={handleReplace}
            disabled={totalMatches === 0}
            title="Replace current"
          >
            Replace
          </button>
          <button
            type="button"
            className="find-replace-btn find-replace-action"
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
