/**
 * Spell Check Context Menu Component
 *
 * Right-click context menu for misspelled words with:
 * - Spelling suggestions
 * - Add to Dictionary option
 * - Ignore (session only) option
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { getSpellSuggestions } from "./extensions/SpellCheck";
import { addToPersonalDictionary } from "@/lib/spellcheck/personalDictionary";

interface SpellCheckContextMenuProps {
  /** Position to show the menu */
  position: { x: number; y: number };
  /** The misspelled word */
  word: string;
  /** Position of the word in the document (from) */
  from: number;
  /** Position of the word in the document (to) */
  to: number;
  /** TipTap editor instance */
  editor: Editor;
  /** Callback when menu should be dismissed */
  onDismiss: () => void;
}

const MAX_SUGGESTIONS = 8;

/**
 * Context menu for spell check with suggestions
 */
export function SpellCheckContextMenu({
  position,
  word,
  from,
  to,
  editor,
  onDismiss,
}: SpellCheckContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Load suggestions on mount
  useEffect(() => {
    const sugs = getSpellSuggestions(word);
    setSuggestions(sugs.slice(0, MAX_SUGGESTIONS));
  }, [word]);

  // Adjust position to keep menu on screen
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 220),
    y: Math.min(position.y, window.innerHeight - 280),
  };

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onDismiss]);

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onDismiss();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  // Handle suggestion click - replace word
  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      editor.commands.replaceWord(from, to, suggestion);
      onDismiss();
    },
    [editor, from, to, onDismiss]
  );

  // Handle Add to Dictionary
  const handleAddToDictionary = useCallback(async () => {
    try {
      // Add to persistent dictionary
      await addToPersonalDictionary(word);
      // Also update in-memory (via editor command which updates decorations)
      editor.commands.addToPersonalDictionary(word);
      setFeedbackMessage("Added to dictionary");
      setTimeout(onDismiss, 1000);
    } catch (error) {
      console.error("Failed to add word to dictionary:", error);
      onDismiss();
    }
  }, [word, editor, onDismiss]);

  // Handle Ignore (session only)
  const handleIgnore = useCallback(() => {
    editor.commands.ignoreWord(word);
    onDismiss();
  }, [word, editor, onDismiss]);

  return (
    <div
      ref={menuRef}
      className="spell-context-menu"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
      role="menu"
      aria-label="Spelling suggestions"
    >
      {feedbackMessage ? (
        <div className="spell-context-menu-feedback">{feedbackMessage}</div>
      ) : (
        <>
          {/* Misspelled word header */}
          <div className="spell-context-menu-header">
            <SpellErrorIcon />
            <span className="spell-context-menu-word">{word}</span>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 ? (
            <div className="spell-context-menu-suggestions">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  className="spell-context-menu-item spell-context-menu-suggestion"
                  onClick={() => handleSuggestionClick(suggestion)}
                  role="menuitem"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : (
            <div className="spell-context-menu-no-suggestions">
              No suggestions
            </div>
          )}

          <div className="spell-context-menu-divider" />

          {/* Actions */}
          <button
            className="spell-context-menu-item"
            onClick={handleAddToDictionary}
            role="menuitem"
          >
            <BookPlusIcon />
            <span>Add to Dictionary</span>
          </button>

          <button
            className="spell-context-menu-item"
            onClick={handleIgnore}
            role="menuitem"
          >
            <SkipIcon />
            <span>Ignore</span>
          </button>
        </>
      )}
    </div>
  );
}

// Icons

function SpellErrorIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="spell-context-menu-icon-error"
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 9 6 6" />
      <path d="m15 9-6 6" />
    </svg>
  );
}

function BookPlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      <path d="M9 10h6" />
      <path d="M12 7v6" />
    </svg>
  );
}

function SkipIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 4h4v16H5" />
      <path d="m15 4 5 8-5 8" />
    </svg>
  );
}

export default SpellCheckContextMenu;
