/**
 * Formatting Commands for CodeMirror 6
 *
 * Phase 2: Toggle commands for bold, italic, strikethrough, inline code.
 * These commands add/remove delimiter markers around selections.
 *
 * Key design decisions:
 * - Commands ONLY insert/remove markers, never normalize existing syntax
 * - If markers exist around selection, they are removed
 * - If no markers exist, they are added
 * - Cursor with no selection expands to word boundaries
 */

import { EditorView } from "@codemirror/view";
import { EditorSelection, type ChangeSpec, type SelectionRange } from "@codemirror/state";

/**
 * Get word boundaries around cursor position
 * Used when there's no selection to expand to the current word
 */
function getWordBoundaries(
  view: EditorView,
  pos: number
): { from: number; to: number } {
  const line = view.state.doc.lineAt(pos);
  const lineText = line.text;
  const lineStart = line.from;
  const posInLine = pos - lineStart;

  // Find word start (go backwards from cursor)
  let wordStart = posInLine;
  while (wordStart > 0 && /\w/.test(lineText[wordStart - 1])) {
    wordStart--;
  }

  // Find word end (go forwards from cursor)
  let wordEnd = posInLine;
  while (wordEnd < lineText.length && /\w/.test(lineText[wordEnd])) {
    wordEnd++;
  }

  return {
    from: lineStart + wordStart,
    to: lineStart + wordEnd,
  };
}

/**
 * Check if text at given range is surrounded by the specified marker
 */
function isSurrounded(
  view: EditorView,
  from: number,
  to: number,
  marker: string
): boolean {
  const doc = view.state.doc;
  const markerLen = marker.length;

  // Check if there's room for markers
  if (from < markerLen || to + markerLen > doc.length) {
    return false;
  }

  // Check if markers exist around the selection
  const beforeMarker = doc.sliceString(from - markerLen, from);
  const afterMarker = doc.sliceString(to, to + markerLen);

  return beforeMarker === marker && afterMarker === marker;
}

/**
 * Surround selection with markers, or remove markers if already surrounded.
 *
 * This is the core formatting function used by toggleBold, toggleItalic, etc.
 *
 * @param view - The EditorView to modify
 * @param marker - The delimiter marker (e.g., "**" for bold, "*" for italic)
 * @returns true if the command was handled
 */
export function surround(view: EditorView, marker: string): boolean {
  const { state } = view;
  const changes: ChangeSpec[] = [];
  const selections: SelectionRange[] = [];
  const markerLen = marker.length;

  for (const range of state.selection.ranges) {
    let { from, to } = range;

    // If no selection, expand to word boundaries
    if (from === to) {
      const boundaries = getWordBoundaries(view, from);
      from = boundaries.from;
      to = boundaries.to;
    }

    // Check if already surrounded by markers
    if (isSurrounded(view, from, to, marker)) {
      // Remove markers
      changes.push(
        { from: from - markerLen, to: from, insert: "" },
        { from: to, to: to + markerLen, insert: "" }
      );

      // Adjust selection to account for removed markers
      selections.push(
        EditorSelection.range(from - markerLen, to - markerLen)
      );
    } else {
      // Add markers around selection
      const selectedText = state.doc.sliceString(from, to);
      changes.push({
        from,
        to,
        insert: `${marker}${selectedText}${marker}`,
      });

      // Position selection inside markers
      selections.push(
        EditorSelection.range(from + markerLen, to + markerLen)
      );
    }
  }

  if (changes.length === 0) {
    return false;
  }

  view.dispatch({
    changes,
    selection: EditorSelection.create(selections),
  });

  return true;
}

/**
 * Toggle bold formatting (**text**)
 *
 * - Adds ** around selection if not bold
 * - Removes ** if selection is already bold
 * - Expands to word if cursor has no selection
 */
export function toggleBold(view: EditorView): boolean {
  return surround(view, "**");
}

/**
 * Toggle italic formatting (*text*)
 *
 * - Adds * around selection if not italic
 * - Removes * if selection is already italic
 * - Expands to word if cursor has no selection
 */
export function toggleItalic(view: EditorView): boolean {
  return surround(view, "*");
}

/**
 * Toggle strikethrough formatting (~~text~~)
 *
 * - Adds ~~ around selection if not strikethrough
 * - Removes ~~ if selection is already strikethrough
 * - Expands to word if cursor has no selection
 */
export function toggleStrikethrough(view: EditorView): boolean {
  return surround(view, "~~");
}

/**
 * Toggle inline code formatting (`text`)
 *
 * - Adds ` around selection if not code
 * - Removes ` if selection is already code
 * - Expands to word if cursor has no selection
 */
export function toggleInlineCode(view: EditorView): boolean {
  return surround(view, "`");
}

/**
 * Toggle highlight formatting (==text==)
 *
 * - Adds == around selection if not highlighted
 * - Removes == if selection is already highlighted
 * - Expands to word if cursor has no selection
 *
 * Note: This is a custom extension, not part of standard GFM
 */
export function toggleHighlight(view: EditorView): boolean {
  return surround(view, "==");
}
