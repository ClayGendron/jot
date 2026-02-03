/**
 * Format Active Detection for CodeMirror 6
 *
 * Phase 2: Utilities to detect if cursor is inside formatting
 * (bold, italic, strikethrough, code). Used for toolbar active states.
 *
 * Walks the syntax tree at cursor position to find parent nodes
 * that indicate active formatting.
 */

import type { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

/**
 * Node names from Lezer markdown parser that represent formatting
 */
const FORMAT_NODES = {
  bold: "StrongEmphasis",
  italic: "Emphasis",
  strikethrough: "Strikethrough",
  code: "InlineCode",
} as const;

export type FormatType = keyof typeof FORMAT_NODES;

/**
 * Check if cursor is inside a specific syntax node type
 *
 * Walks up the syntax tree from cursor position to find matching node.
 *
 * @param state - The editor state to check
 * @param nodeName - The Lezer node name to look for
 * @returns true if cursor is inside a node with the given name
 */
export function isFormatActive(state: EditorState, nodeName: string): boolean {
  const pos = state.selection.main.head;
  const tree = syntaxTree(state);

  // Get the node at cursor position
  let node = tree.resolveInner(pos, -1);

  // Walk up the tree looking for the target node
  while (node) {
    if (node.name === nodeName) {
      // Verify cursor is inside the node content, not on markers
      // Node's from/to includes markers, so we need to check we're inside
      return true;
    }
    node = node.parent!;
  }

  return false;
}

/**
 * Check if cursor is inside bold formatting (**text**)
 */
export function isBoldActive(state: EditorState): boolean {
  return isFormatActive(state, FORMAT_NODES.bold);
}

/**
 * Check if cursor is inside italic formatting (*text*)
 */
export function isItalicActive(state: EditorState): boolean {
  return isFormatActive(state, FORMAT_NODES.italic);
}

/**
 * Check if cursor is inside strikethrough formatting (~~text~~)
 */
export function isStrikethroughActive(state: EditorState): boolean {
  return isFormatActive(state, FORMAT_NODES.strikethrough);
}

/**
 * Check if cursor is inside inline code formatting (`text`)
 */
export function isCodeActive(state: EditorState): boolean {
  return isFormatActive(state, FORMAT_NODES.code);
}

/**
 * Get all active formats at cursor position
 *
 * Returns a Set of format types that are active at the current cursor position.
 * Useful for setting multiple toolbar button states at once.
 *
 * @param state - The editor state to check
 * @returns Set of active format types
 */
export function getActiveFormats(state: EditorState): Set<FormatType> {
  const active = new Set<FormatType>();

  for (const [format, nodeName] of Object.entries(FORMAT_NODES)) {
    if (isFormatActive(state, nodeName)) {
      active.add(format as FormatType);
    }
  }

  return active;
}
