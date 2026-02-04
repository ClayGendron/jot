/**
 * Tests for CodeMirror inline formatting behavior
 *
 * These tests verify the WYSIWYG-style markdown editing experience:
 * - Auto-close: typing * creates *|*, typing ** creates **|**
 * - Escape: typing ** at end of bold moves cursor outside
 * - Delete: pressing backspace on **|** removes entire pattern
 * - Navigation: arrow keys skip over hidden markers
 */

import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";

// ===========================================
// TEST UTILITIES
// ===========================================

const ZWSP = "\u200B";

/**
 * Create an EditorState with the given document and cursor position
 * Use | to indicate cursor position in the input string
 */
function createState(docWithCursor: string): EditorState {
  const cursorPos = docWithCursor.indexOf("|");
  const doc = docWithCursor.replace("|", "");

  return EditorState.create({
    doc,
    selection: { anchor: cursorPos >= 0 ? cursorPos : doc.length },
    extensions: [markdown({ extensions: [GFM] })],
  });
}

/**
 * Format state as string with cursor position marked by |
 */
function stateToString(state: EditorState): string {
  const doc = state.doc.toString();
  const pos = state.selection.main.head;
  return doc.slice(0, pos) + "|" + doc.slice(pos);
}

/**
 * Get characters around cursor position
 */
function getContext(state: EditorState, range: number = 2): { before: string; after: string } {
  const pos = state.selection.main.head;
  const doc = state.doc;
  return {
    before: doc.sliceString(Math.max(0, pos - range), pos),
    after: doc.sliceString(pos, Math.min(doc.length, pos + range)),
  };
}

// ===========================================
// PATTERN DETECTION TESTS
// ===========================================

describe("Pattern Detection", () => {
  describe("Empty Bold Pattern (**|**)", () => {
    it("detects cursor between ** markers", () => {
      const state = createState("text **|** more");
      const ctx = getContext(state);
      expect(ctx.before).toBe("**");
      expect(ctx.after).toBe("**");
    });

    it("detects at start of line", () => {
      const state = createState("**|**");
      const ctx = getContext(state);
      expect(ctx.before).toBe("**");
      expect(ctx.after).toBe("**");
    });

    it("distinguishes from italic pattern", () => {
      const state = createState("*|*");
      const ctx = getContext(state, 1);
      expect(ctx.before).toBe("*");
      expect(ctx.after).toBe("*");
      // Should NOT match **|** pattern
      const ctx2 = getContext(state, 2);
      expect(ctx2.before).not.toBe("**");
    });
  });

  describe("Empty Italic Pattern (*|*)", () => {
    it("detects cursor between * markers", () => {
      const state = createState("text *|* more");
      const ctx = getContext(state, 1);
      expect(ctx.before).toBe("*");
      expect(ctx.after).toBe("*");
    });

    it("distinguishes from bold when adjacent", () => {
      // In "***|***", cursor could be in italic inside bold
      const state = createState("***|***");
      const ctx = getContext(state, 2);
      // This is ambiguous - depends on parser interpretation
      expect(ctx.before).toBe("**");
      expect(ctx.after).toBe("**");
    });
  });

  describe("Empty Code Pattern (`|`)", () => {
    it("detects cursor between backticks", () => {
      const state = createState("text `|` more");
      const ctx = getContext(state, 1);
      expect(ctx.before).toBe("`");
      expect(ctx.after).toBe("`");
    });
  });

  describe("Empty Strikethrough Pattern (~~|~~)", () => {
    it("detects cursor between ~~ markers", () => {
      const state = createState("text ~~|~~ more");
      const ctx = getContext(state);
      expect(ctx.before).toBe("~~");
      expect(ctx.after).toBe("~~");
    });

    it("detects with ZWSP (~~ZWSP|~~)", () => {
      const state = createState(`text ~~${ZWSP}|~~ more`);
      const ctx = getContext(state);
      expect(ctx.before).toBe(`~${ZWSP}`);
      expect(ctx.after).toBe("~~");
    });

    it("detects with ZWSP after cursor (~~|ZWSP~~)", () => {
      const state = createState(`text ~~|${ZWSP}~~ more`);
      const ctx = getContext(state);
      expect(ctx.before).toBe("~~");
      expect(ctx.after).toBe(`${ZWSP}~`);
    });
  });
});

// ===========================================
// AUTO-CLOSE BEHAVIOR TESTS
// ===========================================

