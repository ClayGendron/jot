/**
 * Style Decorations
 *
 * StateField that builds CSS class decorations for formatted content.
 * Applies visual styles (bold, italic, etc.) to content between markdown markers.
 *
 * Uses BOTH Lezer AST nodes AND regex fallback to catch cases the parser misses
 * (like trailing whitespace: **bold **).
 */

import { StateField, RangeSetBuilder } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import {
  codeBlockExtentsField,
  isInCodeBlock,
} from "../utils/sharedHelpers";

// ===========================================
// MARK DECORATIONS
// ===========================================

const boldMark = Decoration.mark({ class: "cm-strong" });
const italicMark = Decoration.mark({ class: "cm-em" });
const codeMark = Decoration.mark({ class: "cm-inline-code" });
const strikethroughMark = Decoration.mark({ class: "cm-strikethrough" });
const highlightMark = Decoration.mark({ class: "cm-highlight" });
const linkMark = Decoration.mark({ class: "cm-link" });

// Heading marks for different levels
const h1Mark = Decoration.mark({ class: "cm-h1" });
const h2Mark = Decoration.mark({ class: "cm-h2" });
const h3Mark = Decoration.mark({ class: "cm-h3" });
const h4Mark = Decoration.mark({ class: "cm-h4" });
const h5Mark = Decoration.mark({ class: "cm-h5" });
const h6Mark = Decoration.mark({ class: "cm-h6" });

// List marks
const ulMark = Decoration.mark({ class: "cm-list-ul" });
const olMark = Decoration.mark({ class: "cm-list-ol" });

// Line decoration for code block content lines
const codeBlockLineDeco = Decoration.line({ class: "cm-code-block-line" });

// ===========================================
// BUILD STYLE DECORATIONS
// ===========================================

/**
 * Build style decorations (bold, italic, etc.)
 * These mark the content (not the syntax) with styling classes.
 *
 * Uses BOTH parser nodes AND regex fallback to catch cases the parser misses
 * (like trailing whitespace: **bold **)
 */
