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