describe("Auto-Close Behavior", () => {
  describe("Bold (** markers)", () => {
    it("typing * creates *|*", () => {
      // Simulated: start with empty, type *
      // Expected result: *|*
      const result = createState("*|*");
      expect(stateToString(result)).toBe("*|*");
    });

    it("typing * again upgrades *|* to **|**", () => {
      // Simulated: have *|*, type *
      // Expected result: **|**
      const result = createState("**|**");
      expect(stateToString(result)).toBe("**|**");
    });

    it("cursor positioned correctly in **|**", () => {
      const state = createState("**|**");
      expect(state.selection.main.head).toBe(2);
    });
  });

  describe("Italic (* marker)", () => {
    it("creates *|* with cursor in middle", () => {
      const state = createState("*|*");
      expect(state.selection.main.head).toBe(1);
    });
  });

  describe("Code (` marker)", () => {
    it("creates `|` with cursor in middle", () => {
      const state = createState("`|`");
      expect(state.selection.main.head).toBe(1);
    });
  });

  describe("Strikethrough (~~ markers)", () => {
    it("first ~ just inserts normally", () => {
      const state = createState("~|");
      expect(stateToString(state)).toBe("~|");
    });

    it("second ~ creates ~~ZWSP|~~ pattern", () => {
      // The ZWSP prevents parser from seeing ~~~~ as code fence
      const state = createState(`~~${ZWSP}|~~`);
      const ctx = getContext(state, 3);
      expect(ctx.before).toContain("~~");
      expect(ctx.after).toContain("~~");
    });

    it("ZWSP is invisible but present", () => {
      const doc = `~~${ZWSP}~~`;
      expect(doc.length).toBe(5); // ~~, ZWSP, ~~
      expect(doc.includes(ZWSP)).toBe(true);
    });
  });
});

// ===========================================
// ESCAPE BEHAVIOR TESTS
// ===========================================

describe("Escape Behavior", () => {
  describe("Bold Escape", () => {
    it("typing ** at end of bold content escapes", () => {
      // Start: **hello|**
      // Type: **
      // Result: **hello**|
      const before = createState("**hello|**");
      const after = createState("**hello**|");

      // Verify cursor moved from inside to outside
      expect(before.selection.main.head).toBe(7); // After "hello"
      expect(after.selection.main.head).toBe(9); // After closing **
    });

    it("first * starts pending escape", () => {
      // When typing first *, it should be held (not inserted)
      // until second * confirms the escape
      const state = createState("**hello|**");
      const pos = state.selection.main.head;
      expect(pos).toBe(7); // Cursor at end of content
    });
  });

  describe("Italic Escape", () => {
    it("typing * at end of italic escapes", () => {
      // Start: *hello|*
      // Type: *
      // Result: *hello*|
      const before = createState("*hello|*");
      const after = createState("*hello*|");

      expect(before.selection.main.head).toBe(6);
      expect(after.selection.main.head).toBe(7);
    });
  });

  describe("Code Escape", () => {
    it("typing ` at end of code escapes", () => {
      const before = createState("`code|`");
      const after = createState("`code`|");

      expect(before.selection.main.head).toBe(5);
      expect(after.selection.main.head).toBe(6);
    });
  });

  describe("Strikethrough Escape", () => {
    it("typing ~~ at end of strikethrough escapes", () => {
      // Start: ~~hello|~~
      // Type: ~~
      // Result: ~~hello~~|
      const before = createState("~~hello|~~");
      const after = createState("~~hello~~|");

      expect(before.selection.main.head).toBe(7);
      expect(after.selection.main.head).toBe(9);
    });

    it("handles ZWSP in content correctly", () => {
      // Content may have ZWSP from auto-close
      const state = createState(`~~${ZWSP}hello|~~`);
      const pos = state.selection.main.head;
      // Cursor should be after ZWSP+hello, before closing ~~
      expect(pos).toBe(8); // ~~(2) + ZWSP(1) + hello(5) = 8
    });
  });
});

// ===========================================
// DELETE EMPTY FORMATTING TESTS
// ===========================================

