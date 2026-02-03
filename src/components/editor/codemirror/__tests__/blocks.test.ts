/**
 * Tests for Block-level Commands
 *
 * Phase 8: Tests for heading, list, blockquote, code block, horizontal rule,
 * link, and image commands.
 */

import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import {
  toggleHeading,
  setParagraph,
  toggleBulletList,
  toggleOrderedList,
  toggleTaskList,
  toggleBlockquote,
  toggleCodeBlock,
  insertHorizontalRule,
  insertLink,
  insertImage,
} from "../commands/blocks";

/**
 * Create a test editor with given content and cursor position
 * Use | to mark cursor position in content string
 */
function createEditor(content: string): EditorView {
  const cursorPos = content.indexOf("|");
  const doc = content.replace("|", "");

  const state = EditorState.create({
    doc,
    selection: { anchor: cursorPos >= 0 ? cursorPos : 0 },
    extensions: [markdown({ extensions: [GFM] })],
  });

  return new EditorView({ state });
}

/**
 * Create editor with a selection range
 * Use |...| to mark selection
 */
function createEditorWithSelection(content: string): EditorView {
  const start = content.indexOf("|");
  const end = content.lastIndexOf("|") - 1; // -1 because first | is removed
  const doc = content.replace(/\|/g, "");

  const state = EditorState.create({
    doc,
    selection: { anchor: start, head: end },
    extensions: [markdown({ extensions: [GFM] })],
  });

  return new EditorView({ state });
}

function getContent(view: EditorView): string {
  return view.state.doc.toString();
}

describe("toggleHeading", () => {
  describe("adding headings", () => {
    it("adds H1 to plain text line", () => {
      const view = createEditor("Hello| world");
      toggleHeading(view, 1);
      expect(getContent(view)).toBe("# Hello world");
    });

    it("adds H2 to plain text line", () => {
      const view = createEditor("Hello| world");
      toggleHeading(view, 2);
      expect(getContent(view)).toBe("## Hello world");
    });

    it("adds H3 to plain text line", () => {
      const view = createEditor("|Some text");
      toggleHeading(view, 3);
      expect(getContent(view)).toBe("### Some text");
    });

    it("adds heading to empty line", () => {
      const view = createEditor("|");
      toggleHeading(view, 1);
      expect(getContent(view)).toBe("# ");
    });
  });

  describe("changing heading levels", () => {
    it("changes H1 to H2", () => {
      const view = createEditor("# Hello| world");
      toggleHeading(view, 2);
      expect(getContent(view)).toBe("## Hello world");
    });

    it("changes H3 to H1", () => {
      const view = createEditor("### Deep| heading");
      toggleHeading(view, 1);
      expect(getContent(view)).toBe("# Deep heading");
    });

    it("changes H2 to H4", () => {
      const view = createEditor("## |Subtitle");
      toggleHeading(view, 4);
      expect(getContent(view)).toBe("#### Subtitle");
    });
  });

  describe("removing headings (toggle off)", () => {
    it("removes H1 when toggling H1 on H1 line", () => {
      const view = createEditor("# Hello| world");
      toggleHeading(view, 1);
      expect(getContent(view)).toBe("Hello world");
    });

    it("removes H3 when toggling H3 on H3 line", () => {
      const view = createEditor("### Deep| heading");
      toggleHeading(view, 3);
      expect(getContent(view)).toBe("Deep heading");
    });
  });

  describe("edge cases", () => {
    it("handles heading with no space after #", () => {
      const view = createEditor("#NoSpace|");
      toggleHeading(view, 1);
      // Should recognize it's already H1 and toggle off
      expect(getContent(view)).toBe("NoSpace");
    });

    it("handles multiple lines - only affects current line", () => {
      const view = createEditor("Line 1\nLine |2\nLine 3");
      toggleHeading(view, 2);
      expect(getContent(view)).toBe("Line 1\n## Line 2\nLine 3");
    });
  });
});

describe("setParagraph", () => {
  it("removes H1 prefix", () => {
    const view = createEditor("# Hello| world");
    setParagraph(view);
    expect(getContent(view)).toBe("Hello world");
  });

  it("removes H3 prefix", () => {
    const view = createEditor("### Deep| heading");
    setParagraph(view);
    expect(getContent(view)).toBe("Deep heading");
  });

  it("keeps plain text unchanged", () => {
    const view = createEditor("Plain| text");
    setParagraph(view);
    expect(getContent(view)).toBe("Plain text");
  });

  it("removes bullet list marker", () => {
    const view = createEditor("- List| item");
    setParagraph(view);
    expect(getContent(view)).toBe("List item");
  });

  it("removes ordered list marker", () => {
    const view = createEditor("1. First| item");
    setParagraph(view);
    expect(getContent(view)).toBe("First item");
  });

  it("removes blockquote marker", () => {
    const view = createEditor("> Quoted| text");
    setParagraph(view);
    expect(getContent(view)).toBe("Quoted text");
  });
});

