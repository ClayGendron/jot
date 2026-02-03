/**
 * WYSIWYG Compartment for CodeMirror 6
 *
 * Provides a compartment that wraps ALL WYSIWYG field decorations,
 * allowing them to be toggled on/off separately from the hidden syntax extension.
 *
 * When raw mode is enabled:
 * - hiddenSyntax: disabled (shows all markdown syntax markers)
 * - wysiwyg: disabled (shows raw markdown instead of widgets)
 *
 * This separation allows for proper raw mode that shows all original markdown.
 */

import { Compartment, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

// Phase 3 extensions
import { headingField } from "../decorations/headings";
import { listField } from "../decorations/lists";
import { blockquoteField } from "../decorations/blockquotes";

// Phase 4 extensions
import { linkField } from "../decorations/links";
import { imageField } from "../decorations/images";

// Phase 5 extensions
import { codeBlockField } from "../decorations/codeBlocks";
import { mermaidField } from "../decorations/mermaid";

// Phase 6 extensions
import { tableField } from "../decorations/tables";

// Phase 9 extensions
import { horizontalRuleField } from "../decorations/horizontalRule";

// Phase 2 extensions (highlight)
import { highlightMarkerField, highlightStyleField } from "../decorations/highlight";

/**
 * Compartment for toggling WYSIWYG decorations on/off
 * Allows switching between WYSIWYG (widgets visible) and raw view (raw markdown visible)
 */
export const wysiwygCompartment = new Compartment();

/**
 * Create WYSIWYG extensions based on enabled state
 *
 * @param enabled - If true, enable WYSIWYG decorations; if false, show raw markdown
 * @returns Array of extensions when enabled, empty array when disabled
 */
export function createWysiwygExtensions(enabled: boolean): Extension[] {
  if (!enabled) return [];

  return [
    // Phase 3: Block structure decorations
    headingField,
    listField,
    blockquoteField,

    // Phase 4: Links and images
    linkField,
    imageField,

    // Phase 5: Code blocks and Mermaid diagrams
    codeBlockField,
    mermaidField,

    // Phase 6: Tables
    tableField,

    // Phase 9: Horizontal rules
    horizontalRuleField,

    // Phase 2: Highlight (split into marker and style fields)
    highlightMarkerField,
    highlightStyleField,
  ];
}

/**
 * Create the WYSIWYG extension configured for enabled or disabled state
 *
 * @param enabled - If true, enable WYSIWYG widgets; if false, show raw markdown
 * @returns Extension configured with the compartment
 */
export function createWysiwygExtension(enabled: boolean): Extension {
  return wysiwygCompartment.of(createWysiwygExtensions(enabled));
}

/**
 * Toggle WYSIWYG mode on or off
 *
 * @param view - The EditorView to update
 * @param enabled - If true, enable WYSIWYG widgets; if false, show raw markdown
 */
export function toggleWysiwyg(view: EditorView, enabled: boolean): void {
  view.dispatch({
    effects: wysiwygCompartment.reconfigure(createWysiwygExtensions(enabled)),
  });
}
