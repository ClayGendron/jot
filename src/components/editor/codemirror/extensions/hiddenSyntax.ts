/**
 * Hidden Syntax Extension for CodeMirror 6
 *
 * Phase 2: Hides markdown syntax markers (**, *, #, etc.) via decorations.
 * Provides a Compartment for toggling between WYSIWYG and raw view modes.
 *
 * Key behaviors:
 * - All syntax markers are hidden via Decoration.replace()
 * - Atomic ranges prevent cursor from entering hidden syntax
 * - Raw view toggle shows all syntax (for advanced editing)
 */

import { Compartment, StateField, RangeSetBuilder, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

/**
 * Decoration that replaces (hides) matched ranges
 */
const hidden = Decoration.replace({ inclusive: false });

/**
 * Node names from the Lezer markdown parser that represent syntax tokens
 * These are the markers we want to hide in WYSIWYG mode
 */
const SYNTAX_TOKEN_NAMES = new Set([
  // Emphasis markers (*, **, ___, etc.)
  "EmphasisMark",

  // Strikethrough markers (~~)
  "StrikethroughMark",

  // Code markers (`)
  "CodeMark",

  // Heading markers (#, ##, ###, etc.)
  "HeaderMark",

  // Blockquote markers (>)
  "QuoteMark",

  // List markers (-, *, +, 1., etc.)
  "ListMark",

  // Link/image syntax markers
  "LinkMark",

  // Code block fences (```)
  "CodeInfo",

  // Note: HorizontalRule is NOT included here because it's replaced
  // with a styled widget decoration in decorations/horizontalRule.ts
]);

/**
 * Check if a syntax tree node represents a syntax token that should be hidden
 */
function isSyntaxToken(name: string): boolean {
  return SYNTAX_TOKEN_NAMES.has(name);
}

/**
 * Build decorations to hide all syntax tokens in the document
 */
function buildHiddenSyntax(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  syntaxTree(state).iterate({
    enter(node) {
      if (isSyntaxToken(node.name)) {
        builder.add(node.from, node.to, hidden);
      }
    },
  });

  return builder.finish();
}

/**
 * StateField that tracks hidden syntax decorations
 *
 * - Creates decorations on initialization
 * - Updates decorations when document changes
 * - Provides both decorations and atomic ranges
 */
export const hiddenSyntaxField = StateField.define<DecorationSet>({
  create: (state) => buildHiddenSyntax(state),

  update: (value, tr) => {
    // Only rebuild if document changed
    if (tr.docChanged) {
      return buildHiddenSyntax(tr.state);
    }
    return value;
  },

  provide: (field) => [
    // Apply decorations to the view
    EditorView.decorations.from(field),

    // Make hidden ranges atomic (cursor skips over them)
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
});

/**
 * Compartment for toggling hidden syntax on/off
 * Allows switching between WYSIWYG (syntax hidden) and raw view (syntax visible)
 */
export const hiddenSyntaxCompartment = new Compartment();

/**
 * Create the hidden syntax extension configured for WYSIWYG or raw mode
 *
 * @param rawMode - If true, syntax is visible (raw view); if false, syntax is hidden (WYSIWYG)
 * @returns Extension configured with the compartment
 */
export function createHiddenSyntaxExtension(rawMode: boolean): Extension {
  return hiddenSyntaxCompartment.of(rawMode ? [] : hiddenSyntaxField);
}

/**
 * Toggle between raw view and WYSIWYG mode
 *
 * @param view - The EditorView to update
 * @param rawMode - If true, show all syntax; if false, hide syntax
 */
export function toggleRawView(view: EditorView, rawMode: boolean): void {
  view.dispatch({
    effects: hiddenSyntaxCompartment.reconfigure(rawMode ? [] : hiddenSyntaxField),
  });
}
