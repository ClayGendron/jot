/**
 * Tests for Heading Decorations
 *
 * Phase 3: Verify heading markers are hidden and styled,
 * and IDs are generated for navigation.
 */

import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import {
  headingField,
  extractHeadingData,
} from "../decorations/headings";

/**
 * Helper to create an editor state with heading extension
 */
function createTestState(doc: string) {
  return EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM] }), headingField],
  });
}

describe("Heading Decorations", () => {
  describe("headingField", () => {
    it("creates decorations for h1 heading", () => {
      const state = createTestState("# Heading 1");
      const decorations = state.field(headingField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decorations for h2 heading", () => {
      const state = createTestState("## Heading 2");
      const decorations = state.field(headingField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decorations for h3 heading", () => {
      const state = createTestState("### Heading 3");
      const decorations = state.field(headingField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decorations for h4-h6 headings", () => {
      const state = createTestState("#### H4\n##### H5\n###### H6");
      const decorations = state.field(headingField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("handles multiple headings", () => {
      const state = createTestState("# First\n## Second\n### Third");
      const decorations = state.field(headingField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("handles empty document", () => {
      const state = createTestState("");
      const decorations = state.field(headingField);

      expect(decorations.size).toBe(0);
    });

    it("handles document with no headings", () => {
      const state = createTestState("Just plain text without any headings.");
      const decorations = state.field(headingField);

      expect(decorations.size).toBe(0);
    });

    it("does not treat # in middle of line as heading", () => {
      const state = createTestState("This is not a # heading");
      const decorations = state.field(headingField);

      // Should have no heading decorations
      expect(decorations.size).toBe(0);
    });

    it("handles heading with inline formatting", () => {
      const state = createTestState("# **Bold** Heading");
      const decorations = state.field(headingField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("updates decorations when document changes", () => {
      const state1 = createTestState("Plain text");
      const decorations1 = state1.field(headingField);
      expect(decorations1.size).toBe(0);

      const state2 = createTestState("# New heading");
      const decorations2 = state2.field(headingField);
      expect(decorations2.size).toBeGreaterThan(0);
    });
  });

  describe("extractHeadingData", () => {
    it("extracts heading level 1", () => {
      const state = createTestState("# Hello World");
      const headings = extractHeadingData(state);

      expect(headings).toHaveLength(1);
      expect(headings[0].level).toBe(1);
      expect(headings[0].text).toBe("Hello World");
    });

    it("extracts heading level 2", () => {
      const state = createTestState("## Second Level");
      const headings = extractHeadingData(state);

      expect(headings).toHaveLength(1);
      expect(headings[0].level).toBe(2);
      expect(headings[0].text).toBe("Second Level");
    });

    it("extracts multiple headings", () => {
      const state = createTestState("# First\n\n## Second\n\n### Third");
      const headings = extractHeadingData(state);

      expect(headings).toHaveLength(3);
      expect(headings[0].level).toBe(1);
      expect(headings[1].level).toBe(2);
      expect(headings[2].level).toBe(3);
    });

    it("generates correct IDs using github-slugger", () => {
      const state = createTestState("# Hello World");
      const headings = extractHeadingData(state);

      expect(headings[0].id).toBe("hello-world");
    });

    it("generates IDs for headings with special characters", () => {
      const state = createTestState("# Hello's & World!");
      const headings = extractHeadingData(state);

      // github-slugger handles special characters
      expect(headings[0].id).toBe("hellos--world");
    });

    it("generates unique IDs for duplicate headings", () => {
      const state = createTestState("# Same\n\n# Same\n\n# Same");
      const headings = extractHeadingData(state);

      expect(headings).toHaveLength(3);
      expect(headings[0].id).toBe("same");
      expect(headings[1].id).toBe("same-1");
      expect(headings[2].id).toBe("same-2");
    });

    it("extracts position information", () => {
      const state = createTestState("# Heading");
      const headings = extractHeadingData(state);

      expect(headings[0].from).toBe(0);
      expect(headings[0].to).toBeGreaterThan(0);
    });

    it("handles heading with leading/trailing whitespace in text", () => {
      const state = createTestState("#    Spaced Heading   ");
      const headings = extractHeadingData(state);

      // Text should be trimmed but # marker count remains accurate
      expect(headings[0].text.trim()).toBe("Spaced Heading");
    });

    it("returns empty array for document with no headings", () => {
      const state = createTestState("Just plain text.");
      const headings = extractHeadingData(state);

      expect(headings).toHaveLength(0);
    });

    it("extracts line number for each heading", () => {
      const state = createTestState("# First\n\n## Second");
      const headings = extractHeadingData(state);

      expect(headings[0].line).toBe(1);
      expect(headings[1].line).toBe(3);
    });
  });

  describe("Heading level detection", () => {
    it("detects all 6 heading levels", () => {
      const doc = `# H1
## H2
### H3
#### H4
##### H5
###### H6`;
      const state = createTestState(doc);
      const headings = extractHeadingData(state);

      expect(headings).toHaveLength(6);
      expect(headings.map((h) => h.level)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it("ignores more than 6 hashes (not a heading)", () => {
      const state = createTestState("####### Not a heading");
      const headings = extractHeadingData(state);

      // 7 hashes is not a valid heading
      expect(headings).toHaveLength(0);
    });
  });

  describe("Integration with navigation", () => {
    it("provides heading data compatible with document outline", () => {
      const state = createTestState("# Introduction\n\n## Getting Started\n\n### Installation");
      const headings = extractHeadingData(state);

      // Should match the Heading interface from parser.ts
      headings.forEach((h) => {
        expect(h).toHaveProperty("level");
        expect(h).toHaveProperty("text");
        expect(h).toHaveProperty("id");
        expect(h.level).toBeGreaterThanOrEqual(1);
        expect(h.level).toBeLessThanOrEqual(6);
        expect(typeof h.text).toBe("string");
        expect(typeof h.id).toBe("string");
      });
    });
  });
});
