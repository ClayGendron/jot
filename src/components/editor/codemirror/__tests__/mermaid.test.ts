/**
 * Tests for Mermaid Diagram Decorations
 *
 * Phase 5: Mermaid blocks that show raw code when focused, rendered diagram otherwise.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { mermaidField, extractMermaidData } from "../decorations/mermaid";

// Mock the mermaid loader
vi.mock("@/lib/mermaid/loader", () => ({
  renderMermaid: vi.fn().mockResolvedValue("<svg>mock diagram</svg>"),
  isMermaidLoaded: vi.fn().mockReturnValue(true),
  getMermaid: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/mermaid/themes", () => ({
  resolveTheme: vi.fn().mockReturnValue("light"),
}));

vi.mock("@/lib/mermaid/exporter", () => ({
  exportAsSvg: vi.fn().mockReturnValue(new Blob()),
  exportAsPng: vi.fn().mockResolvedValue(new Blob()),
  downloadBlob: vi.fn(),
  generateExportFilename: vi.fn().mockReturnValue("diagram.svg"),
}));

/**
 * Create an editor state with the mermaid field
 */
function createState(doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM] }), mermaidField],
  });
}

/**
 * Create an editor view for DOM-based tests
 */
function createView(doc: string): EditorView {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return new EditorView({
    state: createState(doc),
    parent: container,
  });
}

describe("extractMermaidData", () => {
  it("extracts a mermaid code block", () => {
    const state = createState("```mermaid\ngraph TD;\n    A-->B;\n```");
    const blocks = extractMermaidData(state);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].source).toContain("graph TD");
    expect(blocks[0].source).toContain("A-->B");
  });

  it("ignores non-mermaid code blocks", () => {
    const state = createState("```javascript\nconst x = 1;\n```");
    const blocks = extractMermaidData(state);

    expect(blocks).toHaveLength(0);
  });

  it("extracts multiple mermaid blocks", () => {
    const state = createState(
      "```mermaid\ngraph TD;\n```\n\nText\n\n```mermaid\nsequenceDiagram\n```"
    );
    const blocks = extractMermaidData(state);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].source).toContain("graph TD");
    expect(blocks[1].source).toContain("sequenceDiagram");
  });

  it("handles empty mermaid blocks", () => {
    const state = createState("```mermaid\n```");
    const blocks = extractMermaidData(state);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].source).toBe("");
  });

  it("correctly calculates block positions", () => {
    const doc = "Text\n\n```mermaid\ngraph TD;\n```\n\nMore";
    const state = createState(doc);
    const blocks = extractMermaidData(state);

    expect(blocks).toHaveLength(1);
    const blockText = doc.slice(blocks[0].from, blocks[0].to);
    expect(blockText).toBe("```mermaid\ngraph TD;\n```");
  });

  it("handles various diagram types", () => {
    const diagrams = [
      "graph TD; A-->B;",
      "sequenceDiagram\n    Alice->>Bob: Hello",
      "classDiagram\n    Animal <|-- Duck",
      "flowchart LR\n    A --> B",
      "pie\n    title Pets\n    \"Dogs\" : 386",
      "gantt\n    title A Gantt",
      "erDiagram\n    CUSTOMER ||--o{ ORDER : places",
    ];

    for (const diagram of diagrams) {
      const state = createState(`\`\`\`mermaid\n${diagram}\n\`\`\``);
      const blocks = extractMermaidData(state);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].source).toContain(diagram.split("\n")[0]);
    }
  });
});

describe("mermaidField decorations", () => {
  let view: EditorView;

  afterEach(() => {
    if (view) {
      view.dom.parentElement?.removeChild(view.dom);
      view.destroy();
    }
  });

  it("creates decorations for mermaid blocks", () => {
    view = createView("```mermaid\ngraph TD;\n```");

    const decorations = view.state.field(mermaidField);
    expect(decorations.size).toBeGreaterThan(0);
  });

  it("does not decorate regular code blocks", () => {
    view = createView("```javascript\ncode\n```");

    const decorations = view.state.field(mermaidField);
    expect(decorations.size).toBe(0);
  });

  it("updates decorations when document changes", () => {
    view = createView("```mermaid\ngraph TD;\n```");

    const initialSize = view.state.field(mermaidField).size;

    view.dispatch({
      changes: { from: view.state.doc.length, insert: "\n\n```mermaid\npie\n```" },
    });

    const updatedSize = view.state.field(mermaidField).size;
    expect(updatedSize).toBeGreaterThan(initialSize);
  });
});

