/**
 * Grammar Check Context Menu Component
 *
 * Right-click context menu for grammar issues with:
 * - Issue explanation
 * - Suggestions
 * - Ignore (session only) option
 * - Always ignore this rule option
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import type { GrammarIssue } from "@/lib/grammarcheck";
import { addIgnoredRule } from "@/lib/grammarcheck/ignoredRules";

interface GrammarCheckContextMenuProps {
  /** Position to show the menu */
  position: { x: number; y: number };
  /** The grammar issue */
  issue: GrammarIssue;
  /** TipTap editor instance */
  editor: Editor;
  /** Callback when menu should be dismissed */
  onDismiss: () => void;
}

const MAX_SUGGESTIONS = 5;

/**
 * Context menu for grammar issues with suggestions
 */
export function GrammarCheckContextMenu({
  position,
  issue,
  editor,
  onDismiss,
}: GrammarCheckContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Adjust position to keep menu on screen
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 320),
    y: Math.min(position.y, window.innerHeight - 350),
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

  // Handle suggestion click - replace text
  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      editor.commands.applyGrammarFix(issue.from, issue.to, suggestion);
      onDismiss();
    },
    [editor, issue, onDismiss]
  );

  // Handle Ignore (session only)
  const handleIgnore = useCallback(() => {
    editor.commands.ignoreGrammarIssue(issue.from, issue.to);
    onDismiss();
  }, [issue, editor, onDismiss]);

  // Handle Always Ignore This Rule
  const handleAlwaysIgnore = useCallback(async () => {
    try {
      // Add to persistent ignored rules
      await addIgnoredRule(issue.ruleId);
      // Also update session (via editor command)
      editor.commands.ignoreGrammarRuleSession(issue.ruleId);
      setFeedbackMessage("Rule ignored");
      setTimeout(onDismiss, 1000);
    } catch (error) {
      console.error("Failed to ignore grammar rule:", error);
      onDismiss();
    }
  }, [issue.ruleId, editor, onDismiss]);

  const suggestions = issue.suggestions.slice(0, MAX_SUGGESTIONS);

  return (
    <div
      ref={menuRef}
      className="grammar-context-menu"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
      role="menu"
      aria-label="Grammar suggestions"
    >
      {feedbackMessage ? (
        <div className="grammar-context-menu-feedback">{feedbackMessage}</div>
      ) : (
        <>
          {/* Header */}
          <div className="grammar-context-menu-header">
            <GrammarIcon />
            <span className="grammar-context-menu-category">{issue.category}</span>
          </div>

          {/* Message */}
          <div className="grammar-context-menu-message">
            {issue.message}
          </div>

          {/* Original text */}
          <div className="grammar-context-menu-original">
            <span className="grammar-context-menu-original-label">Original:</span>
            <span className="grammar-context-menu-original-text">"{issue.text}"</span>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <>
              <div className="grammar-context-menu-divider" />
              <div className="grammar-context-menu-suggestions">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    className="grammar-context-menu-item grammar-context-menu-suggestion"
                    onClick={() => handleSuggestionClick(suggestion)}
                    role="menuitem"
                  >
                    <CheckIcon />
                    <span>"{suggestion}"</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="grammar-context-menu-divider" />

          {/* Actions */}
          <button
            className="grammar-context-menu-item"
            onClick={handleIgnore}
            role="menuitem"
          >
            <SkipIcon />
            <span>Ignore</span>
          </button>

          <button
            className="grammar-context-menu-item"
            onClick={handleAlwaysIgnore}
            role="menuitem"
          >
            <IgnoreRuleIcon />
            <span>Always ignore this rule</span>
          </button>
        </>
      )}
    </div>
  );
}

// Icons

function GrammarIcon() {
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
      className="grammar-context-menu-icon"
    >
      <path d="M12 2v8" />
      <path d="m4.93 10.93 1.41 1.41" />
      <path d="M2 18h2" />
      <path d="M20 18h2" />
      <path d="m19.07 10.93-1.41 1.41" />
      <path d="M22 22H2" />
      <path d="m8 22 4-10 4 10" />
    </svg>
  );
}

function CheckIcon() {
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
      <polyline points="20 6 9 17 4 12" />
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

function IgnoreRuleIcon() {
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
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  );
}

export default GrammarCheckContextMenu;
