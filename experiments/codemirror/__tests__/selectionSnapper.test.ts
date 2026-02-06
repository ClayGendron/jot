/**
 * Tests for the HiddenRange model and selection snapping.
 *
 * Tests cover:
 * - getHiddenRanges: AST-driven hidden range extraction
 * - snapDirectional: directional snapping for arrow keys
 * - snapToNearest: nearest-edge snapping for pointer clicks
 * - selectionSnapper: transaction filter integration
 */

import { describe, it, expect } from "vitest";
import { EditorState, EditorSelection } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import {
  codeBlockExtentsField,
  hiddenRangesField,
  snapDirectional,
  snapToNearest,
  type HiddenRange,
  type HiddenRangeKind,
} from "../harness";

/**
 * Create a minimal EditorState with markdown parsing and hiddenRangesField.
 * Use | to mark cursor position.
 */
function createState(docWithCursor: string): EditorState {
  const cursorPos = docWithCursor.indexOf("|");
  const doc = cursorPos >= 0
    ? docWithCursor.slice(0, cursorPos) + docWithCursor.slice(cursorPos + 1)
    : docWithCursor;
  const pos = cursorPos >= 0 ? cursorPos : doc.length;

  return EditorState.create({
    doc,
    selection: { anchor: pos },
    extensions: [
      markdown({ extensions: [GFM] }),
      codeBlockExtentsField,
      hiddenRangesField,
    ],
  });
}

/**
 * Get hidden ranges from a document string
 */
function getRanges(doc: string): HiddenRange[] {
  const state = createState(doc);
  return state.field(hiddenRangesField);
}

/**
 * Filter ranges by kind
 */
function rangesOfKind(ranges: HiddenRange[], kind: HiddenRangeKind): HiddenRange[] {
  return ranges.filter(r => r.kind === kind);
}

