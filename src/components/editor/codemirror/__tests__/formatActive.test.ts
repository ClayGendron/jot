/**
 * Tests for Format Active Detection
 *
 * Phase 2: Verify detection of cursor position inside formatting
 * for toolbar active states.
 */

import { describe, it, expect } from "vitest";
import { EditorState, EditorSelection } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import {
  isFormatActive,
  isBoldActive,
  isItalicActive,
  isStrikethroughActive,
  isCodeActive,
  getActiveFormats,
  getHeadingLevel,
  isBulletListActive,
  isOrderedListActive,
  isTaskListActive,
  isBlockquoteActive,
  isCodeBlockActive,
  getActiveBlockFormat,
} from "../utils/formatActive";

/**
 * Helper to create an editor state with cursor at specific position
 */
function createTestState(doc: string, cursorPos: number): EditorState {
  return EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM] })],
    selection: EditorSelection.cursor(cursorPos),
  });
}

describe("Format Active Detection", () => {
  describe("isBoldActive", () => {
    it("returns true when cursor is inside bold text", () => {
      const state = createTestState("This is **bold** text", 12); // Inside "bold"
      expect(isBoldActive(state)).toBe(true);
    });

    it("returns false when cursor is outside bold text", () => {
      const state = createTestState("This is **bold** text", 3); // In "This"
      expect(isBoldActive(state)).toBe(false);
    });

    it("returns false when document has no bold", () => {
      const state = createTestState("Plain text", 5);
      expect(isBoldActive(state)).toBe(false);
    });

    it("handles cursor at start of bold text", () => {
      const state = createTestState("**bold**", 2); // Right after **
      expect(isBoldActive(state)).toBe(true);
    });

    it("handles cursor at end of bold text", () => {
      const state = createTestState("**bold**", 6); // Right before **
      expect(isBoldActive(state)).toBe(true);
    });
  });

  describe("isItalicActive", () => {
    it("returns true when cursor is inside italic text", () => {
      const state = createTestState("This is *italic* text", 11); // Inside "italic"
      expect(isItalicActive(state)).toBe(true);
    });

    it("returns false when cursor is outside italic text", () => {
      const state = createTestState("This is *italic* text", 3);
      expect(isItalicActive(state)).toBe(false);
    });

    it("distinguishes italic from bold", () => {
      const state = createTestState("**bold** and *italic*", 19); // Inside italic
      expect(isItalicActive(state)).toBe(true);
      expect(isBoldActive(state)).toBe(false);
    });
  });

  describe("isStrikethroughActive", () => {
    it("returns true when cursor is inside strikethrough", () => {
      const state = createTestState("This is ~~deleted~~ text", 14); // Inside "deleted"
      expect(isStrikethroughActive(state)).toBe(true);
    });

    it("returns false when cursor is outside strikethrough", () => {
      const state = createTestState("This is ~~deleted~~ text", 3);
      expect(isStrikethroughActive(state)).toBe(false);
    });
  });

  describe("isCodeActive", () => {
    it("returns true when cursor is inside inline code", () => {
      const state = createTestState("This is `code` text", 11); // Inside "code"
      expect(isCodeActive(state)).toBe(true);
    });

    it("returns false when cursor is outside inline code", () => {
      const state = createTestState("This is `code` text", 3);
      expect(isCodeActive(state)).toBe(false);
    });
  });

  describe("isFormatActive (generic)", () => {
    it("detects StrongEmphasis node for bold", () => {
      const state = createTestState("**bold**", 4);
      expect(isFormatActive(state, "StrongEmphasis")).toBe(true);
    });

    it("detects Emphasis node for italic", () => {
      const state = createTestState("*italic*", 3);
      expect(isFormatActive(state, "Emphasis")).toBe(true);
    });

    it("detects Strikethrough node", () => {
      const state = createTestState("~~strike~~", 5);
      expect(isFormatActive(state, "Strikethrough")).toBe(true);
    });

    it("detects InlineCode node", () => {
      const state = createTestState("`code`", 3);
      expect(isFormatActive(state, "InlineCode")).toBe(true);
    });
  });

  describe("getActiveFormats", () => {
    it("returns empty set for plain text", () => {
      const state = createTestState("Plain text", 5);
      const formats = getActiveFormats(state);
      expect(formats.size).toBe(0);
    });

    it("returns bold when cursor in bold", () => {
      const state = createTestState("**bold**", 4);
      const formats = getActiveFormats(state);
      expect(formats.has("bold")).toBe(true);
    });

    it("returns italic when cursor in italic", () => {
      const state = createTestState("*italic*", 4);
      const formats = getActiveFormats(state);
      expect(formats.has("italic")).toBe(true);
    });

    it("returns multiple formats for nested formatting", () => {
      const state = createTestState("***bold and italic***", 10);
      const formats = getActiveFormats(state);
      expect(formats.has("bold")).toBe(true);
      expect(formats.has("italic")).toBe(true);
    });

    it("returns strikethrough when cursor in strikethrough", () => {
      const state = createTestState("~~strike~~", 5);
      const formats = getActiveFormats(state);
      expect(formats.has("strikethrough")).toBe(true);
    });

    it("returns code when cursor in inline code", () => {
      const state = createTestState("`code`", 3);
      const formats = getActiveFormats(state);
      expect(formats.has("code")).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("handles empty document", () => {
      const state = createTestState("", 0);
      expect(isBoldActive(state)).toBe(false);
      expect(getActiveFormats(state).size).toBe(0);
    });

    it("handles cursor at document start", () => {
      const state = createTestState("**bold**", 0);
      expect(isBoldActive(state)).toBe(false);
    });

    it("handles cursor at document end", () => {
      // Cursor at position 8 is at the end of the StrongEmphasis node boundary
      // The parser considers this position still within the node
      const state = createTestState("**bold**", 8);
      expect(isBoldActive(state)).toBe(true);
    });

    it("handles cursor after bold with trailing text", () => {
      // Cursor after the closing ** in "**bold** text"
      const state = createTestState("**bold** text", 9);
      expect(isBoldActive(state)).toBe(false);
    });

    it("handles adjacent formatting", () => {
      const state = createTestState("**bold***italic*", 13); // In italic
      expect(isBoldActive(state)).toBe(false);
      expect(isItalicActive(state)).toBe(true);
    });
  });
});

// Phase 8: Block-level format detection tests
describe("Block Format Active Detection", () => {
  describe("getHeadingLevel", () => {
    it("returns 1 for H1", () => {
      const state = createTestState("# Heading 1", 5);
      expect(getHeadingLevel(state)).toBe(1);
    });

    it("returns 2 for H2", () => {
      const state = createTestState("## Heading 2", 5);
      expect(getHeadingLevel(state)).toBe(2);
    });

    it("returns 3 for H3", () => {
      const state = createTestState("### Heading 3", 5);
      expect(getHeadingLevel(state)).toBe(3);
    });

    it("returns 4 for H4", () => {
      const state = createTestState("#### Heading 4", 5);
      expect(getHeadingLevel(state)).toBe(4);
    });

    it("returns 5 for H5", () => {
      const state = createTestState("##### Heading 5", 5);
      expect(getHeadingLevel(state)).toBe(5);
    });

    it("returns 6 for H6", () => {
      const state = createTestState("###### Heading 6", 5);
      expect(getHeadingLevel(state)).toBe(6);
    });

    it("returns 0 for non-heading", () => {
      const state = createTestState("Plain text", 5);
      expect(getHeadingLevel(state)).toBe(0);
    });

    it("works at start of heading", () => {
      const state = createTestState("# Heading", 2);
      expect(getHeadingLevel(state)).toBe(1);
    });

    it("works at end of heading", () => {
      const state = createTestState("## Heading", 10);
      expect(getHeadingLevel(state)).toBe(2);
    });

    it("returns 0 when on different line", () => {
      const state = createTestState("# Heading\nPlain text", 15);
      expect(getHeadingLevel(state)).toBe(0);
    });
  });

  describe("isBulletListActive", () => {
    it("returns true for - bullet", () => {
      const state = createTestState("- List item", 5);
      expect(isBulletListActive(state)).toBe(true);
    });

    it("returns true for * bullet", () => {
      const state = createTestState("* List item", 5);
      expect(isBulletListActive(state)).toBe(true);
    });

    it("returns true for + bullet", () => {
      const state = createTestState("+ List item", 5);
      expect(isBulletListActive(state)).toBe(true);
    });

    it("returns false for plain text", () => {
      const state = createTestState("Plain text", 5);
      expect(isBulletListActive(state)).toBe(false);
    });

    it("returns false for ordered list", () => {
      const state = createTestState("1. Ordered item", 5);
      expect(isBulletListActive(state)).toBe(false);
    });

    it("returns false for task list", () => {
      const state = createTestState("- [ ] Task item", 10);
      expect(isBulletListActive(state)).toBe(false);
    });
  });

  describe("isOrderedListActive", () => {
    it("returns true for numbered list", () => {
      const state = createTestState("1. First item", 5);
      expect(isOrderedListActive(state)).toBe(true);
    });

    it("returns true for multi-digit number", () => {
      const state = createTestState("42. Item forty-two", 5);
      expect(isOrderedListActive(state)).toBe(true);
    });

    it("returns false for plain text", () => {
      const state = createTestState("Plain text", 5);
      expect(isOrderedListActive(state)).toBe(false);
    });

    it("returns false for bullet list", () => {
      const state = createTestState("- Bullet item", 5);
      expect(isOrderedListActive(state)).toBe(false);
    });
  });

  describe("isTaskListActive", () => {
    it("returns true for unchecked task", () => {
      const state = createTestState("- [ ] Todo item", 10);
      expect(isTaskListActive(state)).toBe(true);
    });

    it("returns true for checked task (lowercase)", () => {
      const state = createTestState("- [x] Done item", 10);
      expect(isTaskListActive(state)).toBe(true);
    });

    it("returns true for checked task (uppercase)", () => {
      const state = createTestState("- [X] Done item", 10);
      expect(isTaskListActive(state)).toBe(true);
    });

    it("returns false for plain text", () => {
      const state = createTestState("Plain text", 5);
      expect(isTaskListActive(state)).toBe(false);
    });

    it("returns false for regular bullet", () => {
      const state = createTestState("- Bullet item", 5);
      expect(isTaskListActive(state)).toBe(false);
    });
  });

  describe("isBlockquoteActive", () => {
    it("returns true for single-level quote", () => {
      const state = createTestState("> Quoted text", 5);
      expect(isBlockquoteActive(state)).toBe(true);
    });

    it("returns true for nested quote", () => {
      const state = createTestState(">> Nested quote", 5);
      expect(isBlockquoteActive(state)).toBe(true);
    });

    it("returns false for plain text", () => {
      const state = createTestState("Plain text", 5);
      expect(isBlockquoteActive(state)).toBe(false);
    });

    it("works at quote marker", () => {
      const state = createTestState("> Quote", 0);
      expect(isBlockquoteActive(state)).toBe(true);
    });
  });

  describe("isCodeBlockActive", () => {
    it("returns true when cursor inside code block", () => {
      const state = createTestState("```\ncode here\n```", 7);
      expect(isCodeBlockActive(state)).toBe(true);
    });

    it("returns true with language specifier", () => {
      const state = createTestState("```javascript\ncode here\n```", 18);
      expect(isCodeBlockActive(state)).toBe(true);
    });

    it("returns false for plain text", () => {
      const state = createTestState("Plain text", 5);
      expect(isCodeBlockActive(state)).toBe(false);
    });

    it("returns false outside code block", () => {
      const state = createTestState("Before\n```\ncode\n```\nAfter", 22);
      expect(isCodeBlockActive(state)).toBe(false);
    });
  });

  describe("getActiveBlockFormat", () => {
    it("returns heading for heading line", () => {
      const state = createTestState("## Heading", 5);
      const format = getActiveBlockFormat(state);
      expect(format).toBe("heading");
    });

    it("returns bulletList for bullet line", () => {
      const state = createTestState("- Item", 3);
      const format = getActiveBlockFormat(state);
      expect(format).toBe("bulletList");
    });

    it("returns orderedList for numbered line", () => {
      const state = createTestState("1. Item", 3);
      const format = getActiveBlockFormat(state);
      expect(format).toBe("orderedList");
    });

    it("returns taskList for task line", () => {
      const state = createTestState("- [ ] Task", 8);
      const format = getActiveBlockFormat(state);
      expect(format).toBe("taskList");
    });

    it("returns blockquote for quote line", () => {
      const state = createTestState("> Quote", 3);
      const format = getActiveBlockFormat(state);
      expect(format).toBe("blockquote");
    });

    it("returns codeBlock when in code fence", () => {
      const state = createTestState("```\ncode\n```", 5);
      const format = getActiveBlockFormat(state);
      expect(format).toBe("codeBlock");
    });

    it("returns paragraph for plain text", () => {
      const state = createTestState("Plain text", 5);
      const format = getActiveBlockFormat(state);
      expect(format).toBe("paragraph");
    });
  });
});
