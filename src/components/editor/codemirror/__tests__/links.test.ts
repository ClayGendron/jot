/**
 * Tests for Link Decorations
 *
 * Phase 4: Verify link markers are hidden, links are clickable,
 * and internal/external links are distinguished.
 */

import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { linkField, extractLinkData } from "../decorations/links";

/**
 * Helper to create an editor state with link extension
 */
function createTestState(doc: string) {
  return EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM] }), linkField],
  });
}

describe("Link Decorations", () => {
  describe("linkField", () => {
    it("creates decorations for a basic link", () => {
      const state = createTestState("[Example](https://example.com)");
      const decorations = state.field(linkField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decorations for multiple links", () => {
      const state = createTestState("[Link 1](url1.md) and [Link 2](url2.md)");
      const decorations = state.field(linkField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("handles empty document", () => {
      const state = createTestState("");
      const decorations = state.field(linkField);

      expect(decorations.size).toBe(0);
    });

    it("handles document with no links", () => {
      const state = createTestState("Just plain text without any links.");
      const decorations = state.field(linkField);

      expect(decorations.size).toBe(0);
    });

    it("creates decoration for internal link (.md file)", () => {
      const state = createTestState("[My Note](notes/my-note.md)");
      const decorations = state.field(linkField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decoration for internal link with heading anchor", () => {
      const state = createTestState("[Section](doc.md#section-1)");
      const decorations = state.field(linkField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("updates decorations when document changes", () => {
      const state1 = createTestState("Plain text");
      const decorations1 = state1.field(linkField);
      expect(decorations1.size).toBe(0);

      const state2 = createTestState("[New Link](url.md)");
      const decorations2 = state2.field(linkField);
      expect(decorations2.size).toBeGreaterThan(0);
    });
  });

  describe("extractLinkData", () => {
    it("extracts basic link data", () => {
      const state = createTestState("[Example](https://example.com)");
      const links = extractLinkData(state);

      expect(links).toHaveLength(1);
      expect(links[0].text).toBe("Example");
      expect(links[0].url).toBe("https://example.com");
    });

    it("extracts multiple links", () => {
      const state = createTestState("[First](url1.md) text [Second](url2.md)");
      const links = extractLinkData(state);

      expect(links).toHaveLength(2);
      expect(links[0].text).toBe("First");
      expect(links[1].text).toBe("Second");
    });

    it("identifies internal links correctly", () => {
      const state = createTestState("[Internal](notes/doc.md)");
      const links = extractLinkData(state);

      expect(links).toHaveLength(1);
      expect(links[0].isInternal).toBe(true);
    });

    it("identifies external links correctly", () => {
      const state = createTestState("[External](https://google.com)");
      const links = extractLinkData(state);

      expect(links).toHaveLength(1);
      expect(links[0].isInternal).toBe(false);
    });

    it("identifies internal link with anchor", () => {
      const state = createTestState("[Section](doc.md#heading)");
      const links = extractLinkData(state);

      expect(links).toHaveLength(1);
      expect(links[0].isInternal).toBe(true);
      expect(links[0].url).toBe("doc.md#heading");
    });

    it("extracts position information", () => {
      const state = createTestState("[Link](url.md)");
      const links = extractLinkData(state);

      expect(links[0].from).toBe(0);
      expect(links[0].to).toBe(14);
    });

    it("handles links with spaces in text", () => {
      const state = createTestState("[Link With Spaces](url.md)");
      const links = extractLinkData(state);

      expect(links[0].text).toBe("Link With Spaces");
    });

    it("handles links with special characters in URL", () => {
      const state = createTestState("[Query](search.md?q=test&page=1)");
      const links = extractLinkData(state);

      expect(links[0].url).toBe("search.md?q=test&page=1");
    });

    it("returns empty array for document with no links", () => {
      const state = createTestState("Just plain text.");
      const links = extractLinkData(state);

      expect(links).toHaveLength(0);
    });

    it("does not extract image syntax as links", () => {
      const state = createTestState("![Alt](image.png)");
      const links = extractLinkData(state);

      // Images have ! prefix and should not be treated as links
      expect(links).toHaveLength(0);
    });

    it("extracts text and URL ranges correctly", () => {
      const state = createTestState("[Text](url.md)");
      const links = extractLinkData(state);

      // Text is between [ and ]
      expect(links[0].textFrom).toBe(1);
      expect(links[0].textTo).toBe(5);
      // URL is between ( and )
      expect(links[0].urlFrom).toBe(7);
      expect(links[0].urlTo).toBe(13);
    });
  });

  describe("Link type detection", () => {
    it("detects http:// as external", () => {
      const state = createTestState("[HTTP](http://example.com)");
      const links = extractLinkData(state);

      expect(links[0].isInternal).toBe(false);
    });

    it("detects https:// as external", () => {
      const state = createTestState("[HTTPS](https://example.com)");
      const links = extractLinkData(state);

      expect(links[0].isInternal).toBe(false);
    });

    it("detects mailto: as external", () => {
      const state = createTestState("[Email](mailto:test@example.com)");
      const links = extractLinkData(state);

      expect(links[0].isInternal).toBe(false);
    });

    it("detects .md file as internal", () => {
      const state = createTestState("[Note](note.md)");
      const links = extractLinkData(state);

      expect(links[0].isInternal).toBe(true);
    });

    it("detects .MD (uppercase) file as internal", () => {
      const state = createTestState("[Note](NOTE.MD)");
      const links = extractLinkData(state);

      expect(links[0].isInternal).toBe(true);
    });

    it("detects relative path .md as internal", () => {
      const state = createTestState("[Note](../folder/note.md)");
      const links = extractLinkData(state);

      expect(links[0].isInternal).toBe(true);
    });
  });

  describe("Code block handling", () => {
    it("does not create decorations for links in inline code", () => {
      const state = createTestState("Use `[link](url.md)` syntax");
      const links = extractLinkData(state);

      // Links inside inline code should be skipped
      expect(links).toHaveLength(0);
    });

    it("does not create decorations for links in fenced code blocks", () => {
      const state = createTestState("```\n[link](url.md)\n```");
      const links = extractLinkData(state);

      // Links inside code blocks should be skipped
      expect(links).toHaveLength(0);
    });
  });

  describe("Edge cases", () => {
    it("handles link at start of document", () => {
      const state = createTestState("[Start](url.md) of text");
      const links = extractLinkData(state);

      expect(links).toHaveLength(1);
      expect(links[0].from).toBe(0);
    });

    it("handles link at end of document", () => {
      const state = createTestState("End with [link](url.md)");
      const links = extractLinkData(state);

      expect(links).toHaveLength(1);
    });

    it("handles adjacent links", () => {
      const state = createTestState("[A](a.md)[B](b.md)");
      const links = extractLinkData(state);

      expect(links).toHaveLength(2);
    });

    it("handles link in heading", () => {
      const state = createTestState("# [Heading Link](doc.md)");
      const links = extractLinkData(state);

      expect(links).toHaveLength(1);
    });

    it("handles link in list item", () => {
      const state = createTestState("- [Item](item.md)");
      const links = extractLinkData(state);

      expect(links).toHaveLength(1);
    });
  });
});
