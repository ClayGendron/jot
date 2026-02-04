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
import { EditorState, StateField, RangeSetBuilder, EditorSelection } from "@codemirror/state";
import { EditorView, Decoration, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxTree } from "@codemirror/language";
import { GFM } from "@lezer/markdown";

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
 * Handle Delete at end of line before heading - merge heading into current line
 */
function handleDeleteBeforeHeading(view: EditorView): boolean {
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
      // Found content line - check if it's a heading
      const headingMatch = targetLine.text.match(/^(#{1,6})\s/);
      const targetContentStart = headingMatch
        ? targetLine.from + headingMatch[0].length
        : targetLine.from;

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
  // Backspace: handle paragraph merging, headings, empty formatting, selection, then skip over invisible closing markers
  {
    key: "Backspace",
    run: (view) => handleBackspaceAtParagraphStart(view) || handleBackspaceAtHeadingStart(view) || handleDeleteEmptyFormatting(view) || handleDeleteWithSelection(view) || handleBackspaceAtClosingMarker(view),
  },
  // Delete: handle end of line (merge with content below), empty formatting, selection, then skip over invisible markers
  {
    key: "Delete",
    run: (view) => handleDeleteBeforeHeading(view) || handleDeleteEmptyFormatting(view) || handleDeleteWithSelection(view) || handleDeleteAtOpeningMarker(view) || handleDeleteAtEndOfContent(view),
  },
  // Arrow Right: skip over invisible markers, heading markers, and blank lines
  {
    key: "ArrowRight",
    run: (view) => handleArrowRight(view) || handleArrowRightAtEnd(view) || handleArrowRightIntoHeading(view) || handleArrowRightOverBlankLines(view),
  },
  // Arrow Left: skip over invisible markers, heading markers, and blank lines
  {
    key: "ArrowLeft",
    run: (view) => handleArrowLeft(view) || handleArrowLeftAtStart(view) || handleArrowLeftFromHeadingStart(view) || handleArrowLeftOverBlankLines(view),
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
  // Tab: escape any formatting
  {
    key: "Tab",
    run: escapeFormatting,
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

    // Debug: log all input
    console.log("[INPUT]", { text, from, to, prevChar, nextChar, doc: doc.toString() });

    // ===========================================
    // HANDLE PENDING ESCAPE (second char of sequence)
    // ===========================================

    if (pendingEscape) {
      const pending = pendingEscape;
      clearPendingEscape();

      console.log("[PENDING ESCAPE]", {
        text,
        from,
        pendingChar: pending.char,
        pendingPos: pending.pos,
        formattingEnd: pending.formattingEnd,
        matches: text === pending.char && from === pending.pos
      });

      // Check if this completes the escape sequence
      // Allow for position to be off by a small amount due to potential race conditions
      if (text === pending.char && Math.abs(from - pending.pos) <= 1) {
        // Second char matches! Complete the escape
        console.log("[PENDING ESCAPE] Completing escape, moving to", pending.formattingEnd);
        view.dispatch({
          selection: { anchor: pending.formattingEnd },
          scrollIntoView: true,
        });
        return true;
      } else {
        // Different char or position - insert the pending char first, then handle this one
        console.log("[PENDING ESCAPE] Failed match, inserting pending char");
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
    const cursorPos = view.state.selection.main.head;
    console.log("[ESCAPE] Context check:", {
      ctx,
      text,
      cursorPos,
      isAtEnd: ctx ? isAtEndOfFormatting(view.state, ctx) : null,
      contentTo: ctx?.contentTo,
      docSlice: view.state.doc.sliceString(Math.max(0, cursorPos - 5), cursorPos + 5)
    });

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
    }

    console.log("[INPUT] Returning false, letting CodeMirror handle");
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
 * Uses BOTH parser AND regex fallback to hide markers the parser misses.
 */
function buildHiddenSyntax(state: EditorState) {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = state.doc;

  // Track ranges we've already hidden
  const hiddenRanges: Array<{ from: number; to: number }> = [];

  syntaxTree(state).iterate({
    enter(node) {
      // Hide emphasis marks (* or _)
      if (node.name === "EmphasisMark") {
        builder.add(node.from, node.to, hiddenDecoration);
        hiddenRanges.push({ from: node.from, to: node.to });
      }

      // Hide code marks (`)
      if (node.name === "CodeMark") {
        builder.add(node.from, node.to, hiddenDecoration);
        hiddenRanges.push({ from: node.from, to: node.to });
      }

      // For strikethrough, we need to find the ~~ markers
      if (node.name === "StrikethroughMark") {
        builder.add(node.from, node.to, hiddenDecoration);
        hiddenRanges.push({ from: node.from, to: node.to });
      }

      // Hide header marks (# symbols and trailing space)
      if (node.name === "HeaderMark") {
        // Hide the # symbols
        builder.add(node.from, node.to, hiddenDecoration);
        hiddenRanges.push({ from: node.from, to: node.to });

        // Also hide the trailing space after the header mark
        const nextChar = doc.sliceString(node.to, node.to + 1);
        if (nextChar === " ") {
          builder.add(node.to, node.to + 1, hiddenDecoration);
          hiddenRanges.push({ from: node.to, to: node.to + 1 });
        }
      }
    },
  });

  // ===========================================
  // REGEX FALLBACK: Hide markers the parser misses
  // ===========================================

  const text = doc.toString();

  const isAlreadyHidden = (from: number, to: number) =>
    hiddenRanges.some((r) => r.from === from && r.to === to);

  // Bold markers: **
  const boldRegex = /\*\*(.+?)\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(text)) !== null) {
    const openFrom = match.index;
    const openTo = match.index + 2;
    const closeFrom = match.index + 2 + match[1].length;
    const closeTo = closeFrom + 2;

    if (!isAlreadyHidden(openFrom, openTo)) {
      builder.add(openFrom, openTo, hiddenDecoration);
    }
    if (!isAlreadyHidden(closeFrom, closeTo)) {
      builder.add(closeFrom, closeTo, hiddenDecoration);
    }
  }

  // Italic markers: * (but not **)
  const italicRegex = /(?<!\*)\*([^*]+?)\*(?!\*)/g;
  while ((match = italicRegex.exec(text)) !== null) {
    const openFrom = match.index;
    const openTo = match.index + 1;
    const closeFrom = match.index + 1 + match[1].length;
    const closeTo = closeFrom + 1;

    if (!isAlreadyHidden(openFrom, openTo)) {
      builder.add(openFrom, openTo, hiddenDecoration);
    }
    if (!isAlreadyHidden(closeFrom, closeTo)) {
      builder.add(closeFrom, closeTo, hiddenDecoration);
    }
  }

  // Strikethrough markers: ~~
  const strikeRegex = /~~(.+?)~~/g;
  while ((match = strikeRegex.exec(text)) !== null) {
    const openFrom = match.index;
    const openTo = match.index + 2;
    const closeFrom = match.index + 2 + match[1].length;
    const closeTo = closeFrom + 2;

    if (!isAlreadyHidden(openFrom, openTo)) {
      builder.add(openFrom, openTo, hiddenDecoration);
    }
    if (!isAlreadyHidden(closeFrom, closeTo)) {
      builder.add(closeFrom, closeTo, hiddenDecoration);
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
 * Extension that ensures cursor can never be inside heading markers.
 * If cursor ends up at line.from of a heading, move it to content start.
 */
const cursorGuard = EditorView.updateListener.of((update) => {
  if (!update.selectionSet) return;

  const state = update.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  // Check if this is a heading line
  const headingMatch = line.text.match(/^(#{1,6})\s/);
  if (!headingMatch) return;

  const contentStart = line.from + headingMatch[0].length;

  // If cursor is before content start, move it
  if (pos < contentStart) {
    // Use requestAnimationFrame to avoid dispatch during update
    requestAnimationFrame(() => {
      update.view.dispatch({
        selection: { anchor: contentStart },
      });
    });
  }
});

// ===========================================
// STYLING DECORATIONS
// ===========================================

const boldMark = Decoration.mark({ class: "cm-strong" });
const italicMark = Decoration.mark({ class: "cm-em" });
const codeMark = Decoration.mark({ class: "cm-inline-code" });
const strikethroughMark = Decoration.mark({ class: "cm-strikethrough" });

// Heading marks for different levels
const h1Mark = Decoration.mark({ class: "cm-h1" });
const h2Mark = Decoration.mark({ class: "cm-h2" });
const h3Mark = Decoration.mark({ class: "cm-h3" });
const h4Mark = Decoration.mark({ class: "cm-h4" });
const h5Mark = Decoration.mark({ class: "cm-h5" });
const h6Mark = Decoration.mark({ class: "cm-h6" });

/**
 * Build style decorations (bold, italic, etc.)
 * These mark the content (not the syntax) with styling classes
 *
 * Uses BOTH parser nodes AND regex fallback to catch cases the parser misses
 * (like trailing whitespace: **bold **)
 */
function buildStyleDecorations(state: EditorState) {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = state.doc;

  // Track ranges we've already decorated (to avoid duplicates from regex fallback)
  const decoratedRanges: Array<{ from: number; to: number }> = [];

  syntaxTree(state).iterate({
    enter(node) {
      // Strong (bold) - style the content between markers
      if (node.name === "StrongEmphasis") {
        // Find content range (skip the markers)
        const content = node.node;
        let contentFrom = node.from;
        let contentTo = node.to;

        // Walk children to find actual content bounds
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
          builder.add(contentFrom, contentTo, boldMark);
          decoratedRanges.push({ from: contentFrom, to: contentTo });
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
          builder.add(contentFrom, contentTo, italicMark);
          decoratedRanges.push({ from: contentFrom, to: contentTo });
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
          builder.add(contentFrom, contentTo, codeMark);
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
          builder.add(contentFrom, contentTo, strikethroughMark);
          decoratedRanges.push({ from: contentFrom, to: contentTo });
        }
      }

      // ATX Headings (# through ######)
      if (node.name === "ATXHeading1" || node.name === "ATXHeading2" ||
          node.name === "ATXHeading3" || node.name === "ATXHeading4" ||
          node.name === "ATXHeading5" || node.name === "ATXHeading6") {
        // Find the HeaderMark to get content start
        let contentFrom = node.from;
        const content = node.node;

        content.cursor().iterate((child) => {
          if (child.name === "HeaderMark") {
            // Content starts after the HeaderMark (includes trailing space)
            contentFrom = child.to;
          }
        });

        // Skip any whitespace after the header mark
        const text = state.doc.sliceString(contentFrom, node.to);
        const leadingSpace = text.match(/^\s*/)?.[0].length || 0;
        contentFrom += leadingSpace;

        // Get the appropriate mark based on heading level
        const level = parseInt(node.name.replace("ATXHeading", ""));
        const headingMark = level === 1 ? h1Mark :
                           level === 2 ? h2Mark :
                           level === 3 ? h3Mark :
                           level === 4 ? h4Mark :
                           level === 5 ? h5Mark : h6Mark;

        // Style the content (not the # markers)
        if (contentFrom < node.to) {
          builder.add(contentFrom, node.to, headingMark);
        }
      }
    },
  });

  // ===========================================
  // REGEX FALLBACK: Catch formatting the parser misses
  // (e.g., trailing whitespace like **bold **)
  // ===========================================

  const text = doc.toString();

  // Helper to check if a range overlaps with already-decorated ranges
  const isAlreadyDecorated = (from: number, to: number) =>
    decoratedRanges.some((r) => !(to <= r.from || from >= r.to));

  // Bold: **...**  (allowing whitespace before closing)
  const boldRegex = /\*\*(.+?)\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(text)) !== null) {
    const contentFrom = match.index + 2;
    const contentTo = match.index + 2 + match[1].length;
    if (!isAlreadyDecorated(contentFrom, contentTo) && contentFrom < contentTo) {
      builder.add(contentFrom, contentTo, boldMark);
    }
  }

  // Italic: *...* (but not **)
  const italicRegex = /(?<!\*)\*([^*]+?)\*(?!\*)/g;
  while ((match = italicRegex.exec(text)) !== null) {
    const contentFrom = match.index + 1;
    const contentTo = match.index + 1 + match[1].length;
    if (!isAlreadyDecorated(contentFrom, contentTo) && contentFrom < contentTo) {
      builder.add(contentFrom, contentTo, italicMark);
    }
  }

  // Strikethrough: ~~...~~
  const strikeRegex = /~~(.+?)~~/g;
  while ((match = strikeRegex.exec(text)) !== null) {
    const contentFrom = match.index + 2;
    const contentTo = match.index + 2 + match[1].length;
    if (!isAlreadyDecorated(contentFrom, contentTo) && contentFrom < contentTo) {
      builder.add(contentFrom, contentTo, strikethroughMark);
    }
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
      // Formatting escape keymap BEFORE default keymap (higher priority)
      formattingEscapeKeymap,
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
