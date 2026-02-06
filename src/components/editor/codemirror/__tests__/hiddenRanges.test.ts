/**
 * Tests for hiddenRanges extension
 *
 * Verifies that:
 * - Empty documents produce zero hidden ranges
 * - Code fences: fence lines hidden, content lines visible
 * - Nested blockquote + list: prefix ranges stack correctly
 * - Table delimiter row hidden as single table-delimiter range
 * - Inline markers detected correctly
 */

import { describe, it, expect, afterEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { hiddenRangesField } from "../extensions/hiddenRanges";
import type { HiddenRange, HiddenRangeKind } from "../extensions/hiddenRanges";
import { codeBlockExtentsField } from "../utils/sharedHelpers";
import { HighlightExtension } from "../extensions/lezerExtensions";

// ===========================================
// TEST UTILITIES
// ===========================================

let activeViews: EditorView[] = [];

function createView(doc: string): EditorView {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const view = new EditorView({
    state: EditorState.create({
      doc,
      extensions: [
        markdown({ extensions: [GFM, HighlightExtension] }),
        codeBlockExtentsField,
        hiddenRangesField,
      ],
    }),
    parent: container,
  });

  activeViews.push(view);
  return view;
}

function getRanges(view: EditorView): HiddenRange[] {
  return view.state.field(hiddenRangesField);
}

function rangesOfKind(ranges: HiddenRange[], kind: HiddenRangeKind): HiddenRange[] {
  return ranges.filter((r) => r.kind === kind);
}

afterEach(() => {
  for (const v of activeViews) {
    const parent = v.dom.parentElement;
    v.destroy();
    parent?.remove();
  }
  activeViews = [];
});

// ===========================================
// TESTS
// ===========================================

describe("hiddenRanges", () => {
  describe("empty document", () => {
    it("produces zero hidden ranges for empty document", () => {
      const view = createView("");
      const ranges = getRanges(view);
      expect(ranges).toHaveLength(0);
    });

    it("produces zero hidden ranges for plain text", () => {
      const view = createView("Hello world, no markdown here.");
      const ranges = getRanges(view);
      expect(ranges).toHaveLength(0);
    });
  });

  describe("code fences", () => {
    it("hides opening and closing fence lines", () => {
      const doc = "```js\nconst x = 1;\n```";
      const view = createView(doc);
      const ranges = getRanges(view);

      const fenceOpen = rangesOfKind(ranges, "code-fence-open");
      const fenceClose = rangesOfKind(ranges, "code-fence-close");

      expect(fenceOpen).toHaveLength(1);
      expect(fenceClose).toHaveLength(1);

      // Opening fence covers the entire first line
      const firstLine = view.state.doc.line(1);
      expect(fenceOpen[0].from).toBe(firstLine.from);
      expect(fenceOpen[0].to).toBe(firstLine.to);

      // Closing fence covers the entire last line
      const lastLine = view.state.doc.line(3);
      expect(fenceClose[0].from).toBe(lastLine.from);
      expect(fenceClose[0].to).toBe(lastLine.to);
    });

    it("stores language in code-fence-open meta", () => {
      const doc = "```typescript\nlet a = 1;\n```";
      const view = createView(doc);
      const ranges = getRanges(view);
      const fenceOpen = rangesOfKind(ranges, "code-fence-open");

      expect(fenceOpen[0].meta?.language).toBe("typescript");
    });

    it("does not produce inline-marker ranges inside code blocks", () => {
      const doc = "```\n**not bold**\n```";
      const view = createView(doc);
      const ranges = getRanges(view);

      const inlineMarkers = rangesOfKind(ranges, "inline-marker");
      expect(inlineMarkers).toHaveLength(0);
    });
  });

  describe("headings", () => {
    it("hides heading prefix (# and space)", () => {
      const doc = "# Hello";
      const view = createView(doc);
      const ranges = getRanges(view);

      const headingPrefixes = rangesOfKind(ranges, "heading-prefix");
      expect(headingPrefixes).toHaveLength(1);
      // Should hide "# " (2 chars)
      expect(headingPrefixes[0].from).toBe(0);
      expect(headingPrefixes[0].to).toBe(2);
    });

    it("hides multi-level heading prefix", () => {
      const doc = "### Third level";
      const view = createView(doc);
      const ranges = getRanges(view);

      const headingPrefixes = rangesOfKind(ranges, "heading-prefix");
      expect(headingPrefixes).toHaveLength(1);
      // Should hide "### " (4 chars)
      expect(headingPrefixes[0].from).toBe(0);
      expect(headingPrefixes[0].to).toBe(4);
    });
  });

  describe("inline markers", () => {
    it("hides bold markers (**)", () => {
      const doc = "**bold text**";
      const view = createView(doc);
      const ranges = getRanges(view);

      const markers = rangesOfKind(ranges, "inline-marker");
      // Should have 2 markers: opening ** and closing **
      expect(markers.length).toBeGreaterThanOrEqual(2);
    });

    it("hides italic markers (*)", () => {
      const doc = "*italic text*";
      const view = createView(doc);
      const ranges = getRanges(view);

      const markers = rangesOfKind(ranges, "inline-marker");
      expect(markers.length).toBeGreaterThanOrEqual(2);
    });

    it("hides strikethrough markers (~~)", () => {
      const doc = "~~strikethrough~~";
      const view = createView(doc);
      const ranges = getRanges(view);

      const markers = rangesOfKind(ranges, "inline-marker");
      expect(markers.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("blockquote prefix", () => {
    it("hides blockquote prefix (> )", () => {
      const doc = "> quoted text";
      const view = createView(doc);
      const ranges = getRanges(view);

      const bqPrefixes = rangesOfKind(ranges, "blockquote-prefix");
      expect(bqPrefixes).toHaveLength(1);
      // Should hide "> " (2 chars)
      expect(bqPrefixes[0].from).toBe(0);
      expect(bqPrefixes[0].to).toBe(2);
    });

    it("nested blockquote produces single blockquote-prefix with correct level", () => {
      const doc = "> > nested";
      const view = createView(doc);
      const ranges = getRanges(view);

      const bqPrefixes = rangesOfKind(ranges, "blockquote-prefix");
      expect(bqPrefixes).toHaveLength(1);
      expect(bqPrefixes[0].meta?.level).toBe(2);
    });
  });

  describe("stacked prefixes (blockquote + list)", () => {
    it("computes effective contentStart after all stacked prefixes", () => {
      const doc = "> - list item";
      const view = createView(doc);
      const ranges = getRanges(view);

      // Should have both blockquote-prefix and list-marker
      const bqPrefixes = rangesOfKind(ranges, "blockquote-prefix");
      const listMarkers = rangesOfKind(ranges, "list-marker");

      expect(bqPrefixes.length).toBeGreaterThanOrEqual(1);
      expect(listMarkers.length).toBeGreaterThanOrEqual(1);

      // Both should share the same effective contentStart (after all prefixes)
      if (bqPrefixes.length > 0 && listMarkers.length > 0) {
        expect(bqPrefixes[0].contentStart).toBe(listMarkers[0].contentStart);
      }
    });
  });

  describe("links", () => {
    it("hides link bracket and tail", () => {
      const doc = "[click here](https://example.com)";
      const view = createView(doc);
      const ranges = getRanges(view);

      const bracketOpen = rangesOfKind(ranges, "link-bracket-open");
      const linkTail = rangesOfKind(ranges, "link-tail");

      expect(bracketOpen.length).toBeGreaterThanOrEqual(1);
      expect(linkTail.length).toBeGreaterThanOrEqual(1);

      // Bracket open should be the "["
      expect(bracketOpen[0].from).toBe(0);
      expect(bracketOpen[0].to).toBe(1);

      // Link tail should cover "](https://example.com)"
      expect(view.state.doc.sliceString(linkTail[0].from, linkTail[0].from + 1)).toBe("]");
    });
  });

  describe("horizontal rule", () => {
    it("hides entire horizontal rule line", () => {
      const doc = "text\n\n---\n\nmore";
      const view = createView(doc);
      const ranges = getRanges(view);

      const hrs = rangesOfKind(ranges, "horizontal-rule");
      expect(hrs).toHaveLength(1);

      // Should cover the entire "---" line
      const hrLine = view.state.doc.line(3);
      expect(hrs[0].from).toBe(hrLine.from);
      expect(hrs[0].to).toBe(hrLine.to);
    });
  });

  describe("table delimiter", () => {
    it("hides table delimiter row as table-delimiter range", () => {
      const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
      const view = createView(doc);
      const ranges = getRanges(view);

      const delimiters = rangesOfKind(ranges, "table-delimiter");
      expect(delimiters).toHaveLength(1);

      // Should cover the delimiter row (line 2)
      const delimLine = view.state.doc.line(2);
      expect(delimiters[0].from).toBe(delimLine.from);
      expect(delimiters[0].to).toBe(delimLine.to);
    });
  });

  describe("StateField caching", () => {
    it("returns same reference when doc unchanged", () => {
      const view = createView("**bold**");
      const ranges1 = view.state.field(hiddenRangesField);

      // Dispatch no-op (no doc change)
      view.dispatch({ selection: { anchor: 0 } });

      const ranges2 = view.state.field(hiddenRangesField);
      // Should be the same array reference (no recompute)
      expect(ranges1).toBe(ranges2);
    });

    it("recomputes when doc changes", () => {
      const view = createView("**bold**");
      const ranges1 = view.state.field(hiddenRangesField);

      // Change document
      view.dispatch({
        changes: { from: view.state.doc.length, insert: "\n*italic*" },
      });

      const ranges2 = view.state.field(hiddenRangesField);
      expect(ranges1).not.toBe(ranges2);
      expect(ranges2.length).toBeGreaterThan(ranges1.length);
    });
  });
});
