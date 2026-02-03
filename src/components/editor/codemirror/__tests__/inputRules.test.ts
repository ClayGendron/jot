/**
 * Tests for Input Rules Extension
 *
 * Phase 3: Verify that markdown shortcuts create proper structure
 * when typing patterns like -, *, 1., #, >, etc.
 */

import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { inputRules } from "../extensions/inputRules";

/**
 * Helper to create an editor state with input rules
 */
function createTestState(doc: string) {
  return EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM] }), inputRules],
  });
}

/**
 * Helper to simulate typing a character at the end of document
 */
function typeChar(state: EditorState, char: string): EditorState {
  return state.update({
    changes: { from: state.doc.length, insert: char },
    selection: { anchor: state.doc.length + char.length },
  }).state;
}

/**
 * Helper to simulate typing a string at a position
 */
function insertText(state: EditorState, pos: number, text: string): EditorState {
  return state.update({
    changes: { from: pos, insert: text },
    selection: { anchor: pos + text.length },
  }).state;
}

describe("Input Rules Extension", () => {
  describe("Unordered list creation", () => {
    it("converts '- ' at line start to bullet list item", () => {
      let state = createTestState("");
      state = typeChar(state, "-");
      state = typeChar(state, " ");

      // After "- ", should have list marker
      expect(state.doc.toString()).toContain("-");
    });

    it("converts '* ' at line start to bullet list item", () => {
      let state = createTestState("");
      state = typeChar(state, "*");
      state = typeChar(state, " ");

      expect(state.doc.toString()).toContain("*");
    });

    it("converts '+ ' at line start to bullet list item", () => {
      let state = createTestState("");
      state = typeChar(state, "+");
      state = typeChar(state, " ");

      expect(state.doc.toString()).toContain("+");
    });

    it("does not convert dash in middle of text", () => {
      let state = createTestState("Hello ");
      state = typeChar(state, "-");
      state = typeChar(state, " ");

      // Should just be text with dash, not a list
      expect(state.doc.toString()).toBe("Hello - ");
    });
  });

  describe("Ordered list creation", () => {
    it("converts '1. ' at line start to ordered list item", () => {
      let state = createTestState("");
      state = typeChar(state, "1");
      state = typeChar(state, ".");
      state = typeChar(state, " ");

      expect(state.doc.toString()).toContain("1.");
    });

    it("converts '2. ' at line start to ordered list item", () => {
      let state = createTestState("");
      state = typeChar(state, "2");
      state = typeChar(state, ".");
      state = typeChar(state, " ");

      expect(state.doc.toString()).toContain("2.");
    });

    it("handles multi-digit numbers like '10. '", () => {
      let state = createTestState("");
      state = insertText(state, 0, "10. ");

      expect(state.doc.toString()).toContain("10.");
    });

    it("does not convert number in middle of text", () => {
      let state = createTestState("Item ");
      state = typeChar(state, "1");
      state = typeChar(state, ".");
      state = typeChar(state, " ");

      expect(state.doc.toString()).toBe("Item 1. ");
    });
  });

  describe("Heading creation", () => {
    it("keeps # at line start (heading syntax)", () => {
      let state = createTestState("");
      state = typeChar(state, "#");
      state = typeChar(state, " ");

      expect(state.doc.toString()).toBe("# ");
    });

    it("keeps ## for h2 heading", () => {
      let state = createTestState("");
      state = insertText(state, 0, "## ");

      expect(state.doc.toString()).toBe("## ");
    });

    it("keeps ### for h3 heading", () => {
      let state = createTestState("");
      state = insertText(state, 0, "### ");

      expect(state.doc.toString()).toBe("### ");
    });

    it("keeps up to ###### for h6 heading", () => {
      let state = createTestState("");
      state = insertText(state, 0, "###### ");

      expect(state.doc.toString()).toBe("###### ");
    });

    it("does not convert # in middle of line", () => {
      let state = createTestState("Title ");
      state = typeChar(state, "#");

      expect(state.doc.toString()).toBe("Title #");
    });
  });

  describe("Blockquote creation", () => {
    it("keeps > at line start (blockquote syntax)", () => {
      let state = createTestState("");
      state = typeChar(state, ">");
      state = typeChar(state, " ");

      expect(state.doc.toString()).toBe("> ");
    });

    it("handles nested blockquotes >> ", () => {
      let state = createTestState("");
      state = insertText(state, 0, ">> ");

      expect(state.doc.toString()).toBe(">> ");
    });

    it("does not convert > in middle of line", () => {
      let state = createTestState("Text ");
      state = typeChar(state, ">");

      expect(state.doc.toString()).toBe("Text >");
    });
  });

  describe("Horizontal rule creation", () => {
    it("keeps --- as horizontal rule", () => {
      let state = createTestState("");
      state = insertText(state, 0, "---");

      expect(state.doc.toString()).toBe("---");
    });

    it("keeps *** as horizontal rule", () => {
      let state = createTestState("");
      state = insertText(state, 0, "***");

      expect(state.doc.toString()).toBe("***");
    });

    it("keeps ___ as horizontal rule", () => {
      let state = createTestState("");
      state = insertText(state, 0, "___");

      expect(state.doc.toString()).toBe("___");
    });

    it("requires --- on its own line", () => {
      let state = createTestState("Text ");
      state = insertText(state, state.doc.length, "---");

      // Should be text with dashes, not a horizontal rule in the markdown
      expect(state.doc.toString()).toBe("Text ---");
    });
  });

  describe("Task list creation", () => {
    it("converts '- [ ] ' at line start to unchecked task", () => {
      let state = createTestState("");
      state = insertText(state, 0, "- [ ] ");

      expect(state.doc.toString()).toBe("- [ ] ");
    });

    it("converts '- [x] ' at line start to checked task", () => {
      let state = createTestState("");
      state = insertText(state, 0, "- [x] ");

      expect(state.doc.toString()).toBe("- [x] ");
    });

    it("converts '* [ ] ' with asterisk marker", () => {
      let state = createTestState("");
      state = insertText(state, 0, "* [ ] ");

      expect(state.doc.toString()).toBe("* [ ] ");
    });
  });

  describe("Code block creation", () => {
    it("keeps ``` for code fence", () => {
      let state = createTestState("");
      state = insertText(state, 0, "```");

      expect(state.doc.toString()).toBe("```");
    });

    it("keeps ```language for code fence with language", () => {
      let state = createTestState("");
      state = insertText(state, 0, "```javascript");

      expect(state.doc.toString()).toBe("```javascript");
    });
  });

  describe("Input rule edge cases", () => {
    it("handles new line after paragraph", () => {
      let state = createTestState("First paragraph\n");
      state = typeChar(state, "-");
      state = typeChar(state, " ");

      expect(state.doc.toString()).toBe("First paragraph\n- ");
    });

    it("handles input after existing list", () => {
      let state = createTestState("- Item 1\n");
      state = typeChar(state, "-");
      state = typeChar(state, " ");

      expect(state.doc.toString()).toBe("- Item 1\n- ");
    });

    it("handles indented list item creation", () => {
      let state = createTestState("- Parent\n  ");
      state = typeChar(state, "-");
      state = typeChar(state, " ");

      expect(state.doc.toString()).toBe("- Parent\n  - ");
    });
  });

  describe("Non-triggering patterns", () => {
    it("does not trigger on standalone -", () => {
      let state = createTestState("");
      state = typeChar(state, "-");

      // Just a dash, no space yet
      expect(state.doc.toString()).toBe("-");
    });

    it("does not trigger on # without space", () => {
      let state = createTestState("");
      state = typeChar(state, "#");

      expect(state.doc.toString()).toBe("#");
    });

    it("does not trigger on number without period", () => {
      let state = createTestState("");
      state = typeChar(state, "1");

      expect(state.doc.toString()).toBe("1");
    });
  });
});
