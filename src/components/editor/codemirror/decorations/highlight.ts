/**
 * Highlight Decoration for CodeMirror 6
 *
 * Phase 2: Custom ==highlight== syntax (not part of GFM).
 * Uses regex-based detection to find ==...== patterns,
 * hides the == markers, and applies highlight styling to content.
 *
 * Key behaviors:
 * - Regex-based matching (not Lezer, since == isn't in GFM)
 * - Skips code blocks and inline code
 * - Hides == markers via Decoration.replace() (atomic - cursor skips)
 * - Applies highlight class to content (NOT atomic - text is editable)
 *
 * Split into two fields:
 * - highlightMarkerField: Hides == markers (atomic)
 * - highlightStyleField: Styles content (NOT atomic - editable)
 */

import { StateField, RangeSetBuilder, type EditorState } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

/**
 * Range information for a highlight match
 */
export interface HighlightRange {
  /** Start position of opening == */
  from: number;
  /** End position of closing == */
  to: number;
  /** Start position of content (after ==) */
  contentFrom: number;
  /** End position of content (before ==) */
  contentTo: number;
}

/**
 * Regex to match ==highlight== patterns
 * Captures: full match, content between markers
 */
const HIGHLIGHT_REGEX = /==([^=]*?)==/g;

/**
 * Check if a position is inside a code block or inline code
 * We skip highlights inside code to avoid false positives
 */
function isInsideCode(state: EditorState, from: number, to: number): boolean {
  const tree = syntaxTree(state);

  // Check if either endpoint is inside a code node
  const startNode = tree.resolveInner(from, 1);
  const endNode = tree.resolveInner(to, -1);

  // Node names that indicate code context
  const codeNodes = new Set([
    "CodeBlock",
    "FencedCode",
    "InlineCode",
    "CodeText",
    "CodeMark",
  ]);

  // Walk up from start position
  let node = startNode;
  while (node) {
    if (codeNodes.has(node.name)) {
      return true;
    }
    node = node.parent!;
  }

  // Walk up from end position
  node = endNode;
  while (node) {
    if (codeNodes.has(node.name)) {
      return true;
    }
    node = node.parent!;
  }

  return false;
}

/**
 * Find all highlight ranges in a document
 *
 * @param doc - The document text to search
 * @param state - Optional editor state for code detection
 * @returns Array of highlight ranges
 */
export function findHighlightRanges(doc: string, state?: EditorState): HighlightRange[] {
  const ranges: HighlightRange[] = [];

  // Reset regex lastIndex
  HIGHLIGHT_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = HIGHLIGHT_REGEX.exec(doc)) !== null) {
    const from = match.index;
    const to = match.index + match[0].length;
    const contentFrom = from + 2; // After ==
    const contentTo = to - 2; // Before ==

    // Skip if inside code (when state is provided)
    if (state && isInsideCode(state, from, to)) {
      continue;
    }

    ranges.push({ from, to, contentFrom, contentTo });
  }

  return ranges;
}

/**
 * Decoration to hide the == markers
 */
const hideMarker = Decoration.replace({ inclusive: false });

/**
 * Decoration to style highlighted content
 */
const highlightMark = Decoration.mark({ class: "cm-highlight" });

/**
 * Build decorations for highlight markers only (the == symbols)
 * These are atomic - cursor skips over them
 */
function buildMarkerDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = state.doc.toString();
  const ranges = findHighlightRanges(doc, state);

  for (const range of ranges) {
    // Hide opening ==
    builder.add(range.from, range.contentFrom, hideMarker);

    // Hide closing ==
    builder.add(range.contentTo, range.to, hideMarker);
  }

  return builder.finish();
}

/**
 * Build decorations for highlight styling only (the content between ==)
 * NOT atomic - content is editable
 */
function buildStyleDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = state.doc.toString();
  const ranges = findHighlightRanges(doc, state);

  for (const range of ranges) {
    // Style the content (but don't make it atomic)
    if (range.contentFrom < range.contentTo) {
      builder.add(range.contentFrom, range.contentTo, highlightMark);
    }
  }

  return builder.finish();
}

/**
 * StateField for highlight markers (== symbols)
 *
 * - Creates decorations to hide == markers
 * - Markers are atomic (cursor skips them)
 */
export const highlightMarkerField = StateField.define<DecorationSet>({
  create: (state) => buildMarkerDecorations(state),

  update: (value, tr) => {
    if (tr.docChanged) {
      return buildMarkerDecorations(tr.state);
    }
    return value;
  },

  provide: (field) => [
    // Apply decorations
    EditorView.decorations.from(field),

    // Make hidden markers atomic (cursor skips them)
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
});

/**
 * StateField for highlight styling (content between ==)
 *
 * - Creates decorations to style highlighted content
 * - NOT atomic - content is editable
 */
export const highlightStyleField = StateField.define<DecorationSet>({
  create: (state) => buildStyleDecorations(state),

  update: (value, tr) => {
    if (tr.docChanged) {
      return buildStyleDecorations(tr.state);
    }
    return value;
  },

  provide: (field) => [
    // Apply decorations only - no atomicRanges so text is editable
    EditorView.decorations.from(field),
  ],
});

/**
 * Legacy combined field for backwards compatibility
 * @deprecated Use highlightMarkerField and highlightStyleField instead
 */
export const highlightField = StateField.define<DecorationSet>({
  create: (state) => {
    const builder = new RangeSetBuilder<Decoration>();
    const doc = state.doc.toString();
    const ranges = findHighlightRanges(doc, state);

    for (const range of ranges) {
      builder.add(range.from, range.contentFrom, hideMarker);
      if (range.contentFrom < range.contentTo) {
        builder.add(range.contentFrom, range.contentTo, highlightMark);
      }
      builder.add(range.contentTo, range.to, hideMarker);
    }

    return builder.finish();
  },

  update: (value, tr) => {
    if (tr.docChanged) {
      const builder = new RangeSetBuilder<Decoration>();
      const doc = tr.state.doc.toString();
      const ranges = findHighlightRanges(doc, tr.state);

      for (const range of ranges) {
        builder.add(range.from, range.contentFrom, hideMarker);
        if (range.contentFrom < range.contentTo) {
          builder.add(range.contentFrom, range.contentTo, highlightMark);
        }
        builder.add(range.contentTo, range.to, hideMarker);
      }

      return builder.finish();
    }
    return value;
  },

  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
});
