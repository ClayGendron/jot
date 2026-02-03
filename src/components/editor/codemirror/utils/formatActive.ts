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

// ============================================================================
// Phase 8: Block-level Format Detection
// ============================================================================

/**
 * Block format types for toolbar active states
 */
export type BlockFormat =
  | "paragraph"
  | "heading"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "blockquote"
  | "codeBlock";

/**
 * Regex patterns for detecting block-level elements from line text
 */
const BLOCK_PATTERNS = {
  heading: /^(#{1,6})\s/,
  bullet: /^[-*+]\s+/,
  ordered: /^\d+\.\s+/,
  task: /^[-*+]\s+\[[xX ]\]\s+/,
  blockquote: /^(>+)\s*/,
};

/**
 * Get the heading level (1-6) at cursor position, or 0 if not a heading
 *
 * Uses line text matching for reliable detection.
 */
export function getHeadingLevel(state: EditorState): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const match = line.text.match(BLOCK_PATTERNS.heading);

  if (match) {
    return match[1].length as 1 | 2 | 3 | 4 | 5 | 6;
  }

  return 0;
}

/**
 * Check if cursor is on a bullet list line (not task list)
 */
export function isBulletListActive(state: EditorState): boolean {
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  // Must match bullet but NOT task list
  return (
    BLOCK_PATTERNS.bullet.test(line.text) &&
    !BLOCK_PATTERNS.task.test(line.text)
  );
}

/**
 * Check if cursor is on an ordered list line
 */
export function isOrderedListActive(state: EditorState): boolean {
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  return BLOCK_PATTERNS.ordered.test(line.text);
}

/**
 * Check if cursor is on a task list line
 */
export function isTaskListActive(state: EditorState): boolean {
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  return BLOCK_PATTERNS.task.test(line.text);
}

/**
 * Check if cursor is on a blockquote line
 */
export function isBlockquoteActive(state: EditorState): boolean {
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  return BLOCK_PATTERNS.blockquote.test(line.text);
}

/**
 * Check if cursor is inside a fenced code block
 *
 * Searches backwards and forwards from cursor to find fence markers.
 */
export function isCodeBlockActive(state: EditorState): boolean {
  const pos = state.selection.main.head;
  const doc = state.doc;
  const currentLine = doc.lineAt(pos);

  // Search backwards for opening fence
  let openFenceLine = -1;
  for (let i = currentLine.number; i >= 1; i--) {
    const line = doc.line(i);
    if (/^```/.test(line.text)) {
      // Check if this is an opening fence (not a closing fence)
      // by looking for a fence before it that would make it a closer
      let isOpening = true;
      for (let j = i - 1; j >= 1; j--) {
        const prevLine = doc.line(j);
        if (/^```/.test(prevLine.text)) {
          // Found another fence before - check if unclosed
          let fenceCount = 0;
          for (let k = 1; k < i; k++) {
            if (/^```/.test(doc.line(k).text)) {
              fenceCount++;
            }
          }
          // If even number of fences before, this is an opener
          isOpening = fenceCount % 2 === 0;
          break;
        }
      }
      if (isOpening) {
        openFenceLine = i;
        break;
      }
    }
  }

  if (openFenceLine === -1) return false;

  // Search forwards for closing fence
  for (let i = openFenceLine + 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    if (/^```$/.test(line.text)) {
      // Found closing fence - cursor must be between open and close
      return currentLine.number > openFenceLine && currentLine.number < i;
    }
  }

  // No closing fence found, but cursor is after opening fence
  return currentLine.number > openFenceLine;
}

/**
 * Get the active block format at cursor position
 *
 * Returns the most specific block format that applies.
 * Priority: codeBlock > taskList > bulletList > orderedList > blockquote > heading > paragraph
 */
export function getActiveBlockFormat(state: EditorState): BlockFormat {
  // Check code block first (highest priority, cursor could be anywhere)
  if (isCodeBlockActive(state)) {
    return "codeBlock";
  }

  // Check task list before bullet (task is a special bullet)
  if (isTaskListActive(state)) {
    return "taskList";
  }

  if (isBulletListActive(state)) {
    return "bulletList";
  }

  if (isOrderedListActive(state)) {
    return "orderedList";
  }

  if (isBlockquoteActive(state)) {
    return "blockquote";
  }

  if (getHeadingLevel(state) > 0) {
    return "heading";
  }

  return "paragraph";
}
