/**
 * Extensions Index
 *
 * Re-exports all extension modules and provides extension bundle factory.
 */

import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { GFM } from "@lezer/markdown";
import { Prec } from "@codemirror/state";
import { history } from "@codemirror/commands";
import { syntaxHighlighting } from "@codemirror/language";
import { search, searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { keymap, EditorView, rectangularSelection } from "@codemirror/view";

// Extension modules
export { hiddenRangesField, getHiddenRanges, type HiddenRange, type HiddenRangeKind } from "./hiddenRanges";
export { hiddenSyntaxField, buildDecorationsFromRanges } from "./hiddenSyntax";
export { selectionSnapper } from "./selectionSnapper";
export { styleField, codeHighlightStyle } from "./styleDecorations";
export { formattingInputHandler } from "./inputHandler";
export { formattingEscapeKeymap, defaultKeymapWithHistory } from "./keymap";
export { theme } from "./theme";

// Lezer extensions
import { HighlightExtension } from "./lezerExtensions";

// Re-export for convenience
export { HighlightExtension };

// Spellcheck extension
export {
  createSpellcheckExtension,
  spellcheckField,
  setSpellcheckEnabledCmd,
  refreshSpellcheck,
  subscribeSpellcheckContextMenu,
  openSpellcheckContextMenu,
  closeSpellcheckContextMenu,
  getSpellcheckContextMenuState,
  handleSpellcheckSuggestion,
  handleAddToPersonalDictionary,
  handleIgnoreWord,
  type SpellcheckConfig,
} from "./spellcheck";

// Import internal modules for bundle
import { hiddenRangesField } from "./hiddenRanges";
import { hiddenSyntaxField } from "./hiddenSyntax";
import { selectionSnapper } from "./selectionSnapper";
import { styleField, codeHighlightStyle } from "./styleDecorations";
import { formattingInputHandler } from "./inputHandler";
import { formattingEscapeKeymap, defaultKeymapWithHistory } from "./keymap";
import { theme } from "./theme";
import { pendingFormattingField, pendingFormatTheme } from "./pendingFormat";
import { getCodeBlockAtLine } from "../handlers/tableHandlers";

// ===========================================
// EXTENSION BUNDLE
// ===========================================

/**
 * Create the full extension bundle for the WYSIWYG markdown editor.
 *
 * Usage:
 * ```typescript
 * const extensions = createWysiwygExtensions();
 * const state = EditorState.create({ doc: "...", extensions });
 * ```
 */
/**
 * Event filter for rectangular selection: only allow inside code blocks.
 * Uses Alt+drag (default) and checks the target position against code block ranges.
 */
function isRectangularSelectionInCodeBlock(event: MouseEvent): boolean {
  if (!event.altKey || event.button !== 0) return false;
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  const view = EditorView.findFromDOM(target);
  if (!view) return false;
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
  if (pos == null) return false;
  const line = view.state.doc.lineAt(pos);
  return getCodeBlockAtLine(view.state, line.number) !== null;
}

export function createWysiwygExtensions() {
  return [
    // Markdown language with GFM, Highlight extensions, and code block syntax highlighting
    markdown({
      extensions: [GFM, HighlightExtension],
      codeLanguages: languages,
    }),
    // History (undo/redo)
    history(),
    // Search and replace (Cmd/Ctrl+F, Cmd/Ctrl+H)
    search({
      top: true, // Panel at top of editor
    }),
    // Highlight other instances of selected text
    highlightSelectionMatches(),
    // Search keymap (must be before default keymap to take priority)
    keymap.of(searchKeymap),
    // Rectangular selection (Alt+drag) restricted to code blocks
    rectangularSelection({
      eventFilter: isRectangularSelectionInCodeBlock,
    }),
    // Hidden ranges field (must be before hiddenSyntaxField)
    hiddenRangesField,
    // Hidden syntax decorations (replaces markdown markers with widgets)
    hiddenSyntaxField,
    // Pending formatting decorations (hides empty marker pairs like **|**)
    pendingFormattingField,
    pendingFormatTheme,
    // Selection snapper (keeps cursor out of hidden ranges)
    selectionSnapper,
    // Style decorations (CSS classes for formatted content)
    styleField,
    // Code block syntax highlighting
    syntaxHighlighting(codeHighlightStyle),
    // Smart input handling (auto-close markers, escape sequences)
    formattingInputHandler,
    // Formatting and editing keymap (highest priority to override default Enter handling)
    Prec.highest(formattingEscapeKeymap),
    // Default keymap with history
    defaultKeymapWithHistory,
    // Editor theme
    theme,
    // Line wrapping
    EditorView.lineWrapping,
  ];
}
