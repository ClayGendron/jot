/**
 * Spell Check Context Menu Component
 *
 * Right-click context menu for misspelled words with:
 * - Spelling suggestions
 * - Add to Dictionary option
 * - Ignore (session only) option
 *
 * Supports both TipTap (HTML) and CodeMirror 6 (Markdown) editors.
 */

import { useEffect, useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import type { EditorView } from "@codemirror/view";
import { XCircle, BookPlus, SkipForward, Check } from "lucide-react";
import { usePositionedMenu } from "@/hooks/usePositionedMenu";
import {
  PositionedMenu,
  PositionedMenuItem,
  PositionedMenuSeparator,
  PositionedMenuHeader,
  PositionedMenuEmpty,
  PositionedMenuFeedback,
} from "@/components/ui/positioned-menu";
import { getSpellSuggestions } from "./extensions/SpellCheck";
import { addToPersonalDictionary } from "@/lib/spellcheck/personalDictionary";
import {
  replaceWord as cmReplaceWord,
  addToIgnored as cmAddToIgnored,
  refreshSpellCheck as cmRefreshSpellCheck,
} from "./codemirror/extensions/spellCheck";
import { addToPersonalDictionaryMemory } from "@/lib/spellcheck";

interface SpellCheckContextMenuProps {
  /** Position to show the menu */
  position: { x: number; y: number };
  /** The misspelled word */
  word: string;
  /** Position of the word in the document (from) */
  from: number;
  /** Position of the word in the document (to) */
  to: number;
  /** TipTap editor instance (for HTML mode) */
  editor?: Editor;
  /** CodeMirror EditorView (for Markdown mode) */
  cmView?: EditorView;
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
  cmView,
  onDismiss,
}: SpellCheckContextMenuProps) {
  const menuRef = usePositionedMenu({ onDismiss });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Determine which editor mode we're in
  const isCM6 = !!cmView;

  // Load suggestions on mount
  useEffect(() => {
    const sugs = getSpellSuggestions(word);
    setSuggestions(sugs.slice(0, MAX_SUGGESTIONS));
  }, [word]);

  // Handle suggestion click - replace word
  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      if (isCM6 && cmView) {
        cmReplaceWord(cmView, from, to, suggestion);
        cmRefreshSpellCheck(cmView);
      } else if (editor) {
        editor.commands.replaceWord(from, to, suggestion);
      }
      onDismiss();
    },
    [editor, cmView, isCM6, from, to, onDismiss]
  );

  // Handle Add to Dictionary
  const handleAddToDictionary = useCallback(async () => {
    try {
      // Add to persistent dictionary
      await addToPersonalDictionary(word);

      if (isCM6 && cmView) {
        // Update in-memory dictionary and refresh decorations
        addToPersonalDictionaryMemory(word);
        cmRefreshSpellCheck(cmView);
      } else if (editor) {
        // Update in-memory (via editor command which updates decorations)
        editor.commands.addToPersonalDictionary(word);
      }

      setFeedbackMessage("Added to dictionary");
      setTimeout(onDismiss, 1000);
    } catch (error) {
      console.error("Failed to add word to dictionary:", error);
      onDismiss();
    }
  }, [word, editor, cmView, isCM6, onDismiss]);

  // Handle Ignore (session only)
  const handleIgnore = useCallback(() => {
    if (isCM6 && cmView) {
      cmAddToIgnored(cmView, word);
      cmRefreshSpellCheck(cmView);
    } else if (editor) {
      editor.commands.ignoreWord(word);
    }
    onDismiss();
  }, [word, editor, cmView, isCM6, onDismiss]);

  return (
    <PositionedMenu
      ref={menuRef}
      position={position}
      menuWidth={220}
      menuHeight={280}
      aria-label="Spelling suggestions"
    >
      {feedbackMessage ? (
        <PositionedMenuFeedback>
          <Check className="h-4 w-4 text-green-500" />
          {feedbackMessage}
        </PositionedMenuFeedback>
      ) : (
        <>
          {/* Misspelled word header */}
          <PositionedMenuHeader>
            <XCircle className="h-4 w-4 text-destructive" />
            <span className="font-medium text-foreground">{word}</span>
          </PositionedMenuHeader>

          {/* Suggestions */}
          {suggestions.length > 0 ? (
            <div className="py-1">
              {suggestions.map((suggestion, index) => (
                <PositionedMenuItem
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </PositionedMenuItem>
              ))}
            </div>
          ) : (
            <PositionedMenuEmpty>No suggestions</PositionedMenuEmpty>
          )}

          <PositionedMenuSeparator />

          {/* Actions */}
          <PositionedMenuItem onClick={handleAddToDictionary}>
            <BookPlus className="h-4 w-4" />
            <span>Add to Dictionary</span>
          </PositionedMenuItem>

          <PositionedMenuItem onClick={handleIgnore}>
            <SkipForward className="h-4 w-4" />
            <span>Ignore</span>
          </PositionedMenuItem>
        </>
      )}
    </PositionedMenu>
  );
}

export default SpellCheckContextMenu;