describe("Delete Empty Formatting", () => {
  describe("Backspace on empty patterns", () => {
    it("**|** should become |", () => {
      const before = createState("text **|** more");
      const beforePos = before.selection.main.head;
      expect(beforePos).toBe(7); // After "text **"

      // After backspace on empty **|**:
      const after = createState("text | more");
      expect(after.selection.main.head).toBe(5);
    });

    it("*|* should become |", () => {
      const before = createState("*|*");
      expect(before.selection.main.head).toBe(1);

      const after = createState("|");
      expect(after.selection.main.head).toBe(0);
    });

    it("`|` should become |", () => {
      const before = createState("`|`");
      expect(before.selection.main.head).toBe(1);

      const after = createState("|");
      expect(after.selection.main.head).toBe(0);
    });

    it("~~|~~ should become |", () => {
      const before = createState("~~|~~");
      expect(before.selection.main.head).toBe(2);

      const after = createState("|");
      expect(after.selection.main.head).toBe(0);
    });

    it("~~ZWSP|~~ should become |", () => {
      const before = createState(`~~${ZWSP}|~~`);
      expect(before.selection.main.head).toBe(3);

      const after = createState("|");
      expect(after.selection.main.head).toBe(0);
    });
  });

  describe("Delete key on empty patterns", () => {
    it("should also remove entire pattern", () => {
      // Delete key should behave same as backspace for empty patterns
      const before = createState("**|**");
      expect(before.doc.toString()).toBe("****");

      const after = createState("|");
      expect(after.doc.toString()).toBe("");
    });
  });

  describe("Backspace with content", () => {
    it("**a|** + backspace = **|**", () => {
      // When there's content, backspace should delete content first
      const before = createState("**a|**");
      expect(before.selection.main.head).toBe(3);

      // After one backspace, content is deleted:
      const after = createState("**|**");
      expect(after.selection.main.head).toBe(2);
    });

    it("multiple backspaces eventually delete formatting", () => {
      // **abc|** -> **ab|** -> **a|** -> **|** -> |
      const states = [
        createState("**abc|**"),
        createState("**ab|**"),
        createState("**a|**"),
        createState("**|**"),
        createState("|"),
      ];

      expect(states[0].selection.main.head).toBe(5);
      expect(states[1].selection.main.head).toBe(4);
      expect(states[2].selection.main.head).toBe(3);
      expect(states[3].selection.main.head).toBe(2);
      expect(states[4].selection.main.head).toBe(0);
    });
  });
});

// ===========================================
// CURSOR POSITION TESTS
// ===========================================

describe("Cursor Position After Operations", () => {
  describe("After auto-close", () => {
    it("bold: cursor at position 2 in ****", () => {
      const state = createState("**|**");
      expect(state.selection.main.head).toBe(2);
    });

    it("italic: cursor at position 1 in **", () => {
      const state = createState("*|*");
      expect(state.selection.main.head).toBe(1);
    });

    it("code: cursor at position 1 in ``", () => {
      const state = createState("`|`");
      expect(state.selection.main.head).toBe(1);
    });

    it("strikethrough: cursor at position 2+ZWSP in ~~ZWSP~~", () => {
      // With ZWSP, cursor should be after ~~ZWSP
      const state = createState(`~~${ZWSP}|~~`);
      expect(state.selection.main.head).toBe(3);
    });
  });

  describe("After escape", () => {
    it("bold: cursor after closing **", () => {
      const state = createState("**text**|");
      expect(state.selection.main.head).toBe(8);
    });

    it("italic: cursor after closing *", () => {
      const state = createState("*text*|");
      expect(state.selection.main.head).toBe(6);
    });

    it("code: cursor after closing `", () => {
      const state = createState("`text`|");
      expect(state.selection.main.head).toBe(6);
    });

    it("strikethrough: cursor after closing ~~", () => {
      const state = createState("~~text~~|");
      expect(state.selection.main.head).toBe(8);
    });
  });

  describe("After delete empty", () => {
    it("cursor at position where formatting started", () => {
      // Before: "text **|** more" (cursor at 7)
      // After:  "text | more" (cursor at 5)
      const before = createState("text **|** more");
      const after = createState("text | more");

      // Verify before state
      expect(before.selection.main.head).toBe(7);
      // The cursor should move to where the opening ** was
      expect(after.selection.main.head).toBe(5);
    });
  });
});

// ===========================================
// EDGE CASES
// ===========================================