describe("toggleBulletList", () => {
  describe("adding bullet", () => {
    it("adds bullet to plain text", () => {
      const view = createEditor("Item| one");
      toggleBulletList(view);
      expect(getContent(view)).toBe("- Item one");
    });

    it("adds bullet to empty line", () => {
      const view = createEditor("|");
      toggleBulletList(view);
      expect(getContent(view)).toBe("- ");
    });
  });

  describe("removing bullet (toggle off)", () => {
    it("removes bullet marker", () => {
      const view = createEditor("- Item| one");
      toggleBulletList(view);
      expect(getContent(view)).toBe("Item one");
    });

    it("removes * bullet marker", () => {
      const view = createEditor("* Item| one");
      toggleBulletList(view);
      expect(getContent(view)).toBe("Item one");
    });

    it("removes + bullet marker", () => {
      const view = createEditor("+ Item| one");
      toggleBulletList(view);
      expect(getContent(view)).toBe("Item one");
    });
  });

  describe("converting from other formats", () => {
    it("converts ordered list to bullet", () => {
      const view = createEditor("1. First| item");
      toggleBulletList(view);
      expect(getContent(view)).toBe("- First item");
    });

    it("converts task list to bullet", () => {
      const view = createEditor("- [ ] Task| item");
      toggleBulletList(view);
      expect(getContent(view)).toBe("- Task item");
    });

    it("converts heading to bullet list", () => {
      const view = createEditor("## Heading| text");
      toggleBulletList(view);
      expect(getContent(view)).toBe("- Heading text");
    });
  });
});

describe("toggleOrderedList", () => {
  describe("adding ordered list", () => {
    it("adds number to plain text", () => {
      const view = createEditor("First| item");
      toggleOrderedList(view);
      expect(getContent(view)).toBe("1. First item");
    });
  });

  describe("removing ordered list (toggle off)", () => {
    it("removes ordered list marker", () => {
      const view = createEditor("1. First| item");
      toggleOrderedList(view);
      expect(getContent(view)).toBe("First item");
    });

    it("removes any number marker", () => {
      const view = createEditor("42. Item| forty-two");
      toggleOrderedList(view);
      expect(getContent(view)).toBe("Item forty-two");
    });
  });

  describe("converting from other formats", () => {
    it("converts bullet to ordered", () => {
      const view = createEditor("- Bullet| item");
      toggleOrderedList(view);
      expect(getContent(view)).toBe("1. Bullet item");
    });
  });
});

describe("toggleTaskList", () => {
  describe("adding task list", () => {
    it("adds unchecked task to plain text", () => {
      const view = createEditor("Todo| item");
      toggleTaskList(view);
      expect(getContent(view)).toBe("- [ ] Todo item");
    });
  });

  describe("removing task list (toggle off)", () => {
    it("removes unchecked task marker", () => {
      const view = createEditor("- [ ] Todo| item");
      toggleTaskList(view);
      expect(getContent(view)).toBe("Todo item");
    });

    it("removes checked task marker", () => {
      const view = createEditor("- [x] Done| item");
      toggleTaskList(view);
      expect(getContent(view)).toBe("Done item");
    });

    it("removes checked task marker (uppercase X)", () => {
      const view = createEditor("- [X] Done| item");
      toggleTaskList(view);
      expect(getContent(view)).toBe("Done item");
    });
  });

  describe("converting from other formats", () => {
    it("converts bullet to task", () => {
      const view = createEditor("- Bullet| item");
      toggleTaskList(view);
      expect(getContent(view)).toBe("- [ ] Bullet item");
    });

    it("converts ordered to task", () => {
      const view = createEditor("1. First| item");
      toggleTaskList(view);
      expect(getContent(view)).toBe("- [ ] First item");
    });
  });
});

