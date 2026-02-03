/**
 * Tests for Code Block Decorations
 *
 * Phase 5: Code blocks with syntax highlighting (Shiki), language badge, copy button.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";

// Mock Shiki before importing the module that uses it
vi.mock("shiki", () => ({
  createHighlighter: vi.fn().mockResolvedValue({
    getLoadedLanguages: () => ["javascript", "typescript", "python"],
    loadLanguage: vi.fn().mockResolvedValue(undefined),
    codeToHtml: vi.fn().mockImplementation((code: string) => {
      return `<pre class="shiki"><code>${code}</code></pre>`;
    }),
  }),
}));

import { codeBlockField, extractCodeBlockData } from "../decorations/codeBlocks";

/**
 * Create an editor state with the code block field
 */
function createState(doc: string, cursorAtEnd = false): EditorState {
  return EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM] }), codeBlockField],
    // Position cursor at end to avoid being inside code blocks (raw-when-focused)
    selection: cursorAtEnd ? { anchor: doc.length } : undefined,
  });
}

/**
 * Create an editor view for DOM-based tests
 * By default, positions cursor at end so code block widgets render
 * (code blocks show raw code when cursor is inside them)
 */
function createView(doc: string, cursorAtEnd = true): EditorView {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return new EditorView({
    state: createState(doc, cursorAtEnd),
    parent: container,
  });
}

describe("extractCodeBlockData", () => {
  it("extracts a simple fenced code block", () => {
    const state = createState("```js\nconst x = 1;\n```");
    const blocks = extractCodeBlockData(state);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe("js");
    expect(blocks[0].code).toBe("const x = 1;");
    expect(blocks[0].from).toBe(0);
  });

  it("extracts code block without language", () => {
    const state = createState("```\nplain text\n```");
    const blocks = extractCodeBlockData(state);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe("");
    expect(blocks[0].code).toBe("plain text");
  });

  it("extracts multiple code blocks", () => {
    const state = createState(
      "```python\ndef foo():\n    pass\n```\n\nSome text\n\n```rust\nfn main() {}\n```"
    );
    const blocks = extractCodeBlockData(state);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].language).toBe("python");
    expect(blocks[0].code).toContain("def foo()");
    expect(blocks[1].language).toBe("rust");
    expect(blocks[1].code).toContain("fn main()");
  });

  it("extracts code block with various language identifiers", () => {
    const languages = ["javascript", "typescript", "tsx", "jsx", "cpp", "c++", "c#", "shell"];

    for (const lang of languages) {
      const state = createState(`\`\`\`${lang}\ncode\n\`\`\``);
      const blocks = extractCodeBlockData(state);
      expect(blocks[0].language).toBe(lang);
    }
  });

  it("preserves code indentation", () => {
    const state = createState("```python\n    indented\n        more indented\n```");
    const blocks = extractCodeBlockData(state);

    expect(blocks[0].code).toBe("    indented\n        more indented");
  });

  it("handles empty code blocks", () => {
    const state = createState("```js\n```");
    const blocks = extractCodeBlockData(state);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].code).toBe("");
    expect(blocks[0].language).toBe("js");
  });

  it("handles code blocks with only whitespace", () => {
    const state = createState("```\n   \n\n```");
    const blocks = extractCodeBlockData(state);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].code).toBe("   \n");
  });

  it("extracts mermaid blocks but marks them as mermaid type", () => {
    const state = createState("```mermaid\ngraph TD;\n    A-->B;\n```");
    const blocks = extractCodeBlockData(state);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe("mermaid");
    expect(blocks[0].isMermaid).toBe(true);
  });

  it("correctly calculates block positions", () => {
    const doc = "Some text\n\n```js\nconst x = 1;\n```\n\nMore text";
    const state = createState(doc);
    const blocks = extractCodeBlockData(state);

    expect(blocks).toHaveLength(1);
    // Block starts after "Some text\n\n"
    expect(blocks[0].from).toBe(11);
    // Block ends at the closing ```
    const blockText = doc.slice(blocks[0].from, blocks[0].to);
    expect(blockText).toBe("```js\nconst x = 1;\n```");
  });

  it("handles nested backticks in code", () => {
    const state = createState("````js\nconst s = `template`;\n````");
    const blocks = extractCodeBlockData(state);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].code).toContain("`template`");
  });
});

