/**
 * Selection Snapper
 *
 * Transaction filter that snaps collapsed selections away from hidden ranges.
 * Ensures the cursor never lands on hidden markdown syntax.
 *
 * Rules:
 * - Only collapsed selections are ever snapped
 * - Ranged (non-empty) selections are never interfered with
 * - Pointer clicks snap to nearest visible edge
 * - Non-pointer events use directional snapping (based on old vs new head)
 * - Composition events are skipped
 */

import { EditorState, EditorSelection } from "@codemirror/state";
import type { SelectionRange } from "@codemirror/state";
import { hiddenRangesField, type HiddenRange } from "./hiddenRanges";

// ===========================================
// SNAPPING HELPERS
// ===========================================

/**
 * Snap a position directionally away from hidden ranges.
 * direction > 0: moving right -> snap to range.to
 * direction < 0: moving left -> snap to range.from
 */
function snapDirectional(pos: number, direction: number, hiddenRanges: HiddenRange[], state: EditorState): number {
  const maxIterations = 5;
  let current = pos;

  for (let iter = 0; iter < maxIterations; iter++) {
    const prev = current;
    let snapped = false;

    // Block-level ranges first (HR, code fences)
    // NOTE: table-delimiter is EXCLUDED because tables are fully replaced by widgets
    // with their own editing - no hidden syntax to snap away from
    for (const r of hiddenRanges) {
      if (r.kind !== "horizontal-rule" && r.kind !== "code-fence-open" && r.kind !== "code-fence-close") continue;
      if (current < r.from || current > r.to) continue; // not inside
      if (current === r.from || current === r.to) continue; // on edge is ok

      // Jump to line before/after
      const firstLine = state.doc.lineAt(r.from);
      const lastLine = state.doc.lineAt(r.to);
      const prevLine = firstLine.number > 1 ? state.doc.line(firstLine.number - 1) : null;
      const nextLine = lastLine.number < state.doc.lines ? state.doc.line(lastLine.number + 1) : null;

      if (direction > 0) {
        if (nextLine) current = nextLine.from;
        else if (prevLine) current = prevLine.to;
        else current = r.to;
      } else {
        if (prevLine) current = prevLine.to;
        else if (nextLine) current = nextLine.from;
        else current = r.from;
      }
      snapped = true;
      break;
    }

    // Line-prefix ranges (heading, list, task, blockquote)
    for (const r of hiddenRanges) {
      if (r.contentStart === undefined) continue;
      if (current >= r.from && current < r.contentStart) {
        if (direction < 0 && r.from > 0) {
          const line = state.doc.lineAt(r.from);
          if (line.number > 1) {
            const prevLine = state.doc.line(line.number - 1);
            current = prevLine.to;
          } else {
            current = r.from;
          }
        } else {
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
    // NOTE: table-delimiter is EXCLUDED because tables are fully replaced by widgets
    // with their own editing - no hidden syntax to snap away from
    for (const r of hiddenRanges) {
      if (r.kind === "horizontal-rule" || r.kind === "code-fence-open" || r.kind === "code-fence-close") {
        if (current >= r.from && current <= r.to) {
          const firstLine = state.doc.lineAt(r.from);
          const lastLine = state.doc.lineAt(r.to);
          const prevLine = firstLine.number > 1 ? state.doc.line(firstLine.number - 1) : null;
          const nextLine = lastLine.number < state.doc.lines ? state.doc.line(lastLine.number + 1) : null;

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

// ===========================================
// SELECTION SNAPPER EXTENSION
// ===========================================

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
export const selectionSnapper = EditorState.transactionFilter.of((tr) => {
  if (!tr.selection) return tr;
  if (tr.isUserEvent("input.type.compose")) return tr;

  const isPointer = tr.isUserEvent("select.pointer");
  const hiddenRanges = tr.state.field(hiddenRangesField);

  const oldRanges = tr.startState.selection.ranges;
  const newRanges = tr.selection.ranges;
  let needsSnap = false;
  const snapped: SelectionRange[] = [];

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