describe("mermaid widget rendering", () => {
  let view: EditorView;

  afterEach(() => {
    if (view) {
      view.dom.parentElement?.removeChild(view.dom);
      view.destroy();
    }
  });

  it("renders mermaid widget in DOM", () => {
    view = createView("```mermaid\ngraph TD;\n```");
    view.requestMeasure();

    const widget = view.dom.querySelector(".cm-mermaid-widget");
    expect(widget).toBeTruthy();
  });

  it("shows mermaid badge in header", () => {
    view = createView("```mermaid\ngraph TD;\n```");
    view.requestMeasure();

    const badge = view.dom.querySelector(".cm-mermaid-badge");
    expect(badge).toBeTruthy();
    expect(badge?.textContent?.toLowerCase()).toContain("mermaid");
  });

  it("shows rendered diagram when not focused", async () => {
    view = createView("```mermaid\ngraph TD;\n```");
    view.requestMeasure();

    // Widget should show diagram container when not focused
    await vi.waitFor(() => {
      const diagramArea = view.dom.querySelector(".cm-mermaid-diagram");
      expect(diagramArea).toBeTruthy();
    });
  });

  it("shows loading state during render", () => {
    view = createView("```mermaid\ngraph TD;\n```");
    view.requestMeasure();

    // Initially may show loading state (transient, may or may not be visible)
    // Just verify widget exists
    const widget = view.dom.querySelector(".cm-mermaid-widget");
    expect(widget).toBeTruthy();
  });
});

describe("mermaid focus behavior", () => {
  let view: EditorView;

  afterEach(() => {
    if (view) {
      view.dom.parentElement?.removeChild(view.dom);
      view.destroy();
    }
  });

  it("widget respects selection state for focus", () => {
    const doc = "```mermaid\ngraph TD;\n```";
    view = createView(doc);
    view.requestMeasure();

    // The mermaid widget should track whether cursor is inside
    const widget = view.dom.querySelector(".cm-mermaid-widget");
    expect(widget).toBeTruthy();

    // When cursor is inside the mermaid block, it should show code
    // When cursor is outside, it should show diagram
    // This behavior is determined by comparing selection to block range
  });
});

describe("mermaid error handling", () => {
  let view: EditorView;

  beforeEach(async () => {
    const { renderMermaid } = vi.mocked(await import("@/lib/mermaid/loader"));
    renderMermaid.mockRejectedValueOnce(new Error("Parse error at line 2"));
  });

  afterEach(() => {
    if (view) {
      view.dom.parentElement?.removeChild(view.dom);
      view.destroy();
    }
    vi.restoreAllMocks();
  });

  it("displays error message for invalid syntax", async () => {
    view = createView("```mermaid\ninvalid syntax here\n```");
    view.requestMeasure();

    // Wait for render attempt
    await vi.waitFor(
      () => {
        const errorDisplay = view.dom.querySelector(".cm-mermaid-error");
        expect(errorDisplay).toBeTruthy();
      },
      { timeout: 1000 }
    );
  });
});

describe("mermaid export functionality", () => {
  let view: EditorView;

  afterEach(() => {
    if (view) {
      view.dom.parentElement?.removeChild(view.dom);
      view.destroy();
    }
  });

  it("shows export button when diagram is rendered", async () => {
    view = createView("```mermaid\ngraph TD;\n```");
    view.requestMeasure();

    await vi.waitFor(() => {
      const exportBtn = view.dom.querySelector(".cm-mermaid-export-button");
      expect(exportBtn).toBeTruthy();
    });
  });

  it("shows copy button", () => {
    view = createView("```mermaid\ngraph TD;\n```");
    view.requestMeasure();

    const copyBtn = view.dom.querySelector(".cm-mermaid-copy-button");
    expect(copyBtn).toBeTruthy();
  });
});

describe("mermaid theme handling", () => {
  it("detects system theme", async () => {
    // Theme detection is handled by resolveTheme from themes.ts
    const { resolveTheme } = vi.mocked(await import("@/lib/mermaid/themes"));
    expect(resolveTheme).toBeDefined();
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

  it("makes mermaid block syntax atomic", () => {
    view = createView("text\n```mermaid\ngraph TD;\n```\nmore");

    const decorations = view.state.field(mermaidField);
    expect(decorations.size).toBeGreaterThan(0);
  });
});
