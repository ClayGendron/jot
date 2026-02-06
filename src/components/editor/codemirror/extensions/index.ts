/**
 * Extensions Index
 *
 * Re-exports all extension modules and provides extension bundle factory.
 */

import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { history } from "@codemirror/commands";
import { syntaxHighlighting } from "@codemirror/language";
import { search, searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { keymap } from "@codemirror/view";

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
export function createWysiwygExtensions() {
  return [
    // Markdown language with GFM and Highlight extensions
    markdown({
      extensions: [GFM, HighlightExtension],
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
    // Hidden ranges field (must be before hiddenSyntaxField)
    hiddenRangesField,
    // Hidden syntax decorations (replaces markdown markers with widgets)
    hiddenSyntaxField,
    // Selection snapper (keeps cursor out of hidden ranges)
    selectionSnapper,
    // Style decorations (CSS classes for formatted content)
    styleField,
    // Code block syntax highlighting
    syntaxHighlighting(codeHighlightStyle),
    // Smart input handling (auto-close markers, escape sequences)
    formattingInputHandler,
    // Default keymap with history
    defaultKeymapWithHistory,
    // Formatting and editing keymap
    formattingEscapeKeymap,
    // Editor theme
    theme,
  ];
}
