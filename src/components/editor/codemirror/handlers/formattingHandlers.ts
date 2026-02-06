/**
 * Formatting Handlers
 *
 * Handles inline formatting (bold, italic, code, strikethrough, highlight).
 * Toggle formatters with escape handling and smart selection formatting.
 */

import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import {
  type FormattingContext,
  ZWSP,
  findFormattingByAST,
  findAllFormattingOfTypeInRange,
  findContainingFormattingOfType,
  isEntireSelectionFormatted,
  stripMarkersOfType,
  getLinkContext,
  getLinkContextAfterClosing,
  isAtEndOfLinkText,
  isAtStartOfLinkText,
} from "../utils/sharedHelpers";

// ===========================================
// FORMATTING CONTEXT HELPERS
// ===========================================

/**
 * Find the formatting context at cursor position
 * Returns info about the formatted region if cursor is inside one
 */
export function getFormattingContext(state: EditorState): FormattingContext | null {
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
export function isAtEndOfFormatting(state: EditorState, ctx: FormattingContext): boolean {
  const pos = state.selection.main.head;

  // Exact match
  if (pos === ctx.contentTo) return true;

  // Check characters ahead - might be ZWSP then marker, or just marker
  const nextChar = state.doc.sliceString(pos, pos + 1);
  const nextTwoChars = state.doc.sliceString(pos, pos + 2);
  const markerChar = ctx.type === "code" ? "`" : ctx.type === "strikethrough" ? "~" : ctx.type === "highlight" ? "=" : "*";

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
export function escapeFormatting(view: EditorView): boolean {
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

// ===========================================
// FORMATTING HELPERS
// ===========================================

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
 * Remove all formatting of a specific type within a selection range.
 * Deletes only the marker characters (opening and closing) while preserving content.
 * Dispatches a single transaction for atomicity and undo support.
 */
function removeFormattingFromRange(
  view: EditorView,
  from: number,
  to: number,
  formattingType: FormattingContext["type"],
  options: { stripZWSP?: boolean } = {}
): boolean {
  const contexts = findAllFormattingOfTypeInRange(view.state, formattingType, from, to);
  if (contexts.length === 0) return false;

  // Collect all marker ranges to delete (opening and closing separately)
  const markerDeletions: Array<{ from: number; to: number; insert: string }> = [];
  for (const ctx of contexts) {
    // Opening marker
    markerDeletions.push({ from: ctx.from, to: ctx.contentFrom, insert: "" });
    // Closing marker
    let closingFrom = ctx.closingMarkerFrom;
    const closingTo = ctx.closingMarkerTo;
    // Strip ZWSP adjacent to closing marker for strikethrough
    if (options.stripZWSP) {
      const beforeClosing = view.state.doc.sliceString(closingFrom - 1, closingFrom);
      if (beforeClosing === ZWSP) {
        closingFrom -= 1;
      }
    }
    markerDeletions.push({ from: closingFrom, to: closingTo, insert: "" });
  }

  // Sort by from position (CodeMirror requires sorted, non-overlapping changes)
  markerDeletions.sort((a, b) => a.from - b.from);

  // Use CodeMirror's change mapping to compute new selection positions
  const changeSet = view.state.changes(markerDeletions);
  const newFrom = changeSet.mapPos(from);
  const newTo = changeSet.mapPos(to);

  view.dispatch({
    changes: markerDeletions,
    selection: { anchor: newFrom, head: newTo },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Apply formatting to a range, handling:
 * 1. Strip existing same-type markers within the selection
 * 2. Split by lines and format each independently (multi-line)
 * 3. Skip empty lines
 */
function applyFormattingToRange(
  view: EditorView,
  from: number,
  to: number,
  formattingType: FormattingContext["type"],
  openMarker: string,
  closeMarker: string,
  options: { stripZWSP?: boolean } = {}
): boolean {
  let selectedText = view.state.doc.sliceString(from, to);

  // Strip existing markers of this type
  selectedText = stripMarkersOfType(selectedText, formattingType);
  if (options.stripZWSP) {
    selectedText = selectedText.replace(new RegExp(ZWSP, "g"), "");
  }

  const lines = selectedText.split("\n");

  let result: string;
  if (lines.length === 1) {
    // Single line: just wrap, select content between markers
    result = `${openMarker}${selectedText}${closeMarker}`;
    view.dispatch({
      changes: { from, to, insert: result },
      selection: { anchor: from + openMarker.length, head: from + openMarker.length + selectedText.length },
      scrollIntoView: true,
    });
  } else {
    // Multi-line: wrap each non-empty line independently, select whole result
    result = lines.map(line => {
      if (line.trim() === "") return line; // preserve empty lines as-is
      return `${openMarker}${line}${closeMarker}`;
    }).join("\n");
    view.dispatch({
      changes: { from, to, insert: result },
      selection: { anchor: from, head: from + result.length },
      scrollIntoView: true,
    });
  }
  return true;
}

/**
 * Smart formatting toggle for ranged selections.
 *
 * Priority:
 * 1. Selection is INSIDE a containing formatting context -> remove it (toggle off)
 * 2. Selection spans multiple contexts covering entire range -> remove all (toggle off)
 * 3. Otherwise -> strip existing same-type markers, apply per-line (toggle on)
 */
function toggleFormattingOnSelection(
  view: EditorView,
  from: number,
  to: number,
  formattingType: FormattingContext["type"],
  openMarker: string,
  closeMarker: string,
  options: { stripZWSP?: boolean } = {}
): boolean {
  const state = view.state;

  // 1. Check if selection is inside a containing formatting context of this type.
  //    Uses type-specific search so ***bold+italic*** correctly finds the right layer.
  const containingCtx = findContainingFormattingOfType(state, formattingType, from, to);
  if (containingCtx) {
    let content = state.doc.sliceString(containingCtx.contentFrom, containingCtx.contentTo);
    if (options.stripZWSP) {
      content = content.replace(new RegExp(ZWSP, "g"), "");
    }
    // Adjust selection positions: markers are removed, content shifts to ctx.from
    const selAnchor = containingCtx.from + Math.max(0, from - containingCtx.contentFrom);
    const selHead = containingCtx.from + Math.min(content.length, to - containingCtx.contentFrom);
    view.dispatch({
      changes: { from: containingCtx.from, to: containingCtx.to, insert: content },
      selection: { anchor: selAnchor, head: selHead },
      scrollIntoView: true,
    });
    return true;
  }

  // 2. Check if entire selection is covered by formatting of this type -> remove all
  if (isEntireSelectionFormatted(state, formattingType, from, to)) {
    return removeFormattingFromRange(view, from, to, formattingType, options);
  }

  // 3. Strip existing same-type markers and apply per-line
  return applyFormattingToRange(view, from, to, formattingType, openMarker, closeMarker, options);
}

// ===========================================
// TOGGLE FORMATTER FACTORY
// ===========================================

/**
 * Generic toggle function for inline formatting
 * Handles escape at end, remove when inside, wrap selection, or insert empty
 */
export function createToggleFormatter(
  formattingType: FormattingContext["type"],
  openMarker: string,
  closeMarker: string,
  options: { stripZWSP?: boolean; emptyContent?: string } = {}
) {
  return function (view: EditorView): boolean {
    const sel = view.state.selection.main;

    // Ranged selection: smart toggle (must check BEFORE formatting context)
    if (!sel.empty) {
      return toggleFormattingOnSelection(view, sel.from, sel.to, formattingType, openMarker, closeMarker, options);
    }

    // Collapsed cursor: check formatting context
    const ctx = getFormattingContext(view.state);

    // If at end of this formatting type, escape
    if (ctx?.type === formattingType && isAtEndOfFormatting(view.state, ctx)) {
      return escapeFormatting(view);
    }

    // If inside this formatting type (not at end), remove formatting
    if (ctx?.type === formattingType) {
      return removeFormatting(view, ctx, options.stripZWSP);
    }

    // Empty cursor - insert empty markers
    return insertEmptyMarkers(view, sel.head, openMarker, closeMarker, options.emptyContent);
  };
}

// ===========================================
// PRE-BUILT TOGGLE FORMATTERS
// ===========================================

export const toggleBoldOrEscape = createToggleFormatter("strong", "**", "**");
export const toggleItalicOrEscape = createToggleFormatter("emphasis", "*", "*");
export const toggleCodeOrEscape = createToggleFormatter("code", "`", "`");
export const toggleStrikethroughOrEscape = createToggleFormatter("strikethrough", "~~", "~~", {
  stripZWSP: true,
  emptyContent: ZWSP,
});
export const toggleHighlightOrEscape = createToggleFormatter("highlight", "==", "==");

// ===========================================
// BACKSPACE/DELETE HANDLERS FOR FORMATTING
// ===========================================

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
    // Check for ==...==
    else if (pos >= 2 && text.slice(pos - 2, pos) === "==") {
      const beforeClose = text.slice(0, pos - 2);
      const openIdx = beforeClose.lastIndexOf("==");
      if (openIdx !== -1) {
        result = {
          type: "highlight",
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
export function handleBackspaceAtClosingMarker(view: EditorView): boolean {
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
 * [link](url)| -> backspace -> [link|(url) (delete last char of text)
 */
export function handleBackspaceAfterLink(view: EditorView): boolean {
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
 * [|link](url) -> backspace -> |link (removes link syntax, keeps text)
 */
export function handleBackspaceAtLinkTextStart(view: EditorView): boolean {
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
 * [link|](url) -> delete -> skip over hidden ](url), effectively exit link
 */
export function handleDeleteAtLinkTextEnd(view: EditorView): boolean {
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
// DELETE EMPTY FORMATTING
// ===========================================

/**
 * Handle delete/backspace when cursor is inside empty formatting
 * Patterns: **|**, *|*, ~~|~~ (with optional ZWSP), `|`
 * Delete the entire formatting pattern
 */
export function handleDeleteEmptyFormatting(view: EditorView): boolean {
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

  // Check for ==|== (highlight)
  if (before2 === "==" && after2 === "==") {
    view.dispatch({
      changes: { from: pos - 2, to: pos + 2, insert: "" },
      selection: { anchor: pos - 2 },
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

// ===========================================
// DELETE AT OPENING/CLOSING MARKERS
// ===========================================

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
    // Check for ==
    else if (text.slice(pos, pos + 2) === "==") {
      const afterOpen = text.slice(pos + 2);
      const closeIdx = afterOpen.indexOf("==");
      if (closeIdx !== -1) {
        result = {
          type: "highlight",
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
export function handleDeleteAtOpeningMarker(view: EditorView): boolean {
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
export function handleDeleteAtEndOfContent(view: EditorView): boolean {
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
// DELETE WITH SELECTION
// ===========================================

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

  // Check AST-based formatted regions
  const ctx = findFormattingByAST(state, (from, to) => selFrom <= from && to <= selTo);
  if (ctx) {
    expanded = { from: ctx.from, to: ctx.to };
  }

  // Also check regex-based patterns in case AST missed them
  const text = state.doc.toString();

  // Bold: **...**
  const boldRegex = /\*\*(.+?)\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(text)) !== null) {
    const contentFrom = match.index + 2;
    const contentTo = match.index + 2 + match[1].length;
    if (selFrom <= contentFrom && contentTo <= selTo) {
      const newFrom = match.index;
      const newTo = match.index + match[0].length;
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
    const contentFrom = match.index + 1;
    const contentTo = match.index + 1 + match[1].length;
    if (selFrom <= contentFrom && contentTo <= selTo) {
      const newFrom = match.index;
      const newTo = match.index + match[0].length;
      if (!expanded) {
        expanded = { from: newFrom, to: newTo };
      } else {
        expanded.from = Math.min(expanded.from, newFrom);
        expanded.to = Math.max(expanded.to, newTo);
      }
    }
  }

  // Strikethrough: ~~...~~
  const strikeRegex = /~~(.+?)~~/g;
  while ((match = strikeRegex.exec(text)) !== null) {
    const contentFrom = match.index + 2;
    const contentTo = match.index + 2 + match[1].length;
    if (selFrom <= contentFrom && contentTo <= selTo) {
      const newFrom = match.index;
      const newTo = match.index + match[0].length;
      if (!expanded) {
        expanded = { from: newFrom, to: newTo };
      } else {
        expanded.from = Math.min(expanded.from, newFrom);
        expanded.to = Math.max(expanded.to, newTo);
      }
    }
  }

  // Highlight: ==...==
  const highlightRegex = /==([^=]+)==/g;
  while ((match = highlightRegex.exec(text)) !== null) {
    const contentFrom = match.index + 2;
    const contentTo = match.index + 2 + match[1].length;
    if (selFrom <= contentFrom && contentTo <= selTo) {
      const newFrom = match.index;
      const newTo = match.index + match[0].length;
      if (!expanded) {
        expanded = { from: newFrom, to: newTo };
      } else {
        expanded.from = Math.min(expanded.from, newFrom);
        expanded.to = Math.max(expanded.to, newTo);
      }
    }
  }

  // Code: `...`
  const codeRegex = /`([^`]+)`/g;
  while ((match = codeRegex.exec(text)) !== null) {
    const contentFrom = match.index + 1;
    const contentTo = match.index + 1 + match[1].length;
    if (selFrom <= contentFrom && contentTo <= selTo) {
      const newFrom = match.index;
      const newTo = match.index + match[0].length;
      if (!expanded) {
        expanded = { from: newFrom, to: newTo };
      } else {
        expanded.from = Math.min(expanded.from, newFrom);
        expanded.to = Math.max(expanded.to, newTo);
      }
    }
  }

  return expanded;
}

/**
 * Handle delete/backspace with selection - expand to include hidden markers
 */
export function handleDeleteWithSelection(view: EditorView): boolean {
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
