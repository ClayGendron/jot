/**
 * CodeMirror Hidden Syntax Experiment Harness
 *
 * Experiment 1: Test hiding bold/italic syntax WITHOUT atomicRanges
 *
 * Goal: Verify that text remains fully editable when syntax is hidden
 * using only Decoration.replace() for markers.
 *
 * Run: bun experiments/codemirror/harness.tsx
 */

import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { EditorState, StateField, RangeSetBuilder, EditorSelection, Prec } from "@codemirror/state";
import { EditorView, Decoration, keymap, WidgetType } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxTree } from "@codemirror/language";
import { GFM } from "@lezer/markdown";

// ===========================================
// LIST MARKER WIDGETS
// ===========================================

/**
 * Widget that renders a bullet point for unordered lists
 * Note: Indentation comes from preserved whitespace before the marker,
 * so we don't need to add margin-left here.
 */
class BulletWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-list-bullet";
    span.textContent = "•";
    span.style.marginRight = "6px";
    span.style.color = "#666";
    return span;
  }

  eq(_other: BulletWidget) {
    return true; // All bullets are the same
  }
}

/**
 * Widget that renders a number for ordered lists
 * Note: Indentation comes from preserved whitespace before the marker.
 */
class NumberWidget extends WidgetType {
  constructor(readonly num: number) {
    super();
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-list-number";
    span.textContent = `${this.num}.`;
    span.style.marginRight = "6px";
    span.style.color = "#666";
    return span;
  }

  eq(other: NumberWidget) {
    return other.num === this.num;
  }
}

// ===========================================
// BLOCKQUOTE WIDGETS
// ===========================================

/**
 * Widget that renders a blockquote bar indicator
 * The bar appears on the left side to indicate a blockquote
 */
class BlockquoteBarWidget extends WidgetType {
  constructor(readonly level: number = 1) {
    super();
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-blockquote-bar";
    // Create nested bars for nested blockquotes
    for (let i = 0; i < this.level; i++) {
      const bar = document.createElement("span");
      bar.className = "cm-blockquote-bar-segment";
      bar.style.display = "inline-block";
      bar.style.width = "3px";
      bar.style.height = "1.2em";
      bar.style.backgroundColor = "#6b7280";
      bar.style.marginRight = i < this.level - 1 ? "8px" : "12px";
      bar.style.verticalAlign = "text-bottom";
      bar.style.borderRadius = "1px";
      span.appendChild(bar);
    }
    return span;
  }

  eq(other: BlockquoteBarWidget) {
    return other.level === this.level;
  }
}

// ===========================================
// PENDING ESCAPE STATE
// ===========================================

/**
 * Track when user types first character of a multi-char escape sequence.
 * We hold the character without inserting it, waiting for the second char.
 */
interface PendingEscape {
  char: string;
  pos: number;
  formattingEnd: number; // Position after the closing marker
  timeoutId: ReturnType<typeof setTimeout>;
}

let pendingEscape: PendingEscape | null = null;

function clearPendingEscape() {
  if (pendingEscape) {
    clearTimeout(pendingEscape.timeoutId);
    pendingEscape = null;
  }
}

// ===========================================
// FORMATTING ESCAPE COMMANDS
// ===========================================

interface FormattingContext {
  type: "strong" | "emphasis" | "code" | "strikethrough";
  from: number; // Start of the formatted region (including markers)
  to: number; // End of the formatted region (including markers)
  contentFrom: number; // Start of content (after opening marker)
  contentTo: number; // End of content (before closing marker)
  closingMarkerFrom: number; // Where closing marker starts
  closingMarkerTo: number; // Where closing marker ends
}

// ===========================================
// LINK CONTEXT
// ===========================================

/**
 * Link context interface for [text](url) links
 * Tracks all positions needed for navigation and editing
 */
interface LinkContext {
  from: number;           // Start of entire link [text](url)
  to: number;             // End of entire link
  textFrom: number;       // Start of text (after [)
  textTo: number;         // End of text (before ])
  urlFrom: number;        // Start of URL (after ()
  urlTo: number;          // End of URL (before ))
  bracketOpen: number;    // Position of [
  bracketClose: number;   // Position of ]
  parenOpen: number;      // Position of (
  parenClose: number;     // Position of )
  url: string;            // The URL string
  text: string;           // The link text
}

/**
 * Find the link context at cursor position
 * Returns info about the link if cursor is anywhere inside [text](url)
 */
function getLinkContext(state: EditorState): LinkContext | null {
  const pos = state.selection.main.head;
  let result: LinkContext | null = null;

  syntaxTree(state).iterate({
    enter(node) {
      // Check for Link node
      if (node.name === "Link" && pos >= node.from && pos <= node.to) {
        let bracketOpen = -1;
        let bracketClose = -1;
        let parenOpen = -1;
        let parenClose = -1;
        let urlFrom = -1;
        let urlTo = -1;

        // Iterate through child nodes to find marks and URL
        node.node.cursor().iterate((child) => {
          if (child.name === "LinkMark") {
            const markText = state.doc.sliceString(child.from, child.to);
            if (markText === "[") {
              bracketOpen = child.from;
            } else if (markText === "]") {
              bracketClose = child.from;
            } else if (markText === "(") {
              parenOpen = child.from;
            } else if (markText === ")") {
              parenClose = child.from;
            }
          }
          if (child.name === "URL") {
            urlFrom = child.from;
            urlTo = child.to;
          }
        });

        // If we found all parts, construct the context
        if (bracketOpen !== -1 && bracketClose !== -1 && parenOpen !== -1 && parenClose !== -1) {
          const textFrom = bracketOpen + 1;
          const textTo = bracketClose;
          // URL might be empty if no URL node found
          if (urlFrom === -1) {
            urlFrom = parenOpen + 1;
            urlTo = parenClose;
          }

          result = {
            from: node.from,
            to: node.to,
            textFrom,
            textTo,
            urlFrom,
            urlTo,
            bracketOpen,
            bracketClose,
            parenOpen,
            parenClose,
            url: state.doc.sliceString(urlFrom, urlTo),
            text: state.doc.sliceString(textFrom, textTo),
          };
        }
      }
    },
  });

  // Regex fallback for links the parser might miss
  if (!result) {
    const doc = state.doc;
    const text = doc.toString();
    const linkRegex = /\[([^\]]*)\]\(([^)]*)\)/g;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(text)) !== null) {
      const from = match.index;
      const to = match.index + match[0].length;

      if (pos >= from && pos <= to) {
        const bracketOpen = from;
        const bracketClose = from + 1 + match[1].length;
        const parenOpen = bracketClose + 1;
        const parenClose = to - 1;
        const textFrom = bracketOpen + 1;
        const textTo = bracketClose;
        const urlFrom = parenOpen + 1;
        const urlTo = parenClose;

        result = {
          from,
          to,
          textFrom,
          textTo,
          urlFrom,
          urlTo,
          bracketOpen,
          bracketClose,
          parenOpen,
          parenClose,
          url: match[2],
          text: match[1],
        };
        break;
      }
    }
  }

  return result;
}

/**
 * Check if cursor is at the end of link text (right before ])
 */
function isAtEndOfLinkText(state: EditorState, ctx: LinkContext): boolean {
  const pos = state.selection.main.head;
  return pos === ctx.textTo;
}

/**
 * Check if cursor is at the start of link text (right after [)
 */
function isAtStartOfLinkText(state: EditorState, ctx: LinkContext): boolean {
  const pos = state.selection.main.head;
  return pos === ctx.textFrom;
}

/**
 * Check if cursor is inside the hidden ](url) portion
 */
function isInHiddenLinkPortion(state: EditorState, ctx: LinkContext): boolean {
  const pos = state.selection.main.head;
  // Hidden portion: ] ( url )
  // That's from bracketClose to parenClose (inclusive of parenClose)
  return pos > ctx.textTo && pos <= ctx.parenClose;
}

/**
 * Find link context when cursor is right after the closing )
 */
function getLinkContextAfterClosing(state: EditorState): LinkContext | null {
  const pos = state.selection.main.head;
  const doc = state.doc;
  const text = doc.toString();
  const linkRegex = /\[([^\]]*)\]\(([^)]*)\)/g;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    const to = match.index + match[0].length;
    if (pos === to) {
      const from = match.index;
      const bracketOpen = from;
      const bracketClose = from + 1 + match[1].length;
      const parenOpen = bracketClose + 1;
      const parenClose = to - 1;
      const textFrom = bracketOpen + 1;
      const textTo = bracketClose;
      const urlFrom = parenOpen + 1;
      const urlTo = parenClose;

      return {
        from,
        to,
        textFrom,
        textTo,
        urlFrom,
        urlTo,
        bracketOpen,
        bracketClose,
        parenOpen,
        parenClose,
        url: match[2],
        text: match[1],
      };
    }
  }

  return null;
}

/**
 * Find the formatting context at cursor position
 * Returns info about the formatted region if cursor is inside one
 */
function getFormattingContext(state: EditorState): FormattingContext | null {
  const pos = state.selection.main.head;
  let result: FormattingContext | null = null;

  syntaxTree(state).iterate({
    enter(node) {
      // Check StrongEmphasis (bold)
      if (node.name === "StrongEmphasis" && pos >= node.from && pos < node.to) {
        const markers: { from: number; to: number }[] = [];
        node.node.cursor().iterate((child) => {
          if (child.name === "EmphasisMark") {
            markers.push({ from: child.from, to: child.to });
          }
        });
        if (markers.length >= 2) {
          result = {
            type: "strong",
            from: node.from,
            to: node.to,
            contentFrom: markers[0].to,
            contentTo: markers[markers.length - 1].from,
            closingMarkerFrom: markers[markers.length - 1].from,
            closingMarkerTo: markers[markers.length - 1].to,
          };
        }
      }

      // Check Emphasis (italic)
      if (node.name === "Emphasis" && pos >= node.from && pos < node.to) {
        const markers: { from: number; to: number }[] = [];
        node.node.cursor().iterate((child) => {
          if (child.name === "EmphasisMark") {
            markers.push({ from: child.from, to: child.to });
          }
        });
        if (markers.length >= 2) {
          result = {
            type: "emphasis",
            from: node.from,
            to: node.to,
            contentFrom: markers[0].to,
            contentTo: markers[markers.length - 1].from,
            closingMarkerFrom: markers[markers.length - 1].from,
            closingMarkerTo: markers[markers.length - 1].to,
          };
        }
      }

      // Check InlineCode
      if (node.name === "InlineCode" && pos >= node.from && pos < node.to) {
        const markers: { from: number; to: number }[] = [];
        node.node.cursor().iterate((child) => {
          if (child.name === "CodeMark") {
            markers.push({ from: child.from, to: child.to });
          }
        });
        if (markers.length >= 2) {
          result = {
            type: "code",
            from: node.from,
            to: node.to,
            contentFrom: markers[0].to,
            contentTo: markers[markers.length - 1].from,
            closingMarkerFrom: markers[markers.length - 1].from,
            closingMarkerTo: markers[markers.length - 1].to,
          };
        }
      }

      // Check Strikethrough
      if (node.name === "Strikethrough" && pos >= node.from && pos < node.to) {
        const markers: { from: number; to: number }[] = [];
        node.node.cursor().iterate((child) => {
          if (child.name === "StrikethroughMark") {
            markers.push({ from: child.from, to: child.to });
          }
        });
        if (markers.length >= 2) {
          result = {
            type: "strikethrough",
            from: node.from,
            to: node.to,
            contentFrom: markers[0].to,
            contentTo: markers[markers.length - 1].from,
            closingMarkerFrom: markers[markers.length - 1].from,
            closingMarkerTo: markers[markers.length - 1].to,
          };
        }
      }
    },
  });

  return result;
}

/**
 * Check if cursor is at the end of content (right before closing marker)
 *
 * We check multiple conditions because:
 * 1. The ZWSP we insert for strikethrough can end up between content and closing marker
 * 2. Position calculations may be off by one
 */
function isAtEndOfFormatting(state: EditorState, ctx: FormattingContext): boolean {
  const pos = state.selection.main.head;
  const ZWSP = "\u200B";

  // Exact match
  if (pos === ctx.contentTo) return true;

  // Check characters ahead - might be ZWSP then marker, or just marker
  const nextChar = state.doc.sliceString(pos, pos + 1);
  const nextTwoChars = state.doc.sliceString(pos, pos + 2);
  const markerChar = ctx.type === "code" ? "`" : ctx.type === "strikethrough" ? "~" : "*";

  // If we're inside the formatting region
  if (pos >= ctx.contentFrom && pos < ctx.closingMarkerTo) {
    // Next char is the marker
    if (nextChar === markerChar) return true;

    // Next char is ZWSP and char after is marker (strikethrough case)
    if (nextChar === ZWSP && nextTwoChars[1] === markerChar) return true;

    // We're one or two positions before the closing marker
    if (ctx.closingMarkerFrom - pos <= 2) return true;
  }

  return false;
}

/**
 * Move cursor past the closing marker to escape formatting
 */
function escapeFormatting(view: EditorView): boolean {
  const ctx = getFormattingContext(view.state);
  if (!ctx) return false;

  if (isAtEndOfFormatting(view.state, ctx)) {
    // Move cursor to after the closing marker
    view.dispatch({
      selection: { anchor: ctx.closingMarkerTo },
      scrollIntoView: true,
    });
    return true;
  }
  return false;
}

/**
 * Toggle bold - but if at end of bold, escape instead
 */
function toggleBoldOrEscape(view: EditorView): boolean {
  const ctx = getFormattingContext(view.state);
  if (ctx?.type === "strong" && isAtEndOfFormatting(view.state, ctx)) {
    return escapeFormatting(view);
  }
  // TODO: implement actual toggle bold (for now, return false to let default handle)
  return false;
}

/**
 * Toggle italic - but if at end of italic, escape instead
 */
function toggleItalicOrEscape(view: EditorView): boolean {
  const ctx = getFormattingContext(view.state);
  if (ctx?.type === "emphasis" && isAtEndOfFormatting(view.state, ctx)) {
    return escapeFormatting(view);
  }
  // TODO: implement actual toggle italic
  return false;
}

/**
 * Check if cursor is right after a closing marker (for backspace handling)
 * Returns the formatting context if we're at the "invisible boundary"
 */
