/**
 * CodeMirror 6 Setup for Jot
 *
 * Creates CM6 configuration for editing Markdown with WYSIWYG features.
 * Markdown is the canonical format - no conversion on load/save.
 *
 * Phase 1: Basic editing
 * Phase 2: Hidden syntax, formatting commands, auto-close markers
 * Phase 3: Block structure (headings, lists, blockquotes), input rules
 * Phase 4: Links and images with internal link navigation
 * Phase 5: Code blocks with syntax highlighting and Mermaid diagrams
 * Phase 6: Tables with minimal mutation and WYSIWYG editing
 */

import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, lineNumbers, highlightActiveLine, drawSelection, dropCursor } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { bracketMatching } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { keymap } from "@codemirror/view";
import { jotKeymap } from "./keymap";
import { jotTheme } from "./theme";

// Phase 2 extensions
import { createHiddenSyntaxExtension, hiddenSyntaxCompartment, toggleRawView } from "./extensions/hiddenSyntax";
import { highlightField } from "./decorations/highlight";
import { autoCloseMarkdown } from "./extensions/autoCloseMarkdown";
import { deleteBehavior } from "./extensions/deleteBehavior";

// Phase 3 extensions
import { headingField } from "./decorations/headings";
import { listField } from "./decorations/lists";
import { blockquoteField } from "./decorations/blockquotes";
import { inputRules } from "./extensions/inputRules";

// Phase 4 extensions
import { linkField } from "./decorations/links";
import { imageField } from "./decorations/images";

// Phase 5 extensions
import { codeBlockField } from "./decorations/codeBlocks";
import { mermaidField } from "./decorations/mermaid";

// Phase 6 extensions
import { tableField } from "./decorations/tables";

// Phase 9 extensions
import { horizontalRuleField } from "./decorations/horizontalRule";

// Phase 7 extensions
import { createSearchExtension } from "./extensions/search";
import { createSpellCheckExtension } from "./extensions/spellCheck";

/**
 * Options for creating editor extensions
 */
export interface CreateExtensionsOptions {
  /** Show line numbers in gutter */
  showLineNumbers?: boolean;
  /** Raw view mode - shows all syntax instead of WYSIWYG */
  rawMode?: boolean;
}

/**
 * Create the base extensions for the Jot CodeMirror editor
 */
export function createBaseExtensions(options: CreateExtensionsOptions = {}): Extension[] {
  const { rawMode = false } = options;

  return [
    // Markdown language with GFM (GitHub Flavored Markdown)
    markdown({ extensions: [GFM] }),

    // Core editing features
    history(),
    drawSelection(),
    dropCursor(),
    bracketMatching(),
    closeBrackets(),
    highlightActiveLine(),
    highlightSelectionMatches(),

    // Phase 2: WYSIWYG features (only in non-raw mode)
    createHiddenSyntaxExtension(rawMode),
    highlightField, // Custom ==highlight== decoration

    // Phase 3: Block structure decorations (only in non-raw mode)
    ...(rawMode ? [] : [headingField, listField, blockquoteField]),

    // Phase 4: Links and images (only in non-raw mode)
    ...(rawMode ? [] : [linkField, imageField]),

    // Phase 5: Code blocks and Mermaid diagrams (only in non-raw mode)
    ...(rawMode ? [] : [codeBlockField, mermaidField]),

    // Phase 6: Tables (only in non-raw mode)
    ...(rawMode ? [] : [tableField]),

    // Phase 9: Horizontal rules (only in non-raw mode)
    ...(rawMode ? [] : [horizontalRuleField]),

    // Phase 7: Search (always active)
    createSearchExtension(),

    // Phase 7: Spell check (always active, provides decorations)
    createSpellCheckExtension(),

    // Phase 3: Input rules (always active)
    inputRules,

    // Phase 2: Auto-close and delete behavior (always active)
    autoCloseMarkdown,
    deleteBehavior,

    // Keymaps
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      ...jotKeymap,
    ]),

    // Theme
    jotTheme,
  ];
}

/**
 * Create extensions with optional line numbers and raw mode
 */
export function createExtensions(options: CreateExtensionsOptions = {}): Extension[] {
  const extensions = createBaseExtensions(options);

  if (options.showLineNumbers) {
    extensions.push(lineNumbers());
  }

  return extensions;
}

// Re-export for convenience
export { hiddenSyntaxCompartment, toggleRawView };

// Re-export Phase 3 utilities for document outline
export { extractHeadingData, type HeadingData } from "./decorations/headings";
export { extractListData, type ListItemData } from "./decorations/lists";
export { extractBlockquoteData, type BlockquoteLineData } from "./decorations/blockquotes";

// Re-export Phase 4 utilities for links and images
export { extractLinkData, type LinkData } from "./decorations/links";
export { extractImageData, type ImageData } from "./decorations/images";

// Re-export Phase 5 utilities for code blocks and mermaid
export { extractCodeBlockData, type CodeBlockData } from "./decorations/codeBlocks";
export { extractMermaidData, type MermaidData } from "./decorations/mermaid";

// Re-export Phase 6 utilities for tables
export { extractTableData, type TableData, type CellData, type Alignment } from "./decorations/tables";

// Re-export Phase 9 utilities for horizontal rules
export { extractHorizontalRuleData, type HorizontalRuleData } from "./decorations/horizontalRule";

// Re-export Phase 7 utilities for search and spell check
export {
  setSearchQuery,
  findNext,
  findPrevious,
  replaceOne,
  replaceAll,
  clearSearch,
  getSearchState,
  type SearchQueryParams,
  type SearchState,
} from "./extensions/search";

export {
  getSpellErrors,
  addToIgnored,
  clearIgnored,
  replaceWord,
  refreshSpellCheck,
  getSpellErrorAt,
  type SpellError,
} from "./extensions/spellCheck";

/**
 * Create a new CodeMirror editor state
 */
export function createEditorState(
  doc: string,
  extensions: Extension[] = createExtensions()
): EditorState {
  return EditorState.create({
    doc,
    extensions,
  });
}

/**
 * Create a new CodeMirror editor view
 */
export function createEditorView(
  state: EditorState,
  parent: HTMLElement
): EditorView {
  return new EditorView({
    state,
    parent,
  });
}
