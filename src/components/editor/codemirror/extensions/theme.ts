/**
 * Theme
 *
 * EditorView.theme() configuration for the WYSIWYG editor.
 * Uses CSS variables from theme.css for consistent theming.
 */

import { EditorView } from "@codemirror/view";

// ===========================================
// EDITOR THEME
// ===========================================

export const theme = EditorView.theme({
  "&": {
    fontSize: "var(--editor-font-size, 18px)",
    fontFamily: "var(--font-serif)",
    color: "var(--color-ink)",
    backgroundColor: "var(--color-paper)",
  },
  ".cm-content": {
    maxWidth: "var(--editor-max-width, 72ch)",
    margin: "0 auto",
    padding: "var(--spacing-page)",
    lineHeight: "var(--editor-line-height, 1.8)",
    minHeight: "100vh",
    caretColor: "var(--color-accent)",
  },
  ".cm-focused": {
    outline: "none",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--color-accent)",
    borderLeftWidth: "2px",
  },
  ".cm-strong": {
    fontWeight: "600",
  },
  ".cm-em": {
    fontStyle: "italic",
  },
  ".cm-inline-code": {
    fontFamily: "var(--font-mono)",
    fontSize: "0.9em",
    backgroundColor: "var(--color-paper-warm)",
    padding: "0.15em 0.4em",
    borderRadius: "4px",
    color: "var(--color-accent)",
  },
  ".cm-strikethrough": {
    textDecoration: "line-through",
    color: "var(--color-ink-muted)",
  },
  ".cm-highlight": {
    backgroundColor: "var(--color-highlight)",
    borderRadius: "2px",
    padding: "0.1em 0.2em",
  },
  ".cm-link": {
    color: "var(--color-accent)",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
    textDecorationThickness: "1px",
    cursor: "pointer",
    transition: "color var(--transition-fast)",
  },
  ".cm-link:hover": {
    color: "var(--color-ink)",
  },
  // Internal links - wiki-style links
  ".cm-internal-link": {
    color: "var(--color-accent)",
    textDecoration: "none",
    borderBottom: "1px dashed currentColor",
    cursor: "pointer",
    transition: "all var(--transition-fast)",
  },
  ".cm-internal-link:hover": {
    borderBottomStyle: "solid",
  },
  ".cm-internal-link.broken": {
    color: "#d97706",
    borderBottomStyle: "wavy",
    borderBottomColor: "#d97706",
  },
  // Heading styles - match editor.css
  ".cm-h1": {
    fontSize: "2.5rem",
    fontWeight: "700",
    lineHeight: "1.3",
    letterSpacing: "-0.02em",
    marginTop: "0",
    marginBottom: "0.5em",
  },
  ".cm-h2": {
    fontSize: "1.875rem",
    fontWeight: "600",
    lineHeight: "1.3",
    letterSpacing: "-0.01em",
    marginTop: "2em",
    marginBottom: "0.5em",
  },
  ".cm-h3": {
    fontSize: "1.5rem",
    fontWeight: "600",
    lineHeight: "1.3",
    marginTop: "2em",
    marginBottom: "0.5em",
  },
  ".cm-h4": {
    fontSize: "1.25rem",
    fontWeight: "600",
    lineHeight: "1.5",
    marginTop: "2em",
    marginBottom: "0.5em",
  },
  ".cm-h5, .cm-h6": {
    fontSize: "1rem",
    fontWeight: "600",
    lineHeight: "1.5",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginTop: "2em",
    marginBottom: "0.5em",
  },
  ".cm-h6": {
    color: "var(--color-ink-muted)",
  },
  // List styles - bullets/numbers are rendered via widgets now
  ".cm-list-ul, .cm-list-ol": {
    display: "inline",
  },
  // Widget styles for list bullets and numbers
  ".cm-list-bullet, .cm-list-number": {
    userSelect: "none",
    fontFamily: "var(--font-sans)",
  },
  // Widget styles for task checkboxes
  ".cm-task-checkbox": {
    display: "inline-block",
    verticalAlign: "middle",
  },
  ".cm-task-checkbox input": {
    margin: "0 6px 0 0",
    cursor: "pointer",
    width: "1.1em",
    height: "1.1em",
    accentColor: "var(--color-accent)",
  },
  ".cm-task-done": {
    color: "var(--color-ink-muted)",
    textDecoration: "line-through",
  },
  // Blockquote styles
  ".cm-blockquote-bar": {
    userSelect: "none",
  },
  ".cm-blockquote-bar-segment": {
    opacity: "0.6",
  },
  ".cm-blockquote-content": {
    color: "var(--color-ink-light)",
    fontStyle: "italic",
  },
  // Horizontal rule styles
  ".cm-horizontal-rule": {
    display: "block",
    margin: "0",
    padding: "16px 0",
    lineHeight: "0",
    userSelect: "none",
  },
  ".cm-horizontal-rule-line": {
    border: "none",
    borderTop: "1px solid var(--color-border)",
    margin: "0",
    padding: "0",
    height: "0",
  },
  // Code block fence styles (opening badge and closing marker)
  ".cm-code-block-open": {
    display: "block",
    margin: "0",
    paddingTop: "8px",
    paddingBottom: "4px",
  },
  ".cm-code-block-lang-badge": {
    display: "inline-block",
    fontSize: "11px",
    fontWeight: "500",
    color: "var(--color-ink-muted)",
    backgroundColor: "var(--color-paper-warm)",
    padding: "2px 8px",
    borderRadius: "4px 4px 0 0",
    border: "1px solid var(--color-border)",
    borderBottom: "none",
    textTransform: "lowercase",
    fontFamily: "var(--font-sans)",
  },
  ".cm-code-block-close": {
    display: "block",
    height: "4px",
    margin: "0",
    paddingBottom: "8px",
  },
  // Code block content lines (between fences)
  ".cm-code-block-line": {
    fontFamily: "var(--font-mono)",
    fontSize: "0.875rem",
    lineHeight: "1.6",
    backgroundColor: "var(--color-paper-warm)",
    borderLeft: "1px solid var(--color-border)",
    borderRight: "1px solid var(--color-border)",
    paddingLeft: "1.25em",
    paddingRight: "1.25em",
  },
  // Pending format styles - style the cursor/caret when in pending format mode
  "&.cm-pending-bold .cm-cursor": {
    borderLeftWidth: "3px",
  },
  "&.cm-pending-bold .cm-line .cm-cursor + *": {
    fontWeight: "bold",
  },
  "&.cm-pending-italic .cm-cursor": {
    transform: "skewX(-12deg)",
  },
  "&.cm-pending-code .cm-cursor": {
    backgroundColor: "var(--color-paper-warm)",
  },
  "&.cm-pending-strikethrough .cm-cursor": {
    opacity: "0.6",
  },
  "&.cm-pending-highlight .cm-cursor": {
    backgroundColor: "var(--color-highlight)",
  },
  ".cm-line": {
    padding: "0 4px",
  },
  // Selection styling
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "var(--color-accent-soft)",
  },
  "::selection": {
    backgroundColor: "var(--color-accent-soft)",
  },
  // HTML table widget styles
  ".cm-table-block": {
    margin: "1.5em 0",
    overflowX: "auto",
    display: "block",
    width: "100%",
    maxWidth: "100%",
    minWidth: "0",
    boxSizing: "border-box",
    whiteSpace: "normal",
  },
  ".cm-table": {
    width: "100%",
    maxWidth: "100%",
    minWidth: "0",
    borderCollapse: "separate",
    borderSpacing: "0",
    border: "1px solid var(--color-border)",
    borderRadius: "6px",
    fontSize: "0.95em",
    fontFamily: "var(--font-sans)",
    tableLayout: "fixed",
    boxSizing: "border-box",
    whiteSpace: "normal",
  },
  ".cm-table thead tr": {
    backgroundColor: "var(--color-paper-warm)",
  },
  ".cm-table th": {
    padding: "0.75em 1em",
    textAlign: "left",
    fontWeight: "600",
    fontSize: "0.875em",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    color: "var(--color-ink-muted)",
    borderBottom: "2px solid var(--color-border-strong)",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  },
  ".cm-table th:first-child": {
    borderTopLeftRadius: "6px",
  },
  ".cm-table th:last-child": {
    borderTopRightRadius: "6px",
  },
  ".cm-table td": {
    padding: "0.75em 1em",
    color: "var(--color-ink)",
    borderBottom: "1px solid var(--color-border)",
    verticalAlign: "top",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },
  ".cm-table-row-odd": {
    backgroundColor: "var(--color-paper)",
  },
  ".cm-table-row-even": {
    backgroundColor: "var(--color-paper-warm)",
  },
  ".cm-table tbody tr:last-child td:first-child": {
    borderBottomLeftRadius: "6px",
  },
  ".cm-table tbody tr:last-child td:last-child": {
    borderBottomRightRadius: "6px",
  },
  ".cm-table tbody tr:last-child td": {
    borderBottom: "none",
  },
  ".cm-table th:focus, .cm-table td:focus": {
    outline: "2px solid var(--color-accent)",
    outlineOffset: "-2px",
  },
  ".cm-table tbody tr:hover": {
    backgroundColor: "color-mix(in srgb, var(--color-paper-warm) 50%, var(--color-paper))",
  },
  ".cm-table .selectedCell": {
    backgroundColor: "var(--color-accent-soft)",
  },
  // Table toolbar styles
  ".cm-table-toolbar": {
    display: "flex",
    gap: "12px",
    marginBottom: "8px",
    opacity: "0",
    transition: "opacity var(--transition-fast)",
  },
  ".cm-table-block:hover .cm-table-toolbar, .cm-table-block:focus-within .cm-table-toolbar": {
    opacity: "1",
  },
  ".cm-table-toolbar-group": {
    display: "flex",
    gap: "4px",
  },
  ".cm-table-toolbar-btn": {
    padding: "4px 10px",
    fontSize: "12px",
    fontWeight: "500",
    color: "var(--color-ink-muted)",
    backgroundColor: "var(--color-paper-warm)",
    border: "1px solid var(--color-border)",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "background-color var(--transition-fast), border-color var(--transition-fast)",
    fontFamily: "var(--font-sans)",
  },
  ".cm-table-toolbar-btn:hover": {
    backgroundColor: "var(--color-border)",
    borderColor: "var(--color-border-strong)",
  },
  ".cm-table-toolbar-btn:active": {
    backgroundColor: "var(--color-border-strong)",
  },
  // Search panel styles
  ".cm-panels": {
    backgroundColor: "var(--color-paper)",
    borderBottom: "1px solid var(--color-border)",
  },
  ".cm-panel.cm-search": {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    fontFamily: "var(--font-sans)",
    fontSize: "14px",
  },
  ".cm-search input": {
    padding: "6px 12px",
    border: "1px solid var(--color-border)",
    borderRadius: "4px",
    fontSize: "14px",
    fontFamily: "inherit",
    backgroundColor: "var(--color-paper)",
    color: "var(--color-ink)",
    outline: "none",
    minWidth: "120px",
  },
  ".cm-search input:focus": {
    borderColor: "var(--color-accent)",
    boxShadow: "0 0 0 2px color-mix(in srgb, var(--color-accent) 15%, transparent)",
  },
  ".cm-search label": {
    color: "var(--color-ink)",
    fontSize: "13px",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    cursor: "pointer",
  },
  ".cm-search label input[type='checkbox']": {
    width: "auto",
    minWidth: "auto",
    margin: "0",
    cursor: "pointer",
    accentColor: "var(--color-accent)",
  },
  ".cm-search button": {
    padding: "6px 12px",
    fontSize: "13px",
    fontWeight: "500",
    color: "var(--color-ink)",
    backgroundColor: "var(--color-paper-warm)",
    border: "1px solid var(--color-border)",
    borderRadius: "4px",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background-color var(--transition-fast), border-color var(--transition-fast)",
  },
  ".cm-search button:hover": {
    backgroundColor: "var(--color-border)",
    borderColor: "var(--color-border-strong)",
  },
  ".cm-search button:active": {
    backgroundColor: "var(--color-border-strong)",
  },
  ".cm-search button[name='close']": {
    padding: "4px 8px",
    fontSize: "16px",
    lineHeight: "1",
  },
  // Search match highlighting
  ".cm-searchMatch": {
    backgroundColor: "color-mix(in srgb, var(--color-highlight) 70%, transparent)",
    borderRadius: "2px",
  },
  ".cm-searchMatch-selected": {
    backgroundColor: "var(--color-highlight)",
    borderRadius: "2px",
  },
  // Selection matches (highlight other occurrences of selected text)
  ".cm-selectionMatch": {
    backgroundColor: "color-mix(in srgb, var(--color-accent) 15%, transparent)",
    borderRadius: "2px",
  },
  // Placeholder styles
  ".cm-placeholder": {
    color: "var(--color-ink-muted)",
    fontStyle: "italic",
  },
  // Scrollbar styling
  "&::-webkit-scrollbar": {
    width: "8px",
    height: "8px",
  },
  "&::-webkit-scrollbar-track": {
    background: "transparent",
  },
  "&::-webkit-scrollbar-thumb": {
    background: "var(--color-border-strong)",
    borderRadius: "4px",
  },
  "&::-webkit-scrollbar-thumb:hover": {
    background: "var(--color-ink-muted)",
  },
});
