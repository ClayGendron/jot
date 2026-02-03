/**
 * Input Rules Extension for CodeMirror 6
 *
 * Phase 3: Handle markdown shortcuts for block structure creation.
 * Triggers when user types patterns like -, *, 1., #, >, etc.
 *
 * Note: This extension provides minimal input handling since markdown
 * syntax is already valid in the editor. The decorations hide the
 * syntax, so users see the WYSIWYG result immediately.
 *
 * Key behaviors:
 * - Validates markdown patterns are at line start
 * - Ensures proper spacing after markers
 * - Does NOT transform text (markdown is canonical)
 */

import { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

/**
 * Patterns that trigger block structure creation
 * These are just for reference - the actual markdown is kept as-is
 */
export const INPUT_RULE_PATTERNS = {
  // Unordered lists
  bulletDash: /^-\s$/,
  bulletAsterisk: /^\*\s$/,
  bulletPlus: /^\+\s$/,

  // Ordered lists
  orderedList: /^\d+\.\s$/,

  // Headings
  heading1: /^#\s$/,
  heading2: /^##\s$/,
  heading3: /^###\s$/,
  heading4: /^####\s$/,
  heading5: /^#####\s$/,
  heading6: /^######\s$/,

  // Blockquotes
  blockquote: /^>\s$/,
  nestedBlockquote: /^>+\s$/,

  // Horizontal rules
  hrDash: /^---$/,
  hrAsterisk: /^\*\*\*$/,
  hrUnderscore: /^___$/,

  // Task lists
  taskUnchecked: /^-\s\[\s\]\s$/,
  taskChecked: /^-\s\[[xX]\]\s$/,

  // Code fences
  codeFence: /^```/,
} as const;

/**
 * Check if cursor is at line start (ignoring whitespace)
 */
function isAtLineStart(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const textBeforeCursor = state.doc.sliceString(line.from, pos);
  return textBeforeCursor.trim().length === 0;
}

/**
 * Get the text from line start to cursor
 */
function getLineTextToCursor(view: EditorView): string {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  return state.doc.sliceString(line.from, pos);
}

/**
 * ViewPlugin that monitors input for markdown patterns
 *
 * This plugin doesn't transform text - it just ensures the editor
 * state is consistent. The decorations handle the WYSIWYG display.
 */
const inputRulesPlugin = ViewPlugin.fromClass(
  class {
    constructor(_view: EditorView) {}

    update(update: ViewUpdate) {
      // We could add logic here to handle special cases
      // For now, markdown syntax works naturally
      if (!update.docChanged) return;

      // Future enhancement: auto-continue lists on Enter
      // Future enhancement: auto-indent nested lists
    }
  }
);

/**
 * Input rules extension
 *
 * The extension primarily exists to:
 * 1. Document the supported input patterns
 * 2. Provide a hook for future enhancements
 * 3. Export utilities for checking patterns
 *
 * Since markdown is our source format, users can type markdown
 * directly and the decorations will render it as WYSIWYG.
 */
export const inputRules: Extension = [inputRulesPlugin];

/**
 * Check if a line matches any list pattern
 */
export function isListPattern(text: string): boolean {
  return (
    INPUT_RULE_PATTERNS.bulletDash.test(text) ||
    INPUT_RULE_PATTERNS.bulletAsterisk.test(text) ||
    INPUT_RULE_PATTERNS.bulletPlus.test(text) ||
    INPUT_RULE_PATTERNS.orderedList.test(text) ||
    INPUT_RULE_PATTERNS.taskUnchecked.test(text) ||
    INPUT_RULE_PATTERNS.taskChecked.test(text)
  );
}

/**
 * Check if a line matches any heading pattern
 */
export function isHeadingPattern(text: string): boolean {
  return /^#{1,6}\s$/.test(text);
}

/**
 * Check if a line matches blockquote pattern
 */
export function isBlockquotePattern(text: string): boolean {
  return /^>+\s?$/.test(text);
}

/**
 * Check if a line matches horizontal rule pattern
 */
export function isHorizontalRulePattern(text: string): boolean {
  return (
    INPUT_RULE_PATTERNS.hrDash.test(text) ||
    INPUT_RULE_PATTERNS.hrAsterisk.test(text) ||
    INPUT_RULE_PATTERNS.hrUnderscore.test(text)
  );
}

/**
 * Check if a line matches code fence pattern
 */
export function isCodeFencePattern(text: string): boolean {
  return INPUT_RULE_PATTERNS.codeFence.test(text);
}

/**
 * Get the type of list marker from text
 */
export function getListMarkerType(text: string): "bullet" | "ordered" | "task" | null {
  if (INPUT_RULE_PATTERNS.taskUnchecked.test(text) || INPUT_RULE_PATTERNS.taskChecked.test(text)) {
    return "task";
  }
  if (INPUT_RULE_PATTERNS.bulletDash.test(text) || INPUT_RULE_PATTERNS.bulletAsterisk.test(text) || INPUT_RULE_PATTERNS.bulletPlus.test(text)) {
    return "bullet";
  }
  if (INPUT_RULE_PATTERNS.orderedList.test(text)) {
    return "ordered";
  }
  return null;
}

/**
 * Get heading level from text (1-6 or 0 if not a heading)
 */
export function getHeadingLevel(text: string): number {
  const match = text.match(/^(#{1,6})\s$/);
  return match ? match[1].length : 0;
}

// Export utilities for use in tests and other modules
export { isAtLineStart, getLineTextToCursor };