function buildStyleDecorations(state: EditorState) {
  const doc = state.doc;

  // Collect all ranges with their decorations, then sort before adding to builder
  // RangeSetBuilder requires ranges in sorted order
  const rangesToDecorate: Array<{ from: number; to: number; decoration: Decoration }> = [];

  // Read cached code block extents from shared StateField
  const codeBlockRanges = state.field(codeBlockExtentsField);

  const isInsideCodeBlock = (pos: number) =>
    isInCodeBlock(pos, codeBlockRanges);

  syntaxTree(state).iterate({
    enter(node) {
      // Skip any nodes inside code blocks - no markdown styling there
      if (isInsideCodeBlock(node.from)) return;

      // Strong (bold) - style the content between markers
      if (node.name === "StrongEmphasis") {
        const content = node.node;
        let contentFrom = node.from;
        let contentTo = node.to;

        let firstMark = true;
        content.cursor().iterate((child) => {
          if (child.name === "EmphasisMark") {
            if (firstMark) {
              contentFrom = child.to;
              firstMark = false;
            } else {
              contentTo = child.from;
            }
          }
        });

        if (contentFrom < contentTo) {
          rangesToDecorate.push({ from: contentFrom, to: contentTo, decoration: boldMark });
        }
      }

      // Emphasis (italic)
      if (node.name === "Emphasis") {
        const content = node.node;
        let contentFrom = node.from;
        let contentTo = node.to;

        let firstMark = true;
        content.cursor().iterate((child) => {
          if (child.name === "EmphasisMark") {
            if (firstMark) {
              contentFrom = child.to;
              firstMark = false;
            } else {
              contentTo = child.from;
            }
          }
        });

        if (contentFrom < contentTo) {
          rangesToDecorate.push({ from: contentFrom, to: contentTo, decoration: italicMark });
        }
      }

      // Inline code
      if (node.name === "InlineCode") {
        const content = node.node;
        let contentFrom = node.from;
        let contentTo = node.to;

        let firstMark = true;
        content.cursor().iterate((child) => {
          if (child.name === "CodeMark") {
            if (firstMark) {
              contentFrom = child.to;
              firstMark = false;
            } else {
              contentTo = child.from;
            }
          }
        });

        if (contentFrom < contentTo) {
          rangesToDecorate.push({ from: contentFrom, to: contentTo, decoration: codeMark });
        }
      }

      // Strikethrough
      if (node.name === "Strikethrough") {
        const content = node.node;
        let contentFrom = node.from;
        let contentTo = node.to;

        let firstMark = true;
        content.cursor().iterate((child) => {
          if (child.name === "StrikethroughMark") {
            if (firstMark) {
              contentFrom = child.to;
              firstMark = false;
            } else {
              contentTo = child.from;
            }
          }
        });

        if (contentFrom < contentTo) {
          rangesToDecorate.push({ from: contentFrom, to: contentTo, decoration: strikethroughMark });
        }
      }

      // Highlight
      if (node.name === "Highlight") {
        const content = node.node;
        let contentFrom = node.from;
        let contentTo = node.to;

        let firstMark = true;
        content.cursor().iterate((child) => {
          if (child.name === "HighlightMark") {
            if (firstMark) {
              contentFrom = child.to;
              firstMark = false;
            } else {
              contentTo = child.from;
            }
          }
        });

        if (contentFrom < contentTo) {
          rangesToDecorate.push({ from: contentFrom, to: contentTo, decoration: highlightMark });
        }
      }

      // Link - style the text portion (between [ and ])
      if (node.name === "Link") {
        let textFrom = node.from;
        let textTo = node.from;

        node.node.cursor().iterate((child) => {
          if (child.name === "LinkMark") {
            const markText = state.doc.sliceString(child.from, child.to);
            if (markText === "[") {
              textFrom = child.to; // After [
            } else if (markText === "]") {
              textTo = child.from; // Before ]
            }
          }
        });

        if (textFrom < textTo) {
          rangesToDecorate.push({ from: textFrom, to: textTo, decoration: linkMark });
        }
      }

      // ATX Headings (# through ######)
      if (node.name === "ATXHeading1" || node.name === "ATXHeading2" ||
          node.name === "ATXHeading3" || node.name === "ATXHeading4" ||
          node.name === "ATXHeading5" || node.name === "ATXHeading6") {
        let contentFrom = node.from;
        const content = node.node;

        content.cursor().iterate((child) => {
          if (child.name === "HeaderMark") {
            contentFrom = child.to;
          }
        });

        const text = state.doc.sliceString(contentFrom, node.to);
        const leadingSpace = text.match(/^\s*/)?.[0].length || 0;
        contentFrom += leadingSpace;

        const level = parseInt(node.name.replace("ATXHeading", ""));
        const headingMark = level === 1 ? h1Mark :
                           level === 2 ? h2Mark :
                           level === 3 ? h3Mark :
                           level === 4 ? h4Mark :
                           level === 5 ? h5Mark : h6Mark;

        if (contentFrom < node.to) {
          rangesToDecorate.push({ from: contentFrom, to: node.to, decoration: headingMark });
        }
      }

      // List items - BulletList and OrderedList contain ListItem nodes
      if (node.name === "ListItem") {
        let contentFrom = node.from;
        let listMark: Decoration | null = null;

        node.node.cursor().iterate((child) => {
          if (child.name === "ListMark") {
            contentFrom = child.to;
            const markText = state.doc.sliceString(child.from, child.to);
            listMark = /^\d+\.$/.test(markText) ? olMark : ulMark;
          }
        });

        const text = state.doc.sliceString(contentFrom, node.to);
        const leadingSpace = text.match(/^\s*/)?.[0].length || 0;
        contentFrom += leadingSpace;

        if (listMark && contentFrom < node.to) {
          rangesToDecorate.push({ from: contentFrom, to: node.to, decoration: listMark });
        }
      }
    },
  });

  // ===========================================
  // REGEX FALLBACK: Catch formatting the parser misses
  // ===========================================

  const text = doc.toString();

  const collectedKeys = new Set<string>();
  for (const r of rangesToDecorate) {
    collectedKeys.add(`${r.from}-${r.to}`);
  }
  const isAlreadyCollected = (from: number, to: number) => {
    if (collectedKeys.has(`${from}-${to}`)) return true;
    return rangesToDecorate.some((r) => !(to <= r.from || from >= r.to));
  };

  // Bold: **...**
  const boldRegex = /\*\*(.+?)\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(text)) !== null) {
    if (isInsideCodeBlock(match.index)) continue;
    const contentFrom = match.index + 2;
    const contentTo = match.index + 2 + match[1].length;
    if (!isAlreadyCollected(contentFrom, contentTo) && contentFrom < contentTo) {
      rangesToDecorate.push({ from: contentFrom, to: contentTo, decoration: boldMark });
      collectedKeys.add(`${contentFrom}-${contentTo}`);
    }
  }

  // Italic: *...* (but not **)
  const italicRegex = /(?<!\*)\*([^*]+?)\*(?!\*)/g;
  while ((match = italicRegex.exec(text)) !== null) {
    if (isInsideCodeBlock(match.index)) continue;
    const contentFrom = match.index + 1;
    const contentTo = match.index + 1 + match[1].length;
    if (!isAlreadyCollected(contentFrom, contentTo) && contentFrom < contentTo) {
      rangesToDecorate.push({ from: contentFrom, to: contentTo, decoration: italicMark });
      collectedKeys.add(`${contentFrom}-${contentTo}`);
    }
  }

  // Strikethrough: ~~...~~
  const strikeRegex = /~~(.+?)~~/g;
  while ((match = strikeRegex.exec(text)) !== null) {
    if (isInsideCodeBlock(match.index)) continue;
    const contentFrom = match.index + 2;
    const contentTo = match.index + 2 + match[1].length;
    if (!isAlreadyCollected(contentFrom, contentTo) && contentFrom < contentTo) {
      rangesToDecorate.push({ from: contentFrom, to: contentTo, decoration: strikethroughMark });
      collectedKeys.add(`${contentFrom}-${contentTo}`);
    }
  }

  // Highlight: ==...==
  const highlightStyleRegex = /==([^=]+)==/g;
  while ((match = highlightStyleRegex.exec(text)) !== null) {
    if (isInsideCodeBlock(match.index)) continue;
    const contentFrom = match.index + 2;
    const contentTo = match.index + 2 + match[1].length;
    if (!isAlreadyCollected(contentFrom, contentTo) && contentFrom < contentTo) {
      rangesToDecorate.push({ from: contentFrom, to: contentTo, decoration: highlightMark });
      collectedKeys.add(`${contentFrom}-${contentTo}`);
    }
  }

  // Links: [text](url) - style the text portion
  const linkStyleRegex = /\[([^\]]*)]\([^)]*\)/g;
  while ((match = linkStyleRegex.exec(text)) !== null) {
    if (isInsideCodeBlock(match.index)) continue;
    const textFrom = match.index + 1; // After [
    const textTo = match.index + 1 + match[1].length; // Before ]
    if (!isAlreadyCollected(textFrom, textTo) && textFrom < textTo) {
      rangesToDecorate.push({ from: textFrom, to: textTo, decoration: linkMark });
      collectedKeys.add(`${textFrom}-${textTo}`);
    }
  }

  // Add line decorations for code block content lines (monospace + background)
  for (const range of codeBlockRanges) {
    const startLine = doc.lineAt(range.from);
    const endLine = doc.lineAt(range.to);
    // Decorate content lines only (skip opening/closing fence lines)
    for (let lineNum = startLine.number + 1; lineNum < endLine.number; lineNum++) {
      const line = doc.line(lineNum);
      rangesToDecorate.push({ from: line.from, to: line.from, decoration: codeBlockLineDeco });
    }
  }

  // Sort ranges by 'from' position (required by RangeSetBuilder)
  rangesToDecorate.sort((a, b) => a.from - b.from);

  // Now add to builder in sorted order
  const builder = new RangeSetBuilder<Decoration>();
  for (const range of rangesToDecorate) {
    builder.add(range.from, range.to, range.decoration);
  }

  return builder.finish();
}

