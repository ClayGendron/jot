/**
 * Tests for styleDecorations extension
 *
 * Verifies that:
 * - Heading lines get .cm-heading-N class decorations
 * - Bold text gets .cm-strong mark decoration
 * - Italic text gets .cm-em mark decoration
 * - Code fence content gets code block line decoration
 * - Link text gets .cm-link mark decoration
 */

import { describe, it, expect, afterEach } from "vitest";
import { EditorState, RangeSet } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { styleField } from "../extensions/styleDecorations";
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
        styleField,
      ],
    }),
    parent: container,
  });

  activeViews.push(view);
  return view;
}

/**
 * Collect all decorations from the styleField as an array of {from, to, class} objects.
 */
function getStyleDecos(view: EditorView): Array<{ from: number; to: number; class: string }> {
  const decoSet: RangeSet<Decoration> = view.state.field(styleField);
  const result: Array<{ from: number; to: number; class: string }> = [];
  const iter = decoSet.iter();
  while (iter.value) {
    const spec = iter.value.spec;
    const cls = spec.class || spec.attributes?.class || "";
    result.push({ from: iter.from, to: iter.to, class: cls });
    iter.next();
  }
  return result;
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

describe("styleDecorations", () => {
  describe("headings", () => {
    it("applies cm-h1 class to heading 1 content", () => {
      const view = createView("# Hello World");
      const decos = getStyleDecos(view);

      const h1Decos = decos.filter((d) => d.class === "cm-h1");
      expect(h1Decos).toHaveLength(1);
      // Should cover "Hello World" (after "# ")
      expect(view.state.doc.sliceString(h1Decos[0].from, h1Decos[0].to)).toBe("Hello World");
    });

    it("applies cm-h2 class to heading 2 content", () => {
      const view = createView("## Subtitle");
      const decos = getStyleDecos(view);

      const h2Decos = decos.filter((d) => d.class === "cm-h2");
      expect(h2Decos).toHaveLength(1);
      expect(view.state.doc.sliceString(h2Decos[0].from, h2Decos[0].to)).toBe("Subtitle");
    });

    it("applies cm-h3 class to heading 3 content", () => {
      const view = createView("### Section");
      const decos = getStyleDecos(view);

      const h3Decos = decos.filter((d) => d.class === "cm-h3");
      expect(h3Decos).toHaveLength(1);
    });
  });

  describe("bold", () => {
    it("applies cm-strong class to bold content", () => {
      const view = createView("**bold text**");
      const decos = getStyleDecos(view);

      const boldDecos = decos.filter((d) => d.class === "cm-strong");
      expect(boldDecos.length).toBeGreaterThanOrEqual(1);
      // The content between markers should be styled
      const boldText = boldDecos.find((d) =>
        view.state.doc.sliceString(d.from, d.to).includes("bold text")
      );
      expect(boldText).toBeDefined();
    });
  });

  describe("italic", () => {
    it("applies cm-em class to italic content", () => {
      const view = createView("*italic text*");
      const decos = getStyleDecos(view);

      const italicDecos = decos.filter((d) => d.class === "cm-em");
      expect(italicDecos.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("inline code", () => {
    it("applies cm-inline-code class to inline code", () => {
      const view = createView("`code here`");
      const decos = getStyleDecos(view);

      const codeDecos = decos.filter((d) => d.class === "cm-inline-code");
      expect(codeDecos.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("strikethrough", () => {
    it("applies cm-strikethrough class to strikethrough content", () => {
      const view = createView("~~deleted~~");
      const decos = getStyleDecos(view);

      const strikeDecos = decos.filter((d) => d.class === "cm-strikethrough");
      expect(strikeDecos.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("highlight", () => {
    it("applies cm-highlight class to highlighted content", () => {
      const view = createView("==highlighted==");
      const decos = getStyleDecos(view);

      const hlDecos = decos.filter((d) => d.class === "cm-highlight");
      expect(hlDecos.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("links", () => {
    it("applies cm-link class to link text", () => {
      const view = createView("[click here](https://example.com)");
      const decos = getStyleDecos(view);

      const linkDecos = decos.filter((d) => d.class === "cm-link");
      expect(linkDecos.length).toBeGreaterThanOrEqual(1);
      const linkText = linkDecos.find((d) =>
        view.state.doc.sliceString(d.from, d.to) === "click here"
      );
      expect(linkText).toBeDefined();
    });
  });

  describe("code blocks", () => {
    it("applies cm-code-block-line decoration to code block content lines", () => {
      const doc = "```js\nconst x = 1;\nconst y = 2;\n```";
      const view = createView(doc);
      const decos = getStyleDecos(view);

      // Line decorations have from === to (point decorations at line start)
      const codeBlockLines = decos.filter((d) => d.class === "cm-code-block-line");
      // Should have 2 code content lines (lines 2 and 3, not the fence lines)
      expect(codeBlockLines).toHaveLength(2);
    });

    it("no code-block-line decoration for empty code block", () => {
      const doc = "```\n```";
      const view = createView(doc);
      const decos = getStyleDecos(view);

      const codeBlockLines = decos.filter((d) => d.class === "cm-code-block-line");
      expect(codeBlockLines).toHaveLength(0);
    });
  });

  describe("lists", () => {
    it("applies cm-list-ul class to unordered list content", () => {
      const view = createView("- list item");
      const decos = getStyleDecos(view);

      const ulDecos = decos.filter((d) => d.class === "cm-list-ul");
      expect(ulDecos.length).toBeGreaterThanOrEqual(1);
    });

    it("applies cm-list-ol class to ordered list content", () => {
      const view = createView("1. ordered item");
      const decos = getStyleDecos(view);

      const olDecos = decos.filter((d) => d.class === "cm-list-ol");
      expect(olDecos.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("StateField caching", () => {
    it("returns same reference when doc unchanged", () => {
      const view = createView("**bold**");
      const decos1 = view.state.field(styleField);

      view.dispatch({ selection: { anchor: 0 } });

      const decos2 = view.state.field(styleField);
      expect(decos1).toBe(decos2);
    });

    it("recomputes when doc changes", () => {
      const view = createView("**bold**");
      const decos1 = view.state.field(styleField);

      view.dispatch({
        changes: { from: view.state.doc.length, insert: "\n*italic*" },
      });

      const decos2 = view.state.field(styleField);
      expect(decos1).not.toBe(decos2);
    });
  });
});
