/**
 * Heading Decorations for CodeMirror 6
 *
 * Phase 3: Hide # markers and apply heading styles.
 * Generates IDs for navigation/outline using github-slugger.
 *
 * Key behaviors:
 * - Hides # markers via Decoration.replace()
 * - Applies heading level classes (h1-h6)
 * - Generates unique IDs for duplicate headings
 * - Provides heading data for document outline
 */

import { StateField, RangeSetBuilder, type EditorState } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import GithubSlugger from "github-slugger";

/**
 * Heading data for document outline and navigation
 */
export interface HeadingData {
  /** Heading level (1-6) */
  level: 1 | 2 | 3 | 4 | 5 | 6;
  /** Heading text content (without # markers) */
  text: string;
  /** Generated ID for navigation */
  id: string;
  /** Start position of the entire heading line */
  from: number;
  /** End position of the entire heading line */
  to: number;
  /** Line number (1-indexed) */
  line: number;
}

/**
 * Decoration to hide the # markers
 */
const hideMarker = Decoration.replace({ inclusive: false });

/**
 * Heading line decorations for each level
 */
const headingLineDecorations: Record<number, Decoration> = {
  1: Decoration.line({ class: "cm-heading cm-heading-1" }),
  2: Decoration.line({ class: "cm-heading cm-heading-2" }),
  3: Decoration.line({ class: "cm-heading cm-heading-3" }),
  4: Decoration.line({ class: "cm-heading cm-heading-4" }),
  5: Decoration.line({ class: "cm-heading cm-heading-5" }),
  6: Decoration.line({ class: "cm-heading cm-heading-6" }),
};

/**
 * Extract heading level from ATXHeading node name or check HeaderMark count
 */
function getHeadingLevel(state: EditorState, node: { from: number; to: number; name: string }): number {
  // ATXHeading nodes are named ATXHeading1, ATXHeading2, etc.
  const match = node.name.match(/ATXHeading(\d)/);
  if (match) {
    return parseInt(match[1], 10);
  }

  // Fallback: count # characters at the start
  const text = state.doc.sliceString(node.from, Math.min(node.from + 7, node.to));
  const hashMatch = text.match(/^(#{1,6})\s/);
  if (hashMatch) {
    return hashMatch[1].length;
  }

  return 1;
}

/**
 * Build decorations for all headings in the document
 */
function buildHeadingDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const tree = syntaxTree(state);

  tree.iterate({
    enter(node) {
      // Match ATXHeading1 through ATXHeading6
      if (node.name.startsWith("ATXHeading")) {
        const level = getHeadingLevel(state, node);

        // Find the HeaderMark (# symbols) within this heading
        let headerMarkFrom = -1;
        let headerMarkTo = -1;

        const headingNode = node.node;
        const cursor = headingNode.cursor();

        // Enter the heading node and look for HeaderMark
        if (cursor.firstChild()) {
          do {
            if (cursor.name === "HeaderMark") {
              headerMarkFrom = cursor.from;
              headerMarkTo = cursor.to;
              break;
            }
          } while (cursor.nextSibling());
        }

        // Add line decoration for the heading
        const lineStart = state.doc.lineAt(node.from).from;
        if (headingLineDecorations[level]) {
          builder.add(lineStart, lineStart, headingLineDecorations[level]);
        }

        // Hide the # markers (including trailing space)
        if (headerMarkFrom !== -1) {
          // Find where the actual heading text starts (after # and space)
          const afterMark = headerMarkTo;
          const lineText = state.doc.sliceString(headerMarkFrom, node.to);
          const spaceMatch = lineText.substring(headerMarkTo - headerMarkFrom).match(/^\s+/);
          const spaceLength = spaceMatch ? spaceMatch[0].length : 0;

          builder.add(headerMarkFrom, afterMark + spaceLength, hideMarker);
        }
      }
    },
  });

  return builder.finish();
}

/**
 * StateField that tracks heading decorations
 */
export const headingField = StateField.define<DecorationSet>({
  create: (state) => buildHeadingDecorations(state),

  update: (value, tr) => {
    if (tr.docChanged) {
      return buildHeadingDecorations(tr.state);
    }
    return value;
  },

  provide: (field) => [
    // Apply decorations only - hiddenSyntax.ts handles atomic ranges for # markers
    EditorView.decorations.from(field),
  ],
});

/**
 * Extract heading data from the document for outline/navigation
 *
 * @param state - The editor state
 * @returns Array of heading data with IDs
 */
export function extractHeadingData(state: EditorState): HeadingData[] {
  const headings: HeadingData[] = [];
  const slugger = new GithubSlugger();
  const tree = syntaxTree(state);

  tree.iterate({
    enter(node) {
      if (node.name.startsWith("ATXHeading")) {
        const level = getHeadingLevel(state, node) as 1 | 2 | 3 | 4 | 5 | 6;
        const line = state.doc.lineAt(node.from);

        // Get the full text of the heading line
        const fullText = state.doc.sliceString(node.from, node.to);

        // Remove # markers to get just the text
        const textMatch = fullText.match(/^#{1,6}\s+(.*)$/);
        const text = textMatch ? textMatch[1].trim() : fullText.trim();

        // Generate unique ID using github-slugger
        const id = slugger.slug(text);

        headings.push({
          level,
          text,
          id,
          from: node.from,
          to: node.to,
          line: line.number,
        });
      }
    },
  });

  return headings;
}