// ===========================================
// STATE FIELD
// ===========================================

/**
 * StateField that tracks style decorations (bold, italic, etc.).
 * Recomputes on doc change.
 */
export const styleField = StateField.define({
  create: (state) => buildStyleDecorations(state),
  update: (value, tr) => {
    if (tr.docChanged) {
      return buildStyleDecorations(tr.state);
    }
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

// ===========================================
// CODE BLOCK SYNTAX HIGHLIGHTING
// ===========================================

/**
 * Highlight style for syntax tokens inside fenced code blocks.
 * Uses a GitHub-light-inspired palette.
 *
 * Only defines styles for code-level tags (keyword, string, comment, etc.).
 * Markdown-level tags (heading, emphasis) are intentionally omitted so the
 * existing styleField decorations handle markdown styling exclusively.
 */
export const codeHighlightStyle = HighlightStyle.define([
  // Keywords
  { tag: tags.keyword, color: "#d73a49" },
  { tag: tags.controlKeyword, color: "#d73a49" },
  { tag: tags.definitionKeyword, color: "#d73a49" },
  { tag: tags.moduleKeyword, color: "#d73a49" },
  { tag: tags.operatorKeyword, color: "#d73a49" },
  { tag: tags.operator, color: "#d73a49" },
  // Comments
  { tag: tags.comment, color: "#6a737d", fontStyle: "italic" },
  { tag: tags.lineComment, color: "#6a737d", fontStyle: "italic" },
  { tag: tags.blockComment, color: "#6a737d", fontStyle: "italic" },
  // Literals
  { tag: tags.string, color: "#032f62" },
  { tag: tags.number, color: "#005cc5" },
  { tag: tags.bool, color: "#005cc5" },
  { tag: tags.null, color: "#005cc5" },
  // Identifiers
  { tag: tags.variableName, color: "#24292e" },
  { tag: tags.function(tags.variableName), color: "#6f42c1" },
  { tag: tags.definition(tags.variableName), color: "#6f42c1" },
  { tag: tags.typeName, color: "#e36209" },
  { tag: tags.className, color: "#e36209" },
  { tag: tags.propertyName, color: "#005cc5" },
  // HTML/XML
  { tag: tags.attributeName, color: "#6f42c1" },
  { tag: tags.attributeValue, color: "#032f62" },
  { tag: tags.tagName, color: "#22863a" },
  // Other
  { tag: tags.regexp, color: "#032f62" },
  { tag: tags.escape, color: "#005cc5" },
  { tag: tags.punctuation, color: "#24292e" },
  { tag: tags.meta, color: "#6a737d" },
]);