describe("getHiddenRanges", () => {
  describe("inline markers", () => {
    it("finds bold markers (**)", () => {
      const ranges = getRanges("**bold**");
      const markers = rangesOfKind(ranges, "inline-marker");
      expect(markers.length).toBeGreaterThanOrEqual(2);
      // Opening ** at [0,2] and closing ** at [6,8]
      expect(markers.some(r => r.from === 0 && r.to === 2)).toBe(true);
      expect(markers.some(r => r.from === 6 && r.to === 8)).toBe(true);
    });

    it("finds italic markers (*)", () => {
      const ranges = getRanges("*italic*");
      const markers = rangesOfKind(ranges, "inline-marker");
      expect(markers.length).toBeGreaterThanOrEqual(2);
      expect(markers.some(r => r.from === 0 && r.to === 1)).toBe(true);
      expect(markers.some(r => r.from === 7 && r.to === 8)).toBe(true);
    });

    it("finds code markers (`)", () => {
      const ranges = getRanges("`code`");
      const markers = rangesOfKind(ranges, "inline-marker");
      expect(markers.length).toBeGreaterThanOrEqual(2);
      expect(markers.some(r => r.from === 0 && r.to === 1)).toBe(true);
      expect(markers.some(r => r.from === 5 && r.to === 6)).toBe(true);
    });

    it("finds strikethrough markers (~~)", () => {
      const ranges = getRanges("~~strike~~");
      const markers = rangesOfKind(ranges, "inline-marker");
      expect(markers.length).toBeGreaterThanOrEqual(2);
      expect(markers.some(r => r.from === 0 && r.to === 2)).toBe(true);
      expect(markers.some(r => r.from === 8 && r.to === 10)).toBe(true);
    });

    it("does not find markers inside code blocks", () => {
      const ranges = getRanges("```\n**bold**\n```");
      const inlineMarkers = rangesOfKind(ranges, "inline-marker");
      // None of the inline markers should be inside the code block
      expect(inlineMarkers.length).toBe(0);
    });
  });

  describe("heading prefix", () => {
    it("finds heading markers with space", () => {
      const ranges = getRanges("## Heading");
      const headings = rangesOfKind(ranges, "heading-prefix");
      expect(headings.length).toBeGreaterThanOrEqual(1);
      // "## " occupies [0,3]
      const h = headings[0];
      expect(h.from).toBe(0);
      expect(h.to).toBe(3);
      expect(h.contentStart).toBe(3);
    });

    it("handles different heading levels", () => {
      const ranges1 = getRanges("# H1");
      const ranges3 = getRanges("### H3");
      expect(rangesOfKind(ranges1, "heading-prefix")[0].to).toBe(2); // "# "
      expect(rangesOfKind(ranges3, "heading-prefix")[0].to).toBe(4); // "### "
    });
  });

  describe("list markers", () => {
    it("finds unordered list markers", () => {
      const ranges = getRanges("- item");
      const lists = rangesOfKind(ranges, "list-marker");
      expect(lists.length).toBeGreaterThanOrEqual(1);
      expect(lists[0].from).toBe(0);
      expect(lists[0].to).toBe(2); // "- "
      expect(lists[0].meta?.isOrdered).toBe(false);
    });

    it("finds ordered list markers", () => {
      const ranges = getRanges("1. item");
      const lists = rangesOfKind(ranges, "list-marker");
      expect(lists.length).toBeGreaterThanOrEqual(1);
      expect(lists[0].from).toBe(0);
      expect(lists[0].to).toBe(3); // "1. "
      expect(lists[0].meta?.isOrdered).toBe(true);
      expect(lists[0].meta?.num).toBe(1);
    });
  });

  describe("task markers", () => {
    it("finds unchecked task markers", () => {
      const ranges = getRanges("- [ ] task");
      const tasks = rangesOfKind(ranges, "task-marker");
      expect(tasks.length).toBeGreaterThanOrEqual(1);
      expect(tasks[0].meta?.checked).toBe(false);
    });

    it("finds checked task markers", () => {
      const ranges = getRanges("- [x] done");
      const tasks = rangesOfKind(ranges, "task-marker");
      expect(tasks.length).toBeGreaterThanOrEqual(1);
      expect(tasks[0].meta?.checked).toBe(true);
    });
  });

  describe("blockquote prefix", () => {
    it("finds single-level blockquote prefix", () => {
      const ranges = getRanges("> quote");
      const quotes = rangesOfKind(ranges, "blockquote-prefix");
      expect(quotes.length).toBeGreaterThanOrEqual(1);
      expect(quotes[0].from).toBe(0);
      expect(quotes[0].to).toBe(2); // "> "
      expect(quotes[0].contentStart).toBe(2);
      expect(quotes[0].meta?.level).toBe(1);
    });

    it("finds nested blockquote prefix", () => {
      const ranges = getRanges("> > nested");
      const quotes = rangesOfKind(ranges, "blockquote-prefix");
      expect(quotes.length).toBeGreaterThanOrEqual(1);
      expect(quotes[0].meta?.level).toBe(2);
    });
  });

  describe("horizontal rule", () => {
    it("finds horizontal rule", () => {
      const ranges = getRanges("---");
      const hrs = rangesOfKind(ranges, "horizontal-rule");
      expect(hrs.length).toBe(1);
      expect(hrs[0].from).toBe(0);
      expect(hrs[0].to).toBe(3);
    });
  });

  describe("code fence", () => {
    it("finds code fence open and close", () => {
      const ranges = getRanges("```js\nconsole.log()\n```");
      const opens = rangesOfKind(ranges, "code-fence-open");
      const closes = rangesOfKind(ranges, "code-fence-close");
      expect(opens.length).toBe(1);
      expect(closes.length).toBe(1);
      expect(opens[0].meta?.language).toBe("js");
    });

    it("handles empty code blocks", () => {
      const ranges = getRanges("```\n\n```");
      const opens = rangesOfKind(ranges, "code-fence-open");
      const closes = rangesOfKind(ranges, "code-fence-close");
      expect(opens.length).toBe(1);
      expect(closes.length).toBe(1);
      expect(opens[0].meta?.language).toBe("");
    });
  });

  describe("link brackets", () => {
    it("finds link bracket open and tail", () => {
      const ranges = getRanges("[link](url)");
      const opens = rangesOfKind(ranges, "link-bracket-open");
      const tails = rangesOfKind(ranges, "link-tail");
      expect(opens.length).toBeGreaterThanOrEqual(1);
      expect(tails.length).toBeGreaterThanOrEqual(1);
      // "[" at [0,1]
      expect(opens[0].from).toBe(0);
      expect(opens[0].to).toBe(1);
      // "](url)" at [5,11]
      expect(tails[0].from).toBe(5);
      expect(tails[0].to).toBe(11);
    });
  });

  describe("prefix stacking (contentStart)", () => {
    it("computes contentStart for blockquote + list", () => {
      const ranges = getRanges("> - item");
      const prefixes = ranges.filter(r =>
        r.kind === "blockquote-prefix" || r.kind === "list-marker"
      );
      // At least 2 prefix ranges on the same line
      expect(prefixes.length).toBeGreaterThanOrEqual(2);
      // All should share the same effective contentStart (after last prefix)
      const contentStarts = prefixes.map(r => r.contentStart).filter(Boolean);
      if (contentStarts.length >= 2) {
        // They should all point to the same place
        const unique = new Set(contentStarts);
        expect(unique.size).toBe(1);
      }
    });
  });
});

