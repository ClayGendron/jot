/**
 * Tests for Horizontal Rule Decorations
 *
 * Phase 9: Verify horizontal rule markers (---, ***, ___) are replaced
 * with styled <hr> widget decorations.
 */

import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import {
  horizontalRuleField,
  extractHorizontalRuleData,
  type HorizontalRuleData,
} from "../decorations/horizontalRule";

/**
 * Helper to create an editor state with horizontal rule extension
 */
function createTestState(doc: string) {
  return EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM] }), horizontalRuleField],
  });
}

describe("Horizontal Rule Decorations", () => {
  describe("horizontalRuleField", () => {
    it("creates decoration for --- horizontal rule", () => {
      const state = createTestState("Text before\n\n---\n\nText after");
      const decorations = state.field(horizontalRuleField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decoration for *** horizontal rule", () => {
      const state = createTestState("Text before\n\n***\n\nText after");
      const decorations = state.field(horizontalRuleField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decoration for ___ horizontal rule", () => {
      const state = createTestState("Text before\n\n___\n\nText after");
      const decorations = state.field(horizontalRuleField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decoration for long horizontal rules", () => {
      const state = createTestState("---\n\n-----\n\n**********");
      const decorations = state.field(horizontalRuleField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("handles multiple horizontal rules", () => {
      const state = createTestState("Section 1\n\n---\n\nSection 2\n\n***\n\nSection 3");
      const decorations = state.field(horizontalRuleField);

      // Should have decorations for both HRs
      expect(decorations.size).toBeGreaterThanOrEqual(2);
    });

    it("handles empty document", () => {
      const state = createTestState("");
      const decorations = state.field(horizontalRuleField);

      expect(decorations.size).toBe(0);
    });

    it("handles document with no horizontal rules", () => {
      const state = createTestState("Just plain text\n\nWithout any horizontal rules.");
      const decorations = state.field(horizontalRuleField);

      expect(decorations.size).toBe(0);
    });

    it("does not treat --- in code block as horizontal rule", () => {
      const state = createTestState("```\n---\n```");
      const decorations = state.field(horizontalRuleField);

      expect(decorations.size).toBe(0);
    });

    it("does not treat inline dashes as horizontal rule", () => {
      const state = createTestState("Some text with --- inline dashes");
      const decorations = state.field(horizontalRuleField);

      expect(decorations.size).toBe(0);
    });

    it("handles horizontal rule at document start", () => {
      const state = createTestState("---\n\nContent after");
      const decorations = state.field(horizontalRuleField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("handles horizontal rule at document end", () => {
      const state = createTestState("Content before\n\n---");
      const decorations = state.field(horizontalRuleField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("handles horizontal rule with spaces", () => {
      // Markdown allows spaces between markers: - - - or * * *
      const state = createTestState("- - -\n\n* * *");
      const decorations = state.field(horizontalRuleField);

      expect(decorations.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe("extractHorizontalRuleData", () => {
    it("extracts data for --- horizontal rule", () => {
      const state = createTestState("Text\n\n---\n\nMore text");
      const data = extractHorizontalRuleData(state);

      expect(data).toHaveLength(1);
      expect(data[0].marker).toBe("---");
    });

    it("extracts data for *** horizontal rule", () => {
      const state = createTestState("Text\n\n***\n\nMore text");
      const data = extractHorizontalRuleData(state);

      expect(data).toHaveLength(1);
      expect(data[0].marker).toBe("***");
    });

    it("extracts data for ___ horizontal rule", () => {
      const state = createTestState("Text\n\n___\n\nMore text");
      const data = extractHorizontalRuleData(state);

      expect(data).toHaveLength(1);
      expect(data[0].marker).toBe("___");
    });

    it("extracts position data", () => {
      const state = createTestState("Line1\n\n---\n\nLine2");
      const data = extractHorizontalRuleData(state);

      expect(data).toHaveLength(1);
      expect(data[0]).toHaveProperty("from");
      expect(data[0]).toHaveProperty("to");
      expect(data[0].from).toBeGreaterThan(0);
      expect(data[0].to).toBeGreaterThan(data[0].from);
    });

    it("extracts line number", () => {
      const state = createTestState("Line1\n\n---\n\nLine2");
      const data = extractHorizontalRuleData(state);

      expect(data).toHaveLength(1);
      expect(data[0].lineNumber).toBe(3); // 1-indexed, HR is on line 3
    });

    it("extracts multiple horizontal rules in order", () => {
      const state = createTestState("Section 1\n\n---\n\nSection 2\n\n***\n\nSection 3\n\n___");
      const data = extractHorizontalRuleData(state);

      expect(data).toHaveLength(3);
      expect(data[0].marker).toBe("---");
      expect(data[1].marker).toBe("***");
      expect(data[2].marker).toBe("___");

      // Verify order by position
      expect(data[0].from).toBeLessThan(data[1].from);
      expect(data[1].from).toBeLessThan(data[2].from);
    });

    it("returns empty array for document without horizontal rules", () => {
      const state = createTestState("Just plain text");
      const data = extractHorizontalRuleData(state);

      expect(data).toEqual([]);
    });

    it("returns empty array for empty document", () => {
      const state = createTestState("");
      const data = extractHorizontalRuleData(state);

      expect(data).toEqual([]);
    });

    it("handles long horizontal rules", () => {
      const state = createTestState("----------");
      const data = extractHorizontalRuleData(state);

      expect(data).toHaveLength(1);
      expect(data[0].marker).toBe("----------");
    });

    it("handles horizontal rules with spaces", () => {
      const state = createTestState("- - - - -");
      const data = extractHorizontalRuleData(state);

      expect(data).toHaveLength(1);
      expect(data[0].marker).toBe("- - - - -");
    });
  });

  describe("HorizontalRuleData type", () => {
    it("has correct structure", () => {
      const state = createTestState("---");
      const data = extractHorizontalRuleData(state);

      expect(data).toHaveLength(1);

      const hrData: HorizontalRuleData = data[0];
      expect(hrData).toHaveProperty("from");
      expect(hrData).toHaveProperty("to");
      expect(hrData).toHaveProperty("marker");
      expect(hrData).toHaveProperty("lineNumber");

      expect(typeof hrData.from).toBe("number");
      expect(typeof hrData.to).toBe("number");
      expect(typeof hrData.marker).toBe("string");
      expect(typeof hrData.lineNumber).toBe("number");
    });
  });
});
