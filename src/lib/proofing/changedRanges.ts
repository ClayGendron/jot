/**
 * Changed Ranges Utility
 *
 * Extracts ranges that were modified in a ProseMirror transaction.
 * Used by SpellCheck and GrammarCheck to determine which words
 * need to have their decorations temporarily hidden during typing.
 */

import type { Transaction } from "@tiptap/pm/state";

export interface Range {
  from: number;
  to: number;
}

/**
 * Extract ranges that were modified in a transaction.
 * Returns positions in the NEW document coordinate space.
 */
export function getChangedRanges(tr: Transaction): Range[] {
  const ranges: Range[] = [];

  tr.mapping.maps.forEach((stepMap, i) => {
    stepMap.forEach((_oldFrom, _oldTo, newFrom, newTo) => {
      // Map to final document positions
      const mappedFrom = tr.mapping.slice(i + 1).map(newFrom);
      const mappedTo = tr.mapping.slice(i + 1).map(newTo);
      ranges.push({ from: mappedFrom, to: mappedTo });
    });
  });

  return mergeOverlappingRanges(ranges);
}

/**
 * Merge overlapping or adjacent ranges into a single range.
 */
function mergeOverlappingRanges(ranges: Range[]): Range[] {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  const merged: Range[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];
    if (current.from <= last.to) {
      last.to = Math.max(last.to, current.to);
    } else {
      merged.push(current);
    }
  }

  return merged;
}