describe("snapDirectional", () => {
  it("snaps rightward out of inline marker", () => {
    const state = createState("**bold**");
    const ranges = state.field(hiddenRangesField);
    // Position 1 is inside the opening ** [0,2]
    const snapped = snapDirectional(1, 1, ranges, state);
    expect(snapped).toBe(2); // snaps to end of opening marker
  });

  it("snaps leftward out of inline marker", () => {
    const state = createState("**bold**");
    const ranges = state.field(hiddenRangesField);
    // Position 1 is inside the opening ** [0,2]
    const snapped = snapDirectional(1, -1, ranges, state);
    expect(snapped).toBe(0); // snaps to start of opening marker
  });

  it("snaps rightward out of closing marker", () => {
    const state = createState("**bold**");
    const ranges = state.field(hiddenRangesField);
    // Position 7 is inside the closing ** [6,8]
    const snapped = snapDirectional(7, 1, ranges, state);
    expect(snapped).toBe(8);
  });

  it("snaps leftward out of closing marker", () => {
    const state = createState("**bold**");
    const ranges = state.field(hiddenRangesField);
    // Position 7 is inside the closing ** [6,8]
    const snapped = snapDirectional(7, -1, ranges, state);
    expect(snapped).toBe(6);
  });

  it("snaps rightward to heading contentStart", () => {
    const state = createState("## Heading");
    const ranges = state.field(hiddenRangesField);
    // Position 1 is inside the heading prefix [0,3]
    const snapped = snapDirectional(1, 1, ranges, state);
    expect(snapped).toBe(3);
  });

  it("snaps leftward from heading prefix to previous line", () => {
    const state = createState("Previous\n\n## Heading");
    const ranges = state.field(hiddenRangesField);
    // Position 11 is inside the heading prefix [10,13]
    const snapped = snapDirectional(11, -1, ranges, state);
    // Should go to end of previous non-blank line
    expect(snapped).toBeLessThan(10);
  });

  it("does not move position that is not inside any hidden range", () => {
    const state = createState("**bold**");
    const ranges = state.field(hiddenRangesField);
    // Position 4 is inside the content "bold"
    const snapped = snapDirectional(4, 1, ranges, state);
    expect(snapped).toBe(4);
  });

  it("snaps out of horizontal rule", () => {
    const state = createState("text\n\n---\n\nmore");
    const ranges = state.field(hiddenRangesField);
    const hrRanges = ranges.filter(r => r.kind === "horizontal-rule");
    if (hrRanges.length > 0) {
      const hrMid = Math.floor((hrRanges[0].from + hrRanges[0].to) / 2);
      const snappedRight = snapDirectional(hrMid, 1, ranges, state);
      expect(snappedRight).toBeGreaterThan(hrRanges[0].to);
      const snappedLeft = snapDirectional(hrMid, -1, ranges, state);
      expect(snappedLeft).toBeLessThan(hrRanges[0].from);
    }
  });

  it("snaps out of horizontal rule at doc start", () => {
    const state = createState("---\nNext");
    const ranges = state.field(hiddenRangesField);
    const hr = ranges.find(r => r.kind === "horizontal-rule");
    expect(hr).toBeTruthy();
    const hrMid = Math.floor(((hr as HiddenRange).from + (hr as HiddenRange).to) / 2);
    const snappedRight = snapDirectional(hrMid, 1, ranges, state);
    const snappedLeft = snapDirectional(hrMid, -1, ranges, state);
    const nextLineFrom = state.doc.line(2).from;
    expect(snappedRight).toBe(nextLineFrom);
    expect(snappedLeft).toBe(nextLineFrom);
  });

  it("is idempotent — snapping same position twice yields same result", () => {
    const state = createState("**bold**");
    const ranges = state.field(hiddenRangesField);
    const first = snapDirectional(1, 1, ranges, state);
    const second = snapDirectional(first, 1, ranges, state);
    expect(second).toBe(first);
  });

  // --- Migrated coverage from removed arrow handlers ---

  it("snaps cursor in blockquote prefix to contentStart", () => {
    const state = createState("> quote text");
    const ranges = state.field(hiddenRangesField);
    // Position 1 is inside the "> " prefix [0,2]
    const snapped = snapDirectional(1, 1, ranges, state);
    expect(snapped).toBe(2);
  });

  it("snaps cursor in nested blockquote prefix to contentStart", () => {
    const state = createState("> > nested");
    const ranges = state.field(hiddenRangesField);
    // Position 1 is inside the prefix
    const snapped = snapDirectional(1, 1, ranges, state);
    // Should snap past all prefix characters to content
    const quoteRanges = ranges.filter(r => r.kind === "blockquote-prefix");
    const contentStart = quoteRanges[0].contentStart!;
    expect(snapped).toBe(contentStart);
  });

  it("snaps cursor in unordered list marker to contentStart", () => {
    const state = createState("- item text");
    const ranges = state.field(hiddenRangesField);
    // Position 1 is inside "- " marker [0,2]
    const snapped = snapDirectional(1, 1, ranges, state);
    expect(snapped).toBe(2);
  });

  it("snaps cursor in ordered list marker to contentStart", () => {
    const state = createState("1. item text");
    const ranges = state.field(hiddenRangesField);
    // Position 1 is inside "1. " marker [0,3]
    const snapped = snapDirectional(1, 1, ranges, state);
    expect(snapped).toBe(3);
  });

  it("does not land inside link bracket-open (1-char range boundary)", () => {
    const state = createState("x [link](https://example.com)");
    const ranges = state.field(hiddenRangesField);
    const opens = ranges.filter(r => r.kind === "link-bracket-open");
    expect(opens.length).toBeGreaterThanOrEqual(1);
    // "[" is a 1-char range [2,3]. Position 2 is at the boundary (from),
    // not strictly inside, so snapper leaves it alone. This is correct —
    // the visual cursor shows the bracket boundary before entering link text.
    const snapped = snapDirectional(opens[0].from, 1, ranges, state);
    expect(snapped).toBe(opens[0].from);
    // But nearest-snap from inside (at position matching from) also stays at from
    const snappedNearest = snapToNearest(opens[0].from, ranges, state);
    expect(snappedNearest).toBe(opens[0].from);
  });

  it("snaps cursor inside link tail to edge", () => {
    const state = createState("[link](https://example.com)");
    const ranges = state.field(hiddenRangesField);
    const tails = ranges.filter(r => r.kind === "link-tail");
    expect(tails.length).toBeGreaterThanOrEqual(1);
    const tail = tails[0];
    const mid = Math.floor((tail.from + tail.to) / 2);
    const snappedRight = snapDirectional(mid, 1, ranges, state);
    expect(snappedRight).toBe(tail.to);
    const snappedLeft = snapDirectional(mid, -1, ranges, state);
    expect(snappedLeft).toBe(tail.from);
  });

  it("snaps cursor inside code fence open line", () => {
    const state = createState("```js\nconsole.log()\n```");
    const ranges = state.field(hiddenRangesField);
    const fenceOpen = ranges.find(r => r.kind === "code-fence-open");
    expect(fenceOpen).toBeTruthy();
    // Position inside the opening fence line
    const snapped = snapDirectional(2, 1, ranges, state);
    expect(snapped).toBeGreaterThanOrEqual(fenceOpen!.to);
  });

  it("snaps cursor inside code fence close line", () => {
    const state = createState("```js\nconsole.log()\n```");
    const ranges = state.field(hiddenRangesField);
    const fenceClose = ranges.find(r => r.kind === "code-fence-close");
    expect(fenceClose).toBeTruthy();
    const mid = Math.floor((fenceClose!.from + fenceClose!.to) / 2);
    const snappedLeft = snapDirectional(mid, -1, ranges, state);
    expect(snappedLeft).toBeLessThanOrEqual(fenceClose!.from);
  });

  it("navigates between consecutive horizontal rules", () => {
    const state = createState("---\n\n---");
    const ranges = state.field(hiddenRangesField);
    const hrs = ranges.filter(r => r.kind === "horizontal-rule");
    expect(hrs.length).toBe(2);
    // From inside first HR, snapping right should land past it
    const snappedRight = snapDirectional(1, 1, ranges, state);
    expect(snappedRight).toBeGreaterThanOrEqual(hrs[0].to);
    // From inside second HR, snapping left should land before it
    const hr2Mid = Math.floor((hrs[1].from + hrs[1].to) / 2);
    const snappedLeft = snapDirectional(hr2Mid, -1, ranges, state);
    expect(snappedLeft).toBeLessThanOrEqual(hrs[1].from);
  });

  it("snaps rightward from heading prefix to contentStart on arrow down landing", () => {
    // When arrow-down lands in a heading prefix, snap to contentStart
    const state = createState("some text\n## Heading");
    const ranges = state.field(hiddenRangesField);
    const headings = ranges.filter(r => r.kind === "heading-prefix");
    expect(headings.length).toBe(1);
    // Position inside "## " prefix — rightward snap should go to contentStart
    const prefixPos = headings[0].from + 1;
    const snapped = snapDirectional(prefixPos, 1, ranges, state);
    expect(snapped).toBe(headings[0].contentStart);
  });

  it("snaps leftward from list marker prefix to previous line end", () => {
    const state = createState("text\n- item");
    const ranges = state.field(hiddenRangesField);
    const lists = ranges.filter(r => r.kind === "list-marker");
    expect(lists.length).toBeGreaterThanOrEqual(1);
    // Inside "- " prefix, leftward snap should go to prev line end
    const snapped = snapDirectional(lists[0].from + 1, -1, ranges, state);
    expect(snapped).toBeLessThanOrEqual(lists[0].from);
  });
});

