/**
 * CodeMirror 6 Theme for Jot
 *
 * Matches the existing Jot design system using CSS variables.
 * Supports all theme presets (paper, midnight, sepia, highContrast, olive).
 */

import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/**
 * Base editor theme - structural styles
 */
const baseTheme = EditorView.theme({
  // Main editor container
  "&": {
    backgroundColor: "var(--color-paper)",
    color: "var(--color-ink)",
    fontFamily: "var(--font-serif)",
    fontSize: "var(--editor-font-size, 18px)",
    lineHeight: "var(--editor-line-height, 1.8)",
    height: "100%",
  },

  // Content area
  ".cm-content": {
    caretColor: "var(--color-accent)",
    fontFamily: "inherit",
    padding: "2rem var(--spacing-page)",
    maxWidth: "var(--editor-max-width, 72ch)",
    margin: "0 auto",
  },

  // Cursor
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--color-accent)",
    borderLeftWidth: "2px",
  },

  // Selection
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--color-accent-soft)",
  },

  // Active line
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },

  "&.cm-focused .cm-activeLine": {
    backgroundColor: "color-mix(in srgb, var(--color-accent-soft) 20%, transparent)",
  },

  // Gutters (line numbers)
  ".cm-gutters": {
    backgroundColor: "var(--color-paper-warm)",
    borderRight: "1px solid var(--color-border)",
    color: "var(--color-ink-muted)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.8em",
  },

  ".cm-gutter-lint": {
    width: "1em",
  },

  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 8px 0 16px",
    minWidth: "3em",
    textAlign: "right",
  },

  // Placeholder text
  ".cm-placeholder": {
    color: "var(--color-ink-muted)",
    fontStyle: "italic",
  },

  // Search matches
  ".cm-searchMatch": {
    backgroundColor: "var(--color-highlight)",
    borderRadius: "2px",
  },

  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "var(--color-accent-soft)",
  },

  // Selection matching
  ".cm-selectionMatch": {
    backgroundColor: "color-mix(in srgb, var(--color-highlight) 50%, transparent)",
  },

  // Spell check errors
  ".spell-error": {
    textDecoration: "underline wavy var(--color-error, #dc2626)",
    textDecorationSkipInk: "none",
    cursor: "pointer",
  },

  // Panels (search, etc.)
  ".cm-panels": {
    backgroundColor: "var(--color-paper-warm)",
    borderBottom: "1px solid var(--color-border)",
  },

  ".cm-panel": {
    padding: "0.5rem 1rem",
  },

  ".cm-panel input, .cm-panel button": {
    fontFamily: "var(--font-sans)",
    fontSize: "0.875rem",
  },

  ".cm-panel button": {
    backgroundColor: "var(--color-paper)",
    border: "1px solid var(--color-border)",
    borderRadius: "4px",
    padding: "0.25rem 0.75rem",
    cursor: "pointer",
    color: "var(--color-ink)",
  },

  ".cm-panel button:hover": {
    backgroundColor: "var(--color-paper-warm)",
  },

  ".cm-panel input[type='text']": {
    backgroundColor: "var(--color-paper)",
    border: "1px solid var(--color-border)",
    borderRadius: "4px",
    padding: "0.25rem 0.5rem",
    color: "var(--color-ink)",
  },

  ".cm-panel input[type='text']:focus": {
    outline: "none",
    borderColor: "var(--color-accent)",
    boxShadow: "0 0 0 2px var(--color-accent-soft)",
  },

  // Tooltips
  ".cm-tooltip": {
    backgroundColor: "var(--color-paper)",
    border: "1px solid var(--color-border)",
    borderRadius: "6px",
    boxShadow: "var(--shadow-md)",
  },

  // Autocomplete
  ".cm-tooltip-autocomplete": {
    "& > ul": {
      fontFamily: "var(--font-sans)",
      fontSize: "0.875rem",
    },
    "& > ul > li": {
      padding: "0.375rem 0.75rem",
    },
    "& > ul > li[aria-selected]": {
      backgroundColor: "var(--color-accent-soft)",
      color: "var(--color-ink)",
    },
  },

  // Fold markers
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--color-paper-warm)",
    border: "1px solid var(--color-border)",
    borderRadius: "4px",
    padding: "0 0.5rem",
    color: "var(--color-ink-muted)",
    cursor: "pointer",
  },

  // Phase 3: Headings (line decorations)
  ".cm-heading": {
    fontWeight: "700",
    color: "var(--color-ink)",
  },
  ".cm-heading-1": {
    fontSize: "1.75em",
    lineHeight: "1.3",
    marginTop: "1.5em",
  },
  ".cm-heading-2": {
    fontSize: "1.5em",
    lineHeight: "1.35",
    marginTop: "1.25em",
  },
  ".cm-heading-3": {
    fontSize: "1.25em",
    lineHeight: "1.4",
    marginTop: "1em",
  },
  ".cm-heading-4": {
    fontSize: "1.125em",
    fontWeight: "600",
  },
  ".cm-heading-5": {
    fontSize: "1em",
    fontWeight: "600",
  },
  ".cm-heading-6": {
    fontSize: "0.9em",
    fontWeight: "600",
    color: "var(--color-ink-light)",
  },

  // Phase 3: Lists (widget styles)
  ".cm-list-bullet": {
    display: "inline-block",
    width: "1.5em",
    textAlign: "center",
    color: "var(--color-accent)",
    fontWeight: "700",
  },
  ".cm-list-number": {
    display: "inline-block",
    width: "1.5em",
    textAlign: "right",
    paddingRight: "0.5em",
    color: "var(--color-ink-light)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.9em",
  },
  ".cm-task-checkbox": {
    display: "inline-block",
    width: "1.5em",
    textAlign: "center",
    cursor: "pointer",
  },
  ".cm-task-unchecked": {
    color: "var(--color-ink-muted)",
  },
  ".cm-task-checked": {
    color: "var(--color-accent)",
  },

  // Phase 3: Blockquotes (line decorations)
  ".cm-blockquote": {
    borderLeft: "3px solid var(--color-border-strong)",
    paddingLeft: "1rem",
    color: "var(--color-ink-light)",
    fontStyle: "italic",
  },
  ".cm-blockquote-1": {
    borderLeftColor: "var(--color-border-strong)",
  },
  ".cm-blockquote-2": {
    borderLeftWidth: "4px",
    paddingLeft: "1.5rem",
    borderLeftColor: "var(--color-accent)",
  },
  ".cm-blockquote-3": {
    borderLeftWidth: "5px",
    paddingLeft: "2rem",
    borderLeftColor: "var(--color-ink-muted)",
  },
  ".cm-blockquote-4": {
    borderLeftWidth: "6px",
    paddingLeft: "2.5rem",
  },
  ".cm-blockquote-5": {
    borderLeftWidth: "7px",
    paddingLeft: "3rem",
  },

  // Phase 2: Highlight (custom ==...== syntax)
  ".cm-highlight": {
    backgroundColor: "var(--color-highlight)",
    borderRadius: "2px",
    padding: "0.1em 0",
  },

  // Phase 4: Links (widget styles)
  ".cm-link": {
    color: "var(--color-accent)",
    textDecoration: "underline",
    textDecorationColor: "color-mix(in srgb, var(--color-accent) 40%, transparent)",
    textUnderlineOffset: "2px",
    cursor: "pointer",
    transition: "color 0.15s, text-decoration-color 0.15s",
  },
  ".cm-link:hover": {
    color: "var(--color-accent)",
    textDecorationColor: "var(--color-accent)",
  },
  ".cm-internal-link": {
    // Internal links use the same accent color but could be distinguished
    // with a subtle background on hover
  },
  ".cm-internal-link:hover": {
    backgroundColor: "color-mix(in srgb, var(--color-accent-soft) 30%, transparent)",
    borderRadius: "2px",
  },
  ".cm-external-link": {
    // External links get a subtle indicator
  },
  ".cm-external-link::after": {
    content: '"↗"',
    fontSize: "0.7em",
    marginLeft: "0.2em",
    opacity: "0.6",
    verticalAlign: "super",
  },

  // Phase 4: Images (widget styles)
  ".cm-image-widget": {
    display: "inline-block",
    verticalAlign: "middle",
    maxWidth: "100%",
    margin: "0.5em 0",
  },
  ".cm-image": {
    maxWidth: "100%",
    height: "auto",
    borderRadius: "4px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  },
  ".cm-image-loaded .cm-image": {
    // Successfully loaded image
  },
  ".cm-image-error": {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5em",
    padding: "0.5em 1em",
    backgroundColor: "var(--color-paper-warm)",
    border: "1px dashed var(--color-border)",
    borderRadius: "4px",
    color: "var(--color-ink-muted)",
    fontFamily: "var(--font-sans)",
    fontSize: "0.875em",
  },
  ".cm-image-fallback": {
    fontStyle: "italic",
  },

  // Phase 5: Code Blocks (with Shiki syntax highlighting)
  ".cm-code-block-widget": {
    display: "block",
    margin: "1rem 0",
    borderRadius: "8px",
    overflow: "hidden",
    border: "1px solid var(--color-border)",
    backgroundColor: "var(--color-paper-warm)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.875em",
  },
  ".cm-code-block-header": {
    display: "flex",
    alignItems: "center",
    padding: "0.5rem 0.75rem",
    backgroundColor: "color-mix(in srgb, var(--color-paper-warm) 80%, var(--color-border))",
    borderBottom: "1px solid var(--color-border)",
    gap: "0.5rem",
  },
  ".cm-code-language-badge": {
    fontSize: "0.75em",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--color-ink-muted)",
    backgroundColor: "var(--color-paper)",
    padding: "0.2em 0.5em",
    borderRadius: "4px",
  },
  ".cm-code-copy-button": {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35rem",
    padding: "0.25rem 0.5rem",
    fontSize: "0.75em",
    color: "var(--color-ink-muted)",
    backgroundColor: "transparent",
    border: "1px solid transparent",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  ".cm-code-copy-button:hover": {
    color: "var(--color-ink)",
    backgroundColor: "var(--color-paper)",
    borderColor: "var(--color-border)",
  },
  ".cm-code-copied .cm-code-copy-button, .cm-code-copy-button.cm-code-copied": {
    color: "var(--color-accent)",
  },
  ".cm-code-block-content": {
    overflow: "auto",
  },
  ".cm-code-block-pre": {
    margin: "0",
    padding: "1rem",
    overflow: "auto",
    lineHeight: "1.6",
  },
  ".cm-code-content": {
    display: "block",
  },
  ".cm-code-loading": {
    opacity: "0.7",
  },
  ".cm-code-highlighted": {
    opacity: "1",
  },
  // Shiki generates pre.shiki with inline styles for theming
  ".cm-code-block-content pre.shiki": {
    margin: "0",
    padding: "1rem",
    backgroundColor: "transparent !important",
    overflow: "auto",
  },

  // Phase 5: Mermaid Diagrams
  ".cm-mermaid-widget": {
    display: "block",
    margin: "1rem 0",
    borderRadius: "8px",
    overflow: "hidden",
    border: "1px solid var(--color-border)",
    backgroundColor: "var(--color-paper)",
  },
  ".cm-mermaid-header": {
    display: "flex",
    alignItems: "center",
    padding: "0.5rem 0.75rem",
    backgroundColor: "color-mix(in srgb, var(--color-paper-warm) 80%, var(--color-border))",
    borderBottom: "1px solid var(--color-border)",
    gap: "0.5rem",
  },
  ".cm-mermaid-badge": {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35rem",
    fontSize: "0.75em",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--color-ink-muted)",
    backgroundColor: "var(--color-paper)",
    padding: "0.2em 0.5em",
    borderRadius: "4px",
    fontFamily: "var(--font-sans)",
  },
  ".cm-mermaid-actions": {
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
  },
  ".cm-mermaid-copy-button, .cm-mermaid-export-button": {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35rem",
    padding: "0.25rem 0.5rem",
    fontSize: "0.75em",
    color: "var(--color-ink-muted)",
    backgroundColor: "transparent",
    border: "1px solid transparent",
    borderRadius: "4px",
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    transition: "all 0.15s ease",
  },
  ".cm-mermaid-copy-button:hover, .cm-mermaid-export-button:hover": {
    color: "var(--color-ink)",
    backgroundColor: "var(--color-paper)",
    borderColor: "var(--color-border)",
  },
  ".cm-mermaid-copied": {
    color: "var(--color-accent)",
  },
  ".cm-mermaid-export-dropdown": {
    position: "relative",
  },
  ".cm-mermaid-export-menu": {
    position: "absolute",
    top: "100%",
    right: "0",
    marginTop: "4px",
    flexDirection: "column",
    backgroundColor: "var(--color-paper)",
    border: "1px solid var(--color-border)",
    borderRadius: "6px",
    boxShadow: "var(--shadow-md)",
    zIndex: "100",
    minWidth: "120px",
    overflow: "hidden",
  },
  ".cm-mermaid-export-menu button": {
    display: "block",
    width: "100%",
    padding: "0.5rem 0.75rem",
    fontSize: "0.8em",
    color: "var(--color-ink)",
    backgroundColor: "transparent",
    border: "none",
    textAlign: "left",
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    transition: "background-color 0.1s",
  },
  ".cm-mermaid-export-menu button:hover": {
    backgroundColor: "var(--color-paper-warm)",
  },
  ".cm-mermaid-diagram": {
    padding: "1rem",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100px",
  },
  ".cm-mermaid-loading": {
    color: "var(--color-ink-muted)",
  },
  ".cm-mermaid-loading-content": {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontFamily: "var(--font-sans)",
    fontSize: "0.875em",
  },
  ".cm-mermaid-spinner": {
    width: "16px",
    height: "16px",
    border: "2px solid var(--color-border)",
    borderTopColor: "var(--color-accent)",
    borderRadius: "50%",
    animation: "cm-spin 0.8s linear infinite",
  },
  ".cm-mermaid-rendered svg": {
    maxWidth: "100%",
    height: "auto",
  },
  ".cm-mermaid-error": {
    backgroundColor: "color-mix(in srgb, #ef4444 10%, var(--color-paper))",
    borderRadius: "4px",
    padding: "0.75rem 1rem",
    margin: "0.5rem",
  },
  ".cm-mermaid-error-content": {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.75rem",
    color: "#ef4444",
    fontFamily: "var(--font-sans)",
    fontSize: "0.875em",
  },
  ".cm-mermaid-error-text": {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  ".cm-mermaid-error-text strong": {
    fontWeight: "600",
  },
  ".cm-mermaid-error-text span": {
    color: "var(--color-ink-muted)",
    fontSize: "0.9em",
  },

  // Phase 6: Tables
  ".cm-table-widget": {
    display: "block",
    margin: "1rem 0",
    borderRadius: "8px",
    overflow: "hidden",
    border: "1px solid var(--color-border)",
    backgroundColor: "var(--color-paper)",
  },
  ".cm-table": {
    width: "100%",
    borderCollapse: "collapse",
    fontFamily: "var(--font-sans)",
    fontSize: "0.9em",
  },
  ".cm-table th, .cm-table td": {
    border: "1px solid var(--color-border)",
    padding: "0",
  },
  ".cm-table th": {
    backgroundColor: "var(--color-paper-warm)",
    fontWeight: "600",
  },
  ".cm-table-cell": {
    verticalAlign: "top",
  },
  ".cm-table-cell-content": {
    padding: "0.5rem 0.75rem",
    minHeight: "1.5em",
    outline: "none",
  },
  ".cm-table-cell-content:focus": {
    backgroundColor: "color-mix(in srgb, var(--color-accent-soft) 20%, transparent)",
    boxShadow: "inset 0 0 0 2px var(--color-accent)",
  },
  ".cm-table-controls": {
    display: "flex",
    gap: "0.5rem",
    padding: "0.5rem",
    backgroundColor: "var(--color-paper-warm)",
    borderTop: "1px solid var(--color-border)",
  },
  ".cm-table-add-row, .cm-table-add-column": {
    padding: "0.25rem 0.5rem",
    fontSize: "0.75em",
    color: "var(--color-ink-muted)",
    backgroundColor: "transparent",
    border: "1px solid var(--color-border)",
    borderRadius: "4px",
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    transition: "all 0.15s ease",
  },
  ".cm-table-add-row:hover, .cm-table-add-column:hover": {
    color: "var(--color-ink)",
    backgroundColor: "var(--color-paper)",
    borderColor: "var(--color-accent)",
  },

  // Phase 9: Horizontal Rules
  ".cm-horizontal-rule": {
    display: "block",
    width: "100%",
    border: "none",
    borderTop: "1px solid var(--color-border)",
    margin: "2em 0",
    height: "0",
  },

  // Phase 9: Inline code (for raw syntax view)
  ".cm-inline-code": {
    fontFamily: "var(--font-mono)",
    fontSize: "0.9em",
    backgroundColor: "var(--color-paper-warm)",
    padding: "0.15em 0.4em",
    borderRadius: "4px",
    color: "var(--color-accent)",
  },
});

