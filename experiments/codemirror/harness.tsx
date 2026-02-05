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
import { EditorView, Decoration, keymap, WidgetType, rectangularSelection } from "@codemirror/view";
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
// HORIZONTAL RULE WIDGET
// ===========================================

/**
 * Widget that renders a horizontal rule (---, ***, ___)
 * Replaces the raw syntax with a visual hr element
 */
class HorizontalRuleWidget extends WidgetType {
  toDOM() {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-horizontal-rule";

    const line = document.createElement("hr");
    line.className = "cm-horizontal-rule-line";

    wrapper.appendChild(line);
    return wrapper;
  }

  eq(_other: HorizontalRuleWidget) {
    return true; // All HRs are identical
  }
}

// ===========================================
// CODE BLOCK FENCE WIDGET
// ===========================================

/**
 * Widget that renders the opening fence of a code block (```language)
 * Shows a language badge, the content remains editable inline
 */
class CodeBlockOpenWidget extends WidgetType {
  constructor(readonly language: string) {
    super();
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-code-block-open";

    const badge = document.createElement("span");
    badge.className = "cm-code-block-lang-badge";
    badge.textContent = this.language || "code";
    span.appendChild(badge);

    return span;
  }

  eq(other: CodeBlockOpenWidget) {
    return other.language === this.language;
  }
}

/**
 * Widget that renders the closing fence of a code block (```)
 * Shows a subtle end indicator
 */
class CodeBlockCloseWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-code-block-close";
    // Empty - just provides visual spacing/boundary
    return span;
  }

  eq(_other: CodeBlockCloseWidget) {
    return true;
  }
}

// ===========================================
// CODE BLOCK HELPERS
// ===========================================

/**
 * Regex to match fenced code block start: ```language
 */
const CODE_FENCE_REGEX = /^(`{3,})(\w*)$/;

/**
 * Check if a line is the start of a fenced code block
 */
function isCodeFenceStart(lineText: string): { fence: string; language: string } | null {
  const match = lineText.match(CODE_FENCE_REGEX);
  if (match) {
    return { fence: match[1], language: match[2] || "" };
  }
  return null;
}

/**
 * Get code block range if cursor is on a code block line
 * Returns the from/to positions of the entire code block
 */
function getCodeBlockAtLine(
  state: EditorState,
  lineNum: number
): { from: number; to: number; code: string; language: string } | null {
  const doc = state.doc;
  const totalLines = doc.lines;

  // First, check if this line is a code fence
  const line = doc.line(lineNum);
  const fenceStart = isCodeFenceStart(line.text);

  if (fenceStart) {
    // This is a fence start - find the closing fence
    const fence = fenceStart.fence;
    for (let i = lineNum + 1; i <= totalLines; i++) {
      const checkLine = doc.line(i);
      if (checkLine.text.startsWith(fence)) {
        // Found closing fence
        const codeLines: string[] = [];
        for (let j = lineNum + 1; j < i; j++) {
          codeLines.push(doc.line(j).text);
        }
        return {
          from: line.from,
          to: checkLine.to,
          code: codeLines.join("\n"),
          language: fenceStart.language,
        };
      }
    }
    // No closing fence found
    return null;
  }

  // Check if this line is inside a code block
  // by searching backwards for an opening fence
  for (let i = lineNum - 1; i >= 1; i--) {
    const checkLine = doc.line(i);
    const maybeFence = isCodeFenceStart(checkLine.text);
    if (maybeFence) {
      // Found a potential opening fence, now find its closing
      const fence = maybeFence.fence;
      for (let j = i + 1; j <= totalLines; j++) {
        const closeLine = doc.line(j);
        if (closeLine.text.startsWith(fence)) {
          // Check if our target line is within this range
          if (lineNum > i && lineNum <= j) {
            // We're inside this code block
            const codeLines: string[] = [];
            for (let k = i + 1; k < j; k++) {
              codeLines.push(doc.line(k).text);
            }
            return {
              from: checkLine.from,
              to: closeLine.to,
              code: codeLines.join("\n"),
              language: maybeFence.language,
            };
          }
          // This block closes before our line, continue searching
          break;
        }
      }
    }
  }

  return null;
}

/**
 * Handle Backspace when cursor is at start of line after a code block
 * Delete the entire code block
 */
function handleBackspaceAfterCodeBlock(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  // Must have no selection
  if (!state.selection.main.empty) return false;

  // Must be at start of line
  if (pos !== line.from) return false;

  // Must not be first line
  if (line.number <= 1) return false;

  // Check if previous line is the end of a code block
  const prevLine = state.doc.line(line.number - 1);
  if (prevLine.text.match(/^`{3,}$/)) {
    // Find the opening fence
    for (let i = line.number - 2; i >= 1; i--) {
      const checkLine = state.doc.line(i);
      if (isCodeFenceStart(checkLine.text)) {
        // Verify this is the matching opener
        const codeBlock = getCodeBlockAtLine(state, i);
        if (codeBlock && state.doc.lineAt(codeBlock.to).number === line.number - 1) {
          // Delete the entire code block
          view.dispatch({
            changes: { from: codeBlock.from, to: line.from, insert: "" },
            selection: { anchor: codeBlock.from },
            scrollIntoView: true,
          });
          return true;
        }
        break;
      }
    }
  }

  return false;
}

/**
 * Handle Delete when cursor is at end of line before a code block
 * Delete the entire code block
 */
function handleDeleteBeforeCodeBlock(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  // Must have no selection
  if (!state.selection.main.empty) return false;

  // Must be at end of line
  if (pos !== line.to) return false;

  // Must not be last line
  if (line.number >= state.doc.lines) return false;

  // Check if next line starts a code block
  const nextLine = state.doc.line(line.number + 1);
  if (isCodeFenceStart(nextLine.text)) {
    const codeBlock = getCodeBlockAtLine(state, line.number + 1);
    if (codeBlock) {
      // Delete the newline and the entire code block
      view.dispatch({
        changes: { from: line.to, to: codeBlock.to, insert: "" },
        scrollIntoView: true,
      });
      return true;
    }
  }

  return false;
}

// ===========================================
// TASK LIST CHECKBOX WIDGET
// ===========================================

/**
 * Widget that renders an interactive checkbox for task list items
 * Handles click events to toggle between [ ] and [x]
 */
class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly pos: number
  ) {
    super();
  }

  toDOM(view: EditorView) {
    const span = document.createElement("span");
    span.className = "cm-task-checkbox";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = this.checked;
    checkbox.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleTaskCheckbox(view, this.pos, this.checked);
    });

    span.appendChild(checkbox);
    return span;
  }

  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.pos === this.pos;
  }

  ignoreEvent() {
    return true;
  }
}

/**
 * Toggle a task checkbox between [ ] and [x] states
 */
function toggleTaskCheckbox(
  view: EditorView,
  markerPos: number,
  currentlyChecked: boolean
): void {
  const newMarker = currentlyChecked ? "[ ]" : "[x]";
  view.dispatch({
    changes: { from: markerPos, to: markerPos + 3, insert: newMarker },
  });
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
    result = findLinkByRegex(state, (from, to) => pos >= from && pos <= to);
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
 * Shared regex-based link finder. Returns the first LinkContext whose position
 * satisfies the given predicate, or null.
 */
function findLinkByRegex(
  state: EditorState,
  predicate: (from: number, to: number) => boolean,
): LinkContext | null {
  const text = state.doc.toString();
  const linkRegex = /\[([^\]]*)]\(([^)]*)\)/g;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    const from = match.index;
    const to = match.index + match[0].length;

    if (predicate(from, to)) {
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
 * Find link context when cursor is right after the closing )
 */
function getLinkContextAfterClosing(state: EditorState): LinkContext | null {
  const pos = state.selection.main.head;
  return findLinkByRegex(state, (_from, to) => pos === to);
}

/**
 * Shared AST walk for formatting contexts.
 * Each formatting node type uses the same logic — only the position predicate differs.
 */
const FORMATTING_NODE_TYPES: Array<{
  nodeName: string;
  markName: string;
  type: FormattingContext["type"];
}> = [
  { nodeName: "StrongEmphasis", markName: "EmphasisMark", type: "strong" },
  { nodeName: "Emphasis", markName: "EmphasisMark", type: "emphasis" },
  { nodeName: "InlineCode", markName: "CodeMark", type: "code" },
  { nodeName: "Strikethrough", markName: "StrikethroughMark", type: "strikethrough" },
];