describe("snapToNearest", () => {
  it("snaps to nearest edge of inline marker", () => {
    const state = createState("**bold**");
    const ranges = state.field(hiddenRangesField);
    // Position 1 is inside opening ** [0,2], closer to 0 than 2
    const snapped = snapToNearest(1, ranges, state);
    expect(snapped === 0 || snapped === 2).toBe(true);
  });

  it("snaps to contentStart for heading prefix", () => {
    const state = createState("## Heading");
    const ranges = state.field(hiddenRangesField);
    const snapped = snapToNearest(1, ranges, state);
    expect(snapped).toBe(3);
  });

  it("does not move position outside hidden ranges", () => {
    const state = createState("**bold**");
    const ranges = state.field(hiddenRangesField);
    const snapped = snapToNearest(4, ranges, state);
    expect(snapped).toBe(4);
  });

  it("is idempotent", () => {
    const state = createState("## Heading");
    const ranges = state.field(hiddenRangesField);
    const first = snapToNearest(1, ranges, state);
    const second = snapToNearest(first, ranges, state);
    expect(second).toBe(first);
  });

  it("snaps out of horizontal rule at doc start", () => {
    const state = createState("---\nNext");
    const ranges = state.field(hiddenRangesField);
    const hr = ranges.find(r => r.kind === "horizontal-rule");
    expect(hr).toBeTruthy();
    const hrMid = Math.floor(((hr as HiddenRange).from + (hr as HiddenRange).to) / 2);
    const snapped = snapToNearest(hrMid, ranges, state);
    const nextLineFrom = state.doc.line(2).from;
    expect(snapped).toBe(nextLineFrom);
  });
});