function getFormattingContextAfterClosing(state: EditorState): FormattingContext | null {
  const pos = state.selection.main.head;
  let result: FormattingContext | null = null;

  syntaxTree(state).iterate({
    enter(node) {
      // Check if cursor is right after a formatted region
      if (node.name === "StrongEmphasis" && pos === node.to) {
        const markers: { from: number; to: number }[] = [];
        node.node.cursor().iterate((child) => {
          if (child.name === "EmphasisMark") {
            markers.push({ from: child.from, to: child.to });
          }
        });
        if (markers.length >= 2) {
          result = {
            type: "strong",
            from: node.from,
            to: node.to,
            contentFrom: markers[0].to,
            contentTo: markers[markers.length - 1].from,
            closingMarkerFrom: markers[markers.length - 1].from,
            closingMarkerTo: markers[markers.length - 1].to,
          };
        }
      }

      if (node.name === "Emphasis" && pos === node.to) {
        const markers: { from: number; to: number }[] = [];
        node.node.cursor().iterate((child) => {
          if (child.name === "EmphasisMark") {
            markers.push({ from: child.from, to: child.to });
          }
        });
        if (markers.length >= 2) {
          result = {
            type: "emphasis",
            from: node.from,
            to: node.to,
            contentFrom: markers[0].to,
            contentTo: markers[markers.length - 1].from,
            closingMarkerFrom: markers[markers.length - 1].from,
            closingMarkerTo: markers[markers.length - 1].to,
          };
        }
      }

      if (node.name === "InlineCode" && pos === node.to) {
        const markers: { from: number; to: number }[] = [];
        node.node.cursor().iterate((child) => {
          if (child.name === "CodeMark") {
            markers.push({ from: child.from, to: child.to });
          }
        });
        if (markers.length >= 2) {
          result = {
            type: "code",
            from: node.from,
            to: node.to,
            contentFrom: markers[0].to,
            contentTo: markers[markers.length - 1].from,
            closingMarkerFrom: markers[markers.length - 1].from,
            closingMarkerTo: markers[markers.length - 1].to,
          };
        }
      }

      if (node.name === "Strikethrough" && pos === node.to) {
        const markers: { from: number; to: number }[] = [];
        node.node.cursor().iterate((child) => {
          if (child.name === "StrikethroughMark") {
            markers.push({ from: child.from, to: child.to });
          }
        });
        if (markers.length >= 2) {
          result = {
            type: "strikethrough",
            from: node.from,
            to: node.to,
            contentFrom: markers[0].to,
            contentTo: markers[markers.length - 1].from,
            closingMarkerFrom: markers[markers.length - 1].from,
            closingMarkerTo: markers[markers.length - 1].to,
          };
        }
      }
    },
  });

  // Fallback: check with regex for patterns parser might miss
  if (!result) {
    const doc = state.doc;
    const text = doc.toString();

    // Check for **...** pattern ending at cursor
    // Look backwards from cursor for closing **
    if (pos >= 2 && text.slice(pos - 2, pos) === "**") {
      // Find the opening **
      const beforeClose = text.slice(0, pos - 2);
      const openIdx = beforeClose.lastIndexOf("**");
      if (openIdx !== -1) {
        result = {
          type: "strong",
          from: openIdx,
          to: pos,
          contentFrom: openIdx + 2,
          contentTo: pos - 2,
          closingMarkerFrom: pos - 2,
          closingMarkerTo: pos,
        };
      }
    }
    // Check for *...* (italic, not bold)
    else if (pos >= 1 && text[pos - 1] === "*" && (pos < 2 || text[pos - 2] !== "*")) {
      const beforeClose = text.slice(0, pos - 1);
      // Find opening * that's not part of **
      for (let i = beforeClose.length - 1; i >= 0; i--) {
        if (beforeClose[i] === "*" && (i === 0 || beforeClose[i - 1] !== "*") && (i === beforeClose.length - 1 || beforeClose[i + 1] !== "*")) {
          result = {
            type: "emphasis",
            from: i,
            to: pos,
            contentFrom: i + 1,
            contentTo: pos - 1,
            closingMarkerFrom: pos - 1,
            closingMarkerTo: pos,
          };
          break;
        }
      }
    }
    // Check for `...`
    else if (pos >= 1 && text[pos - 1] === "`") {
      const beforeClose = text.slice(0, pos - 1);
      const openIdx = beforeClose.lastIndexOf("`");
      if (openIdx !== -1) {
        result = {
          type: "code",
          from: openIdx,
          to: pos,
          contentFrom: openIdx + 1,
          contentTo: pos - 1,
          closingMarkerFrom: pos - 1,
          closingMarkerTo: pos,
        };
      }
    }
    // Check for ~~...~~
    else if (pos >= 2 && text.slice(pos - 2, pos) === "~~") {
      const beforeClose = text.slice(0, pos - 2);
      const openIdx = beforeClose.lastIndexOf("~~");
      if (openIdx !== -1) {
        result = {
          type: "strikethrough",
          from: openIdx,
          to: pos,
          contentFrom: openIdx + 2,
          contentTo: pos - 2,
          closingMarkerFrom: pos - 2,
          closingMarkerTo: pos,
        };
      }
    }
  }

  return result;
}

/**
 * Handle backspace when cursor is right after closing marker
 * Skip over the invisible marker and delete from inside
 */
function handleBackspaceAtClosingMarker(view: EditorView): boolean {
  const ctx = getFormattingContextAfterClosing(view.state);
  if (!ctx) return false;

  // Cursor is right after closing marker (e.g., **bold**|)
  // We want to delete the last char of content and move cursor inside
  // Result: **bol|**

  if (ctx.contentTo > ctx.contentFrom) {
    // There's content to delete
    view.dispatch({
      changes: { from: ctx.contentTo - 1, to: ctx.contentTo, insert: "" },
      selection: { anchor: ctx.contentTo - 1 },
      scrollIntoView: true,
    });
    return true;
  } else {
    // No content left - delete the entire formatting
    view.dispatch({
      changes: { from: ctx.from, to: ctx.to, insert: "" },
      selection: { anchor: ctx.from },
      scrollIntoView: true,
    });
    return true;
  }
}

/**
 * Handle backspace when cursor is right after link closing )
 * [link](url)| → backspace → [link|(url) (delete last char of text)
 */
function handleBackspaceAfterLink(view: EditorView): boolean {
  const ctx = getLinkContextAfterClosing(view.state);
  if (!ctx) return false;

  if (ctx.textTo > ctx.textFrom) {
    // There's text to delete - delete last char and move cursor inside
    view.dispatch({
      changes: { from: ctx.textTo - 1, to: ctx.textTo, insert: "" },
      selection: { anchor: ctx.textTo - 1 },
      scrollIntoView: true,
    });
    return true;
  } else {
    // No text left - delete entire link
    view.dispatch({
      changes: { from: ctx.from, to: ctx.to, insert: "" },
      selection: { anchor: ctx.from },
      scrollIntoView: true,
    });
    return true;
  }
}

/**
 * Handle backspace at start of link text
 * [|link](url) → backspace → |link (removes link syntax, keeps text)
 */
function handleBackspaceAtLinkTextStart(view: EditorView): boolean {
  const ctx = getLinkContext(view.state);
  if (!ctx) return false;

  if (!isAtStartOfLinkText(view.state, ctx)) return false;

  // Remove the link syntax but keep the text
  const linkText = ctx.text;
  view.dispatch({
    changes: { from: ctx.from, to: ctx.to, insert: linkText },
    selection: { anchor: ctx.from },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Handle delete at end of link text
 * [link|](url) → delete → skip over hidden ](url), effectively exit link
 */
function handleDeleteAtLinkTextEnd(view: EditorView): boolean {
  const ctx = getLinkContext(view.state);
  if (!ctx) return false;

  if (!isAtEndOfLinkText(view.state, ctx)) return false;

  // Delete skips over the hidden ](url) and deletes the next char after the link
  const nextPos = ctx.to;
  const doc = view.state.doc;
  if (nextPos < doc.length) {
    view.dispatch({
      changes: { from: nextPos, to: nextPos + 1, insert: "" },
      selection: { anchor: ctx.textTo },
      scrollIntoView: true,
    });
    return true;
  }
  return false;
}

// ===========================================
// LIST HANDLING
// ===========================================

/**
 * List marker patterns:
 * - Unordered: -, *, + followed by space
 * - Ordered: 1., 2., etc. followed by space
 */
const LIST_MARKER_REGEX = /^(\s*)([-*+]|\d+\.)\s/;

/**
 * Get list info for a line
 */
function getListInfo(line: { text: string; from: number }): {
  isListItem: boolean;
  indent: string;
  marker: string;
  markerWithSpace: string;
  contentStart: number;
  isOrdered: boolean;
  orderNumber: number | null;
} | null {
  const match = line.text.match(LIST_MARKER_REGEX);
  if (!match) return null;

  const indent = match[1];
  const marker = match[2];
  const markerWithSpace = match[0];
  const isOrdered = /^\d+\.$/.test(marker);
  const orderNumber = isOrdered ? parseInt(marker) : null;

  return {
    isListItem: true,
    indent,
    marker,
    markerWithSpace,
    contentStart: line.from + markerWithSpace.length,
    isOrdered,
    orderNumber,
  };
}

/**
 * Check if cursor is at the start of list item content
 */
function isAtListContentStart(state: EditorState): boolean {
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const listInfo = getListInfo(line);
  if (!listInfo) return false;
  return pos === listInfo.contentStart;
}

/**
 * Get the next order number for an ordered list
 */
function getNextOrderNumber(state: EditorState, lineNumber: number): number {
  const line = state.doc.line(lineNumber);
  const listInfo = getListInfo(line);
  if (listInfo?.isOrdered && listInfo.orderNumber !== null) {
    return listInfo.orderNumber + 1;
  }
  return 1;
}

/**
 * Handle Enter in list - auto-continue or exit
 */
function handleEnterInList(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const listInfo = getListInfo(line);

  if (!listInfo) return false;

  // Check if list item content is empty (just the marker)
  const content = line.text.slice(listInfo.markerWithSpace.length);

  if (content.trim() === "") {
    // Empty list item - exit list with proper paragraph spacing
    if (line.number <= 1) {
      // First line - just remove the marker, cursor at line start
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: "" },
        selection: { anchor: line.from },
        scrollIntoView: true,
      });
    } else {
      // Not first line - remove the empty list item line and replace with blank line
      // Before: "- Previous item\n- |"
      // After:  "- Previous item\n\n|" (blank line for paragraph spacing)
      const prevLine = state.doc.line(line.number - 1);
      view.dispatch({
        changes: { from: prevLine.to, to: line.to, insert: "\n\n" },
        selection: { anchor: prevLine.to + 2 },
        scrollIntoView: true,
      });
    }
    return true;
  }

  // At end of list item - create new list item
  if (pos === line.to) {
    let newMarker: string;
    if (listInfo.isOrdered) {
      const nextNum = getNextOrderNumber(state, line.number);
      newMarker = `${listInfo.indent}${nextNum}. `;
    } else {
      newMarker = `${listInfo.indent}${listInfo.marker} `;
    }

    view.dispatch({
      changes: { from: pos, to: pos, insert: `\n${newMarker}` },
      selection: { anchor: pos + 1 + newMarker.length },
      scrollIntoView: true,
    });
    return true;
  }

  // In middle of list item - split into two list items
  if (pos > listInfo.contentStart && pos < line.to) {
    const afterCursor = line.text.slice(pos - line.from);
    let newMarker: string;
    if (listInfo.isOrdered) {
      const nextNum = getNextOrderNumber(state, line.number);
      newMarker = `${listInfo.indent}${nextNum}. `;
    } else {
      newMarker = `${listInfo.indent}${listInfo.marker} `;
    }

    view.dispatch({
      changes: { from: pos, to: line.to, insert: `\n${newMarker}${afterCursor}` },
      selection: { anchor: pos + 1 + newMarker.length },
      scrollIntoView: true,
    });
    return true;
  }

  // At start of content - insert new list item above
  if (pos === listInfo.contentStart) {
    const marker = listInfo.markerWithSpace;
    view.dispatch({
      changes: { from: line.from, to: line.from, insert: `${marker}\n` },
      selection: { anchor: listInfo.contentStart + marker.length + 1 },
      scrollIntoView: true,
    });
    return true;
  }

  return false;
}

/**
 * Handle Backspace at start of list item - exit list or merge
 */