function findFormattingByAST(
  state: EditorState,
  predicate: (nodeFrom: number, nodeTo: number) => boolean,
): FormattingContext | null {
  let result: FormattingContext | null = null;

  syntaxTree(state).iterate({
    enter(node) {
      for (const ft of FORMATTING_NODE_TYPES) {
        if (node.name === ft.nodeName && predicate(node.from, node.to)) {
          const markers: { from: number; to: number }[] = [];
          node.node.cursor().iterate((child) => {
            if (child.name === ft.markName) {
              markers.push({ from: child.from, to: child.to });
            }
          });
          if (markers.length >= 2) {
            result = {
              type: ft.type,
              from: node.from,
              to: node.to,
              contentFrom: markers[0].to,
              contentTo: markers[markers.length - 1].from,
              closingMarkerFrom: markers[markers.length - 1].from,
              closingMarkerTo: markers[markers.length - 1].to,
            };
          }
        }
      }
    },
  });

  return result;
}

/**
 * Find the formatting context at cursor position
 * Returns info about the formatted region if cursor is inside one
 */
function getFormattingContext(state: EditorState): FormattingContext | null {
  const pos = state.selection.main.head;
  return findFormattingByAST(state, (from, to) => pos >= from && pos < to);
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

// Zero-width space used for strikethrough to prevent Lezer parsing issues
const ZWSP = "\u200B";

/**
 * Generic helper to remove formatting markers, preserving content
 * @param stripZWSP - If true, removes ZWSP characters (for strikethrough)
 */
function removeFormatting(view: EditorView, ctx: FormattingContext, stripZWSP = false): boolean {
  let content = view.state.doc.sliceString(ctx.contentFrom, ctx.contentTo);
  if (stripZWSP) {
    content = content.replace(new RegExp(ZWSP, "g"), "");
  }
  const cursorOffset = view.state.selection.main.head - ctx.contentFrom;

  view.dispatch({
    changes: { from: ctx.from, to: ctx.to, insert: content },
    selection: { anchor: ctx.from + Math.max(0, Math.min(cursorOffset, content.length)) },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Generic helper to wrap selection in formatting markers
 */
function wrapSelectionInMarkers(
  view: EditorView,
  from: number,
  to: number,
  openMarker: string,
  closeMarker: string
): boolean {
  const selectedText = view.state.doc.sliceString(from, to);
  view.dispatch({
    changes: { from, to, insert: `${openMarker}${selectedText}${closeMarker}` },
    selection: { anchor: from + openMarker.length, head: from + openMarker.length + selectedText.length },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Generic helper to insert empty formatting markers with cursor between
 * @param content - Optional content to insert between markers (e.g., ZWSP for strikethrough)
 */
function insertEmptyMarkers(
  view: EditorView,
  pos: number,
  openMarker: string,
  closeMarker: string,
  content = ""
): boolean {
  view.dispatch({
    changes: { from: pos, to: pos, insert: `${openMarker}${content}${closeMarker}` },
    selection: { anchor: pos + openMarker.length },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Generic toggle function for inline formatting
 * Handles escape at end, remove when inside, wrap selection, or insert empty
 */
function createToggleFormatter(
  formattingType: FormattingContext["type"],
  openMarker: string,
  closeMarker: string,
  options: { stripZWSP?: boolean; emptyContent?: string } = {}
) {
  return function (view: EditorView): boolean {
    const ctx = getFormattingContext(view.state);
    const sel = view.state.selection.main;

    // If at end of this formatting type, escape
    if (ctx?.type === formattingType && isAtEndOfFormatting(view.state, ctx)) {
      return escapeFormatting(view);
    }

    // If inside this formatting type (not at end), remove formatting
    if (ctx?.type === formattingType) {
      return removeFormatting(view, ctx, options.stripZWSP);
    }

    // If has selection, wrap it
    if (!sel.empty) {
      return wrapSelectionInMarkers(view, sel.from, sel.to, openMarker, closeMarker);
    }

    // Empty cursor - insert empty markers
    return insertEmptyMarkers(view, sel.head, openMarker, closeMarker, options.emptyContent);
  };
}

// Create toggle functions using the generic factory
const toggleBoldOrEscape = createToggleFormatter("strong", "**", "**");
const toggleItalicOrEscape = createToggleFormatter("emphasis", "*", "*");
const toggleCodeOrEscape = createToggleFormatter("code", "`", "`");
const toggleStrikethroughOrEscape = createToggleFormatter("strikethrough", "~~", "~~", {
  stripZWSP: true,
  emptyContent: ZWSP,
});

/**
 * Set heading level for current line
 * - Same level: toggle off (remove heading)
 * - Different level: change to new level
 * - Plain text: add heading markers
 * - List/blockquote: don't convert (return false)
 */
function setHeadingLevel(view: EditorView, level: 1 | 2 | 3 | 4 | 5 | 6): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const lineText = line.text;

  // Don't convert list items or blockquotes
  if (getListInfo(line)) return false;
  if (getBlockquoteInfo(line)) return false;

  // Check for existing heading
  const headingMatch = lineText.match(HEADING_PREFIX_RE);

  if (headingMatch) {
    const existingLevel = headingMatch[1].length;
    const existingMarkerLength = headingMatch[0].length;
    const cursorOffsetFromContent = pos - (line.from + existingMarkerLength);

    if (existingLevel === level) {
      // Same level - toggle off (remove heading)
      view.dispatch({
        changes: { from: line.from, to: line.from + existingMarkerLength, insert: "" },
        selection: { anchor: line.from + Math.max(0, cursorOffsetFromContent) },
        scrollIntoView: true,
      });
    } else {
      // Different level - change heading level
      const newMarker = "#".repeat(level) + " ";
      view.dispatch({
        changes: { from: line.from, to: line.from + existingMarkerLength, insert: newMarker },
        selection: { anchor: line.from + newMarker.length + Math.max(0, cursorOffsetFromContent) },
        scrollIntoView: true,
      });
    }
    return true;
  }

  // Plain text - add heading
  const cursorOffsetFromLineStart = pos - line.from;
  const newMarker = "#".repeat(level) + " ";
  view.dispatch({
    changes: { from: line.from, to: line.from, insert: newMarker },
    selection: { anchor: line.from + newMarker.length + cursorOffsetFromLineStart },
    scrollIntoView: true,
  });
  return true;
}

// Heading level wrapper functions for keymap
function setHeading1(view: EditorView): boolean { return setHeadingLevel(view, 1); }
function setHeading2(view: EditorView): boolean { return setHeadingLevel(view, 2); }
function setHeading3(view: EditorView): boolean { return setHeadingLevel(view, 3); }
function setHeading4(view: EditorView): boolean { return setHeadingLevel(view, 4); }
function setHeading5(view: EditorView): boolean { return setHeadingLevel(view, 5); }
function setHeading6(view: EditorView): boolean { return setHeadingLevel(view, 6); }

/**
 * Check if cursor is right after a closing marker (for backspace handling)
 * Returns the formatting context if we're at the "invisible boundary"
 */
function getFormattingContextAfterClosing(state: EditorState): FormattingContext | null {
  const pos = state.selection.main.head;
  let result = findFormattingByAST(state, (_from, to) => pos === to);

  // Fallback: check with regex for patterns parser might miss
  if (!result) {
    const text = state.doc.toString();

    // Check for **...** pattern ending at cursor
    if (pos >= 2 && text.slice(pos - 2, pos) === "**") {
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
 * - Task lists: - [ ] or - [x] (checkbox)
 */
const LIST_MARKER_REGEX = /^(\s*)([-*+]|\d+\.)\s(\[[ xX]]\s)?/;

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
  isTask: boolean;
  isTaskChecked: boolean;
  taskMarkerStart: number | null;
} | null {
  const match = line.text.match(LIST_MARKER_REGEX);
  if (!match) return null;

  const indent = match[1];
  const marker = match[2];
  const markerWithSpace = match[0];
  const isOrdered = /^\d+\.$/.test(marker);
  const orderNumber = isOrdered ? parseInt(marker) : null;

  // Task marker detection: match[3] is the optional [ ] or [x] with trailing space
  const taskMarkerMatch = match[3];
  const isTask = !!taskMarkerMatch;
  const isTaskChecked = isTask && /\[[xX]]/.test(taskMarkerMatch);
  // Task marker position: after indent + marker + space
  const taskMarkerStart = isTask ? line.from + indent.length + marker.length + 1 : null;

  return {
    isListItem: true,
    indent,
    marker,
    markerWithSpace,
    contentStart: line.from + markerWithSpace.length,
    isOrdered,
    orderNumber,
    isTask,
    isTaskChecked,
    taskMarkerStart,
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
 * Build a new list marker string for continuing a list
 * Handles both ordered/unordered and task/regular lists
 */
function buildNewListMarker(
  listInfo: NonNullable<ReturnType<typeof getListInfo>>,
  nextNum: number
): string {
  if (listInfo.isOrdered) {
    return listInfo.isTask
      ? `${listInfo.indent}${nextNum}. [ ] `
      : `${listInfo.indent}${nextNum}. `;
  } else {
    return listInfo.isTask
      ? `${listInfo.indent}${listInfo.marker} [ ] `
      : `${listInfo.indent}${listInfo.marker} `;
  }
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
    const nextNum = getNextOrderNumber(state, line.number);
    const newMarker = buildNewListMarker(listInfo, nextNum);

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
    const nextNum = getNextOrderNumber(state, line.number);
    const newMarker = buildNewListMarker(listInfo, nextNum);

    view.dispatch({
      changes: { from: pos, to: line.to, insert: `\n${newMarker}${afterCursor}` },
      selection: { anchor: pos + 1 + newMarker.length },
      scrollIntoView: true,
    });
    return true;
  }

  // At start of content - keep marker as empty list item, move content to plain text below
  // Before: "- item\n- |content"
  // After:  "- item\n- \n\n|content"
  if (pos === listInfo.contentStart) {
    const contentText = line.text.slice(listInfo.markerWithSpace.length);
    const markerOnly = listInfo.markerWithSpace.trimEnd(); // Remove trailing space for empty item

    view.dispatch({
      changes: { from: line.from, to: line.to, insert: `${markerOnly}\n\n${contentText}` },
      selection: { anchor: line.from + markerOnly.length + 2 }, // Position at start of content
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

  const markerStart = line.from + listInfo.indent.length;

  // Check if list item content is empty
  const content = line.text.slice(listInfo.markerWithSpace.length);
  const isEmptyListItem = content.trim() === "";

  // If empty list item, just remove the marker (don't merge)
  // This handles the case: user types "-" then backspaces
  if (isEmptyListItem) {
    view.dispatch({
      changes: { from: markerStart, to: listInfo.contentStart, insert: "" },
      selection: { anchor: markerStart },
      scrollIntoView: true,
    });
    return true;
  }

  // List item has content - remove the marker, keep content as plain text
  // Before: "- item\n- |content"
  // After:  "- item\n\n|content"
  if (line.number <= 1) {
    // First line - just remove the list marker, keep content
    view.dispatch({
      changes: { from: markerStart, to: listInfo.contentStart, insert: "" },
      selection: { anchor: markerStart },
      scrollIntoView: true,
    });
    return true;
  }

  // Remove the list marker and add blank line for paragraph spacing
  // The content becomes plain text on its own line
  const prevLine = state.doc.line(line.number - 1);

  // Replace current line with blank line + content (reuse content variable from above)
  view.dispatch({
    changes: { from: prevLine.to, to: line.to, insert: `\n\n${listInfo.indent}${content}` },
    selection: { anchor: prevLine.to + 2 + listInfo.indent.length }, // Position at start of content (after indent)
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
  const headingMatch = line.text.match(HEADING_PREFIX_RE);
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

// ===========================================
// HORIZONTAL RULE HANDLERS
// ===========================================

/**
 * Regex to match heading prefix (# through ######, followed by a space)
 */
const HEADING_PREFIX_RE = /^(#{1,6})\s/;

/**
 * Collect fenced code block extents from the AST.
 * Shared by getHiddenRanges() and buildStyleDecorations() to skip code blocks.
 */
function collectCodeBlockExtents(state: EditorState): Array<{ from: number; to: number }> {
  const extents: Array<{ from: number; to: number }> = [];
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === "FencedCode") {
        extents.push({ from: node.from, to: node.to });
      }
    },
  });
  return extents;
}

function isInCodeBlock(pos: number, extents: Array<{ from: number; to: number }>): boolean {
  return extents.some((r) => pos >= r.from && pos < r.to);
}

/**
 * Regex to match horizontal rule patterns (---, ***, ___, or longer)
 */
const HR_REGEX = /^([-*_])\1{2,}\s*$/;

/**
 * Handle Backspace when cursor is at start of line after a horizontal rule
 * Delete the horizontal rule
 */
function handleBackspaceAfterHorizontalRule(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  // Must have no selection
  if (!state.selection.main.empty) return false;

  // Must be at start of line
  if (pos !== line.from) return false;

  // Must not be first line
  if (line.number <= 1) return false;

  const prevLine = state.doc.line(line.number - 1);
  if (HR_REGEX.test(prevLine.text)) {
    // Delete the HR line and the newline after it, keeping cursor on the resulting blank line
    // This preserves paragraph spacing while removing the HR
    view.dispatch({
      changes: { from: prevLine.from, to: line.from, insert: "" },
      selection: { anchor: prevLine.from },
      scrollIntoView: true,
    });
    return true;
  }

  // Also handle: cursor on blank line, previous line is blank, line before that is HR
  // This handles the case where HR was created with spacing: ---\n\n|
  if (line.text === "" && line.number > 2) {
    const prevPrevLine = state.doc.line(line.number - 2);
    if (prevLine.text === "" && HR_REGEX.test(prevPrevLine.text)) {
      // Delete the HR and the blank line after it, keep one blank line
      view.dispatch({
        changes: { from: prevPrevLine.from, to: prevLine.to + 1, insert: "" },
        selection: { anchor: prevPrevLine.from },
        scrollIntoView: true,
      });
      return true;
    }
  }

  return false;
}

/**
 * Handle Delete when cursor is at end of line before a horizontal rule
 * Delete the horizontal rule
 */
function handleDeleteBeforeHorizontalRule(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  // Must have no selection
  if (!state.selection.main.empty) return false;

  // Must be at end of line
  if (pos !== line.to) return false;

  // Must not be last line
  if (line.number >= state.doc.lines) return false;

  const nextLine = state.doc.line(line.number + 1);
  if (HR_REGEX.test(nextLine.text)) {
    // Delete the newline and the HR
    view.dispatch({
      changes: { from: line.to, to: nextLine.to, insert: "" },
      scrollIntoView: true,
    });
    return true;
  }
  return false;
}

/**
 * Get the content start position for any line (handles headings, lists, blockquotes)
 * Returns the position where actual content starts, after any markers
 */
function getContentStartForLine(line: { from: number; text: string }): number {
  // Check for heading: # ## ### etc.
  const headingMatch = line.text.match(HEADING_PREFIX_RE);
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
  const headingMatch = lineText.match(HEADING_PREFIX_RE);

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
  let result = findFormattingByAST(state, (from, _to) => pos === from);

  // Fallback: check with regex for patterns parser might miss
  if (!result) {
    const text = state.doc.toString();

    // Check for ** at cursor position (opening bold)
    if (text.slice(pos, pos + 2) === "**") {
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

// ===========================================
// LINK CONTEXT MENU STATE
// ===========================================

/**
 * State for the link context menu
 */
interface LinkContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  linkContext: LinkContext | null;
  view: EditorView | null;
}

let linkContextMenuState: LinkContextMenuState = {
  isOpen: false,
  x: 0,
  y: 0,
  linkContext: null,
  view: null,
};

/**
 * Callbacks for when context menu state changes
 */
type LinkContextMenuCallback = (state: LinkContextMenuState) => void;
const linkContextMenuCallbacks: LinkContextMenuCallback[] = [];

function subscribeLinkContextMenu(callback: LinkContextMenuCallback) {
  linkContextMenuCallbacks.push(callback);
  return () => {
    const index = linkContextMenuCallbacks.indexOf(callback);
    if (index > -1) linkContextMenuCallbacks.splice(index, 1);
  };
}

function notifyLinkContextMenuChange() {
  linkContextMenuCallbacks.forEach(cb => cb(linkContextMenuState));
}

/**
 * Open the link context menu
 */
function openLinkContextMenu(x: number, y: number, linkContext: LinkContext, view: EditorView) {
  linkContextMenuState = {
    isOpen: true,
    x,
    y,
    linkContext,
    view,
  };
  notifyLinkContextMenuChange();
}

/**
 * Close the link context menu
 */
function closeLinkContextMenu() {
  linkContextMenuState = {
    isOpen: false,
    x: 0,
    y: 0,
    linkContext: null,
    view: null,
  };
  notifyLinkContextMenuChange();
}

/**
 * Handle "Edit Link" from context menu
 */
function handleContextMenuEditLink() {
  const { view, linkContext } = linkContextMenuState;
  if (!view || !linkContext) return;

  closeLinkContextMenu();
  openLinkEditor(view, linkContext, "edit");
}

/**
 * Handle "Remove Link" from context menu
 */
function handleContextMenuRemoveLink() {
  const { view, linkContext } = linkContextMenuState;
  if (!view || !linkContext) return;

  view.dispatch({
    changes: { from: linkContext.from, to: linkContext.to, insert: linkContext.text },
    selection: { anchor: linkContext.from + linkContext.text.length },
    scrollIntoView: true,
  });

  closeLinkContextMenu();
  view.focus();
}

/**
 * Handle "Copy Link URL" from context menu
 */
function handleContextMenuCopyLink() {
  const { view, linkContext } = linkContextMenuState;
  if (!view || !linkContext) return;

  navigator.clipboard.writeText(linkContext.url).catch(() => {
    // Silently fail if clipboard access is denied
  });

  closeLinkContextMenu();
  view.focus();
}

/**
 * Handle "Open Link" from context menu
 */
function handleContextMenuOpenLink() {
  const { view, linkContext } = linkContextMenuState;
  if (!view || !linkContext) return;

  if (linkContext.url) {
    window.open(linkContext.url, "_blank", "noopener,noreferrer");
  }

  closeLinkContextMenu();
  view.focus();
}

/**
 * Get link context at a specific document position
 */
function getLinkContextAtPos(state: EditorState, pos: number): LinkContext | null {
  return findLinkByRegex(state, (from, to) => pos >= from && pos <= to);
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
 * Toggle task checkbox on current line using Mod+Enter
 * Returns false if not on a task line to allow default behavior
 */
function toggleTaskCheckboxOnLine(view: EditorView): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const listInfo = getListInfo(line);

  if (!listInfo?.isTask || listInfo.taskMarkerStart === null) return false;

  toggleTaskCheckbox(view, listInfo.taskMarkerStart, listInfo.isTaskChecked);
  return true;
}

/**
 * Check if cursor is inside a fenced code block.
 * When true, all special key handlers should be bypassed for plain text editing.
 */
function isCursorInCodeBlock(view: EditorView): boolean {
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  return getCodeBlockAtLine(view.state, line.number) !== null;
}

/**
 * Wrap a keymap handler to bypass it when cursor is inside a code block.
 * Returns false (letting default behavior handle the key) when inside a code block.
 */
function bypassInCodeBlock(handler: (view: EditorView) => boolean): (view: EditorView) => boolean {
  return (view) => isCursorInCodeBlock(view) ? false : handler(view);
}

/**
 * Event filter for rectangular selection: only allow inside code blocks.
 * Uses Alt+drag (default) and checks the target position against code block ranges.
 */
function isRectangularSelectionInCodeBlock(event: MouseEvent): boolean {
  if (!event.altKey || event.button !== 0) return false;
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  const view = EditorView.findFromDOM(target);
  if (!view) return false;
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
  if (pos == null) return false;
  const line = view.state.doc.lineAt(pos);
  return getCodeBlockAtLine(view.state, line.number) !== null;
}

const codeBlockRectangularSelection = rectangularSelection({
  eventFilter: isRectangularSelectionInCodeBlock,
});

/**
 * Handle Tab inside a code block by inserting a tab character.
 * For selections, indent each selected line with a tab.
 */
function handleTabInCodeBlock(view: EditorView): boolean {
  if (!isCursorInCodeBlock(view)) return false;

  const state = view.state;
  const sel = state.selection.main;

  // Collapsed selection: insert a tab at the cursor
  if (sel.empty) {
    const pos = sel.head;
    view.dispatch({
      changes: { from: pos, to: pos, insert: "\t" },
      selection: { anchor: pos + 1 },
      scrollIntoView: true,
    });
    return true;
  }

  const from = Math.min(sel.anchor, sel.head);
  const to = Math.max(sel.anchor, sel.head);
  const startLine = state.doc.lineAt(from);
  const endLine = state.doc.lineAt(to);
  const lineStarts: number[] = [];

  for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
    const line = state.doc.line(lineNum);
    // If selection ends at the start of a line, don't indent that line
    if (line.from === to && to > from) break;
    lineStarts.push(line.from);
  }

  if (lineStarts.length === 0) return false;

  const changes = lineStarts.map((lineFrom) => ({ from: lineFrom, to: lineFrom, insert: "\t" }));

  const shiftPos = (pos: number) => {
    let shift = 0;
    for (const lineFrom of lineStarts) {
      if (lineFrom <= pos) shift++;
    }
    return pos + shift;
  };

  const newAnchor = shiftPos(sel.anchor);
  const newHead = shiftPos(sel.head);

  view.dispatch({
    changes,
    selection: { anchor: newAnchor, head: newHead },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Handle Shift-Tab inside a code block by removing a leading tab.
 * For selections, outdent each selected line if it starts with a tab.
 */
function handleShiftTabInCodeBlock(view: EditorView): boolean {
  if (!isCursorInCodeBlock(view)) return false;

  const state = view.state;
  const sel = state.selection.main;

  // Collapsed selection: remove a single tab before cursor if present
  if (sel.empty) {
    const pos = sel.head;
    if (pos <= 0) return false;
    const before = state.doc.sliceString(pos - 1, pos);
    if (before !== "\t") return false;
    view.dispatch({
      changes: { from: pos - 1, to: pos, insert: "" },
      selection: { anchor: pos - 1 },
      scrollIntoView: true,
    });
    return true;
  }

  const from = Math.min(sel.anchor, sel.head);
  const to = Math.max(sel.anchor, sel.head);
  const startLine = state.doc.lineAt(from);
  const endLine = state.doc.lineAt(to);
  const lineStarts: number[] = [];

  for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
    const line = state.doc.line(lineNum);
    if (line.from === to && to > from) break;
    if (line.text.startsWith("\t")) {
      lineStarts.push(line.from);
    }
  }

  if (lineStarts.length === 0) return false;

  const changes = lineStarts.map((lineFrom) => ({ from: lineFrom, to: lineFrom + 1, insert: "" }));

  const shiftPos = (pos: number) => {
    let shift = 0;
    for (const lineFrom of lineStarts) {
      if (lineFrom < pos) shift--;
    }
    return pos + shift;
  };

  const newAnchor = shiftPos(sel.anchor);
  const newHead = shiftPos(sel.head);

  view.dispatch({
    changes,
    selection: { anchor: newAnchor, head: newHead },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Create keymap for formatting escape commands
 */
const formattingEscapeKeymap = keymap.of([
  // Backspace: handle code blocks, HR, lists, blockquotes, paragraph merging, headings, empty formatting, selection, links, then skip over invisible closing markers
  {
    key: "Backspace",
    run: bypassInCodeBlock((view) => handleBackspaceAfterCodeBlock(view) || handleBackspaceAfterHorizontalRule(view) || handleBackspaceInList(view) || handleBackspaceInBlockquote(view) || handleBackspaceAtParagraphStart(view) || handleBackspaceAtHeadingStart(view) || handleDeleteEmptyFormatting(view) || handleDeleteWithSelection(view) || handleBackspaceAfterLink(view) || handleBackspaceAtLinkTextStart(view) || handleBackspaceAtClosingMarker(view)),
  },
  // Delete: handle code blocks, HR, end of line (merge with content below), empty formatting, selection, links, then skip over invisible markers
  {
    key: "Delete",
    run: bypassInCodeBlock((view) => handleDeleteBeforeCodeBlock(view) || handleDeleteBeforeHorizontalRule(view) || handleDeleteAtEndOfLine(view) || handleDeleteEmptyFormatting(view) || handleDeleteWithSelection(view) || handleDeleteAtLinkTextEnd(view) || handleDeleteAtOpeningMarker(view) || handleDeleteAtEndOfContent(view)),
  },
  // Arrow Right/Left: navigation handled by selectionSnapper transaction filter
  // Cmd+B: toggle bold or escape
  {
    key: "Mod-b",
    run: bypassInCodeBlock(toggleBoldOrEscape),
  },
  // Cmd+I: toggle italic or escape
  {
    key: "Mod-i",
    run: bypassInCodeBlock(toggleItalicOrEscape),
  },
  // Cmd+K: create or edit link
  {
    key: "Mod-k",
    run: bypassInCodeBlock(handleLinkCommand),
  },
  // Cmd+`: toggle inline code or escape
  {
    key: "Mod-`",
    run: bypassInCodeBlock(toggleCodeOrEscape),
  },
  // Cmd+Shift+S: toggle strikethrough or escape
  {
    key: "Mod-Shift-s",
    run: bypassInCodeBlock(toggleStrikethroughOrEscape),
  },
  // Cmd+1-6: set heading level
  {
    key: "Mod-1",
    run: bypassInCodeBlock(setHeading1),
  },
  {
    key: "Mod-2",
    run: bypassInCodeBlock(setHeading2),
  },
  {
    key: "Mod-3",
    run: bypassInCodeBlock(setHeading3),
  },
  {
    key: "Mod-4",
    run: bypassInCodeBlock(setHeading4),
  },
  {
    key: "Mod-5",
    run: bypassInCodeBlock(setHeading5),
  },
  {
    key: "Mod-6",
    run: bypassInCodeBlock(setHeading6),
  },
  // Tab: indent list or escape formatting
  {
    key: "Tab",
    run: (view) => handleTabInCodeBlock(view) || handleTabInList(view) || escapeFormatting(view),
  },
  // Shift+Tab: outdent list
  {
    key: "Shift-Tab",
    run: (view) => handleShiftTabInCodeBlock(view) || handleShiftTabInList(view),
  },
  // Enter: new paragraph (double newline for proper markdown)
  {
    key: "Enter",
    run: bypassInCodeBlock(handleEnter),
  },
  // Shift+Enter: soft line break (single newline, same paragraph)
  {
    key: "Shift-Enter",
    run: bypassInCodeBlock(handleShiftEnter),
  },
  // Mod+Enter: toggle task checkbox on current line
  {
    key: "Mod-Enter",
    run: bypassInCodeBlock(toggleTaskCheckboxOnLine),
  },
  // ArrowUp/Down: navigation handled by selectionSnapper transaction filter
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
    // CODE BLOCK GUARD: Inside a code block, skip all special input handling
    // ===========================================

    const currentLine = doc.lineAt(from);
    const insideCodeBlock = getCodeBlockAtLine(view.state, currentLine.number) !== null;

    if (insideCodeBlock) return false;

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
    // HORIZONTAL RULE: Convert "- " + "-" to "---" (and similar)
    // When user types second marker after auto-created list, make HR instead
    // ===========================================

    if (text === "-" || text === "*" || text === "_") {
      const line = doc.lineAt(from);
      const lineStart = line.from;
      const textBeforeCursor = doc.sliceString(lineStart, from);

      // Check if line is "- " or "* " (just an auto-created list marker)
      // and user is typing the same character again
      if (textBeforeCursor === `${text} `) {
        // Convert to horizontal rule: replace "- " with "---" and add blank line after
        // Position cursor on the blank line for continued typing
        view.dispatch({
          changes: { from: lineStart, to: line.to, insert: `${text}${text}${text}\n\n` },
          selection: { anchor: lineStart + 5 }, // After "---\n\n"
          scrollIntoView: true,
        });
        return true;
      }

      // Also handle "-- " → "---" when typing third dash (if they manually typed two dashes)
      if (text === "-" && textBeforeCursor === "-- ") {
        view.dispatch({
          changes: { from: lineStart, to: line.to, insert: "---\n\n" },
          selection: { anchor: lineStart + 5 }, // After "---\n\n"
          scrollIntoView: true,
        });
        return true;
      }
    }

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
    // TASK LIST: Auto-expand -[ to - [ ] at line start
    // ===========================================

    if (text === "[") {
      const line = doc.lineAt(from);
      const lineStart = line.from;
      const textBeforeCursor = doc.sliceString(lineStart, from);

      // Check if we just have a list marker (-, *, +) possibly with indent
      // This triggers when user types "[" after "- " at line start
      const taskMatch = textBeforeCursor.match(/^(\s*)([-*+])\s$/);
      if (taskMatch) {
        const indent = taskMatch[1];
        const marker = taskMatch[2];
        // Replace "- " with "- [ ] "
        view.dispatch({
          changes: { from: lineStart, to: from, insert: `${indent}${marker} [ ] ` },
          selection: { anchor: lineStart + indent.length + marker.length + 5 }, // After "- [ ] "
          scrollIntoView: true,
        });
        return true;
      }

      // Also handle ordered list task: "1. [" → "1. [ ] "
      const orderedTaskMatch = textBeforeCursor.match(/^(\s*)(\d+\.)\s$/);
      if (orderedTaskMatch) {
        const indent = orderedTaskMatch[1];
        const marker = orderedTaskMatch[2];
        view.dispatch({
          changes: { from: lineStart, to: from, insert: `${indent}${marker} [ ] ` },
          selection: { anchor: lineStart + indent.length + marker.length + 5 }, // After "1. [ ] "
          scrollIntoView: true,
        });
        return true;
      }
    }

    // ===========================================
    // CODE BLOCK: Single ` at start of empty line creates code block
    // ===========================================

    if (text === "`") {
      const line = doc.lineAt(from);
      const lineStart = line.from;
      const textBeforeCursor = doc.sliceString(lineStart, from);

      // At start of empty line → create full code block immediately
      if (textBeforeCursor === "") {
        view.dispatch({
          changes: { from: lineStart, to: from, insert: "```\n\n```" },
          selection: { anchor: lineStart + 4 }, // Position on empty line
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

    // Auto-close ` → `|` (for inline code)
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
// HIDDEN RANGE MODEL — Single Source of Truth
// ===========================================

type HiddenRangeKind =
  | "inline-marker"      // **, *, ~~, `
  | "heading-prefix"     // ## (and trailing space)
  | "list-marker"        // - , 1. (and trailing space)
  | "task-marker"        // [ ] or [x] (and trailing space)
  | "blockquote-prefix"  // > (one or more levels)
  | "link-bracket-open"  // the [ of [text](url)
  | "link-tail"          // ](url) portion
  | "code-fence-open"    // opening ``` line
  | "code-fence-close"   // closing ``` line
  | "horizontal-rule";   // entire --- line

interface HiddenRange {
  from: number;
  to: number;
  kind: HiddenRangeKind;
  /** Start of the AST node this range belongs to */
  nodeFrom: number;
  /** End of the AST node this range belongs to */
  nodeTo: number;
  /** For line-prefix kinds: visible start after ALL stacked prefixes */
  contentStart?: number;
  /** For line-prefix kinds: end of visible content */
  contentEnd?: number;
  /** Extra metadata (e.g., language for code-fence-open, level for blockquote) */
  meta?: Record<string, unknown>;
}

/**
 * Walk the Lezer AST and return all hidden ranges.
 * Both decorations and selection snapping consume this cached result.
 *
 * Prefix stacking (blockquote + list + task): computes per-line
 * "effectiveContentStart" by walking the line from its start and
 * accumulating all prefix ranges.
 *
 * Code block exclusion: first pass collects fenced code extents;
 * subsequent iteration ignores positions inside code blocks.
 */
function getHiddenRanges(state: EditorState): HiddenRange[] {
  const doc = state.doc;
  const ranges: HiddenRange[] = [];

  // First pass: collect code block extents so we can exclude their content
  const codeBlockExtents = collectCodeBlockExtents(state);

  const isInsideCodeBlock = (pos: number) =>
    isInCodeBlock(pos, codeBlockExtents);

  // Track which lines we've processed for blockquotes (to handle nested)
  const processedBlockquoteLines = new Set<number>();

  // Second pass: walk the AST to find all hidden ranges
  syntaxTree(state).iterate({
    enter(node) {
      // Skip nodes inside code blocks (but still process FencedCode itself)
      if (isInsideCodeBlock(node.from) && node.name !== "FencedCode") return;

      // Inline markers: EmphasisMark, CodeMark, StrikethroughMark
      if (node.name === "EmphasisMark" || node.name === "CodeMark" || node.name === "StrikethroughMark") {
        ranges.push({
          from: node.from,
          to: node.to,
          kind: "inline-marker",
          nodeFrom: node.from,
          nodeTo: node.to,
        });
      }

      // Heading prefix: HeaderMark + trailing space
      if (node.name === "HeaderMark") {
        const nextChar = doc.sliceString(node.to, node.to + 1);
        const to = nextChar === " " ? node.to + 1 : node.to;
        // Find the ATXHeading parent to get full line info
        const line = doc.lineAt(node.from);
        ranges.push({
          from: node.from,
          to,
          kind: "heading-prefix",
          nodeFrom: node.from,
          nodeTo: line.to,
          contentStart: to,
          contentEnd: line.to,
        });
      }

      // List markers
      if (node.name === "ListMark") {
        const nextChar = doc.sliceString(node.to, node.to + 1);
        const to = nextChar === " " ? node.to + 1 : node.to;
        const markText = doc.sliceString(node.from, node.to);
        const isOrdered = /^\d+\.$/.test(markText);
        const num = isOrdered ? parseInt(markText) : 0;
        const line = doc.lineAt(node.from);
        ranges.push({
          from: node.from,
          to,
          kind: "list-marker",
          nodeFrom: node.from,
          nodeTo: line.to,
          contentStart: to,
          contentEnd: line.to,
          meta: { isOrdered, num },
        });
      }

      // Task markers
      if (node.name === "TaskMarker") {
        const markerText = doc.sliceString(node.from, node.to);
        const isChecked = /\[[xX]]/.test(markerText);
        const nextChar = doc.sliceString(node.to, node.to + 1);
        const to = nextChar === " " ? node.to + 1 : node.to;
        const line = doc.lineAt(node.from);
        ranges.push({
          from: node.from,
          to,
          kind: "task-marker",
          nodeFrom: node.from,
          nodeTo: line.to,
          contentStart: to,
          contentEnd: line.to,
          meta: { checked: isChecked, pos: node.from },
        });
      }

      // Blockquote prefix (QuoteMark)
      if (node.name === "QuoteMark") {
        const line = doc.lineAt(node.from);
        if (!processedBlockquoteLines.has(line.number)) {
          processedBlockquoteLines.add(line.number);
          const quoteInfo = getBlockquoteInfo(line);
          if (quoteInfo) {
            ranges.push({
              from: line.from,
              to: quoteInfo.contentStart,
              kind: "blockquote-prefix",
              nodeFrom: line.from,
              nodeTo: line.to,
              contentStart: quoteInfo.contentStart,
              contentEnd: line.to,
              meta: { level: quoteInfo.level },
            });
          }
        }
      }

      // Horizontal rule
      if (node.name === "HorizontalRule") {
        const line = doc.lineAt(node.from);
        ranges.push({
          from: line.from,
          to: line.to,
          kind: "horizontal-rule",
          nodeFrom: line.from,
          nodeTo: line.to,
        });
      }

      // Fenced code blocks
      if (node.name === "FencedCode") {
        const startLine = doc.lineAt(node.from);
        const endLine = doc.lineAt(node.to);
        const langMatch = startLine.text.match(/^`{3,}(\w*)/);
        const language = langMatch ? langMatch[1] : "";

        // Opening fence
        ranges.push({
          from: startLine.from,
          to: startLine.to,
          kind: "code-fence-open",
          nodeFrom: node.from,
          nodeTo: node.to,
          meta: { language },
        });

        // Closing fence (if different line)
        if (endLine.number !== startLine.number) {
          ranges.push({
            from: endLine.from,
            to: endLine.to,
            kind: "code-fence-close",
            nodeFrom: node.from,
            nodeTo: node.to,
          });
        }
      }

      // Links: hide [ and ](url)
      if (node.name === "Link") {
        let bracketOpen = -1;
        let bracketClose = -1;
        let parenClose = -1;

        node.node.cursor().iterate((child) => {
          if (child.name === "LinkMark") {
            const markText = doc.sliceString(child.from, child.to);
            if (markText === "[") bracketOpen = child.from;
            else if (markText === "]") bracketClose = child.from;
            else if (markText === ")") parenClose = child.from;
          }
        });

        if (bracketOpen !== -1) {
          ranges.push({
            from: bracketOpen,
            to: bracketOpen + 1,
            kind: "link-bracket-open",
            nodeFrom: node.from,
            nodeTo: node.to,
          });
        }
        if (bracketClose !== -1 && parenClose !== -1) {
          ranges.push({
            from: bracketClose,
            to: parenClose + 1,
            kind: "link-tail",
            nodeFrom: node.from,
            nodeTo: node.to,
          });
        }
      }
    },
  });

  // ===========================================
  // REGEX FALLBACK: catch markers the parser misses
  // ===========================================

  const text = doc.toString();

  const isAlreadyCollected = (from: number, to: number) =>
    ranges.some((r) => r.from === from && r.to === to);

  // Bold markers: **
  const boldRegex = /\*\*(.+?)\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(text)) !== null) {
    const openFrom = match.index;
    const openTo = match.index + 2;
    const closeFrom = match.index + 2 + match[1].length;
    const closeTo = closeFrom + 2;
    if (isInsideCodeBlock(openFrom)) continue;
    if (!isAlreadyCollected(openFrom, openTo)) {
      ranges.push({ from: openFrom, to: openTo, kind: "inline-marker", nodeFrom: openFrom, nodeTo: closeTo });
    }
    if (!isAlreadyCollected(closeFrom, closeTo)) {
      ranges.push({ from: closeFrom, to: closeTo, kind: "inline-marker", nodeFrom: openFrom, nodeTo: closeTo });
    }
  }

  // Italic markers: * (but not **)
  const italicRegex = /(?<!\*)\*([^*]+?)\*(?!\*)/g;
  while ((match = italicRegex.exec(text)) !== null) {
    const openFrom = match.index;
    const openTo = match.index + 1;
    const closeFrom = match.index + 1 + match[1].length;
    const closeTo = closeFrom + 1;
    if (isInsideCodeBlock(openFrom)) continue;
    if (!isAlreadyCollected(openFrom, openTo)) {
      ranges.push({ from: openFrom, to: openTo, kind: "inline-marker", nodeFrom: openFrom, nodeTo: closeTo });
    }
    if (!isAlreadyCollected(closeFrom, closeTo)) {
      ranges.push({ from: closeFrom, to: closeTo, kind: "inline-marker", nodeFrom: openFrom, nodeTo: closeTo });
    }
  }

  // Strikethrough markers: ~~
  const strikeRegex = /~~(.+?)~~/g;
  while ((match = strikeRegex.exec(text)) !== null) {
    const openFrom = match.index;
    const openTo = match.index + 2;
    const closeFrom = match.index + 2 + match[1].length;
    const closeTo = closeFrom + 2;
    if (isInsideCodeBlock(openFrom)) continue;
    if (!isAlreadyCollected(openFrom, openTo)) {
      ranges.push({ from: openFrom, to: openTo, kind: "inline-marker", nodeFrom: openFrom, nodeTo: closeTo });
    }
    if (!isAlreadyCollected(closeFrom, closeTo)) {
      ranges.push({ from: closeFrom, to: closeTo, kind: "inline-marker", nodeFrom: openFrom, nodeTo: closeTo });
    }
  }

  // Link markers: [text](url)
  const linkRegex = /\[([^\]]*)]\(([^)]*)\)/g;
  while ((match = linkRegex.exec(text)) !== null) {
    const bracketOpen = match.index;
    const bracketClose = match.index + 1 + match[1].length;
    const parenClose = match.index + match[0].length - 1;
    if (isInsideCodeBlock(bracketOpen)) continue;
    if (!isAlreadyCollected(bracketOpen, bracketOpen + 1)) {
      ranges.push({ from: bracketOpen, to: bracketOpen + 1, kind: "link-bracket-open", nodeFrom: bracketOpen, nodeTo: parenClose + 1 });
    }
    if (!isAlreadyCollected(bracketClose, parenClose + 1)) {
      ranges.push({ from: bracketClose, to: parenClose + 1, kind: "link-tail", nodeFrom: bracketOpen, nodeTo: parenClose + 1 });
    }
  }

  // Blockquote markers: regex fallback for lines the parser missed
  for (let i = 1; i <= doc.lines; i++) {
    if (processedBlockquoteLines.has(i)) continue;
    const line = doc.line(i);
    if (isInsideCodeBlock(line.from)) continue;
    const quoteInfo = getBlockquoteInfo(line);
    if (quoteInfo) {
      ranges.push({
        from: line.from,
        to: quoteInfo.contentStart,
        kind: "blockquote-prefix",
        nodeFrom: line.from,
        nodeTo: line.to,
        contentStart: quoteInfo.contentStart,
        contentEnd: line.to,
        meta: { level: quoteInfo.level },
      });
    }
  }

  // ===========================================
  // Compute per-line effective contentStart for stacked prefixes
  // ===========================================

  // Group prefix ranges by line and compute effective contentStart
  const prefixKinds: Set<HiddenRangeKind> = new Set([
    "heading-prefix", "list-marker", "task-marker", "blockquote-prefix",
  ]);
  const prefixRangesByLine = new Map<number, HiddenRange[]>();

  for (const r of ranges) {
    if (!prefixKinds.has(r.kind)) continue;
    const lineNum = doc.lineAt(r.from).number;
    let arr = prefixRangesByLine.get(lineNum);
    if (!arr) {
      arr = [];
      prefixRangesByLine.set(lineNum, arr);
    }
    arr.push(r);
  }

  for (const [, lineRanges] of prefixRangesByLine) {
    if (lineRanges.length <= 1) continue;
    // Sort by from position (leftmost first)
    lineRanges.sort((a, b) => a.from - b.from);
    // The effective contentStart is the `to` of the last (rightmost) prefix range
    const effectiveContentStart = lineRanges[lineRanges.length - 1].to;
    const line = doc.lineAt(lineRanges[0].from);
    // Update all prefix ranges on this line to share the same contentStart
    for (const r of lineRanges) {
      r.contentStart = effectiveContentStart;
      r.contentEnd = line.to;
    }
  }

  return ranges;
}

/**
 * StateField that caches HiddenRange[] and recomputes on doc change.
 * All consumers (decorations, snapper) read from this field.
 */
const hiddenRangesField = StateField.define<HiddenRange[]>({
  create: (state) => getHiddenRanges(state),
  update: (value, tr) => {
    if (tr.docChanged) {
      return getHiddenRanges(tr.state);
    }
    return value;
  },
});

// ===========================================
// SELECTION SNAPPING
// ===========================================

/**
 * Snap a position directionally away from hidden ranges.
 * direction > 0: moving right → snap to range.to
 * direction < 0: moving left → snap to range.from
 */
function snapDirectional(pos: number, direction: number, hiddenRanges: HiddenRange[], state: EditorState): number {
  const maxIterations = 5;
  let current = pos;

  for (let iter = 0; iter < maxIterations; iter++) {
    const prev = current;
    let snapped = false;

    // Block-level ranges first (HR, code fences)
    for (const r of hiddenRanges) {
      if (current < r.from || current > r.to) continue; // not inside
      if (current === r.from || current === r.to) continue; // on edge is ok for some kinds

      if (r.kind === "horizontal-rule" || r.kind === "code-fence-open" || r.kind === "code-fence-close") {
        if (current >= r.from && current <= r.to) {
          // Jump to line before/after
          const line = state.doc.lineAt(r.from);
          const prevLine = line.number > 1 ? state.doc.line(line.number - 1) : null;
          const nextLine = line.number < state.doc.lines ? state.doc.line(line.number + 1) : null;

          if (direction > 0) {
            // Prefer moving down; if no next line, move up instead
            if (nextLine) current = nextLine.from;
            else if (prevLine) current = prevLine.to;
            else current = r.to;
          } else {
            // Prefer moving up; if no previous line, move down instead
            if (prevLine) current = prevLine.to;
            else if (nextLine) current = nextLine.from;
            else current = r.from;
          }
          snapped = true;
          break;
        }
      }
    }

    // Line-prefix ranges (heading, list, task, blockquote)
    for (const r of hiddenRanges) {
      if (r.contentStart === undefined) continue;
      if (current >= r.from && current < r.contentStart) {
        if (direction < 0 && r.from > 0) {
          // Moving left into prefix → go to end of previous line
          const line = state.doc.lineAt(r.from);
          if (line.number > 1) {
            const prevLine = state.doc.line(line.number - 1);
            current = prevLine.to;
          } else {
            current = r.from;
          }
        } else {
          // Moving right or click → snap to contentStart
          current = r.contentStart;
        }
        snapped = true;
        break;
      }
    }

    // Inline markers (**, *, ~~, `, link brackets)
    for (const r of hiddenRanges) {
      if (r.kind !== "inline-marker" && r.kind !== "link-bracket-open" && r.kind !== "link-tail") continue;
      if (current > r.from && current < r.to) {
        current = direction >= 0 ? r.to : r.from;
        snapped = true;
        break;
      }
    }

    if (!snapped || current === prev) break;
  }

  return current;
}

/**
 * Snap a position to the nearest visible edge (for pointer clicks).
 */
function snapToNearest(pos: number, hiddenRanges: HiddenRange[], state: EditorState): number {
  const maxIterations = 5;
  let current = pos;

  for (let iter = 0; iter < maxIterations; iter++) {
    const prev = current;
    let snapped = false;

    // Block-level: snap to nearest line boundary
    for (const r of hiddenRanges) {
      if (r.kind === "horizontal-rule" || r.kind === "code-fence-open" || r.kind === "code-fence-close") {
        if (current >= r.from && current <= r.to) {
          const line = state.doc.lineAt(r.from);
          const prevLine = line.number > 1 ? state.doc.line(line.number - 1) : null;
          const nextLine = line.number < state.doc.lines ? state.doc.line(line.number + 1) : null;

          if (!prevLine && nextLine) {
            current = nextLine.from;
          } else if (!nextLine && prevLine) {
            current = prevLine.to;
          } else if (!prevLine && !nextLine) {
            current = r.to;
          } else {
            const distBefore = current - prevLine!.to;
            const distAfter = nextLine!.from - current;
            current = distBefore <= distAfter ? prevLine!.to : nextLine!.from;
          }
          snapped = true;
          break;
        }
      }
    }

    // Line-prefix: snap to contentStart
    for (const r of hiddenRanges) {
      if (r.contentStart === undefined) continue;
      if (current >= r.from && current < r.contentStart) {
        current = r.contentStart;
        snapped = true;
        break;
      }
    }

    // Inline: snap to nearest edge
    for (const r of hiddenRanges) {
      if (r.kind !== "inline-marker" && r.kind !== "link-bracket-open" && r.kind !== "link-tail") continue;
      if (current > r.from && current < r.to) {
        const distFrom = current - r.from;
        const distTo = r.to - current;
        current = distFrom <= distTo ? r.from : r.to;
        snapped = true;
        break;
      }
    }

    if (!snapped || current === prev) break;
  }

  return current;
}

/**
 * Transaction filter that snaps collapsed selections away from hidden ranges.
 *
 * Rules:
 * - Only collapsed selections are ever snapped
 * - Ranged (non-empty) selections are never interfered with
 * - Pointer clicks snap to nearest visible edge
 * - Non-pointer events use directional snapping (based on old vs new head)
 * - Composition events are skipped
 */
const selectionSnapper = EditorState.transactionFilter.of((tr) => {
  if (!tr.selection) return tr;
  if (tr.isUserEvent("input.type.compose")) return tr;

  const isPointer = tr.isUserEvent("select.pointer");
  const hiddenRanges = tr.state.field(hiddenRangesField);

  const oldRanges = tr.startState.selection.ranges;
  const newRanges = tr.selection.ranges;
  let needsSnap = false;
  const snapped: import("@codemirror/state").SelectionRange[] = [];

  for (let i = 0; i < newRanges.length; i++) {
    const newR = newRanges[i];
    const oldR = oldRanges[Math.min(i, oldRanges.length - 1)];

    // Only collapsed selections are ever snapped
    if (!newR.empty) {
      snapped.push(newR);
      continue;
    }

    let head: number;

    if (isPointer) {
      head = snapToNearest(newR.head, hiddenRanges, tr.state);
    } else {
      const headDir = newR.head >= oldR.head ? 1 : -1;
      head = snapDirectional(newR.head, headDir, hiddenRanges, tr.state);
    }

    if (head !== newR.head) {
      needsSnap = true;
      snapped.push(EditorSelection.cursor(head));
    } else {
      snapped.push(newR);
    }
  }

  if (!needsSnap) return tr;
  return [tr, { selection: EditorSelection.create(snapped, tr.selection.mainIndex) }];
});

// ===========================================
// HIDDEN SYNTAX DECORATION (NO atomicRanges)
// ===========================================

const hiddenDecoration = Decoration.replace({});

/**
 * Build decorations from HiddenRange[].
 * Unified decoration builder — single source of truth.
 *
 * - inline-marker → Decoration.replace({})
 * - heading-prefix → Decoration.replace({})
 * - list-marker → BulletWidget or NumberWidget
 * - task-marker → CheckboxWidget
 * - blockquote-prefix → BlockquoteBarWidget
 * - code-fence-open → CodeBlockOpenWidget
 * - code-fence-close → CodeBlockCloseWidget
 * - horizontal-rule → HorizontalRuleWidget
 * - link-bracket-open → Decoration.replace({})
 * - link-tail → Decoration.replace({})
 */
function buildDecorationsFromRanges(hiddenRanges: HiddenRange[]) {
  // Collect HR and code fence ranges for overlap filtering
  const hrRanges = hiddenRanges.filter(r => r.kind === "horizontal-rule");
  const codeFenceRanges = hiddenRanges.filter(r => r.kind === "code-fence-open" || r.kind === "code-fence-close");

  const overlapsWithHR = (from: number, to: number): boolean =>
    hrRanges.some(hr => from >= hr.from && to <= hr.to);

  const overlapsWithCodeFence = (from: number, to: number): boolean =>
    codeFenceRanges.some(cb => from >= cb.from && to <= cb.to);

  type DecorationEntry = { from: number; to: number; deco: Decoration };
  const entries: DecorationEntry[] = [];

  for (const r of hiddenRanges) {
    // Filter out ranges that overlap with HR or code fences (except the HR/fence ranges themselves)
    if (r.kind !== "horizontal-rule" && r.kind !== "code-fence-open" && r.kind !== "code-fence-close") {
      if (overlapsWithHR(r.from, r.to) || overlapsWithCodeFence(r.from, r.to)) continue;
    }

    switch (r.kind) {
      case "inline-marker":
      case "link-bracket-open":
      case "link-tail":
      case "heading-prefix":
        entries.push({ from: r.from, to: r.to, deco: hiddenDecoration });
        break;
      case "list-marker": {
        const isOrdered = r.meta?.isOrdered as boolean;
        const num = r.meta?.num as number;
        const widget = isOrdered ? new NumberWidget(num) : new BulletWidget();
        entries.push({ from: r.from, to: r.to, deco: Decoration.replace({ widget }) });
        break;
      }
      case "task-marker": {
        const checked = r.meta?.checked as boolean;
        const pos = r.meta?.pos as number;
        const widget = new CheckboxWidget(checked, pos);
        entries.push({ from: r.from, to: r.to, deco: Decoration.replace({ widget }) });
        break;
      }
      case "blockquote-prefix": {
        const level = r.meta?.level as number;
        const widget = new BlockquoteBarWidget(level);
        entries.push({ from: r.from, to: r.to, deco: Decoration.replace({ widget }) });
        break;
      }
      case "horizontal-rule": {
        const widget = new HorizontalRuleWidget();
        entries.push({ from: r.from, to: r.to, deco: Decoration.replace({ widget, block: true }) });
        break;
      }
      case "code-fence-open": {
        const language = r.meta?.language as string;
        const widget = new CodeBlockOpenWidget(language);
        entries.push({ from: r.from, to: r.to, deco: Decoration.replace({ widget, block: true }) });
        break;
      }
      case "code-fence-close": {
        const widget = new CodeBlockCloseWidget();
        entries.push({ from: r.from, to: r.to, deco: Decoration.replace({ widget, block: true }) });
        break;
      }
    }
  }

  // Sort by 'from' position, then 'to' (required by RangeSetBuilder)
  entries.sort((a, b) => a.from - b.from || a.to - b.to);

  const builder = new RangeSetBuilder<Decoration>();
  for (const e of entries) {
    builder.add(e.from, e.to, e.deco);
  }
  return builder.finish();
}

/**
 * StateField that tracks hidden syntax decorations.
 * Consumes HiddenRange[] from hiddenRangesField.
 *
 * NOTE: We only provide EditorView.decorations, NOT EditorView.atomicRanges.
 */
const hiddenSyntaxField = StateField.define({
  create: (state) => buildDecorationsFromRanges(state.field(hiddenRangesField)),
  update: (value, tr) => {
    if (tr.docChanged) {
      return buildDecorationsFromRanges(tr.state.field(hiddenRangesField));
    }
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
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

  // Collect code block ranges - no styling should be applied inside them
  const codeBlockRanges = collectCodeBlockExtents(state);

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
    if (isInsideCodeBlock(match.index)) continue;
    const contentFrom = match.index + 2;
    const contentTo = match.index + 2 + match[1].length;
    if (!isAlreadyCollected(contentFrom, contentTo) && contentFrom < contentTo) {
      rangesToDecorate.push({ from: contentFrom, to: contentTo, decoration: boldMark });
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
// LINK CONTEXT MENU COMPONENT
// ===========================================

function LinkContextMenu() {
  const [state, setState] = useState<LinkContextMenuState>(linkContextMenuState);

  useEffect(() => {
    return subscribeLinkContextMenu((newState) => {
      setState(newState);
    });
  }, []);

  useEffect(() => {
    if (!state.isOpen) return;

    // Close menu on any click outside or Escape key
    const handleClick = () => closeLinkContextMenu();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeLinkContextMenu();
        state.view?.focus();
      }
    };

    // Use setTimeout to avoid closing immediately from the right-click
    setTimeout(() => {
      document.addEventListener("click", handleClick);
      document.addEventListener("keydown", handleKeyDown);
    }, 0);

    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [state.isOpen, state.view]);

  if (!state.isOpen || !state.linkContext) return null;

  return (
    <div
      className="link-context-menu"
      style={{ left: state.x, top: state.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {state.linkContext.url && (
        <button
          className="link-context-menu-item"
          onClick={handleContextMenuOpenLink}
        >
          <span className="link-context-menu-icon">↗</span>
          Open Link
        </button>
      )}
      {state.linkContext.url && (
        <button
          className="link-context-menu-item"
          onClick={handleContextMenuCopyLink}
        >
          <span className="link-context-menu-icon">⧉</span>
          Copy Link URL
        </button>
      )}
      <button
        className="link-context-menu-item"
        onClick={handleContextMenuEditLink}
      >
        <span className="link-context-menu-icon">✎</span>
        Edit Link
      </button>
      <div className="link-context-menu-separator" />
      <button
        className="link-context-menu-item danger"
        onClick={handleContextMenuRemoveLink}
      >
        <span className="link-context-menu-icon">✕</span>
        Remove Link
      </button>
    </div>
  );
}

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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
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
      codeBlockRectangularSelection,
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
      extensions.push(hiddenRangesField);
      extensions.push(hiddenSyntaxField);
      extensions.push(selectionSnapper);
      extensions.push(pendingFormattingField);
      extensions.push(pendingFormatTheme);
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

    // Handle right-click for link context menu
    const handleContextMenu = (e: MouseEvent) => {
      // Get the position in the document from the click coordinates
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (pos === null) return;

      // Check if there's a link at this position
      const linkCtx = getLinkContextAtPos(view.state, pos);
      if (linkCtx) {
        e.preventDefault();
        openLinkContextMenu(e.clientX, e.clientY, linkCtx, view);
      }
    };

    containerRef.current.addEventListener("contextmenu", handleContextMenu);

    return () => {
      containerRef.current?.removeEventListener("contextmenu", handleContextMenu);
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
  { name: "checkboxes.md", label: "Checkboxes" },
  { name: "blockquotes.md", label: "Blockquotes" },
  { name: "horizontal-rules.md", label: "Horizontal Rules" },
  { name: "code-blocks.md", label: "Code Blocks" },
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
      <LinkContextMenu />
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
            <strong>Right-click on link:</strong> Shows context menu with Open, Copy, Edit, Remove options
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

        /* Link Context Menu */
        .link-context-menu {
          position: fixed;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 0 1px rgba(0, 0, 0, 0.1);
          padding: 4px;
          min-width: 180px;
          z-index: 1001;
        }

        .link-context-menu-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 12px;
          border: none;
          background: none;
          cursor: pointer;
          font-size: 14px;
          text-align: left;
          border-radius: 4px;
          color: #333;
        }

        .link-context-menu-item:hover {
          background: #f5f5f5;
        }

        .link-context-menu-item.danger {
          color: #dc3545;
        }

        .link-context-menu-item.danger:hover {
          background: #fff5f5;
        }

        .link-context-menu-icon {
          width: 16px;
          text-align: center;
          opacity: 0.7;
        }

        .link-context-menu-separator {
          height: 1px;
          background: #eee;
          margin: 4px 0;
        }
      `}</style>
    </div>
  );
}

// ===========================================
// BOOTSTRAP
// ===========================================

// Only bootstrap when running in browser (not during tests)
if (typeof document !== "undefined") {
  const root = document.getElementById("root");
  if (root) {
    createRoot(root).render(<App />);
  }
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
  styleField,
  theme,

  // Blockquote handlers
  handleEnterInBlockquote,
  handleBackspaceInBlockquote,
  getBlockquoteInfo,

  // List handlers
  handleEnterInList,
  handleBackspaceInList,
  handleTabInList,
  handleShiftTabInList,
  getListInfo,
  getNextOrderNumber,
  isAtListContentStart,
  buildNewListMarker,

  // Task list handlers
  toggleTaskCheckbox,
  toggleTaskCheckboxOnLine,

  // Heading handlers
  handleBackspaceAtHeadingStart,

  // Horizontal rule handlers
  handleBackspaceAfterHorizontalRule,
  handleDeleteBeforeHorizontalRule,
  HEADING_PREFIX_RE,
  HR_REGEX,

  // Code block handlers
  handleBackspaceAfterCodeBlock,
  handleDeleteBeforeCodeBlock,
  getCodeBlockAtLine,
  isCodeFenceStart,

  // Enter/Delete handlers
  handleEnter,
  handleShiftEnter,
  handleDeleteAtEndOfLine,
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
  toggleCodeOrEscape,
  toggleStrikethroughOrEscape,
  escapeFormatting,
  setHeadingLevel,
  setHeading1,
  setHeading2,
  setHeading3,
  setHeading4,
  setHeading5,
  setHeading6,

  // Link handlers
  handleBackspaceAfterLink,
  handleBackspaceAtLinkTextStart,
  handleDeleteAtLinkTextEnd,
  handleLinkCommand,

  // Link utilities
  getLinkContext,
  getLinkContextAfterClosing,
  isAtEndOfLinkText,
  isAtStartOfLinkText,

  // Link editor state
  openLinkEditor,
  closeLinkEditor,
  applyLink,
  removeLink,
  subscribeLinkEditor,

  // Link context menu
  openLinkContextMenu,
  closeLinkContextMenu,
  handleContextMenuEditLink,
  handleContextMenuRemoveLink,
  handleContextMenuCopyLink,
  handleContextMenuOpenLink,
  subscribeLinkContextMenu,
  getLinkContextAtPos,

  // Utility functions
  getFormattingContext,
  getFormattingContextAfterClosing,
  getFormattingContextBeforeOpening,
  getContentStartForLine,
  isAtEndOfFormatting,
  getPendingFormat,

  // Hidden Range model
  getHiddenRanges,
  hiddenRangesField,
  snapDirectional,
  snapToNearest,
  selectionSnapper,
  handleTabInCodeBlock,
  handleShiftTabInCodeBlock,
  codeBlockRectangularSelection,
  isRectangularSelectionInCodeBlock,

  // Types
  type FormattingContext,
  type LinkContext,
  type HiddenRange,
  type HiddenRangeKind,
};