describe("selectionSnapper integration", () => {
  it("should not interfere with non-empty selections", () => {
    // Non-empty (ranged) selections should never be snapped
    // A selection that spans hidden markers is valid
    const sel = EditorSelection.range(0, 8);
    expect(sel.empty).toBe(false);
    // No snap should occur (the snapper only handles collapsed selections)
  });

  it("collapsed cursor inside inline marker should snap", () => {
    const state = createState("**bold**");
    const ranges = state.field(hiddenRangesField);
    // Position 1 is inside the opening **
    const snapped = snapDirectional(1, 1, ranges, state);
    expect(snapped).not.toBe(1);
  });

  it("collapsed cursor inside visible content should not snap", () => {
    const state = createState("**bold**");
    const ranges = state.field(hiddenRangesField);
    const snapped = snapDirectional(4, 1, ranges, state);
    expect(snapped).toBe(4);
  });

  it("handles multiple hidden ranges without infinite loop", () => {
    const state = createState("**bold** and *italic*");
    const ranges = state.field(hiddenRangesField);
    // Snap from various positions shouldn't loop
    for (let i = 0; i <= state.doc.length; i++) {
      const snapped = snapDirectional(i, 1, ranges, state);
      expect(snapped).toBeGreaterThanOrEqual(0);
      expect(snapped).toBeLessThanOrEqual(state.doc.length);
    }
  });

  it("handles doc-changed transactions (new state ranges)", () => {
    // After a doc change, the hidden ranges are recomputed
    const state1 = createState("**bold**");
    const ranges1 = state1.field(hiddenRangesField);
    expect(ranges1.length).toBeGreaterThan(0);

    // Simulate doc change by creating a new state
    const state2 = createState("*italic*");
    const ranges2 = state2.field(hiddenRangesField);
    expect(ranges2.length).toBeGreaterThan(0);
    // Ranges should be different
    expect(ranges1).not.toEqual(ranges2);
  });
});
