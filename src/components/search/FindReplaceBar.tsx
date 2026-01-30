/**
 * FindReplaceBar Component
 *
 * Floating search bar for in-document find and replace.
 * Positioned at top-right of the editor, appears when Cmd+F is pressed.
 */

import { useEffect, useRef, useCallback } from "react";
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
          <SearchIcon />
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
            <ChevronUpIcon />
          </button>
          <button
            type="button"
            className="find-replace-btn"
            onClick={handleNext}
            disabled={totalMatches === 0}
            title="Next (Enter)"
            aria-label="Next match"
          >
            <ChevronDownIcon />
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
          <CloseIcon />
        </button>
      </div>

      {/* Replace row */}
      <div className="find-replace-row find-replace-row-secondary">
        <div className="find-replace-input-group">
          <ReplaceIcon />
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

// Icons

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="find-replace-icon"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ReplaceIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="find-replace-icon"
    >
      <path d="M12 3v6" />
      <path d="M9 6l3-3 3 3" />
      <path d="M12 21v-6" />
      <path d="M9 18l3 3 3-3" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default FindReplaceBar;