describe("toggleBlockquote", () => {
  describe("adding blockquote", () => {
    it("adds > to plain text", () => {
      const view = createEditor("Quote| this");
      toggleBlockquote(view);
      expect(getContent(view)).toBe("> Quote this");
    });

    it("adds > to empty line", () => {
      const view = createEditor("|");
      toggleBlockquote(view);
      expect(getContent(view)).toBe("> ");
    });
  });

  describe("removing blockquote (toggle off)", () => {
    it("removes > marker", () => {
      const view = createEditor("> Quote| this");
      toggleBlockquote(view);
      expect(getContent(view)).toBe("Quote this");
    });

    it("removes nested blockquote one level", () => {
      const view = createEditor(">> Nested| quote");
      toggleBlockquote(view);
      expect(getContent(view)).toBe("> Nested quote");
    });
  });

  describe("converting from other formats", () => {
    it("converts heading to blockquote", () => {
      const view = createEditor("## Heading| text");
      toggleBlockquote(view);
      expect(getContent(view)).toBe("> Heading text");
    });

    it("converts list to blockquote", () => {
      const view = createEditor("- List| item");
      toggleBlockquote(view);
      expect(getContent(view)).toBe("> List item");
    });
  });
});

describe("toggleCodeBlock", () => {
  describe("wrapping selection", () => {
    it("wraps selected text in code fence", () => {
      const view = createEditorWithSelection("|const x = 1;|");
      toggleCodeBlock(view);
      expect(getContent(view)).toBe("```\nconst x = 1;\n```");
    });

    it("wraps multiple lines in code fence", () => {
      const view = createEditorWithSelection("|line 1\nline 2|");
      toggleCodeBlock(view);
      expect(getContent(view)).toBe("```\nline 1\nline 2\n```");
    });
  });

  describe("inserting at cursor", () => {
    it("inserts empty code fence at cursor", () => {
      const view = createEditor("Before|\nAfter");
      toggleCodeBlock(view);
      expect(getContent(view)).toBe("Before\n```\n\n```\nAfter");
    });
  });

  describe("unwrapping code block", () => {
    it("removes code fence when cursor inside", () => {
      const view = createEditor("```\ncode| here\n```");
      toggleCodeBlock(view);
      expect(getContent(view)).toBe("code here");
    });

    it("removes code fence with language", () => {
      const view = createEditor("```javascript\ncode| here\n```");
      toggleCodeBlock(view);
      expect(getContent(view)).toBe("code here");
    });
  });
});

describe("insertHorizontalRule", () => {
  it("inserts --- at cursor position", () => {
    const view = createEditor("Before|\nAfter");
    insertHorizontalRule(view);
    expect(getContent(view)).toBe("Before\n\n---\n\nAfter");
  });

  it("inserts --- on empty line", () => {
    const view = createEditor("|\n");
    insertHorizontalRule(view);
    expect(getContent(view)).toBe("\n---\n\n");
  });

  it("inserts --- at end of document", () => {
    const view = createEditor("Content|");
    insertHorizontalRule(view);
    expect(getContent(view)).toBe("Content\n\n---\n");
  });
});

describe("insertLink", () => {
  describe("with selection", () => {
    it("wraps selected text as link text", () => {
      const view = createEditorWithSelection("Click |here| for more");
      insertLink(view, "https://example.com");
      expect(getContent(view)).toBe("Click [here](https://example.com) for more");
    });

    it("wraps selected text with default URL placeholder", () => {
      const view = createEditorWithSelection("Click |here| for more");
      insertLink(view);
      expect(getContent(view)).toBe("Click [here](url) for more");
    });
  });

  describe("without selection", () => {
    it("inserts link template at cursor", () => {
      const view = createEditor("Click | for more");
      insertLink(view, "https://example.com");
      expect(getContent(view)).toBe("Click [](https://example.com) for more");
    });

    it("inserts link template with default placeholder", () => {
      const view = createEditor("Click | for more");
      insertLink(view);
      expect(getContent(view)).toBe("Click [](url) for more");
    });
  });

  describe("with both text and URL", () => {
    it("inserts complete link", () => {
      const view = createEditor("See | for details");
      insertLink(view, "https://docs.com", "documentation");
      expect(getContent(view)).toBe("See [documentation](https://docs.com) for details");
    });
  });
});

describe("insertImage", () => {
  describe("with alt text", () => {
    it("inserts image with alt and URL", () => {
      const view = createEditor("Content|\n");
      insertImage(view, "https://example.com/img.png", "My image");
      expect(getContent(view)).toBe("Content![My image](https://example.com/img.png)\n");
    });
  });

  describe("without alt text", () => {
    it("inserts image with empty alt", () => {
      const view = createEditor("Content|\n");
      insertImage(view, "https://example.com/img.png");
      expect(getContent(view)).toBe("Content![](https://example.com/img.png)\n");
    });
  });

  describe("template insertion", () => {
    it("inserts image template with placeholder", () => {
      const view = createEditor("Content|\n");
      insertImage(view);
      expect(getContent(view)).toBe("Content![alt](url)\n");
    });
  });
});
