/**
 * Extensions Index
 *
 * Re-exports all extension modules and provides extension bundle factory.
 */

import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { history } from "@codemirror/commands";
import { syntaxHighlighting } from "@codemirror/language";

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
