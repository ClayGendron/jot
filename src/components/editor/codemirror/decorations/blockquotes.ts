/**
 * Blockquote Decorations for CodeMirror 6
 *
 * Phase 3: Hide > markers and apply blockquote styling.
 *
 * Key behaviors:
 * - Hides > markers via Decoration.replace()
 * - Applies blockquote styling with left border
 * - Tracks nesting depth for nested blockquotes
 * - Uses line decorations for the border styling
 */

import { StateField, RangeSetBuilder, type EditorState } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

/**
 * Blockquote line data for analysis
 */
export interface BlockquoteLineData {
  /** Nesting depth (1 = single >, 2 = >>, etc.) */
  depth: number;
  /** Text content of the line (without > markers) */
  text: string;
  /** Start position of the line */
  from: number;
  /** End position of the line */
  to: number;
  /** Start position of the > marker(s) */
  markerFrom: number;
  /** End position of the > marker(s) */
  markerTo: number;
  /** Line number (1-indexed) */
  line: number;
}

/**
 * Decoration to hide the > markers
 */
const hideMarker = Decoration.replace({ inclusive: false });

/**
 * Line decorations for different blockquote depths
 */
const blockquoteLineDecorations: Record<number, Decoration> = {
  1: Decoration.line({ class: "cm-blockquote cm-blockquote-1" }),
  2: Decoration.line({ class: "cm-blockquote cm-blockquote-2" }),
  3: Decoration.line({ class: "cm-blockquote cm-blockquote-3" }),
  4: Decoration.line({ class: "cm-blockquote cm-blockquote-4" }),
  5: Decoration.line({ class: "cm-blockquote cm-blockquote-5" }),
};

/**
 * Count the depth of blockquote markers at a position
 */
function countBlockquoteDepth(state: EditorState, lineFrom: number, lineTo: number): { depth: number; markerEnd: number } {
  const text = state.doc.sliceString(lineFrom, lineTo);

  // Count consecutive > markers (with optional spaces between)
  let depth = 0;
  let pos = 0;

  while (pos < text.length) {
    // Skip leading whitespace
    const wsMatch = text.substring(pos).match(/^\s*/);
    if (wsMatch) {
      pos += wsMatch[0].length;
    }

    // Check for >
    if (text[pos] === ">") {
      depth++;
      pos++;

      // Skip optional space after >
      if (text[pos] === " ") {
        pos++;
      }
    } else {
      break;
    }
  }

  return { depth, markerEnd: lineFrom + pos };
}

/**
 * Build decorations for all blockquotes in the document
 */
function buildBlockquoteDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const tree = syntaxTree(state);
  const processedLines = new Set<number>();

  tree.iterate({
    enter(node) {
      // Match Blockquote nodes
      if (node.name === "Blockquote") {
        // Process each line within the blockquote
        const startLine = state.doc.lineAt(node.from);
        const endLine = state.doc.lineAt(node.to);

        for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
          if (processedLines.has(lineNum)) continue;
          processedLines.add(lineNum);

          const line = state.doc.line(lineNum);
          const { depth, markerEnd } = countBlockquoteDepth(state, line.from, line.to);

          if (depth > 0) {
            // Add line decoration for styling
            const decorationLevel = Math.min(depth, 5);
            builder.add(line.from, line.from, blockquoteLineDecorations[decorationLevel]);

            // Hide the > markers and any trailing space
            if (markerEnd > line.from) {
              builder.add(line.from, markerEnd, hideMarker);
            }
          }
        }
      }

      // Also handle QuoteMark nodes directly
      if (node.name === "QuoteMark") {
        const line = state.doc.lineAt(node.from);

        if (!processedLines.has(line.number)) {
          processedLines.add(line.number);

          const { depth, markerEnd } = countBlockquoteDepth(state, line.from, line.to);

          if (depth > 0) {
            // Add line decoration
            const decorationLevel = Math.min(depth, 5);
            builder.add(line.from, line.from, blockquoteLineDecorations[decorationLevel]);

            // Hide markers
            if (markerEnd > line.from) {
              builder.add(line.from, markerEnd, hideMarker);
            }
          }
        }
      }
    },
  });

  return builder.finish();
}

/**
 * StateField that tracks blockquote decorations
 */
export const blockquoteField = StateField.define<DecorationSet>({
  create: (state) => buildBlockquoteDecorations(state),

  update: (value, tr) => {
    if (tr.docChanged) {
      return buildBlockquoteDecorations(tr.state);
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
 * Extract blockquote data from the document
 *
 * @param state - The editor state
 * @returns Array of blockquote line data
 */
export function extractBlockquoteData(state: EditorState): BlockquoteLineData[] {
  const quotes: BlockquoteLineData[] = [];
  const tree = syntaxTree(state);
  const processedLines = new Set<number>();

  tree.iterate({
    enter(node) {
      if (node.name === "Blockquote") {
        // Process each line within the blockquote
        const startLine = state.doc.lineAt(node.from);
        const endLine = state.doc.lineAt(node.to);

        for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
          if (processedLines.has(lineNum)) continue;
          processedLines.add(lineNum);

          const line = state.doc.line(lineNum);
          const { depth, markerEnd } = countBlockquoteDepth(state, line.from, line.to);

          if (depth > 0) {
            const text = state.doc.sliceString(markerEnd, line.to).trim();

            quotes.push({
              depth,
              text,
              from: line.from,
              to: line.to,
              markerFrom: line.from,
              markerTo: markerEnd,
              line: lineNum,
            });
          }
        }
      }
    },
  });

  return quotes;
}
