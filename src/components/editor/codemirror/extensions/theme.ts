/**
 * Theme
 *
 * EditorView.theme() configuration for the WYSIWYG editor.
 * Defines CSS styles for all visual elements.
 */

import { EditorView } from "@codemirror/view";

// ===========================================
// EDITOR THEME
// ===========================================

export const theme = EditorView.theme({
  "&": {
    fontSize: "16px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  ".cm-content": {
    padding: "16px",
    lineHeight: "1.6",
  },
  ".cm-strong": {
    fontWeight: "bold",
  },
  ".cm-em": {
    fontStyle: "italic",
  },
  ".cm-inline-code": {
    fontFamily: "monospace",
    backgroundColor: "rgba(0, 0, 0, 0.06)",
    padding: "2px 4px",
    borderRadius: "3px",
  },
  ".cm-strikethrough": {
    textDecoration: "line-through",
  },
  ".cm-highlight": {
    backgroundColor: "#fff3b0",
    borderRadius: "2px",
    padding: "1px 0",
  },
  ".cm-link": {
    color: "#0066cc",
    textDecoration: "underline",
    cursor: "pointer",
  },
  // Heading styles
  ".cm-h1": {
    fontSize: "2em",
    fontWeight: "700",
    lineHeight: "1.2",
  },
  ".cm-h2": {
    fontSize: "1.5em",
    fontWeight: "600",
    lineHeight: "1.3",
  },
  ".cm-h3": {
    fontSize: "1.25em",
    fontWeight: "600",
    lineHeight: "1.4",
  },
  ".cm-h4": {
    fontSize: "1.1em",
    fontWeight: "600",
    lineHeight: "1.5",
  },
  ".cm-h5": {
    fontSize: "1em",
    fontWeight: "600",
    lineHeight: "1.5",
  },
  ".cm-h6": {
    fontSize: "0.9em",
    fontWeight: "600",
    lineHeight: "1.5",
    color: "#666",
  },
  // List styles - bullets/numbers are rendered via widgets now
  ".cm-list-ul, .cm-list-ol": {
    display: "inline",
  },
  // Widget styles for list bullets and numbers
  ".cm-list-bullet, .cm-list-number": {
    userSelect: "none",
    fontFamily: "system-ui, sans-serif",
  },
  // Widget styles for task checkboxes
  ".cm-task-checkbox": {
    display: "inline-block",
    verticalAlign: "middle",
  },
  ".cm-task-checkbox input": {
    margin: "0 6px 0 0",
    cursor: "pointer",
    width: "14px",
    height: "14px",
  },
  // Blockquote styles
  ".cm-blockquote-bar": {
    userSelect: "none",
  },
  ".cm-blockquote-bar-segment": {
    opacity: "0.6",
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
    borderTop: "1px solid #d1d5db",
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
    color: "#57606a",
    backgroundColor: "#f1f3f5",
    padding: "2px 8px",
    borderRadius: "4px 4px 0 0",
    border: "1px solid #e1e4e8",
    borderBottom: "none",
    textTransform: "lowercase",
    fontFamily: "system-ui, sans-serif",
  },
  ".cm-code-block-close": {
    display: "block",
    height: "4px",
    margin: "0",
    paddingBottom: "8px",
  },
  // Code block content lines (between fences)
  ".cm-code-block-line": {
    fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace",
    fontSize: "14px",
    backgroundColor: "#f6f8fa",
    borderLeft: "1px solid #e1e4e8",
    borderRight: "1px solid #e1e4e8",
    paddingLeft: "16px",
    paddingRight: "16px",
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
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },
  "&.cm-pending-strikethrough .cm-cursor": {
    opacity: "0.6",
  },
  "&.cm-pending-highlight .cm-cursor": {
    backgroundColor: "#fff3b0",
  },
  ".cm-line": {
    padding: "0 4px",
  },
  // HTML table widget styles
  ".cm-table-block": {
    margin: "16px 0",
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
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "14px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    tableLayout: "fixed",
    boxSizing: "border-box",
    whiteSpace: "normal",
  },
  ".cm-table thead tr": {
    backgroundColor: "#f6f8fa",
  },
  ".cm-table th": {
    padding: "10px 16px",
    textAlign: "left",
    fontWeight: "600",
    fontSize: "0.8em",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#57606a",
    borderBottom: "2px solid #d1d5db",
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
    padding: "10px 16px",
    color: "#24292e",
    borderBottom: "1px solid #e5e7eb",
    verticalAlign: "top",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },
  ".cm-table-row-odd": {
    backgroundColor: "white",
  },
  ".cm-table-row-even": {
    backgroundColor: "#fafafa",
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
    outline: "2px solid #007aff",
    outlineOffset: "-2px",
  },
  ".cm-table tbody tr:hover": {
    backgroundColor: "#f5f5f5",
  },
  // Table toolbar styles
  ".cm-table-toolbar": {
    display: "flex",
    gap: "12px",
    marginBottom: "8px",
    opacity: "0",
    transition: "opacity 0.15s ease",
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
    color: "#57606a",
    backgroundColor: "#f6f8fa",
    border: "1px solid #d1d5db",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "background-color 0.1s ease, border-color 0.1s ease",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  ".cm-table-toolbar-btn:hover": {
    backgroundColor: "#e5e7eb",
    borderColor: "#9ca3af",
  },
  ".cm-table-toolbar-btn:active": {
    backgroundColor: "#d1d5db",
  },
});