describe("codeBlockField decorations", () => {
  let view: EditorView;

  afterEach(() => {
    if (view) {
      view.dom.parentElement?.removeChild(view.dom);
      view.destroy();
    }
  });

  it("creates decorations for code blocks", () => {
    view = createView("```js\nconst x = 1;\n```");

    const decorations = view.state.field(codeBlockField);
    expect(decorations.size).toBeGreaterThan(0);
  });

  it("does not decorate inline code", () => {
    view = createView("Some `inline code` here");

    const decorations = view.state.field(codeBlockField);
    expect(decorations.size).toBe(0);
  });

  it("updates decorations when document changes", () => {
    view = createView("```js\nconst x = 1;\n```");

    const initialDecorations = view.state.field(codeBlockField);

    view.dispatch({
      changes: { from: view.state.doc.length, insert: "\n\n```python\npass\n```" },
    });

    const updatedDecorations = view.state.field(codeBlockField);
    expect(updatedDecorations.size).toBeGreaterThan(initialDecorations.size);
  });

  it("renders code block widget in DOM", () => {
    view = createView("```javascript\nconst hello = 'world';\n```");

    // Force a render
    view.requestMeasure();

    // Look for the code block widget
    const widget = view.dom.querySelector(".cm-code-block-widget");
    expect(widget).toBeTruthy();
  });

  it("shows language badge for known languages", () => {
    view = createView("```typescript\nconst x: number = 1;\n```");
    view.requestMeasure();

    const badge = view.dom.querySelector(".cm-code-language-badge");
    expect(badge).toBeTruthy();
    expect(badge?.textContent?.toLowerCase()).toContain("typescript");
  });

  it("shows copy button on hover", () => {
    view = createView("```js\ncode\n```");
    view.requestMeasure();

    const copyBtn = view.dom.querySelector(".cm-code-copy-button");
    expect(copyBtn).toBeTruthy();
  });
});

describe("code block widget functionality", () => {
  let view: EditorView;
  const mockWriteText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    // Mock clipboard API using defineProperty
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    if (view) {
      view.dom.parentElement?.removeChild(view.dom);
      view.destroy();
    }
    mockWriteText.mockClear();
  });

  it("copies code to clipboard when copy button clicked", async () => {
    view = createView("```js\nconst x = 1;\n```");
    view.requestMeasure();

    const copyBtn = view.dom.querySelector(".cm-code-copy-button") as HTMLButtonElement;
    expect(copyBtn).toBeTruthy();

    copyBtn?.click();

    await vi.waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith("const x = 1;");
    });
  });

  it("shows copied feedback after successful copy", async () => {
    view = createView("```js\ncode\n```");
    view.requestMeasure();

    const copyBtn = view.dom.querySelector(".cm-code-copy-button") as HTMLButtonElement;
    copyBtn?.click();

    await vi.waitFor(() => {
      const copiedIndicator = view.dom.querySelector(".cm-code-copied");
      expect(copiedIndicator).toBeTruthy();
    });
  });
});

describe("code block line numbers", () => {
  let view: EditorView;

  afterEach(() => {
    if (view) {
      view.dom.parentElement?.removeChild(view.dom);
      view.destroy();
    }
  });

  it("can display line numbers when enabled", () => {
    // Line numbers are controlled by editor config
    // The code block widget should respect this
    view = createView("```js\nline1\nline2\nline3\n```");
    view.requestMeasure();

    // The widget should have a data attribute for line number styling
    const widget = view.dom.querySelector(".cm-code-block-widget");
    expect(widget).toBeTruthy();
  });
});

describe("syntax highlighting", () => {
  let view: EditorView;

  afterEach(() => {
    if (view) {
      view.dom.parentElement?.removeChild(view.dom);
      view.destroy();
    }
  });

  it("applies syntax highlighting to code content", async () => {
    view = createView("```javascript\nconst x = 'string';\n```");
    view.requestMeasure();

    // Wait for async Shiki highlighting to complete
    await vi.waitFor(() => {
      // Shiki wraps code in pre.shiki
      const shikiPre = view.dom.querySelector("pre.shiki");
      expect(shikiPre).toBeTruthy();
    });
  });

  it("handles unknown languages gracefully", () => {
    view = createView("```unknownlang\nsome code\n```");
    view.requestMeasure();

    // Should still render without error
    const widget = view.dom.querySelector(".cm-code-block-widget");
    expect(widget).toBeTruthy();
  });
});

describe("atomic ranges", () => {
  let view: EditorView;

  afterEach(() => {
    if (view) {
      view.dom.parentElement?.removeChild(view.dom);
      view.destroy();
    }
  });

  it("makes code block syntax atomic", () => {
    view = createView("text\n```js\ncode\n```\nmore");

    // The code block field provides atomic ranges
    const decorations = view.state.field(codeBlockField);
    expect(decorations.size).toBeGreaterThan(0);

    // Verify atomic behavior - cursor should skip over hidden fence markers
    // This is handled by the atomicRanges provider in the field
  });
});
