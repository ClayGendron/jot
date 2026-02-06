/**
 * Input Handler
 *
 * EditorView.inputHandler that implements smart input behaviors:
 * - Auto-close markers (*, `, [, ~~, ==)
 * - Format escape sequences (typing closing marker escapes formatting)
 * - List/blockquote/heading auto-creation
 * - Horizontal rule detection (-- → ---)
 * - Code block creation on ` at start of line
 * - Task list expansion (- [ )
 */

import { EditorView } from "@codemirror/view";
import {
  getFormattingContext,
  isAtEndOfFormatting,
} from "../handlers/formattingHandlers";
import { getCodeBlockAtLine } from "../handlers/tableHandlers";

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

export function clearPendingEscape() {
  if (pendingEscape) {
    clearTimeout(pendingEscape.timeoutId);
    pendingEscape = null;
  }
}

// ===========================================
// INPUT HANDLER
// ===========================================

/**
 * Smart input handler for markdown editing.
 *
 * Handles:
 * - Auto-close: *, `, [, ~~, ==
 * - Format escape: type closing marker at end to exit formatting
 * - Upgrade: *|* → **|** (bold from italic)
 * - Lists: -, *, +, 1., 2., etc. at line start
 * - Blockquotes: > at line start
 * - Headings: # at line start, space confirms
 * - Code blocks: ` at start of empty line → full code block
 * - Horizontal rules: - - → ---
 * - Task lists: -[ → - [ ]
 *
 * For two-character escape sequences (**, ~~, ==), we need to hold the first char
 * and wait for the second * before doing anything.
 */
export const formattingInputHandler = EditorView.inputHandler.of(
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
    // HIGHLIGHT AUTO-CLOSE: Handle == specially
    // Single = does nothing (no auto-close), but == creates ==|==
    // ===========================================

    if (text === "=" && prevChar === "=") {
      const eqStart = from - 1;
      view.dispatch({
        changes: { from: eqStart, to: from, insert: "====" },
        selection: { anchor: eqStart + 2 },
        scrollIntoView: true,
      });
      return true;
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

      // HIGHLIGHT: Need == to escape - hold first =, wait for second
      if (text === "=" && ctx.type === "highlight") {
        pendingEscape = {
          char: "=",
          pos: from,
          formattingEnd: ctx.closingMarkerTo,
          timeoutId: setTimeout(() => {
            if (pendingEscape && pendingEscape.pos === from) {
              view.dispatch({
                changes: { from, to: from, insert: "=" },
              });
              pendingEscape = null;
            }
          }, 500),
        };
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
