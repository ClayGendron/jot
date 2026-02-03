/**
 * Delete Behavior Extension for CodeMirror 6
 *
 * Phase 2: Boundary-safe delete/backspace near hidden markers.
 * When cursor is near ** or other markers, delete them as a unit
 * rather than one character at a time.
 *
 * This prevents awkward intermediate states when deleting formatted text.
 */

import { EditorView, keymap } from "@codemirror/view";
import { EditorSelection, type Extension } from "@codemirror/state";

/**
 * Ordered list of marker patterns to check
 * Longer patterns should come first to match "**" before "*"
 */
const MARKERS = ["**", "~~", "==", "*", "_", "`", "~"];

/**
 * Check if text at position matches a marker (looking backward)
 */
function getMarkerBefore(doc: string, pos: number): string | null {
  for (const marker of MARKERS) {
    const start = pos - marker.length;
    if (start >= 0 && doc.slice(start, pos) === marker) {
      return marker;
    }
  }
  return null;
}

/**
 * Check if text at position matches a marker (looking forward)
 */
function getMarkerAfter(doc: string, pos: number): string | null {
  for (const marker of MARKERS) {
    const end = pos + marker.length;
    if (end <= doc.length && doc.slice(pos, end) === marker) {
      return marker;
    }
  }
  return null;
}

/**
 * Handle backspace key press
 *
 * Deletes markers as a unit when cursor is right after a marker.
 * This handles both opening and closing markers.
 *
 * @returns true if handled, false to let default behavior proceed
 */
export function handleBackspace(view: EditorView): boolean {
  const { state } = view;
  const selection = state.selection.main;

  // Only handle cursor (no selection)
  if (!selection.empty) {
    return false;
  }

  const pos = selection.head;

  // Can't backspace at document start
  if (pos === 0) {
    return false;
  }

  const doc = state.doc.toString();
  const marker = getMarkerBefore(doc, pos);

  if (marker) {
    // Delete the entire marker
    view.dispatch({
      changes: { from: pos - marker.length, to: pos, insert: "" },
      selection: EditorSelection.cursor(pos - marker.length),
    });
    return true;
  }

  return false;
}

/**
 * Handle delete key press
 *
 * Deletes markers as a unit when cursor is right before a marker.
 * This handles both opening and closing markers.
 *
 * @returns true if handled, false to let default behavior proceed
 */
export function handleDelete(view: EditorView): boolean {
  const { state } = view;
  const selection = state.selection.main;

  // Only handle cursor (no selection)
  if (!selection.empty) {
    return false;
  }

  const pos = selection.head;
  const doc = state.doc.toString();

  // Can't delete at document end
  if (pos >= doc.length) {
    return false;
  }

  const marker = getMarkerAfter(doc, pos);

  if (marker) {
    // Delete the entire marker
    view.dispatch({
      changes: { from: pos, to: pos + marker.length, insert: "" },
      selection: EditorSelection.cursor(pos),
    });
    return true;
  }

  return false;
}

/**
 * Delete behavior extension
 *
 * Provides boundary-safe delete/backspace near markdown markers:
 * - Backspace after ** deletes both characters
 * - Delete before ** deletes both characters
 * - Same for other markers: *, _, `, ~~, ==
 *
 * This prevents awkward states when editing formatted text and
 * works well with hidden syntax (atomic ranges).
 */
export const deleteBehavior: Extension = keymap.of([
  {
    key: "Backspace",
    run: handleBackspace,
  },
  {
    key: "Delete",
    run: handleDelete,
  },
]);