function handleBackspaceInList(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;

  if (!state.selection.main.empty) return false;

  const line = state.doc.lineAt(pos);
  const listInfo = getListInfo(line);

  if (!listInfo) return false;

  // Only handle if at start of content
  if (pos !== listInfo.contentStart) return false;

  // Check if list item content is empty
  const content = line.text.slice(listInfo.markerWithSpace.length);
  const isEmptyListItem = content.trim() === "";

  // If empty list item, just remove the marker (don't merge)
  // This handles the case: user types "-" then backspaces
  if (isEmptyListItem) {
    view.dispatch({
      changes: { from: line.from, to: listInfo.contentStart, insert: "" },
      selection: { anchor: line.from },
      scrollIntoView: true,
    });
    return true;
  }

  // List item has content - handle merging with previous line
  if (line.number <= 1) {
    // First line - just remove the list marker, keep content
    view.dispatch({
      changes: { from: line.from, to: listInfo.contentStart, insert: "" },
      selection: { anchor: line.from },
      scrollIntoView: true,
    });
    return true;
  }

  // Check line above
  const prevLine = state.doc.line(line.number - 1);
  const prevListInfo = getListInfo(prevLine);

  if (prevListInfo) {
    // Previous line is also a list item - merge into it
    view.dispatch({
      changes: { from: prevLine.to, to: listInfo.contentStart, insert: "" },
      selection: { anchor: prevLine.to },
      scrollIntoView: true,
    });
    return true;
  }

  if (prevLine.text.trim() === "") {
    // Previous line is blank - find content above and merge
    let targetLineNum = line.number - 1;
    while (targetLineNum >= 1) {
      const targetLine = state.doc.line(targetLineNum);
      if (targetLine.text.trim() !== "") {
        view.dispatch({
          changes: { from: targetLine.to, to: listInfo.contentStart, insert: "" },
          selection: { anchor: targetLine.to },
          scrollIntoView: true,
        });
        return true;
      }
      targetLineNum--;
    }
    // All blank above - just remove marker
    view.dispatch({
      changes: { from: line.from, to: listInfo.contentStart, insert: "" },
      selection: { anchor: line.from },
      scrollIntoView: true,
    });
    return true;
  }

  // Previous line has content - merge with it
  view.dispatch({
    changes: { from: prevLine.to, to: listInfo.contentStart, insert: "" },
    selection: { anchor: prevLine.to },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Handle Tab in list - indent list item
 */
function handleTabInList(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const listInfo = getListInfo(line);

  if (!listInfo) return false;

  // Add two spaces of indentation
  view.dispatch({
    changes: { from: line.from, to: line.from, insert: "  " },
    selection: { anchor: pos + 2 },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Handle Shift+Tab in list - outdent list item
 */
function handleShiftTabInList(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const listInfo = getListInfo(line);

  if (!listInfo) return false;

  // Remove up to two spaces of indentation
  const indent = listInfo.indent;
  if (indent.length === 0) return false;

  const spacesToRemove = Math.min(2, indent.length);
  view.dispatch({
    changes: { from: line.from, to: line.from + spacesToRemove, insert: "" },
    selection: { anchor: pos - spacesToRemove },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Handle ArrowLeft from list content start - go to previous line
 */
function handleArrowLeftFromListStart(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const listInfo = getListInfo(line);

  if (!listInfo) return false;
  if (pos !== listInfo.contentStart) return false;
  if (line.number <= 1) return false;

  // Find previous content line (skip blank lines)
  let targetLineNum = line.number - 1;
  while (targetLineNum >= 1) {
    const targetLine = state.doc.line(targetLineNum);
    if (targetLine.text.trim() !== "") {
      view.dispatch({
        selection: { anchor: targetLine.to },
        scrollIntoView: true,
      });
      return true;
    }
    targetLineNum--;
  }

  return false;
}

/**
 * Handle ArrowRight into list - skip to content start
 */
function handleArrowRightIntoList(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  // Only handle if at start of line
  if (pos !== line.from) return false;

  const listInfo = getListInfo(line);
  if (!listInfo) return false;

  // Skip to content start
  view.dispatch({
    selection: { anchor: listInfo.contentStart },
    scrollIntoView: true,
  });
  return true;
}

// ===========================================
// BLOCKQUOTE HANDLING
// ===========================================

/**
 * Blockquote marker pattern:
 * One or more > at the start of a line, optionally followed by space
 * Supports nested blockquotes: >, > >, > > >, etc.
 */
const BLOCKQUOTE_REGEX = /^((?:>\s*)+)/;

/**
 * Get blockquote info for a line
 */
function getBlockquoteInfo(line: { text: string; from: number }): {
  isBlockquote: boolean;
  level: number;
  marker: string;
  contentStart: number;
} | null {
  const match = line.text.match(BLOCKQUOTE_REGEX);
  if (!match) return null;

  const marker = match[1];
  // Count the number of > characters to determine nesting level
  const level = (marker.match(/>/g) || []).length;

  return {
    isBlockquote: true,
    level,
    marker,
    contentStart: line.from + marker.length,
  };
}

/**
 * Handle Enter in blockquote - continue the blockquote or exit
 */
function handleEnterInBlockquote(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const quoteInfo = getBlockquoteInfo(line);

  if (!quoteInfo) return false;

  // Check if blockquote content is empty (just the markers)
  const content = line.text.slice(quoteInfo.marker.length);

  if (content.trim() === "") {
    // Empty blockquote line - exit blockquote with proper paragraph spacing
    if (line.number <= 1) {
      // First line - just remove the marker
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: "" },
        selection: { anchor: line.from },
        scrollIntoView: true,
      });
    } else {
      // Not first line - remove empty blockquote and add blank line
      const prevLine = state.doc.line(line.number - 1);
      view.dispatch({
        changes: { from: prevLine.to, to: line.to, insert: "\n\n" },
        selection: { anchor: prevLine.to + 2 },
        scrollIntoView: true,
      });
    }
    return true;
  }

  // At end of blockquote line - create new blockquote line
  if (pos === line.to) {
    // Use the same marker for continuation
    const newMarker = quoteInfo.marker;

    view.dispatch({
      changes: { from: pos, to: pos, insert: `\n${newMarker}` },
      selection: { anchor: pos + 1 + newMarker.length },
      scrollIntoView: true,
    });
    return true;
  }

  // In middle of blockquote - split into two blockquote lines
  if (pos > quoteInfo.contentStart && pos < line.to) {
    const afterCursor = line.text.slice(pos - line.from);
    const newMarker = quoteInfo.marker;

    view.dispatch({
      changes: { from: pos, to: line.to, insert: `\n${newMarker}${afterCursor}` },
      selection: { anchor: pos + 1 + newMarker.length },
      scrollIntoView: true,
    });
    return true;
  }

  // At start of content - insert new blockquote line above
  if (pos === quoteInfo.contentStart) {
    const marker = quoteInfo.marker;
    view.dispatch({
      changes: { from: line.from, to: line.from, insert: `${marker}\n` },
      selection: { anchor: quoteInfo.contentStart + marker.length + 1 },
      scrollIntoView: true,
    });
    return true;
  }

  return false;
}

/**
 * Handle Backspace at start of blockquote content - exit blockquote or merge
 */
function handleBackspaceInBlockquote(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;

  if (!state.selection.main.empty) return false;

  const line = state.doc.lineAt(pos);
  const quoteInfo = getBlockquoteInfo(line);

  if (!quoteInfo) return false;

  // Only handle if at start of content
  if (pos !== quoteInfo.contentStart) return false;

  // Check if blockquote content is empty
  const content = line.text.slice(quoteInfo.marker.length);
  const isEmptyBlockquote = content.trim() === "";

  // If empty blockquote, just remove the marker
  if (isEmptyBlockquote) {
    view.dispatch({
      changes: { from: line.from, to: quoteInfo.contentStart, insert: "" },
      selection: { anchor: line.from },
      scrollIntoView: true,
    });
    return true;
  }

  // Blockquote has content - remove marker and keep content
  if (line.number <= 1) {
    // First line - just remove the blockquote marker
    view.dispatch({
      changes: { from: line.from, to: quoteInfo.contentStart, insert: "" },
      selection: { anchor: line.from },
      scrollIntoView: true,
    });
    return true;
  }

  // Check line above
  const prevLine = state.doc.line(line.number - 1);
  const prevQuoteInfo = getBlockquoteInfo(prevLine);

  if (prevQuoteInfo) {
    // Previous line is also a blockquote - merge into it
    view.dispatch({
      changes: { from: prevLine.to, to: quoteInfo.contentStart, insert: " " },
      selection: { anchor: prevLine.to },
      scrollIntoView: true,
    });
    return true;
  }

  if (prevLine.text.trim() === "") {
    // Previous line is blank - find content above and merge
    let targetLineNum = line.number - 1;
    while (targetLineNum >= 1) {
      const targetLine = state.doc.line(targetLineNum);
      if (targetLine.text.trim() !== "") {
        view.dispatch({
          changes: { from: targetLine.to, to: quoteInfo.contentStart, insert: "" },
          selection: { anchor: targetLine.to },
          scrollIntoView: true,
        });
        return true;
      }
      targetLineNum--;
    }
    // All blank above - just remove marker
    view.dispatch({
      changes: { from: line.from, to: quoteInfo.contentStart, insert: "" },
      selection: { anchor: line.from },
      scrollIntoView: true,
    });
    return true;
  }

  // Previous line has content - merge with it
  view.dispatch({
    changes: { from: prevLine.to, to: quoteInfo.contentStart, insert: "" },
    selection: { anchor: prevLine.to },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Handle ArrowLeft from blockquote content start - go to previous line
 */
function handleArrowLeftFromBlockquoteStart(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const quoteInfo = getBlockquoteInfo(line);

  if (!quoteInfo) return false;
  if (pos !== quoteInfo.contentStart) return false;
  if (line.number <= 1) return false;

  // Find previous content line (skip blank lines)
  let targetLineNum = line.number - 1;
  while (targetLineNum >= 1) {
    const targetLine = state.doc.line(targetLineNum);
    if (targetLine.text.trim() !== "") {
      view.dispatch({
        selection: { anchor: targetLine.to },
        scrollIntoView: true,
      });
      return true;
    }
    targetLineNum--;
  }

  return false;
}

/**
 * Handle ArrowRight into blockquote - skip to content start
 */
function handleArrowRightIntoBlockquote(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  // Only handle if at start of line
  if (pos !== line.from) return false;

  const quoteInfo = getBlockquoteInfo(line);
  if (!quoteInfo) return false;

  // Skip to content start
  view.dispatch({
    selection: { anchor: quoteInfo.contentStart },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Handle Enter - insert blank line for proper markdown paragraph separation
 *
 * In markdown, paragraphs are separated by blank lines.
 * Enter = new paragraph (double newline)
 * Shift+Enter = soft line break (single newline)
 */
function handleEnter(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  // Don't handle if there's a selection
  if (!state.selection.main.empty) return false;

  // Skip if line is empty (already a blank line, just add one newline)
  if (line.text.trim() === "") {
    return false; // Let default behavior handle
  }

  // Check if we're in a list - handle first
  const listInfo = getListInfo(line);
  if (listInfo) {
    return handleEnterInList(view);
  }

  // Check if we're in a blockquote
  const quoteInfo = getBlockquoteInfo(line);
  if (quoteInfo) {
    return handleEnterInBlockquote(view);
  }

  // Check if we're in a heading
  const headingMatch = line.text.match(/^(#{1,6})\s/);
  if (headingMatch) {
    const contentStart = line.from + headingMatch[0].length;

    // At start of heading content - insert paragraph ABOVE the heading
    if (pos === contentStart) {
      view.dispatch({
        changes: { from: line.from, to: line.from, insert: "\n\n" },
        selection: { anchor: contentStart + 2 }, // Stay at heading content start
        scrollIntoView: true,
      });
      return true;
    }

    // In middle of heading - split into heading + paragraph
    if (pos > contentStart && pos < line.to) {
      const headingPrefix = headingMatch[0]; // e.g., "## "
      const beforeCursor = line.text.slice(headingPrefix.length, pos - line.from);
      const afterCursor = line.text.slice(pos - line.from);

      // Keep text before cursor as heading, text after becomes paragraph
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: `${headingPrefix}${beforeCursor}\n\n${afterCursor}` },
        selection: { anchor: line.from + headingPrefix.length + beforeCursor.length + 2 },
        scrollIntoView: true,
      });
      return true;
    }
  }

  // Default: Insert two newlines to create blank line (new paragraph)
  view.dispatch({
    changes: { from: pos, to: pos, insert: "\n\n" },
    selection: { anchor: pos + 2 },
    scrollIntoView: true,
  });

  return true;
}

/**
 * Handle Shift+Enter - soft line break (single newline, stays in same paragraph)
 */
function handleShiftEnter(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;

  // Insert single newline
  view.dispatch({
    changes: { from: pos, to: pos, insert: "\n" },
    selection: { anchor: pos + 1 },
    scrollIntoView: true,
  });

  return true;
}

/**
 * Handle ArrowRight into heading - skip over # markers
 * When entering a heading line from the left, skip to content start
 */
function handleArrowRightIntoHeading(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  // Check if we're at the start of a heading line
  if (pos !== line.from) return false;

  const headingMatch = line.text.match(/^(#{1,6})\s/);
  if (!headingMatch) return false;

  // Skip to content start
  const contentStart = line.from + headingMatch[0].length;
  view.dispatch({
    selection: { anchor: contentStart },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Handle ArrowLeft into heading - skip over # markers and blank lines
 * When at start of heading content, jump to end of previous content
 */
function handleArrowLeftFromHeadingStart(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  const headingMatch = line.text.match(/^(#{1,6})\s/);
  if (!headingMatch) return false;

  const contentStart = line.from + headingMatch[0].length;

  // Only handle if at start of heading content
  if (pos !== contentStart) return false;

  // Can't go left from first line
  if (line.number <= 1) return false;

  // Find previous content line (skip blank lines)
  let targetLineNum = line.number - 1;
  while (targetLineNum >= 1) {
    const targetLine = state.doc.line(targetLineNum);
    if (targetLine.text.trim() !== "") {
      // Found content - go to end of it
      view.dispatch({
        selection: { anchor: targetLine.to },
        scrollIntoView: true,
      });
      return true;
    }
    targetLineNum--;
  }

  // All lines above are blank, go to start of document
  view.dispatch({
    selection: { anchor: 0 },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Handle ArrowRight at end of line - skip over blank lines
 */
function handleArrowRightOverBlankLines(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const totalLines = state.doc.lines;

  // Only handle if at end of line
  if (pos !== line.to) return false;

  // Can't go right from last line
  if (line.number >= totalLines) return false;

  const nextLine = state.doc.line(line.number + 1);

  // If next line is not blank, let default behavior handle
  if (nextLine.text.trim() !== "") return false;

  // Next line is blank - find the next non-blank line
  let targetLineNum = line.number + 2;
  while (targetLineNum <= totalLines) {
    const targetLine = state.doc.line(targetLineNum);
    if (targetLine.text.trim() !== "") {
      // Found content line - go to start of it
      view.dispatch({
        selection: { anchor: targetLine.from },
        scrollIntoView: true,
      });
      return true;
    }
    targetLineNum++;
  }

  // All lines below are blank, go to end of document
  view.dispatch({
    selection: { anchor: state.doc.length },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Handle ArrowLeft at start of line - skip over blank lines
 */
function handleArrowLeftOverBlankLines(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  // Only handle if at start of line
  if (pos !== line.from) return false;

  // Can't go left from first line
  if (line.number <= 1) return false;

  const prevLine = state.doc.line(line.number - 1);

  // If previous line is not blank, let default behavior handle
  if (prevLine.text.trim() !== "") return false;

  // Previous line is blank - find the next non-blank line above
  let targetLineNum = line.number - 2;
  while (targetLineNum >= 1) {
    const targetLine = state.doc.line(targetLineNum);
    if (targetLine.text.trim() !== "") {
      // Found content line - go to end of it
      view.dispatch({
        selection: { anchor: targetLine.to },
        scrollIntoView: true,
      });
      return true;
    }
    targetLineNum--;
  }

  // All lines above are blank, go to start of document
  view.dispatch({
    selection: { anchor: 0 },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Get the content start position for a line (accounts for heading markers)
 */
function getLineContentStart(line: { from: number; text: string }): number {
  const headingMatch = line.text.match(/^(#{1,6})\s/);
  if (headingMatch) {
    return line.from + headingMatch[0].length;
  }
  return line.from;
}

/**
 * Get the content length for a line (accounts for heading markers)
 */
function getLineContentLength(line: { text: string }): number {
  const headingMatch = line.text.match(/^(#{1,6})\s/);
  if (headingMatch) {
    return line.text.length - headingMatch[0].length;
  }
  return line.text.length;
}

/**
 * Handle ArrowUp - skip over blank lines and account for heading markers
 */
function handleArrowUp(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  // Can't go up from first line
  if (line.number <= 1) return false;

  const prevLine = state.doc.line(line.number - 1);

  // If previous line is not blank, let default behavior handle (but we need to check heading)
  if (prevLine.text.trim() !== "") {
    // Check if moving to a heading - need to adjust column
    const headingMatch = prevLine.text.match(/^(#{1,6})\s/);
    if (headingMatch) {
      // Calculate column in content area
      const currentContentStart = getLineContentStart(line);
      const colInContent = pos - currentContentStart;
      const prevContentStart = prevLine.from + headingMatch[0].length;
      const prevContentLength = prevLine.text.length - headingMatch[0].length;
      const targetCol = Math.min(Math.max(0, colInContent), prevContentLength);
      view.dispatch({
        selection: { anchor: prevContentStart + targetCol },
        scrollIntoView: true,
      });
      return true;
    }
    return false;
  }

  // Previous line is blank - find the next non-blank line above
  let targetLineNum = line.number - 2;
  while (targetLineNum >= 1) {
    const targetLine = state.doc.line(targetLineNum);
    if (targetLine.text.trim() !== "") {
      // Found content line - calculate equivalent cursor position
      const currentContentStart = getLineContentStart(line);
      const colInContent = pos - currentContentStart;
      const targetContentStart = getLineContentStart(targetLine);
      const targetContentLength = getLineContentLength(targetLine);
      const targetCol = Math.min(Math.max(0, colInContent), targetContentLength);
      view.dispatch({
        selection: { anchor: targetContentStart + targetCol },
        scrollIntoView: true,
      });
      return true;
    }
    targetLineNum--;
  }

  // All lines above are blank, go to start of document
  view.dispatch({
    selection: { anchor: 0 },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Handle ArrowDown - skip over blank lines and account for heading markers
 */
function handleArrowDown(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const totalLines = state.doc.lines;

  // Can't go down from last line
  if (line.number >= totalLines) return false;

  const nextLine = state.doc.line(line.number + 1);

  // If next line is not blank, check if we need to handle heading
  if (nextLine.text.trim() !== "") {
    const headingMatch = nextLine.text.match(/^(#{1,6})\s/);
    if (headingMatch) {
      // Calculate column in content area
      const currentContentStart = getLineContentStart(line);
      const colInContent = pos - currentContentStart;
      const nextContentStart = nextLine.from + headingMatch[0].length;
      const nextContentLength = nextLine.text.length - headingMatch[0].length;
      const targetCol = Math.min(Math.max(0, colInContent), nextContentLength);
      view.dispatch({
        selection: { anchor: nextContentStart + targetCol },
        scrollIntoView: true,
      });
      return true;
    }
    return false;
  }

  // Next line is blank - find the next non-blank line below
  let targetLineNum = line.number + 2;
  while (targetLineNum <= totalLines) {
    const targetLine = state.doc.line(targetLineNum);
    if (targetLine.text.trim() !== "") {
      // Found content line - calculate equivalent cursor position
      const currentContentStart = getLineContentStart(line);
      const colInContent = pos - currentContentStart;
      const targetContentStart = getLineContentStart(targetLine);
      const targetContentLength = getLineContentLength(targetLine);
      const targetCol = Math.min(Math.max(0, colInContent), targetContentLength);
      view.dispatch({
        selection: { anchor: targetContentStart + targetCol },
        scrollIntoView: true,
      });
      return true;
    }
    targetLineNum++;
  }

  // All lines below are blank, go to end of document
  view.dispatch({
    selection: { anchor: state.doc.length },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Handle Delete at start of line - merge with content above (including headings)
 *
 * When cursor is at start of a paragraph and there's a heading above,
 * delete should merge the paragraph into the heading.
 */
function handleDeleteAtLineStart(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  // Must be at start of line (or start of heading content)
  const headingMatch = line.text.match(/^(#{1,6})\s/);
  const contentStart = headingMatch ? line.from + headingMatch[0].length : line.from;

  if (pos !== contentStart) return false;

  // Must not be the last line
  if (line.number >= state.doc.lines) return false;

  // This is for when we're at start of content and want to merge with line below
  // Actually, Delete at start of line should merge content below INTO this line
  // But the user's case is different - they want Delete to merge THIS line into the line ABOVE

  // Wait, re-reading: cursor is at |paragraph, pressing Delete...
  // Delete key deletes FORWARD, so it would delete the 'p' in paragraph
  // But the user wants it to merge with the heading above

  // Actually I think the user means: at the start of the paragraph,
  // there's nothing to delete forward on this line before the content,
  // so delete should act like "merge up" similar to backspace

  // Hmm, but that's not standard Delete behavior. Let me re-read...
  // "and hit delete, the paragraph should become part of the header"
  //
  // I think the user might mean Backspace? Or they want Delete to also merge up?
  // Let me implement it as: Delete at start of line merges with line above

  return false;
}

/**
 * Get the content start position for any line (handles headings, lists, blockquotes)
 * Returns the position where actual content starts, after any markers
 */
function getContentStartForLine(line: { from: number; text: string }): number {
  // Check for heading: # ## ### etc.
  const headingMatch = line.text.match(/^(#{1,6})\s/);
  if (headingMatch) {
    return line.from + headingMatch[0].length;
  }

  // Check for blockquote: > or > > etc.
  const quoteInfo = getBlockquoteInfo(line);
  if (quoteInfo) {
    return quoteInfo.contentStart;
  }

  // Check for list item: - * + or 1. 2. etc.
  const listInfo = getListInfo(line);
  if (listInfo) {
    return listInfo.contentStart;
  }

  // No markers, content starts at line start
  return line.from;
}

/**
 * Handle Delete at end of line - merge with next content, removing any markers
 * This handles headings, blockquotes, lists, etc.
 */
function handleDeleteAtEndOfLine(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  // Must be at end of line
  if (pos !== line.to) return false;

  // Must not be the last line
  if (line.number >= state.doc.lines) return false;

  // Find next content line (skip blank lines)
  let targetLineNum = line.number + 1;
  while (targetLineNum <= state.doc.lines) {
    const targetLine = state.doc.line(targetLineNum);
    if (targetLine.text.trim() !== "") {
      // Found content line - get content start (after any markers)
      const targetContentStart = getContentStartForLine(targetLine);

      // Delete from current position to start of target content
      view.dispatch({
        changes: { from: pos, to: targetContentStart, insert: "" },
        selection: { anchor: pos },
        scrollIntoView: true,
      });
      return true;
    }
    targetLineNum++;
  }

  return false;
}

/**
 * Handle backspace at start of paragraph - merge with previous content
 *
 * If cursor is at start of a line and previous lines are blank,
 * delete ALL blank lines to merge paragraphs.
 *
 * Markdown collapses multiple blank lines, so we should too.
 */
function handleBackspaceAtParagraphStart(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;

  // Must have a selection that's empty (just cursor)
  if (!state.selection.main.empty) return false;

  const line = state.doc.lineAt(pos);

  // Must be at start of line
  if (pos !== line.from) return false;

  // Must not be the first line
  if (line.number <= 1) return false;

  const prevLine = state.doc.line(line.number - 1);

  // Check if previous line is blank
  if (prevLine.text.trim() !== "") return false;

  // Find all consecutive blank lines above
  let firstBlankLineNum = line.number - 1;
  while (firstBlankLineNum > 1) {
    const checkLine = state.doc.line(firstBlankLineNum - 1);
    if (checkLine.text.trim() !== "") break;
    firstBlankLineNum--;
  }

  const firstBlankLine = state.doc.line(firstBlankLineNum);

  // Check what's above all the blank lines
  if (firstBlankLineNum <= 1) {
    // Only blank lines above, delete them all
    view.dispatch({
      changes: { from: firstBlankLine.from, to: line.from, insert: "" },
      selection: { anchor: firstBlankLine.from },
      scrollIntoView: true,
    });
    return true;
  }

  const contentLine = state.doc.line(firstBlankLineNum - 1);

  // Merge content: delete from end of content line to start of current line
  // This works for both headings and paragraphs
  view.dispatch({
    changes: { from: contentLine.to, to: line.from, insert: "" },
    selection: { anchor: contentLine.to },
    scrollIntoView: true,
  });

  return true;
}

/**
 * Handle backspace at start of heading content
 * Removes heading entirely and merges with line above (or converts to paragraph if first line)
 */
function handleBackspaceAtHeadingStart(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  // Check if we're in a heading by looking for # at start of line
  const lineText = line.text;
  const headingMatch = lineText.match(/^(#{1,6})\s/);

  if (!headingMatch) return false;

  const contentStart = line.from + headingMatch[0].length;

  // Only handle if cursor is at the start of content
  if (pos !== contentStart) return false;

  // Remove heading markers entirely
  if (line.number <= 1) {
    // First line - just remove the "## " prefix, becomes paragraph
    view.dispatch({
      changes: { from: line.from, to: contentStart, insert: "" },
      selection: { anchor: line.from },
      scrollIntoView: true,
    });
    return true;
  }

  // Not first line - find content above (skip blank lines)
  let targetLineNum = line.number - 1;
  while (targetLineNum >= 1) {
    const targetLine = state.doc.line(targetLineNum);
    if (targetLine.text.trim() !== "") {
      // Found content line - merge with it
      view.dispatch({
        changes: { from: targetLine.to, to: contentStart, insert: "" },
        selection: { anchor: targetLine.to },
        scrollIntoView: true,
      });
      return true;
    }
    targetLineNum--;
  }

  // All lines above are blank - just remove them and the heading markers
  const firstLine = state.doc.line(1);
  view.dispatch({
    changes: { from: firstLine.from, to: contentStart, insert: "" },
    selection: { anchor: 0 },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Handle delete/backspace when cursor is inside empty formatting
 * Patterns: **|**, *|*, ~~|~~ (with optional ZWSP), `|`
 * Delete the entire formatting pattern
 */
function handleDeleteEmptyFormatting(view: EditorView): boolean {
  const doc = view.state.doc;
  const pos = view.state.selection.main.head;
  const ZWSP = "\u200B";

  if (pos < 1) return false;

  const before2 = pos >= 2 ? doc.sliceString(pos - 2, pos) : "";
  const after2 = doc.sliceString(pos, pos + 2);
  const before1 = doc.sliceString(pos - 1, pos);
  const after1 = doc.sliceString(pos, pos + 1);

  // Check for **|** (bold)
  if (before2 === "**" && after2 === "**") {
    view.dispatch({
      changes: { from: pos - 2, to: pos + 2, insert: "" },
      selection: { anchor: pos - 2 },
      scrollIntoView: true,
    });
    return true;
  }

  // Check for *|* (italic) - but not part of **|**
  if (before1 === "*" && after1 === "*" && before2 !== "**" && !after2.startsWith("**")) {
    view.dispatch({
      changes: { from: pos - 1, to: pos + 1, insert: "" },
      selection: { anchor: pos - 1 },
      scrollIntoView: true,
    });
    return true;
  }

  // Check for `|` (code)
  if (before1 === "`" && after1 === "`") {
    view.dispatch({
      changes: { from: pos - 1, to: pos + 1, insert: "" },
      selection: { anchor: pos - 1 },
      scrollIntoView: true,
    });
    return true;
  }

  // Check for ~~|~~ (strikethrough) - may have ZWSP: ~~ZWSP|~~ or ~~|ZWSP~~
  if (before2 === "~~" && after2 === "~~") {
    view.dispatch({
      changes: { from: pos - 2, to: pos + 2, insert: "" },
      selection: { anchor: pos - 2 },
      scrollIntoView: true,
    });
    return true;
  }

  // Check for ~~ZWSP|~~ (strikethrough with ZWSP before cursor)
  if (before2 === `~${ZWSP}` && after2 === "~~") {
    // before is ~ZWSP, so opening ~~ starts at pos-3
    view.dispatch({
      changes: { from: pos - 3, to: pos + 2, insert: "" },
      selection: { anchor: pos - 3 },
      scrollIntoView: true,
    });
    return true;
  }

  // Check for ~~|ZWSP~~ (strikethrough with ZWSP after cursor)
  if (before2 === "~~" && after2 === `${ZWSP}~`) {
    // after is ZWSP~, so closing ~~ ends at pos+3
    view.dispatch({
      changes: { from: pos - 2, to: pos + 3, insert: "" },
      selection: { anchor: pos - 2 },
      scrollIntoView: true,
    });
    return true;
  }

  return false;
}

/**
 * Check if cursor is right before an opening marker (for delete handling)
 */
function getFormattingContextBeforeOpening(state: EditorState): FormattingContext | null {
  const pos = state.selection.main.head;
  let result: FormattingContext | null = null;

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === "StrongEmphasis" && pos === node.from) {
        const markers: { from: number; to: number }[] = [];
        node.node.cursor().iterate((child) => {
          if (child.name === "EmphasisMark") {
            markers.push({ from: child.from, to: child.to });
          }
        });
        if (markers.length >= 2) {
          result = {
            type: "strong",
            from: node.from,
            to: node.to,
            contentFrom: markers[0].to,
            contentTo: markers[markers.length - 1].from,
            closingMarkerFrom: markers[markers.length - 1].from,
            closingMarkerTo: markers[markers.length - 1].to,
          };
        }
      }

      if (node.name === "Emphasis" && pos === node.from) {
        const markers: { from: number; to: number }[] = [];
        node.node.cursor().iterate((child) => {
          if (child.name === "EmphasisMark") {
            markers.push({ from: child.from, to: child.to });
          }
        });
        if (markers.length >= 2) {
          result = {
            type: "emphasis",
            from: node.from,
            to: node.to,
            contentFrom: markers[0].to,
            contentTo: markers[markers.length - 1].from,
            closingMarkerFrom: markers[markers.length - 1].from,
            closingMarkerTo: markers[markers.length - 1].to,
          };
        }
      }

      if (node.name === "InlineCode" && pos === node.from) {
        const markers: { from: number; to: number }[] = [];
        node.node.cursor().iterate((child) => {
          if (child.name === "CodeMark") {
            markers.push({ from: child.from, to: child.to });
          }
        });
        if (markers.length >= 2) {
          result = {
            type: "code",
            from: node.from,
            to: node.to,
            contentFrom: markers[0].to,
            contentTo: markers[markers.length - 1].from,
            closingMarkerFrom: markers[markers.length - 1].from,
            closingMarkerTo: markers[markers.length - 1].to,
          };
        }
      }

      if (node.name === "Strikethrough" && pos === node.from) {
        const markers: { from: number; to: number }[] = [];
        node.node.cursor().iterate((child) => {
          if (child.name === "StrikethroughMark") {
            markers.push({ from: child.from, to: child.to });
          }
        });
        if (markers.length >= 2) {
          result = {
            type: "strikethrough",
            from: node.from,
            to: node.to,
            contentFrom: markers[0].to,
            contentTo: markers[markers.length - 1].from,
            closingMarkerFrom: markers[markers.length - 1].from,
            closingMarkerTo: markers[markers.length - 1].to,
          };
        }
      }
    },
  });

  // Fallback: check with regex for patterns parser might miss
  if (!result) {
    const doc = state.doc;
    const text = doc.toString();

    // Check for ** at cursor position (opening bold)
    if (text.slice(pos, pos + 2) === "**") {
      // Find the closing **
      const afterOpen = text.slice(pos + 2);
      const closeIdx = afterOpen.indexOf("**");
      if (closeIdx !== -1) {
        result = {
          type: "strong",
          from: pos,
          to: pos + 2 + closeIdx + 2,
          contentFrom: pos + 2,
          contentTo: pos + 2 + closeIdx,
          closingMarkerFrom: pos + 2 + closeIdx,
          closingMarkerTo: pos + 2 + closeIdx + 2,
        };
      }
    }
    // Check for * (italic, not bold)
    else if (text[pos] === "*" && text[pos + 1] !== "*") {
      const afterOpen = text.slice(pos + 1);
      // Find closing * that's not **
      for (let i = 0; i < afterOpen.length; i++) {
        if (afterOpen[i] === "*" && afterOpen[i + 1] !== "*" && (i === 0 || afterOpen[i - 1] !== "*")) {
          result = {
            type: "emphasis",
            from: pos,
            to: pos + 1 + i + 1,
            contentFrom: pos + 1,
            contentTo: pos + 1 + i,
            closingMarkerFrom: pos + 1 + i,
            closingMarkerTo: pos + 1 + i + 1,
          };
          break;
        }
      }
    }
    // Check for `
    else if (text[pos] === "`") {
      const afterOpen = text.slice(pos + 1);
      const closeIdx = afterOpen.indexOf("`");
      if (closeIdx !== -1) {
        result = {
          type: "code",
          from: pos,
          to: pos + 1 + closeIdx + 1,
          contentFrom: pos + 1,
          contentTo: pos + 1 + closeIdx,
          closingMarkerFrom: pos + 1 + closeIdx,
          closingMarkerTo: pos + 1 + closeIdx + 1,
        };
      }
    }
    // Check for ~~
    else if (text.slice(pos, pos + 2) === "~~") {
      const afterOpen = text.slice(pos + 2);
      const closeIdx = afterOpen.indexOf("~~");
      if (closeIdx !== -1) {
        result = {
          type: "strikethrough",
          from: pos,
          to: pos + 2 + closeIdx + 2,
          contentFrom: pos + 2,
          contentTo: pos + 2 + closeIdx,
          closingMarkerFrom: pos + 2 + closeIdx,
          closingMarkerTo: pos + 2 + closeIdx + 2,
        };
      }
    }
  }

  return result;
}

/**
 * Handle delete when cursor is right before opening marker
 * Skip over the invisible marker and delete from inside
 */
function handleDeleteAtOpeningMarker(view: EditorView): boolean {
  const ctx = getFormattingContextBeforeOpening(view.state);
  if (!ctx) return false;

  // Cursor is right before opening marker (e.g., |**bold**)
  // We want to delete the first char of content and move cursor inside
  // Result: **|old**

  if (ctx.contentTo > ctx.contentFrom) {
    // There's content to delete
    view.dispatch({
      changes: { from: ctx.contentFrom, to: ctx.contentFrom + 1, insert: "" },
      selection: { anchor: ctx.contentFrom },
      scrollIntoView: true,
    });
    return true;
  } else {
    // No content left - delete the entire formatting
    view.dispatch({
      changes: { from: ctx.from, to: ctx.to, insert: "" },
      selection: { anchor: ctx.from },
      scrollIntoView: true,
    });
    return true;
  }
}

/**
 * Handle delete when cursor is at end of content (before closing marker)
 * Skip over the invisible closing marker and delete what's after
 */
function handleDeleteAtEndOfContent(view: EditorView): boolean {
  const ctx = getFormattingContext(view.state);
  if (!ctx || !isAtEndOfFormatting(view.state, ctx)) return false;

  // Cursor is at end of content, before closing marker (e.g., **bold|**)
  // Delete should skip the closing marker and delete what's after
  const doc = view.state.doc;
  const afterMarker = ctx.closingMarkerTo;

  if (afterMarker < doc.length) {
    // There's content after the closing marker to delete
    view.dispatch({
      changes: { from: afterMarker, to: afterMarker + 1, insert: "" },
      scrollIntoView: true,
    });
    return true;
  }

  return false;
}

/**
 * Handle right arrow - skip over opening markers
 * text|**bold** → text**|bold**
 */
function handleArrowRight(view: EditorView): boolean {
  const ctx = getFormattingContextBeforeOpening(view.state);
  if (!ctx) return false;

  // Cursor is right before opening marker, skip to content start
  view.dispatch({
    selection: { anchor: ctx.contentFrom },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Handle right arrow at end of content - skip over closing marker
 * **bold|** → **bold**|
 */
function handleArrowRightAtEnd(view: EditorView): boolean {
  const ctx = getFormattingContext(view.state);
  if (!ctx || !isAtEndOfFormatting(view.state, ctx)) return false;

  // Cursor is at end of content, skip over closing marker
  view.dispatch({
    selection: { anchor: ctx.closingMarkerTo },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Handle left arrow - skip over closing markers
 * **bold**|text → **bold|**text
 */
function handleArrowLeft(view: EditorView): boolean {
  const ctx = getFormattingContextAfterClosing(view.state);
  if (!ctx) return false;

  // Cursor is right after closing marker, skip to content end
  view.dispatch({
    selection: { anchor: ctx.contentTo },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Handle left arrow at start of content - skip over opening marker
 * **|bold** → |**bold**
 */
function handleArrowLeftAtStart(view: EditorView): boolean {
  const ctx = getFormattingContext(view.state);
  if (!ctx) return false;

  const pos = view.state.selection.main.head;
  if (pos !== ctx.contentFrom) return false;

  // Cursor is at start of content, skip over opening marker
  view.dispatch({
    selection: { anchor: ctx.from },
    scrollIntoView: true,
  });
  return true;
}

// ===========================================
// LINK NAVIGATION HANDLERS
// ===========================================

/**
 * Handle right arrow at end of link text - skip over hidden ](url) portion
 * [link|](url) → [link](url)|
 */
function handleArrowRightFromLinkText(view: EditorView): boolean {
  const ctx = getLinkContext(view.state);
  if (!ctx) return false;

  if (!isAtEndOfLinkText(view.state, ctx)) return false;

  // Skip over ](url) to after )
  view.dispatch({
    selection: { anchor: ctx.to },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Handle left arrow from after link - skip into link text
 * [link](url)|text → [link|](url)text
 */
function handleArrowLeftAfterLink(view: EditorView): boolean {
  const ctx = getLinkContextAfterClosing(view.state);
  if (!ctx) return false;

  // Skip to end of link text (before ])
  view.dispatch({
    selection: { anchor: ctx.textTo },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Handle left arrow at start of link text - skip over [
 * [|link](url) → |[link](url)
 */
function handleArrowLeftFromLinkTextStart(view: EditorView): boolean {
  const ctx = getLinkContext(view.state);
  if (!ctx) return false;

  if (!isAtStartOfLinkText(view.state, ctx)) return false;

  // Skip over [ to before link
  view.dispatch({
    selection: { anchor: ctx.from },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Handle right arrow into link - skip [ to reach link text
 * |[link](url) → [|link](url)
 */
function handleArrowRightIntoLink(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const doc = state.doc;
  const text = doc.toString();

  // Check if next char is [ starting a link
  if (pos < text.length && text[pos] === "[") {
    // Check if this is actually a link
    const linkRegex = /\[([^\]]*)\]\(([^)]*)\)/g;
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index === pos) {
        // This is a link starting at cursor
        view.dispatch({
          selection: { anchor: pos + 1 }, // Skip [
          scrollIntoView: true,
        });
        return true;
      }
    }
  }
  return false;
}

// ===========================================
// LINK EDITOR STATE
// ===========================================

/**
 * State for the link editor popup
 */
interface LinkEditorState {
  isOpen: boolean;
  linkContext: LinkContext | null;
  view: EditorView | null;
  mode: "edit" | "create";
  selectedText?: string;
}

let linkEditorState: LinkEditorState = {
  isOpen: false,
  linkContext: null,
  view: null,
  mode: "create",
};

/**
 * Callbacks for when link editor state changes
 */
type LinkEditorCallback = (state: LinkEditorState) => void;
const linkEditorCallbacks: LinkEditorCallback[] = [];

function subscribeLinkEditor(callback: LinkEditorCallback) {
  linkEditorCallbacks.push(callback);
  return () => {
    const index = linkEditorCallbacks.indexOf(callback);
    if (index > -1) linkEditorCallbacks.splice(index, 1);
  };
}

function notifyLinkEditorChange() {
  linkEditorCallbacks.forEach(cb => cb(linkEditorState));
}

/**
 * Open the link editor popup
 */
function openLinkEditor(view: EditorView, ctx: LinkContext | null, mode: "edit" | "create", selectedText?: string) {
  linkEditorState = {
    isOpen: true,
    linkContext: ctx,
    view,
    mode,
    selectedText,
  };
  notifyLinkEditorChange();
}

/**
 * Close the link editor popup
 */
function closeLinkEditor() {
  linkEditorState = {
    isOpen: false,
    linkContext: null,
    view: null,
    mode: "create",
  };
  notifyLinkEditorChange();
}

/**
 * Apply link from the editor
 */
function applyLink(url: string) {
  const { view, linkContext, mode, selectedText } = linkEditorState;
  if (!view) return;

  if (mode === "edit" && linkContext) {
    // Edit existing link URL
    view.dispatch({
      changes: { from: linkContext.urlFrom, to: linkContext.urlTo, insert: url },
      selection: { anchor: linkContext.textTo },
      scrollIntoView: true,
    });
  } else if (mode === "create" && selectedText) {
    // Wrap selection in link
    const sel = view.state.selection.main;
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: `[${selectedText}](${url})` },
      selection: { anchor: sel.from + selectedText.length + 3 + url.length + 1 },
      scrollIntoView: true,
    });
  } else {
    // Create new empty link at cursor
    const pos = view.state.selection.main.head;
    view.dispatch({
      changes: { from: pos, to: pos, insert: `[](${url})` },
      selection: { anchor: pos + 1 }, // Inside the []
      scrollIntoView: true,
    });
  }

  closeLinkEditor();
  view.focus();
}

/**
 * Remove link (keep text)
 */
function removeLink() {
  const { view, linkContext } = linkEditorState;
  if (!view || !linkContext) return;

  view.dispatch({
    changes: { from: linkContext.from, to: linkContext.to, insert: linkContext.text },
    selection: { anchor: linkContext.from + linkContext.text.length },
    scrollIntoView: true,
  });

  closeLinkEditor();
  view.focus();
}

/**
 * Handle Cmd+K command for links
 * - On existing link: open editor to edit URL
 * - With selection: wrap selection in link
 * - Empty cursor: create new link at cursor
 */
function handleLinkCommand(view: EditorView): boolean {
  const ctx = getLinkContext(view.state);
  const sel = view.state.selection.main;

  if (ctx) {
    // Cursor is inside a link - edit it
    openLinkEditor(view, ctx, "edit");
    return true;
  }

  if (!sel.empty) {
    // Has selection - wrap in link
    const selectedText = view.state.doc.sliceString(sel.from, sel.to);
    openLinkEditor(view, null, "create", selectedText);
    return true;
  }

  // Empty cursor - create new empty link
  view.dispatch({
    changes: { from: sel.head, to: sel.head, insert: "[]()" },
    selection: { anchor: sel.head + 1 },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Find all formatted regions that are fully covered by a selection range
 * and return expanded ranges that include the markers
 */
function expandSelectionToIncludeMarkers(state: EditorState): { from: number; to: number } | null {
  const sel = state.selection.main;
  if (sel.empty) return null;

  const selFrom = sel.from;
  const selTo = sel.to;

  let expanded: { from: number; to: number } | null = null;

  // Check parser-based formatted regions
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === "StrongEmphasis" || node.name === "Emphasis" ||
          node.name === "InlineCode" || node.name === "Strikethrough") {
        const markers: { from: number; to: number }[] = [];
        const markName = node.name === "InlineCode" ? "CodeMark" :
                         node.name === "Strikethrough" ? "StrikethroughMark" : "EmphasisMark";

        node.node.cursor().iterate((child) => {
          if (child.name === markName) {
            markers.push({ from: child.from, to: child.to });
          }
        });

        if (markers.length >= 2) {
          const contentFrom = markers[0].to;
          const contentTo = markers[markers.length - 1].from;

          // Check if selection covers the entire content (or more)
          if (selFrom <= contentFrom && selTo >= contentTo) {
            // Expand to include markers
            const newFrom = Math.min(selFrom, node.from);
            const newTo = Math.max(selTo, node.to);

            if (!expanded) {
              expanded = { from: newFrom, to: newTo };
            } else {
              expanded.from = Math.min(expanded.from, newFrom);
              expanded.to = Math.max(expanded.to, newTo);
            }
          }
        }
      }
    },
  });

  // Also check with regex fallback for patterns parser might miss
  const doc = state.doc;
  const text = doc.toString();

  // Bold: **...**
  const boldRegex = /\*\*(.+?)\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(text)) !== null) {
    const nodeFrom = match.index;
    const nodeTo = match.index + match[0].length;
    const contentFrom = match.index + 2;
    const contentTo = match.index + 2 + match[1].length;

    if (selFrom <= contentFrom && selTo >= contentTo) {
      const newFrom = Math.min(selFrom, nodeFrom);
      const newTo = Math.max(selTo, nodeTo);

      if (!expanded) {
        expanded = { from: newFrom, to: newTo };
      } else {
        expanded.from = Math.min(expanded.from, newFrom);
        expanded.to = Math.max(expanded.to, newTo);
      }
    }
  }

  // Italic: *...*
  const italicRegex = /(?<!\*)\*([^*]+?)\*(?!\*)/g;
  while ((match = italicRegex.exec(text)) !== null) {
    const nodeFrom = match.index;
    const nodeTo = match.index + match[0].length;
    const contentFrom = match.index + 1;
    const contentTo = match.index + 1 + match[1].length;

    if (selFrom <= contentFrom && selTo >= contentTo) {
      const newFrom = Math.min(selFrom, nodeFrom);
      const newTo = Math.max(selTo, nodeTo);

      if (!expanded) {
        expanded = { from: newFrom, to: newTo };
      } else {
        expanded.from = Math.min(expanded.from, newFrom);
        expanded.to = Math.max(expanded.to, newTo);
      }
    }
  }

  // Only return if we actually expanded
  if (expanded && (expanded.from < selFrom || expanded.to > selTo)) {
    return expanded;
  }

  return null;
}

/**
 * Handle delete/backspace with selection - expand to include hidden markers
 */
function handleDeleteWithSelection(view: EditorView): boolean {
  const sel = view.state.selection.main;
  if (sel.empty) return false;

  const expanded = expandSelectionToIncludeMarkers(view.state);
  if (!expanded) return false;

  // Delete the expanded range
  view.dispatch({
    changes: { from: expanded.from, to: expanded.to, insert: "" },
    selection: { anchor: expanded.from },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Create keymap for formatting escape commands
 */
const formattingEscapeKeymap = keymap.of([
  // Backspace: handle lists, blockquotes, paragraph merging, headings, empty formatting, selection, links, then skip over invisible closing markers
  {
    key: "Backspace",
    run: (view) => handleBackspaceInList(view) || handleBackspaceInBlockquote(view) || handleBackspaceAtParagraphStart(view) || handleBackspaceAtHeadingStart(view) || handleDeleteEmptyFormatting(view) || handleDeleteWithSelection(view) || handleBackspaceAfterLink(view) || handleBackspaceAtLinkTextStart(view) || handleBackspaceAtClosingMarker(view),
  },
  // Delete: handle end of line (merge with content below), empty formatting, selection, links, then skip over invisible markers
  {
    key: "Delete",
    run: (view) => handleDeleteAtEndOfLine(view) || handleDeleteEmptyFormatting(view) || handleDeleteWithSelection(view) || handleDeleteAtLinkTextEnd(view) || handleDeleteAtOpeningMarker(view) || handleDeleteAtEndOfContent(view),
  },
  // Arrow Right: skip over invisible markers, heading markers, list markers, blockquote markers, links, and blank lines
  {
    key: "ArrowRight",
    run: (view) => handleArrowRight(view) || handleArrowRightAtEnd(view) || handleArrowRightFromLinkText(view) || handleArrowRightIntoLink(view) || handleArrowRightIntoHeading(view) || handleArrowRightIntoList(view) || handleArrowRightIntoBlockquote(view) || handleArrowRightOverBlankLines(view),
  },
  // Arrow Left: skip over invisible markers, heading markers, list markers, blockquote markers, links, and blank lines
  {
    key: "ArrowLeft",
    run: (view) => handleArrowLeft(view) || handleArrowLeftAtStart(view) || handleArrowLeftAfterLink(view) || handleArrowLeftFromLinkTextStart(view) || handleArrowLeftFromHeadingStart(view) || handleArrowLeftFromListStart(view) || handleArrowLeftFromBlockquoteStart(view) || handleArrowLeftOverBlankLines(view),
  },
  // Cmd+B: toggle bold or escape
  {
    key: "Mod-b",
    run: toggleBoldOrEscape,
  },
  // Cmd+I: toggle italic or escape
  {
    key: "Mod-i",
    run: toggleItalicOrEscape,
  },
  // Cmd+K: create or edit link
  {
    key: "Mod-k",
    run: handleLinkCommand,
  },
  // Tab: indent list or escape formatting
  {
    key: "Tab",
    run: (view) => handleTabInList(view) || escapeFormatting(view),
  },
  // Shift+Tab: outdent list
  {
    key: "Shift-Tab",
    run: handleShiftTabInList,
  },
  // Enter: new paragraph (double newline for proper markdown)
  {
    key: "Enter",
    run: handleEnter,
  },
  // Shift+Enter: soft line break (single newline, same paragraph)
  {
    key: "Shift-Enter",
    run: handleShiftEnter,
  },
  // ArrowUp: skip blank lines
  {
    key: "ArrowUp",
    run: handleArrowUp,
  },
  // ArrowDown: skip blank lines
  {
    key: "ArrowDown",
    run: handleArrowDown,
  },
]);

/**
 * Input handler for:
 * 1. Escaping formatting with proper sequences (** for bold, * for italic, etc.)
 * 2. Auto-closing markers when creating new formatting
 *
 * KEY INSIGHT: For ** escape, we don't insert the first * - we hold it
 * and wait for the second * before doing anything.
 */
const formattingInputHandler = EditorView.inputHandler.of(
  (view, from, to, text) => {
    // Only handle single character insertions at cursor (no selection)
    if (from !== to || text.length !== 1) return false;

    const doc = view.state.doc;
    const prevChar = from > 0 ? doc.sliceString(from - 1, from) : "";
    const nextChar = doc.sliceString(from, from + 1);

    // ===========================================
    // HANDLE PENDING ESCAPE (second char of sequence)
    // ===========================================

    if (pendingEscape) {
      const pending = pendingEscape;
      clearPendingEscape();

      // Check if this completes the escape sequence
      // Allow for position to be off by a small amount due to potential race conditions
      if (text === pending.char && Math.abs(from - pending.pos) <= 1) {
        // Second char matches! Complete the escape
        view.dispatch({
          selection: { anchor: pending.formattingEnd },
          scrollIntoView: true,
        });
        return true;
      } else {
        // Different char or position - insert the pending char first, then handle this one
        view.dispatch({
          changes: { from: pending.pos, to: pending.pos, insert: pending.char },
        });
        // Continue to handle the current input normally (don't return)
        // Update from position since we inserted a char
        // Actually, we need to let the current char be handled by default
        // This is tricky - for now, just return false to let default handle it
        return false;
      }
    }

    // ===========================================
    // STRIKETHROUGH AUTO-CLOSE: Handle ~~ specially
    // Single ~ does nothing (no auto-close), but ~~ creates ~~|~~
    // ===========================================

    if (text === "~" && prevChar === "~") {
      // User typed second ~ to create strikethrough
      // IMPORTANT: We can't use `~~~~` because Lezer parses it as a fenced code block!
      // Instead, insert a zero-width space between the markers: ~~\u200B~~
      // This gives us valid strikethrough that the parser recognizes correctly.

      const ZWSP = "\u200B"; // Zero-width space
      const tildeStart = from - 1; // Position of first ~

      // Replace the single ~ with full ~~ZWSP~~ pattern
      view.dispatch({
        changes: { from: tildeStart, to: from, insert: `~~${ZWSP}~~` },
        selection: { anchor: tildeStart + 2 }, // Position at the ZWSP
        scrollIntoView: true,
      });
      return true;
    }

    // ===========================================
    // ESCAPE: At end of formatting, start or complete escape sequence
    // ===========================================

    const ctx = getFormattingContext(view.state);

    if (ctx && isAtEndOfFormatting(view.state, ctx)) {
      // BOLD: Need ** to escape - hold first *, wait for second
      if (text === "*" && ctx.type === "strong") {
        // Start pending escape - don't insert the *
        pendingEscape = {
          char: "*",
          pos: from,
          formattingEnd: ctx.closingMarkerTo,
          timeoutId: setTimeout(() => {
            // Timeout - insert the held * and clear pending
            if (pendingEscape && pendingEscape.pos === from) {
              view.dispatch({
                changes: { from, to: from, insert: "*" },
              });
              pendingEscape = null;
            }
          }, 500), // 500ms timeout
        };
        return true; // Don't insert anything yet
      }

      // ITALIC: Single * escapes
      if (text === "*" && ctx.type === "emphasis") {
        view.dispatch({
          selection: { anchor: ctx.closingMarkerTo },
          scrollIntoView: true,
        });
        return true;
      }

      // STRIKETHROUGH: Need ~~ to escape - hold first ~, wait for second
      if (text === "~" && ctx.type === "strikethrough") {
        pendingEscape = {
          char: "~",
          pos: from,
          formattingEnd: ctx.closingMarkerTo,
          timeoutId: setTimeout(() => {
            if (pendingEscape && pendingEscape.pos === from) {
              view.dispatch({
                changes: { from, to: from, insert: "~" },
              });
              pendingEscape = null;
            }
          }, 500),
        };
        return true;
      }

      // CODE: Single ` escapes
      if (text === "`" && ctx.type === "code") {
        view.dispatch({
          selection: { anchor: ctx.closingMarkerTo },
          scrollIntoView: true,
        });
        return true;
      }
    }

    // ===========================================
    // UPGRADE: *|* → **|** and ~|~ → ~~|~~
    // This must come BEFORE the ctx check, because after creating *|*
    // the cursor is technically "inside" formatting
    // ===========================================

    if (text === "*" && prevChar === "*" && nextChar === "*") {
      // Upgrade *|* to **|**
      view.dispatch({
        changes: [
          { from: from, to: from, insert: "*" },
          { from: from + 1, to: from + 1, insert: "*" },
        ],
        selection: { anchor: from + 1 },
        scrollIntoView: true,
      });
      return true;
    }

    // Note: No ~|~ → ~~|~~ upgrade needed because first ~ doesn't auto-close
    // Strikethrough requires ~~ so we only auto-close on second ~

    // ===========================================
    // LISTS: Create list item when typing marker at start of line
    // Must come BEFORE auto-close to take priority
    // ===========================================

    // Unordered list markers (-, *, +)
    if (text === "-" || text === "*" || text === "+") {
      const line = doc.lineAt(from);
      const lineStart = line.from;
      const textBeforeCursor = doc.sliceString(lineStart, from);

      // At start of line (possibly with indentation) - create list item
      if (/^\s*$/.test(textBeforeCursor)) {
        view.dispatch({
          changes: { from, to, insert: `${text} ` },
          selection: { anchor: from + 2 },
          scrollIntoView: true,
        });
        return true;
      }
    }

    // Ordered list: typing "." after a number at line start (e.g., "1." → "1. ")
    if (text === ".") {
      const line = doc.lineAt(from);
      const lineStart = line.from;
      const textBeforeCursor = doc.sliceString(lineStart, from);

      // Check if there's a number at the start of line
      const orderedMatch = textBeforeCursor.match(/^(\s*)(\d+)$/);
      if (orderedMatch) {
        view.dispatch({
          changes: { from, to, insert: ". " },
          selection: { anchor: from + 2 },
          scrollIntoView: true,
        });
        return true;
      }
    }

    // Blockquote: typing ">" at start of line creates "> |"
    if (text === ">") {
      const line = doc.lineAt(from);
      const lineStart = line.from;
      const textBeforeCursor = doc.sliceString(lineStart, from);

      // At start of line (possibly with existing > markers for nesting) - create blockquote
      if (/^(>\s*)*$/.test(textBeforeCursor)) {
        view.dispatch({
          changes: { from, to, insert: "> " },
          selection: { anchor: from + 2 },
          scrollIntoView: true,
        });
        return true;
      }
    }

    // ===========================================
    // AUTO-CLOSE: Outside formatting, auto-pair markers
    // ===========================================

    // Don't auto-close if we're already inside formatting
    if (ctx) return false;

    // Don't auto-close if next char is alphanumeric (mid-word)
    if (/\w/.test(nextChar)) return false;

    // Auto-close * → *|*
    if (text === "*") {
      view.dispatch({
        changes: { from, to, insert: "**" },
        selection: { anchor: from + 1 },
        scrollIntoView: true,
      });
      return true;
    }

    // Auto-close ` → `|`
    if (text === "`") {
      view.dispatch({
        changes: { from, to, insert: "``" },
        selection: { anchor: from + 1 },
        scrollIntoView: true,
      });
      return true;
    }

    // Auto-close [ → [|]()  for links
    if (text === "[") {
      view.dispatch({
        changes: { from, to, insert: "[]()" },
        selection: { anchor: from + 1 },
        scrollIntoView: true,
      });
      return true;
    }

    // First ~ just inserts normally (no auto-close for single ~)
    // The ~~ auto-close is handled at the top of this function

    // ===========================================
    // HEADINGS: Space after # at start of line creates heading
    // User types: # → ## → ### then space to confirm
    // ===========================================

    if (text === " ") {
      const line = doc.lineAt(from);
      const lineStart = line.from;
      const textBeforeCursor = doc.sliceString(lineStart, from);

      // Check if line starts with 1-6 # characters and cursor is right after them
      const headingMatch = textBeforeCursor.match(/^#{1,6}$/);
      if (headingMatch) {
        // User typed space after #'s - this confirms the heading
        // Just let it happen naturally, the parser will recognize it
        // and our decorations will hide the markers
        return false;
      }

      // Check if line starts with list marker (-, *, +, or 1., 2., etc.)
      const listMatch = textBeforeCursor.match(/^(\s*)([-*+]|\d+\.)$/);
      if (listMatch) {
        // User typed space after list marker - confirms the list item
        // Let it happen naturally, parser will recognize it
        return false;
      }
    }

    return false;
  }
);

// ===========================================
// HIDDEN SYNTAX DECORATION (NO atomicRanges)
// ===========================================

const hiddenDecoration = Decoration.replace({});

/**
 * Build decorations that hide syntax markers
 *
 * KEY INSIGHT: We use Decoration.replace() but do NOT add atomicRanges.
 * This hides the markers visually but keeps the text editable.
 *
 * For list markers, we use widget decorations to show bullets/numbers.
 *
 * Uses BOTH parser AND regex fallback to hide markers the parser misses.
 */
function buildHiddenSyntax(state: EditorState) {
  const doc = state.doc;

  // Collect all ranges to hide, then sort before adding to builder
  // RangeSetBuilder requires ranges in sorted order
  const rangesToHide: Array<{ from: number; to: number }> = [];

  // List markers get widget decorations instead of being hidden
  const listMarkers: Array<{ from: number; to: number; isOrdered: boolean; num: number }> = [];

  // Blockquote markers get widget decorations showing the bar
  const blockquoteMarkers: Array<{ from: number; to: number; level: number }> = [];

  // Track which lines we've already processed for blockquotes (to handle nested)
  const processedBlockquoteLines = new Set<number>();

  syntaxTree(state).iterate({
    enter(node) {
      // Hide emphasis marks (* or _)
      if (node.name === "EmphasisMark") {
        rangesToHide.push({ from: node.from, to: node.to });
      }

      // Hide code marks (`)
      if (node.name === "CodeMark") {
        rangesToHide.push({ from: node.from, to: node.to });
      }

      // For strikethrough, we need to find the ~~ markers
      if (node.name === "StrikethroughMark") {
        rangesToHide.push({ from: node.from, to: node.to });
      }

      // Hide header marks (# symbols and trailing space)
      if (node.name === "HeaderMark") {
        rangesToHide.push({ from: node.from, to: node.to });

        // Also hide the trailing space after the header mark
        const nextChar = doc.sliceString(node.to, node.to + 1);
        if (nextChar === " ") {
          rangesToHide.push({ from: node.to, to: node.to + 1 });
        }
      }

      // Replace list marks with widget decorations
      if (node.name === "ListMark") {
        const markText = doc.sliceString(node.from, node.to);

        // Determine if ordered or unordered
        const isOrdered = /^\d+\.$/.test(markText);
        const num = isOrdered ? parseInt(markText) : 0;

        // Include the trailing space in the replacement range
        const nextChar = doc.sliceString(node.to, node.to + 1);
        const to = nextChar === " " ? node.to + 1 : node.to;

        listMarkers.push({ from: node.from, to, isOrdered, num });
      }

      // Handle QuoteMark nodes from the parser
      if (node.name === "QuoteMark") {
        const line = doc.lineAt(node.from);

        // Only process each line once (multiple QuoteMarks on same line = nested)
        if (!processedBlockquoteLines.has(line.number)) {
          processedBlockquoteLines.add(line.number);

          // Get the full blockquote info for this line
          const quoteInfo = getBlockquoteInfo(line);
          if (quoteInfo) {
            blockquoteMarkers.push({
              from: line.from,
              to: quoteInfo.contentStart,
              level: quoteInfo.level,
            });
          }
        }
      }

      // Handle Link nodes - hide [ and ](url) portions, keep text visible
      if (node.name === "Link") {
        let bracketOpen = -1;
        let bracketClose = -1;
        let parenClose = -1;

        node.node.cursor().iterate((child) => {
          if (child.name === "LinkMark") {
            const markText = doc.sliceString(child.from, child.to);
            if (markText === "[") {
              bracketOpen = child.from;
            } else if (markText === "]") {
              bracketClose = child.from;
            } else if (markText === ")") {
              parenClose = child.from;
            }
          }
        });

        // Hide [ at start
        if (bracketOpen !== -1) {
          rangesToHide.push({ from: bracketOpen, to: bracketOpen + 1 });
        }
        // Hide ](url) portion - from ] to after )
        if (bracketClose !== -1 && parenClose !== -1) {
          rangesToHide.push({ from: bracketClose, to: parenClose + 1 });
        }
      }
    },
  });

  // ===========================================
  // REGEX FALLBACK: Hide markers the parser misses
  // ===========================================

  const text = doc.toString();

  const isAlreadyCollected = (from: number, to: number) =>
    rangesToHide.some((r) => r.from === from && r.to === to);

  // Bold markers: **
  const boldRegex = /\*\*(.+?)\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(text)) !== null) {
    const openFrom = match.index;
    const openTo = match.index + 2;
    const closeFrom = match.index + 2 + match[1].length;
    const closeTo = closeFrom + 2;

    if (!isAlreadyCollected(openFrom, openTo)) {
      rangesToHide.push({ from: openFrom, to: openTo });
    }
    if (!isAlreadyCollected(closeFrom, closeTo)) {
      rangesToHide.push({ from: closeFrom, to: closeTo });
    }
  }

  // Italic markers: * (but not **)
  const italicRegex = /(?<!\*)\*([^*]+?)\*(?!\*)/g;
  while ((match = italicRegex.exec(text)) !== null) {
    const openFrom = match.index;
    const openTo = match.index + 1;
    const closeFrom = match.index + 1 + match[1].length;
    const closeTo = closeFrom + 1;

    if (!isAlreadyCollected(openFrom, openTo)) {
      rangesToHide.push({ from: openFrom, to: openTo });
    }
    if (!isAlreadyCollected(closeFrom, closeTo)) {
      rangesToHide.push({ from: closeFrom, to: closeTo });
    }
  }

  // Strikethrough markers: ~~
  const strikeRegex = /~~(.+?)~~/g;
  while ((match = strikeRegex.exec(text)) !== null) {
    const openFrom = match.index;
    const openTo = match.index + 2;
    const closeFrom = match.index + 2 + match[1].length;
    const closeTo = closeFrom + 2;

    if (!isAlreadyCollected(openFrom, openTo)) {
      rangesToHide.push({ from: openFrom, to: openTo });
    }
    if (!isAlreadyCollected(closeFrom, closeTo)) {
      rangesToHide.push({ from: closeFrom, to: closeTo });
    }
  }

  // Link markers: [text](url) - hide [ and ](url)
  const linkRegex = /\[([^\]]*)\]\(([^)]*)\)/g;
  while ((match = linkRegex.exec(text)) !== null) {
    const bracketOpen = match.index;
    const bracketClose = match.index + 1 + match[1].length;
    const parenClose = match.index + match[0].length - 1;

    // Hide opening [
    if (!isAlreadyCollected(bracketOpen, bracketOpen + 1)) {
      rangesToHide.push({ from: bracketOpen, to: bracketOpen + 1 });
    }
    // Hide ](url) portion
    if (!isAlreadyCollected(bracketClose, parenClose + 1)) {
      rangesToHide.push({ from: bracketClose, to: parenClose + 1 });
    }
  }

  // Blockquote markers: lines starting with > (regex fallback)
  // Process each line for blockquote markers
  for (let i = 1; i <= doc.lines; i++) {
    if (processedBlockquoteLines.has(i)) continue;

    const line = doc.line(i);
    const quoteInfo = getBlockquoteInfo(line);
    if (quoteInfo) {
      blockquoteMarkers.push({
        from: line.from,
        to: quoteInfo.contentStart,
        level: quoteInfo.level,
      });
    }
  }

  // Combine all decorations with their types for sorting
  type DecorationEntry =
    | { from: number; to: number; type: "hide" }
    | { from: number; to: number; type: "list"; isOrdered: boolean; num: number }
    | { from: number; to: number; type: "blockquote"; level: number };

  const allDecorations: DecorationEntry[] = [
    ...rangesToHide.map(r => ({ ...r, type: "hide" as const })),
    ...listMarkers.map(m => ({ ...m, type: "list" as const })),
    ...blockquoteMarkers.map(b => ({ ...b, type: "blockquote" as const })),
  ];

  // Sort by 'from' position (required by RangeSetBuilder)
  allDecorations.sort((a, b) => a.from - b.from);

  // Now add to builder in sorted order
  const builder = new RangeSetBuilder<Decoration>();
  for (const entry of allDecorations) {
    if (entry.type === "hide") {
      builder.add(entry.from, entry.to, hiddenDecoration);
    } else if (entry.type === "list") {
      // List marker - use widget decoration
      const listEntry = entry as { from: number; to: number; type: "list"; isOrdered: boolean; num: number };
      const widget = listEntry.isOrdered
        ? new NumberWidget(listEntry.num)
        : new BulletWidget();
      builder.add(entry.from, entry.to, Decoration.replace({ widget }));
    } else if (entry.type === "blockquote") {
      // Blockquote marker - use widget decoration with bar
      const quoteEntry = entry as { from: number; to: number; type: "blockquote"; level: number };
      const widget = new BlockquoteBarWidget(quoteEntry.level);
      builder.add(entry.from, entry.to, Decoration.replace({ widget }));
    }
  }

  return builder.finish();
}

/**
 * StateField that tracks hidden syntax decorations
 *
 * NOTE: We only provide EditorView.decorations, NOT EditorView.atomicRanges
 * This is the key difference from the failed migration.
 */
const hiddenSyntaxField = StateField.define({
  create: (state) => buildHiddenSyntax(state),
  update: (value, tr) => {
    if (tr.docChanged) {
      return buildHiddenSyntax(tr.state);
    }
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
  // INTENTIONALLY NOT providing atomicRanges - this is the experiment!
});

// ===========================================
// PENDING FORMATTING DECORATIONS
// ===========================================

/**
 * Detect "pending formatting" patterns where cursor is between markers
 * with no content yet: *|*, **|**, `|`, ~~|~~
 *
 * These need special handling because the parser doesn't recognize
 * empty formatting as valid nodes.
 */
function buildPendingFormattingDecorations(state: EditorState) {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = state.doc;
  const pos = state.selection.main.head;

  // Only check around cursor position
  if (pos < 1) return builder.finish();

  const before2 = pos >= 2 ? doc.sliceString(pos - 2, pos) : "";
  const after2 = doc.sliceString(pos, pos + 2);
  const before1 = pos >= 1 ? doc.sliceString(pos - 1, pos) : "";
  const after1 = doc.sliceString(pos, pos + 1);

  // Check for **|** (bold) - must check before *|*
  if (before2 === "**" && after2 === "**") {
    // Hide the markers
    builder.add(pos - 2, pos, Decoration.replace({}));
    builder.add(pos, pos + 2, Decoration.replace({}));
  }
  // Check for *|* (italic) - but not **|**
  // The key is: before2 !== "**" AND after2 doesn't start with "**"
  else if (before1 === "*" && after1 === "*" && before2 !== "**" && !after2.startsWith("**")) {
    builder.add(pos - 1, pos, Decoration.replace({}));
    builder.add(pos, pos + 1, Decoration.replace({}));
  }
  // Check for `|` (code)
  else if (before1 === "`" && after1 === "`") {
    builder.add(pos - 1, pos, Decoration.replace({}));
    builder.add(pos, pos + 1, Decoration.replace({}));
  }
  // NOTE: We intentionally do NOT hide ~~|~~ (empty strikethrough)
  // When both sides of cursor are Decoration.replace(), CodeMirror
  // gets confused about text insertion position. Once user types content,
  // the regular hiddenSyntaxField will hide the markers.

  return builder.finish();
}

/**
 * Get the pending format type at cursor position (for styling the cursor)
 */
function getPendingFormat(state: EditorState): "bold" | "italic" | "code" | "strikethrough" | null {
  const doc = state.doc;
  const pos = state.selection.main.head;

  if (pos < 1) return null;

  const before2 = pos >= 2 ? doc.sliceString(pos - 2, pos) : "";
  const after2 = doc.sliceString(pos, pos + 2);
  const before1 = doc.sliceString(pos - 1, pos);
  const after1 = doc.sliceString(pos, pos + 1);

  if (before2 === "**" && after2 === "**") return "bold";
  if (before1 === "*" && after1 === "*" && before2 !== "**" && !after2.startsWith("**")) return "italic";
  if (before1 === "`" && after1 === "`") return "code";
  if (before2 === "~~" && after2 === "~~") return "strikethrough";

  return null;
}

const pendingFormattingField = StateField.define({
  create: (state) => buildPendingFormattingDecorations(state),
  update: (_, tr) => buildPendingFormattingDecorations(tr.state),
  provide: (field) => EditorView.decorations.from(field),
});

/**
 * Extension that adds a CSS class to the editor based on pending format
 */
const pendingFormatTheme = EditorView.updateListener.of((update) => {
  const format = getPendingFormat(update.state);
  const editorEl = update.view.dom;

  // Remove all pending format classes
  editorEl.classList.remove("cm-pending-bold", "cm-pending-italic", "cm-pending-code", "cm-pending-strikethrough");

  // Add current pending format class
  if (format) {
    editorEl.classList.add(`cm-pending-${format}`);
  }
});

/**
 * Extension that ensures cursor can never be inside heading, list, blockquote markers,
 * or hidden link portions (the ](url) part).
 * If cursor ends up in a hidden region, move it to an appropriate position.
 */
const cursorGuard = EditorView.updateListener.of((update) => {
  if (!update.selectionSet) return;

  const state = update.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  let newPos: number | null = null;

  // Check if cursor is inside hidden link portion
  const linkCtx = getLinkContext(state);
  if (linkCtx && isInHiddenLinkPortion(state, linkCtx)) {
    // Move cursor to end of link text (textTo)
    newPos = linkCtx.textTo;
  }

  // Check if this is a heading line
  if (newPos === null) {
    const headingMatch = line.text.match(/^(#{1,6})\s/);
    if (headingMatch && pos < line.from + headingMatch[0].length) {
      newPos = line.from + headingMatch[0].length;
    }
  }

  // Check if this is a list item line
  if (newPos === null) {
    const listMatch = line.text.match(/^(\s*)([-*+]|\d+\.)\s/);
    if (listMatch && pos < line.from + listMatch[0].length) {
      newPos = line.from + listMatch[0].length;
    }
  }

  // Check if this is a blockquote line
  if (newPos === null) {
    const quoteInfo = getBlockquoteInfo(line);
    if (quoteInfo && pos < quoteInfo.contentStart) {
      newPos = quoteInfo.contentStart;
    }
  }

  if (newPos === null) return;

  // Move cursor to the appropriate position
  // Use requestAnimationFrame to avoid dispatch during update
  requestAnimationFrame(() => {
    update.view.dispatch({
      selection: { anchor: newPos! },
    });
  });
});

// ===========================================
// STYLING DECORATIONS
// ===========================================

const boldMark = Decoration.mark({ class: "cm-strong" });
const italicMark = Decoration.mark({ class: "cm-em" });
const codeMark = Decoration.mark({ class: "cm-inline-code" });
const strikethroughMark = Decoration.mark({ class: "cm-strikethrough" });
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

/**
 * Build style decorations (bold, italic, etc.)
 * These mark the content (not the syntax) with styling classes
 *
 * Uses BOTH parser nodes AND regex fallback to catch cases the parser misses
 * (like trailing whitespace: **bold **)
 */
function buildStyleDecorations(state: EditorState) {
  const doc = state.doc;

  // Collect all ranges with their decorations, then sort before adding to builder
  // RangeSetBuilder requires ranges in sorted order
  const rangesToDecorate: Array<{ from: number; to: number; decoration: Decoration }> = [];

  syntaxTree(state).iterate({
    enter(node) {
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

  const isAlreadyCollected = (from: number, to: number) =>
    rangesToDecorate.some((r) => !(to <= r.from || from >= r.to));

  // Bold: **...**
  const boldRegex = /\*\*(.+?)\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(text)) !== null) {
    const contentFrom = match.index + 2;
    const contentTo = match.index + 2 + match[1].length;
    if (!isAlreadyCollected(contentFrom, contentTo) && contentFrom < contentTo) {
      rangesToDecorate.push({ from: contentFrom, to: contentTo, decoration: boldMark });
    }
  }

  // Italic: *...* (but not **)
  const italicRegex = /(?<!\*)\*([^*]+?)\*(?!\*)/g;
  while ((match = italicRegex.exec(text)) !== null) {
    const contentFrom = match.index + 1;
    const contentTo = match.index + 1 + match[1].length;
    if (!isAlreadyCollected(contentFrom, contentTo) && contentFrom < contentTo) {
      rangesToDecorate.push({ from: contentFrom, to: contentTo, decoration: italicMark });
    }
  }

  // Strikethrough: ~~...~~
  const strikeRegex = /~~(.+?)~~/g;
  while ((match = strikeRegex.exec(text)) !== null) {
    const contentFrom = match.index + 2;
    const contentTo = match.index + 2 + match[1].length;
    if (!isAlreadyCollected(contentFrom, contentTo) && contentFrom < contentTo) {
      rangesToDecorate.push({ from: contentFrom, to: contentTo, decoration: strikethroughMark });
    }
  }

  // Links: [text](url) - style the text portion
  const linkStyleRegex = /\[([^\]]*)\]\([^)]*\)/g;
  while ((match = linkStyleRegex.exec(text)) !== null) {
    const textFrom = match.index + 1; // After [
    const textTo = match.index + 1 + match[1].length; // Before ]
    if (!isAlreadyCollected(textFrom, textTo) && textFrom < textTo) {
      rangesToDecorate.push({ from: textFrom, to: textTo, decoration: linkMark });
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

const styleField = StateField.define({
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
// THEME
// ===========================================

const theme = EditorView.theme({
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
  // Blockquote styles
  ".cm-blockquote-bar": {
    userSelect: "none",
  },
  ".cm-blockquote-bar-segment": {
    opacity: "0.6",
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
  ".cm-line": {
    padding: "0 4px",
  },
});

// ===========================================
// LINK EDITOR POPUP COMPONENT
// ===========================================

function LinkEditorPopup() {
  const [state, setState] = useState<LinkEditorState>(linkEditorState);
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return subscribeLinkEditor((newState) => {
      setState(newState);
      if (newState.isOpen) {
        setUrl(newState.linkContext?.url || "");
        // Focus input after a short delay to ensure it's rendered
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyLink(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      closeLinkEditor();
      state.view?.focus();
    }
  };

  if (!state.isOpen) return null;

  return (
    <div
      className="link-editor-overlay"
      onClick={() => {
        closeLinkEditor();
        state.view?.focus();
      }}
    >
      <div className="link-editor-popup" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="link-editor-header">
            {state.mode === "edit" ? "Edit Link" : "Insert Link"}
          </div>
          {state.selectedText && (
            <div className="link-editor-text">
              Text: <strong>{state.selectedText}</strong>
            </div>
          )}
          {state.linkContext && (
            <div className="link-editor-text">
              Text: <strong>{state.linkContext.text}</strong>
            </div>
          )}
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://example.com"
            className="link-editor-input"
          />
          <div className="link-editor-buttons">
            <button type="submit" className="link-editor-button primary">
              {state.mode === "edit" ? "Update" : "Insert"}
            </button>
            {state.mode === "edit" && (
              <button
                type="button"
                className="link-editor-button danger"
                onClick={() => {
                  removeLink();
                }}
              >
                Remove Link
              </button>
            )}
            <button
              type="button"
              className="link-editor-button"
              onClick={() => {
                closeLinkEditor();
                state.view?.focus();
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===========================================
// EDITOR COMPONENT
// ===========================================

interface EditorProps {
  initialContent: string;
  hidesSyntax: boolean;
  onChange?: (content: string) => void;
}

function Editor({ initialContent, hidesSyntax, onChange }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = [
      // Input handler FIRST to intercept before markdown parser
      formattingInputHandler,
      markdown({ extensions: [GFM] }),
      history(),
      // Formatting escape keymap with HIGHEST priority to override markdown extension's list handling
      Prec.highest(formattingEscapeKeymap),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      theme,
      styleField,
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChange) {
          onChange(update.state.doc.toString());
        }
      }),
    ];

    // Only add hidden syntax if enabled
    if (hidesSyntax) {
      extensions.push(hiddenSyntaxField);
      extensions.push(pendingFormattingField);
      extensions.push(pendingFormatTheme);
      extensions.push(cursorGuard);
    }

    const state = EditorState.create({
      doc: initialContent,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, [initialContent, hidesSyntax]);

  return <div ref={containerRef} className="editor-container" />;
}

// ===========================================
// HARNESS APP
// ===========================================

const FIXTURES = [
  { name: "headings.md", label: "Headings" },
  { name: "lists.md", label: "Lists" },
  { name: "blockquotes.md", label: "Blockquotes" },
  { name: "links.md", label: "Links" },
  { name: "bold-asterisks.md", label: "Bold (**)" },
  { name: "bold-underscores.md", label: "Bold (__)" },
  { name: "italic-asterisks.md", label: "Italic (*)" },
  { name: "italic-underscores.md", label: "Italic (_)" },
  { name: "nested-formatting.md", label: "Nested" },
  { name: "edge-cases.md", label: "Edge Cases" },
  { name: "strikethrough.md", label: "Strikethrough" },
  { name: "inline-code.md", label: "Inline Code" },
  { name: "highlight.md", label: "Highlight" },
  { name: "mixed-formatting.md", label: "Mixed" },
  { name: "cursor-positions.md", label: "Cursor Tests" },
];

function App() {
  const [selectedFixture, setSelectedFixture] = useState(FIXTURES[0].name);
  const [fixtureContent, setFixtureContent] = useState("");
  const [hidesSyntax, setHidesSyntax] = useState(true);
  const [currentContent, setCurrentContent] = useState("");
  const [loading, setLoading] = useState(true);

  // Load fixture content
  useEffect(() => {
    setLoading(true);
    fetch(`/experiments/codemirror/fixtures/${selectedFixture}`)
      .then((res) => res.text())
      .then((content) => {
        setFixtureContent(content);
        setCurrentContent(content);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load fixture:", err);
        setFixtureContent(`# Error\n\nFailed to load fixture: ${selectedFixture}`);
        setLoading(false);
      });
  }, [selectedFixture]);

  // Check if content has drifted from original
  const hasDrift = currentContent !== fixtureContent;

  return (
    <div className="harness">
      <LinkEditorPopup />
      <header className="harness-header">
        <h1>CodeMirror Experiment 1: Hidden Syntax</h1>
        <p>Test that text remains editable when syntax markers are hidden (no atomicRanges)</p>
      </header>

      <div className="harness-controls">
        <div className="control-group">
          <label>Fixture:</label>
          <select
            value={selectedFixture}
            onChange={(e) => setSelectedFixture(e.target.value)}
          >
            {FIXTURES.map((f) => (
              <option key={f.name} value={f.name}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={hidesSyntax}
              onChange={(e) => setHidesSyntax(e.target.checked)}
            />
            Hide syntax markers
          </label>
        </div>

        <div className="control-group">
          <button onClick={() => setCurrentContent(fixtureContent)}>
            Reset to Original
          </button>
        </div>

        {hasDrift && (
          <div className="drift-warning">
            ⚠️ Content modified from original
          </div>
        )}
      </div>

      <div className="harness-content">
        <div className="editor-panel">
          <h2>Editor {hidesSyntax ? "(WYSIWYG)" : "(Raw)"}</h2>
          {!loading && (
            <Editor
              key={`${selectedFixture}-${hidesSyntax}`}
              initialContent={fixtureContent}
              hidesSyntax={hidesSyntax}
              onChange={setCurrentContent}
            />
          )}
        </div>

        <div className="source-panel">
          <h2>Raw Markdown</h2>
          <pre className="source-content">{currentContent}</pre>
        </div>
      </div>

      <div className="harness-tests">
        <h2>Manual Tests</h2>

        <h3>Basic Editing</h3>
        <ul>
          <li>
            <strong>Cursor movement:</strong> Can you move cursor through formatted text with arrow keys?
          </li>
          <li>
            <strong>Typing:</strong> Can you type inside bold/italic text?
          </li>
          <li>
            <strong>Selection:</strong> Can you select formatted text and delete it?
          </li>
          <li>
            <strong>Backspace:</strong> Does backspace work at the start of formatted text?
          </li>
          <li>
            <strong>Delete:</strong> Does delete work at the end of formatted text?
          </li>
          <li>
            <strong>Undo/Redo:</strong> Does Cmd+Z / Cmd+Shift+Z work correctly?
          </li>
        </ul>

        <h3>Auto-Close Markers (NEW)</h3>
        <p>When typing formatting markers, they auto-pair like IDE brackets:</p>
        <ul>
          <li>
            <strong>Type *:</strong> Creates <code>*|*</code> (cursor in middle)
          </li>
          <li>
            <strong>Type * again:</strong> Upgrades to <code>**|**</code> (bold)
          </li>
          <li>
            <strong>Type `:</strong> Creates <code>`|`</code> (inline code)
          </li>
          <li>
            <strong>Type ~~:</strong> Creates <code>~~|~~</code> (strikethrough - requires two tildes)
          </li>
        </ul>

        <h3>Escape Formatting (NEW)</h3>
        <p>When cursor is at end of formatted text (e.g., <code>**bold text|**</code>):</p>
        <ul>
          <li>
            <strong>Tab:</strong> Press Tab to escape any formatting
          </li>
          <li>
            <strong>Cmd+B:</strong> Press Cmd+B at end of bold to escape
          </li>
          <li>
            <strong>Cmd+I:</strong> Press Cmd+I at end of italic to escape
          </li>
          <li>
            <strong>Type **:</strong> Type ** at end of bold to escape
          </li>
          <li>
            <strong>Type *:</strong> Type * at end of italic to escape
          </li>
          <li>
            <strong>Type `:</strong> Type ` at end of inline code to escape
          </li>
          <li>
            <strong>Type ~~:</strong> Type ~~ at end of strikethrough to escape
          </li>
        </ul>

        <h3>Headings (NEW)</h3>
        <p>Headings are created by typing # at the start of a line:</p>
        <ul>
          <li>
            <strong>Create h1:</strong> Type # at start of empty line
          </li>
          <li>
            <strong>Upgrade heading:</strong> At start of heading content, type # to upgrade (h1 → h2, etc.)
          </li>
          <li>
            <strong>Demote heading:</strong> At start of heading content, press Backspace to demote (h2 → h1 → paragraph)
          </li>
          <li>
            <strong>Max level:</strong> h6 is the maximum (######)
          </li>
          <li>
            <strong>Styling:</strong> Each heading level has distinct font size and weight
          </li>
        </ul>

        <h3>Lists (NEW)</h3>
        <p>Lists are created by typing - or 1. at the start of a line:</p>
        <ul>
          <li>
            <strong>Create unordered:</strong> Type - + space at start of line
          </li>
          <li>
            <strong>Create ordered:</strong> Type 1. + space at start of line
          </li>
          <li>
            <strong>Auto-continue:</strong> Enter at end of list item creates new item
          </li>
          <li>
            <strong>Exit list:</strong> Enter on empty list item exits list
          </li>
          <li>
            <strong>Indent:</strong> Tab indents list item (nested list)
          </li>
          <li>
            <strong>Outdent:</strong> Shift+Tab outdents list item
          </li>
          <li>
            <strong>Remove:</strong> Backspace at start of list item removes marker
          </li>
        </ul>

        <h3>Links (NEW)</h3>
        <p>Links display styled text with hidden URL syntax:</p>
        <ul>
          <li>
            <strong>Display:</strong> Link text shows styled (blue, underlined), URL hidden
          </li>
          <li>
            <strong>Auto-close:</strong> Type [ to create [|]() (cursor in text position)
          </li>
          <li>
            <strong>Navigation:</strong> Arrow keys skip over hidden ](url) portion
          </li>
          <li>
            <strong>Create with Cmd+K:</strong> Select text, press Cmd+K to wrap in link
          </li>
          <li>
            <strong>Edit with Cmd+K:</strong> Place cursor in link, press Cmd+K to edit URL
          </li>
          <li>
            <strong>Backspace at start:</strong> Removes link syntax, keeps text
          </li>
          <li>
            <strong>Backspace after link:</strong> Deletes last char of link text
          </li>
        </ul>
      </div>

      <style>{`
        .harness {
          font-family: system-ui, -apple-system, sans-serif;
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
        }

        .harness-header {
          margin-bottom: 20px;
        }

        .harness-header h1 {
          margin: 0 0 8px 0;
          font-size: 24px;
        }

        .harness-header p {
          margin: 0;
          color: #666;
        }

        .harness-controls {
          display: flex;
          gap: 20px;
          align-items: center;
          padding: 12px 16px;
          background: #f5f5f5;
          border-radius: 8px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .control-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .control-group label {
          font-weight: 500;
        }

        .control-group select {
          padding: 6px 12px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 14px;
        }

        .control-group button {
          padding: 6px 12px;
          background: #007aff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .control-group button:hover {
          background: #0066dd;
        }

        .drift-warning {
          background: #fff3cd;
          color: #856404;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 14px;
        }

        .harness-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .editor-panel, .source-panel {
          border: 1px solid #ddd;
          border-radius: 8px;
          overflow: hidden;
        }

        .editor-panel h2, .source-panel h2 {
          margin: 0;
          padding: 12px 16px;
          background: #f9f9f9;
          border-bottom: 1px solid #ddd;
          font-size: 14px;
          font-weight: 600;
        }

        .editor-container {
          min-height: 400px;
        }

        .editor-container .cm-editor {
          height: 400px;
          overflow: auto;
        }

        .source-content {
          margin: 0;
          padding: 16px;
          font-family: monospace;
          font-size: 14px;
          white-space: pre-wrap;
          word-break: break-word;
          height: 400px;
          overflow: auto;
          background: #fafafa;
        }

        .harness-tests {
          background: #f0f7ff;
          padding: 16px;
          border-radius: 8px;
        }

        .harness-tests h2 {
          margin: 0 0 12px 0;
          font-size: 16px;
        }

        .harness-tests ul {
          margin: 0;
          padding-left: 20px;
        }

        .harness-tests li {
          margin-bottom: 8px;
        }

        /* Link Editor Popup */
        .link-editor-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .link-editor-popup {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
          min-width: 400px;
        }

        .link-editor-header {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 12px;
        }

        .link-editor-text {
          font-size: 14px;
          color: #666;
          margin-bottom: 12px;
        }

        .link-editor-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 14px;
          margin-bottom: 16px;
          box-sizing: border-box;
        }

        .link-editor-input:focus {
          outline: none;
          border-color: #007aff;
          box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2);
        }

        .link-editor-buttons {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .link-editor-button {
          padding: 8px 16px;
          border: 1px solid #ccc;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          font-size: 14px;
        }

        .link-editor-button:hover {
          background: #f5f5f5;
        }

        .link-editor-button.primary {
          background: #007aff;
          color: white;
          border-color: #007aff;
        }

        .link-editor-button.primary:hover {
          background: #0066dd;
        }

        .link-editor-button.danger {
          color: #dc3545;
          border-color: #dc3545;
        }

        .link-editor-button.danger:hover {
          background: #fff5f5;
        }
      `}</style>
    </div>
  );
}

// ===========================================
// BOOTSTRAP
// ===========================================

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}

export { App };

// ===========================================
// EXPORTS FOR TESTING
// ===========================================

export {
  // Extensions
  formattingEscapeKeymap,
  formattingInputHandler,
  hiddenSyntaxField,
  pendingFormattingField,
  pendingFormatTheme,
  cursorGuard,
  styleField,
  theme,

  // Blockquote handlers
  handleEnterInBlockquote,
  handleBackspaceInBlockquote,
  handleArrowLeftFromBlockquoteStart,
  handleArrowRightIntoBlockquote,
  getBlockquoteInfo,

  // List handlers
  handleEnterInList,
  handleBackspaceInList,
  handleTabInList,
  handleShiftTabInList,
  handleArrowLeftFromListStart,
  handleArrowRightIntoList,
  getListInfo,
  getNextOrderNumber,
  isAtListContentStart,

  // Heading handlers
  handleArrowRightIntoHeading,
  handleArrowLeftFromHeadingStart,
  handleBackspaceAtHeadingStart,
  getLineContentStart,
  getLineContentLength,

  // Navigation handlers
  handleArrowRight,
  handleArrowRightAtEnd,
  handleArrowLeft,
  handleArrowLeftAtStart,
  handleArrowRightOverBlankLines,
  handleArrowLeftOverBlankLines,
  handleArrowUp,
  handleArrowDown,

  // Enter/Delete handlers
  handleEnter,
  handleShiftEnter,
  handleDeleteAtEndOfLine,
  handleDeleteAtLineStart,
  handleDeleteEmptyFormatting,
  handleDeleteAtOpeningMarker,
  handleDeleteAtEndOfContent,
  handleDeleteWithSelection,

  // Backspace handlers
  handleBackspaceAtClosingMarker,
  handleBackspaceAtParagraphStart,

  // Formatting handlers
  toggleBoldOrEscape,
  toggleItalicOrEscape,
  escapeFormatting,

  // Link handlers
  handleArrowRightFromLinkText,
  handleArrowLeftAfterLink,
  handleArrowLeftFromLinkTextStart,
  handleArrowRightIntoLink,
  handleBackspaceAfterLink,
  handleBackspaceAtLinkTextStart,
  handleDeleteAtLinkTextEnd,
  handleLinkCommand,

  // Link utilities
  getLinkContext,
  getLinkContextAfterClosing,
  isAtEndOfLinkText,
  isAtStartOfLinkText,
  isInHiddenLinkPortion,

  // Link editor state
  openLinkEditor,
  closeLinkEditor,
  applyLink,
  removeLink,
  subscribeLinkEditor,

  // Utility functions
  getFormattingContext,
  getFormattingContextAfterClosing,
  getFormattingContextBeforeOpening,
  getContentStartForLine,
  isAtEndOfFormatting,
  getPendingFormat,

  // Types
  type FormattingContext,
  type LinkContext,
};