/**
 * Syntax highlighting for Markdown
 */
const syntaxColors = HighlightStyle.define([
  // Headings
  { tag: tags.heading1, fontWeight: "700", fontSize: "1.75em", lineHeight: "1.3" },
  { tag: tags.heading2, fontWeight: "700", fontSize: "1.5em", lineHeight: "1.35" },
  { tag: tags.heading3, fontWeight: "600", fontSize: "1.25em", lineHeight: "1.4" },
  { tag: tags.heading4, fontWeight: "600", fontSize: "1.125em" },
  { tag: tags.heading5, fontWeight: "600", fontSize: "1em" },
  { tag: tags.heading6, fontWeight: "600", fontSize: "0.9em", color: "var(--color-ink-light)" },

  // Emphasis
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "var(--color-ink-muted)" },

  // Links
  { tag: tags.link, color: "var(--color-accent)", textDecoration: "underline" },
  { tag: tags.url, color: "var(--color-accent)", textDecoration: "underline" },

  // Code
  {
    tag: tags.monospace,
    fontFamily: "var(--font-mono)",
    fontSize: "0.9em",
    backgroundColor: "var(--color-paper-warm)",
    borderRadius: "3px",
    padding: "0.1em 0.3em",
  },

  // Quotes
  {
    tag: tags.quote,
    color: "var(--color-ink-light)",
    fontStyle: "italic",
    borderLeft: "3px solid var(--color-border-strong)",
    paddingLeft: "1rem",
  },

  // Lists
  { tag: tags.list, color: "var(--color-ink)" },

  // Punctuation and meta (markdown syntax markers)
  { tag: tags.processingInstruction, color: "var(--color-ink-muted)" },
  { tag: tags.meta, color: "var(--color-ink-muted)" },

  // Comments (HTML comments in markdown)
  { tag: tags.comment, color: "var(--color-ink-muted)", fontStyle: "italic" },

  // Content (images, etc.)
  { tag: tags.contentSeparator, color: "var(--color-border-strong)" },
]);

/**
 * Combined Jot theme for CodeMirror
 */
export const jotTheme = [baseTheme, syntaxHighlighting(syntaxColors)];