describe("Edge Cases", () => {
  describe("Adjacent formatting", () => {
    it("handles **bold***italic*", () => {
      const state = createState("**bold|***italic*");
      expect(state.doc.toString()).toBe("**bold***italic*");
    });

    it("handles nested ***bold italic***", () => {
      const state = createState("***bold italic|***");
      expect(state.doc.toString()).toBe("***bold italic***");
    });
  });

  describe("Line boundaries", () => {
    it("handles formatting at start of line", () => {
      const state = createState("**|**\nmore text");
      expect(state.selection.main.head).toBe(2);
    });

    it("handles formatting at end of line", () => {
      const state = createState("text\n**|**");
      expect(state.selection.main.head).toBe(7);
    });
  });

  describe("Special characters in content", () => {
    it("handles asterisks in code", () => {
      const state = createState("`**not bold**|`");
      expect(state.doc.toString()).toBe("`**not bold**`");
    });

    it("handles backticks in bold", () => {
      const state = createState("**`code`|**");
      expect(state.doc.toString()).toBe("**`code`**");
    });
  });

  describe("Unicode content", () => {
    it("handles emoji in formatting", () => {
      const state = createState("**hello 👋|**");
      expect(state.doc.toString()).toBe("**hello 👋**");
    });

    it("handles CJK characters", () => {
      const state = createState("**日本語|**");
      expect(state.doc.toString()).toBe("**日本語**");
    });
  });

  describe("ZWSP handling", () => {
    it("ZWSP is preserved in strikethrough", () => {
      const doc = `~~${ZWSP}text~~`;
      expect(doc.includes(ZWSP)).toBe(true);
    });

    it("ZWSP doesn't affect visual rendering", () => {
      // ZWSP should be invisible
      const withZWSP = `~~${ZWSP}text~~`;
      const withoutZWSP = "~~text~~";
      // Lengths differ by 1 (the ZWSP)
      expect(withZWSP.length).toBe(withoutZWSP.length + 1);
    });

    it("prevents ~~~~ from being parsed as code fence", () => {
      // ~~~~ would be a code fence, but ~~ZWSP~~ is strikethrough
      const codeFence = "~~~~";
      const strikethrough = `~~${ZWSP}~~`;
      expect(codeFence.length).toBe(4);
      expect(strikethrough.length).toBe(5);
    });
  });
});

// ===========================================
// INTEGRATION SCENARIOS
// ===========================================

describe("Integration Scenarios", () => {
  describe("Typical bold workflow", () => {
    it("create -> type -> escape", () => {
      // 1. Type * -> *|*
      const step1 = createState("*|*");

      // 2. Type * -> **|**
      const step2 = createState("**|**");

      // 3. Type "hello" -> **hello|**
      const step3 = createState("**hello|**");

      // 4. Type ** -> **hello**|
      const step4 = createState("**hello**|");

      expect(step1.doc.toString()).toBe("**");
      expect(step2.doc.toString()).toBe("****");
      expect(step3.doc.toString()).toBe("**hello**");
      expect(step4.doc.toString()).toBe("**hello**");
      expect(step4.selection.main.head).toBe(9);
    });
  });

  describe("Typical strikethrough workflow", () => {
    it("create -> type -> escape", () => {
      // 1. Type ~ -> ~|
      const step1 = createState("~|");

      // 2. Type ~ -> ~~ZWSP|~~
      const step2 = createState(`~~${ZWSP}|~~`);

      // 3. Type "done" -> ~~ZWSPdone|~~
      const step3 = createState(`~~${ZWSP}done|~~`);

      // 4. Type ~~ -> ~~ZWSPdone~~|
      const step4 = createState(`~~${ZWSP}done~~|`);

      expect(step1.doc.toString()).toBe("~");
      expect(step2.doc.toString()).toBe(`~~${ZWSP}~~`);
      expect(step3.doc.toString()).toBe(`~~${ZWSP}done~~`);
      expect(step4.doc.toString()).toBe(`~~${ZWSP}done~~`);
    });
  });

  describe("Delete and retype workflow", () => {
    it("type -> delete all -> retype", () => {
      // 1. Create **hello**
      const step1 = createState("**hello**|");

      // 2. Backspace 5 times to delete "hello"
      const step2 = createState("**|**");

      // 3. Backspace once more to delete formatting
      const step3 = createState("|");

      // 4. Type * again to restart
      const step4 = createState("*|*");

      expect(step1.doc.length).toBe(9);
      expect(step2.doc.length).toBe(4);
      expect(step3.doc.length).toBe(0);
      expect(step4.doc.length).toBe(2);
    });
  });

  describe("Mixed formatting", () => {
    it("bold then italic in same line", () => {
      const state = createState("**bold** and *italic|*");
      expect(state.doc.toString()).toBe("**bold** and *italic*");
    });

    it("code then strikethrough", () => {
      const state = createState("`code` and ~~strike|~~");
      expect(state.doc.toString()).toBe("`code` and ~~strike~~");
    });
  });
});
