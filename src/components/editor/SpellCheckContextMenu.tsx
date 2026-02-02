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
import { XCircle, BookPlus, SkipForward } from "lucide-react";
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
            <XCircle className="h-4 w-4 spell-context-menu-icon-error" />
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
            <BookPlus className="h-4 w-4" />
            <span>Add to Dictionary</span>
          </button>

          <button
            className="spell-context-menu-item"
            onClick={handleIgnore}
            role="menuitem"
          >
            <SkipForward className="h-4 w-4" />
            <span>Ignore</span>
          </button>
        </>
      )}
    </div>
  );
}

export default SpellCheckContextMenu;
