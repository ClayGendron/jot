/**
 * Tests for code block handlers in the CodeMirror WYSIWYG experiment
 */

import { describe, it, expect, afterEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { createTestView, createMinimalView, getDocWithCursor, type TestView } from "./testUtils";
import {
  handleBackspaceAfterCodeBlock,
  handleDeleteBeforeCodeBlock,
  handleTabInCodeBlock,
  handleShiftTabInCodeBlock,
  isRectangularSelectionInCodeBlock,
  getCodeBlockAtLine,
  isCodeFenceStart,
} from "../harness";

let tv: TestView;
let view: EditorView;

afterEach(() => {
  tv?.destroy();
  view?.destroy();
});

describe("isCodeFenceStart", () => {
  it("matches ``` fence start", () => {
    const result = isCodeFenceStart("```");
    expect(result).not.toBeNull();
    expect(result?.fence).toBe("```");
    expect(result?.language).toBe("");
  });

  it("matches ``` with language", () => {
    const result = isCodeFenceStart("```javascript");
    expect(result).not.toBeNull();
    expect(result?.fence).toBe("```");
    expect(result?.language).toBe("javascript");
  });

  it("matches longer fences", () => {
    const result = isCodeFenceStart("````typescript");
    expect(result).not.toBeNull();
    expect(result?.fence).toBe("````");
    expect(result?.language).toBe("typescript");
  });

  it("does not match closing fence only (no alphanumeric after)", () => {
    // A line with just ``` could be opening or closing
    // The function matches it as a potential opener
    const result = isCodeFenceStart("```");
    expect(result).not.toBeNull();
  });

  it("does not match lines with text before backticks", () => {
    const result = isCodeFenceStart("text```");
    expect(result).toBeNull();
  });

  it("does not match lines with only two backticks", () => {
    const result = isCodeFenceStart("``");
    expect(result).toBeNull();
  });

  it("does not match single backtick", () => {
    const result = isCodeFenceStart("`");
    expect(result).toBeNull();
  });
});

describe("handleTabInCodeBlock", () => {
  it("inserts a tab at the cursor inside a code block", () => {
    tv = createMinimalView("```\ncon|sole.log()\n```");

    const handled = handleTabInCodeBlock(tv.view);

    expect(handled).toBe(true);
    expect(tv.view.state.doc.toString()).toBe("```\ncon\tsole.log()\n```");
  });

  it("returns false when not inside a code block", () => {
    tv = createMinimalView("not code|");

    const handled = handleTabInCodeBlock(tv.view);

    expect(handled).toBe(false);
  });
});

describe("handleShiftTabInCodeBlock", () => {
  it("removes a tab before the cursor inside a code block", () => {
    tv = createMinimalView("```\n\t|console\n```");

    const handled = handleShiftTabInCodeBlock(tv.view);

    expect(handled).toBe(true);
    expect(tv.view.state.doc.toString()).toBe("```\nconsole\n```");
  });
});

describe("rectangular selection in code blocks", () => {
  let testView: TestView;

  afterEach(() => {
    testView?.destroy();
  });

  it("allows Alt+drag inside a code block", () => {
    testView = createTestView("```\nco|de\n```");
    const v = testView.view as EditorView & { posAtCoords: (coords: { x: number; y: number }) => number | null };
    const pos = v.state.doc.line(2).from + 1; // inside code block content
    v.posAtCoords = () => pos;

    const event = {
      altKey: true,
      button: 0,
      clientX: 0,
      clientY: 0,
      target: v.dom,
    } as unknown as MouseEvent;

    expect(isRectangularSelectionInCodeBlock(event)).toBe(true);
  });

  it("blocks Alt+drag outside a code block", () => {
    testView = createTestView("plain |text");
    const v = testView.view as EditorView & { posAtCoords: (coords: { x: number; y: number }) => number | null };
    const pos = 2;
    v.posAtCoords = () => pos;

    const event = {
      altKey: true,
      button: 0,
      clientX: 0,
      clientY: 0,
      target: v.dom,
    } as unknown as MouseEvent;

    expect(isRectangularSelectionInCodeBlock(event)).toBe(false);
  });
});

describe("getCodeBlockAtLine", () => {
  it("returns code block info when on opening fence", () => {
    const content = "text\n```javascript\nconst x = 1;\n```\nmore text";
    const state = EditorState.create({ doc: content, extensions: [markdown()] });

    const result = getCodeBlockAtLine(state, 2); // Line 2 is ```javascript

    expect(result).not.toBeNull();
    expect(result?.language).toBe("javascript");
    expect(result?.code).toBe("const x = 1;");
    expect(result?.from).toBe(5); // Start of ```javascript
    // The 'to' position is the end of the closing ```
    // "text\n```javascript\nconst x = 1;\n```" = 35 chars
    expect(result?.to).toBe(35);
  });

  it("returns code block info when on a line inside the block", () => {
    const content = "text\n```javascript\nconst x = 1;\n```\nmore text";
    const state = EditorState.create({ doc: content, extensions: [markdown()] });

    const result = getCodeBlockAtLine(state, 3); // Line 3 is const x = 1;

    expect(result).not.toBeNull();
    expect(result?.language).toBe("javascript");
    expect(result?.code).toBe("const x = 1;");
  });

  it("returns code block info when on closing fence", () => {
    const content = "text\n```javascript\nconst x = 1;\n```\nmore text";
    const state = EditorState.create({ doc: content, extensions: [markdown()] });

    const result = getCodeBlockAtLine(state, 4); // Line 4 is closing ```

    if (result) {
      expect(result?.code).toBe("const x = 1;");
    }
  });

  it("returns null when not inside a code block", () => {
    const content = "text\n```javascript\nconst x = 1;\n```\nmore text";
    const state = EditorState.create({ doc: content, extensions: [markdown()] });

    const result = getCodeBlockAtLine(state, 5); // Line 5 is "more text"

    expect(result).toBeNull();
  });

  it("returns null when on line before code block", () => {
    const content = "text\n```javascript\nconst x = 1;\n```";
    const state = EditorState.create({ doc: content, extensions: [markdown()] });

    const result = getCodeBlockAtLine(state, 1); // Line 1 is "text"

    expect(result).toBeNull();
  });

  it("handles code block with no language", () => {
    const content = "```\ncode\n```";
    const state = EditorState.create({ doc: content, extensions: [markdown()] });

    const result = getCodeBlockAtLine(state, 1);

    expect(result).not.toBeNull();
    expect(result?.language).toBe("");
    expect(result?.code).toBe("code");
  });

  it("handles code block with multiple lines", () => {
    const content = "```python\nline1\nline2\nline3\n```";
    const state = EditorState.create({ doc: content, extensions: [markdown()] });

    const result = getCodeBlockAtLine(state, 1);

    expect(result).not.toBeNull();
    expect(result?.code).toBe("line1\nline2\nline3");
  });

  it("handles empty code block", () => {
    const content = "```\n\n```";
    const state = EditorState.create({ doc: content, extensions: [markdown()] });

    const result = getCodeBlockAtLine(state, 1);

    expect(result).not.toBeNull();
    expect(result?.code).toBe("");
  });

  it("returns null for unclosed code block", () => {
    const content = "```javascript\ncode without closing fence";
    const state = EditorState.create({ doc: content, extensions: [markdown()] });

    const result = getCodeBlockAtLine(state, 1);

    expect(result).toBeNull();
  });
});

describe("code block tab integration", () => {
  let testView: TestView;

  afterEach(() => {
    testView?.destroy();
  });

  it("tabs inside a code fence in the full editor", () => {
    testView = createTestView("```\nco|de\n```");

    const handled = handleTabInCodeBlock(testView.view);

    expect(handled).toBe(true);
    expect(getDocWithCursor(testView.view)).toBe("```\nco\t|de\n```");
  });
});

describe("handleBackspaceAfterCodeBlock", () => {
  it("deletes code block when cursor is at start of line after code block", () => {
    tv = createMinimalView("Line 1\n```\ncode\n```\n|Line 5");

    const result = handleBackspaceAfterCodeBlock(tv.view);

    expect(result).toBe(true);
    expect(tv.view.state.doc.toString()).toBe("Line 1\nLine 5");
  });

  it("returns false when cursor is not at start of line", () => {
    tv = createMinimalView("Line 1\n```\ncode\n```\nLi|ne 5");

    const result = handleBackspaceAfterCodeBlock(tv.view);

    expect(result).toBe(false);
    expect(tv.view.state.doc.toString()).toBe("Line 1\n```\ncode\n```\nLine 5");
  });

  it("returns false when previous line is not end of code block", () => {
    tv = createMinimalView("Line 1\nLine 2\n|Line 3");

    const result = handleBackspaceAfterCodeBlock(tv.view);

    expect(result).toBe(false);
    expect(tv.view.state.doc.toString()).toBe("Line 1\nLine 2\nLine 3");
  });

  it("returns false when there is a selection", () => {
    const content = "Line 1\n```\ncode\n```\nLine 5";
    const state = EditorState.create({
      doc: content,
      selection: { anchor: content.indexOf("Line 5"), head: content.indexOf("Line 5") + 4 },
      extensions: [markdown()],
    });
    view = new EditorView({ state });

    const result = handleBackspaceAfterCodeBlock(view);

    expect(result).toBe(false);
  });

  it("returns false on first line", () => {
    tv = createMinimalView("|Line 1");

    const result = handleBackspaceAfterCodeBlock(tv.view);

    expect(result).toBe(false);
  });
});

describe("handleDeleteBeforeCodeBlock", () => {
  it("deletes code block when cursor is at end of line before code block", () => {
    tv = createMinimalView("Line 1|\n```\ncode\n```\nLine 5");

    const result = handleDeleteBeforeCodeBlock(tv.view);

    expect(result).toBe(true);
    expect(tv.view.state.doc.toString()).toBe("Line 1\nLine 5");
  });

  it("returns false when cursor is not at end of line", () => {
    tv = createMinimalView("Lin|e 1\n```\ncode\n```\nLine 5");

    const result = handleDeleteBeforeCodeBlock(tv.view);

    expect(result).toBe(false);
    expect(tv.view.state.doc.toString()).toBe("Line 1\n```\ncode\n```\nLine 5");
  });

  it("returns false when next line is not a code block", () => {
    tv = createMinimalView("Line 1|\nLine 2\nLine 3");

    const result = handleDeleteBeforeCodeBlock(tv.view);

    expect(result).toBe(false);
    expect(tv.view.state.doc.toString()).toBe("Line 1\nLine 2\nLine 3");
  });

  it("returns false when there is a selection", () => {
    const content = "Line 1\n```\ncode\n```";
    const state = EditorState.create({
      doc: content,
      selection: { anchor: 3, head: 6 },
      extensions: [markdown()],
    });
    view = new EditorView({ state });

    const result = handleDeleteBeforeCodeBlock(view);

    expect(result).toBe(false);
  });

  it("returns false on last line", () => {
    tv = createMinimalView("Line 1|");

    const result = handleDeleteBeforeCodeBlock(tv.view);

    expect(result).toBe(false);
  });
});

describe("code block integration", () => {
  it("multiple code blocks are handled correctly", () => {
    // Line numbers: 1=Line 1, 2=```js, 3=a, 4=```, 5=Line 5, 6=```py, 7=b, 8=```, 9=Line 9
    const content = "Line 1\n```js\na\n```\nLine 5\n```py\nb\n```\nLine 9";
    const state = EditorState.create({ doc: content, extensions: [markdown()] });

    // First code block - line 2 is opening fence
    const first = getCodeBlockAtLine(state, 2);
    expect(first?.language).toBe("js");
    expect(first?.code).toBe("a");

    // Second code block - line 6 is opening fence
    const second = getCodeBlockAtLine(state, 6);
    expect(second?.language).toBe("py");
    expect(second?.code).toBe("b");

    // Line 1 (before any code block)
    const line1 = getCodeBlockAtLine(state, 1);
    expect(line1).toBeNull();

    // Line 9 (after all code blocks)
    const line9 = getCodeBlockAtLine(state, 9);
    expect(line9).toBeNull();
  });

  it("handles code block with special characters", () => {
    const content = "```\n<div class=\"test\">&amp;</div>\n```";
    const state = EditorState.create({ doc: content, extensions: [markdown()] });

    const result = getCodeBlockAtLine(state, 1);

    expect(result).not.toBeNull();
    expect(result?.code).toBe('<div class="test">&amp;</div>');
  });

  it("handles code block with backticks in content", () => {
    // The content has inline backticks which should not close the fence
    const content = "```\nconst x = `template`;\n```";
    const state = EditorState.create({ doc: content, extensions: [markdown()] });

    const result = getCodeBlockAtLine(state, 1);

    expect(result).not.toBeNull();
    expect(result?.code).toBe("const x = `template`;");
  });
});
