/**
 * Grammar Check Context Menu Component
 *
 * Right-click context menu for grammar issues with:
 * - Issue explanation
 * - Suggestions
 * - Ignore (session only) option
 * - Always ignore this rule option
 */

import { useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { AlertCircle, Check, SkipForward, Ban } from "lucide-react";
import { usePositionedMenu } from "@/hooks/usePositionedMenu";
import {
  PositionedMenu,
  PositionedMenuItem,
  PositionedMenuSeparator,
  PositionedMenuHeader,
  PositionedMenuFeedback,
} from "@/components/ui/positioned-menu";
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
  const menuRef = usePositionedMenu({ onDismiss });
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

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
    <PositionedMenu
      ref={menuRef}
      position={position}
      menuWidth={320}
      menuHeight={350}
      aria-label="Grammar suggestions"
    >
      {feedbackMessage ? (
        <PositionedMenuFeedback>
          <Check className="h-4 w-4 text-green-500" />
          {feedbackMessage}
        </PositionedMenuFeedback>
      ) : (
        <>
          {/* Header */}
          <PositionedMenuHeader>
            <AlertCircle className="h-4 w-4 text-cyan-500" />
            <span className="font-medium text-foreground">{issue.category}</span>
          </PositionedMenuHeader>

          {/* Message */}
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            {issue.message}
          </div>

          {/* Original text */}
          <div className="px-2 py-1 text-xs">
            <span className="text-muted-foreground">Original: </span>
            <span className="font-medium text-foreground">"{issue.text}"</span>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <>
              <PositionedMenuSeparator />
              <div className="py-1">
                {suggestions.map((suggestion, index) => (
                  <PositionedMenuItem
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <Check className="h-4 w-4 text-green-500" />
                    <span>"{suggestion}"</span>
                  </PositionedMenuItem>
                ))}
              </div>
            </>
          )}

          <PositionedMenuSeparator />

          {/* Actions */}
          <PositionedMenuItem onClick={handleIgnore}>
            <SkipForward className="h-4 w-4" />
            <span>Ignore</span>
          </PositionedMenuItem>

          <PositionedMenuItem onClick={handleAlwaysIgnore}>
            <Ban className="h-4 w-4" />
            <span>Always ignore this rule</span>
          </PositionedMenuItem>
        </>
      )}
    </PositionedMenu>
  );
}

export default GrammarCheckContextMenu;
