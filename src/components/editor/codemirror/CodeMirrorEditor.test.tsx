/**
 * CodeMirrorEditor Lifecycle Tests
 *
 * Tests the React wrapper's lifecycle behavior:
 * - Mount/unmount creates and destroys EditorView
 * - Content loaded from tabsStore on mount
 * - fileSwitchAnnotation suppresses onUpdate during file switch
 * - Source mode round-trip preserves content
 * - onUpdate fires on user edits
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, screen, waitFor } from "@testing-library/react";
import { useTabsStore } from "@/stores/tabsStore";
import { useEditorStore } from "@/stores/editorStore";

// Mock spellcheck extension (heavy, not relevant to lifecycle)
vi.mock("./extensions/spellcheck", () => ({
  createSpellcheckExtension: () => [],
  setSpellcheckEnabledCmd: vi.fn(),
  subscribeSpellcheckContextMenu: vi.fn(() => () => {}),
  closeSpellcheckContextMenu: vi.fn(),
  handleSpellcheckSuggestion: vi.fn(),
  handleAddToPersonalDictionary: vi.fn(),
  handleIgnoreWord: vi.fn(),
}));

// Mock extensions module — provide lightweight extensions to avoid heavy deps
vi.mock("./extensions", () => {
  const { Compartment } = require("@codemirror/state");
  return {
    createWysiwygExtensions: () => [],
    historyCompartment: new Compartment(),
    clearPendingEscape: vi.fn(),
  };
});

// Mock handlers (avoid importing full handler modules)
vi.mock("./handlers/formattingHandlers", () => ({
  toggleBoldOrEscape: vi.fn(() => true),
  toggleItalicOrEscape: vi.fn(() => true),
  toggleCodeOrEscape: vi.fn(() => true),
  toggleStrikethroughOrEscape: vi.fn(() => true),
  toggleHighlightOrEscape: vi.fn(() => true),
}));

vi.mock("./handlers/headingHandlers", () => ({
  setHeading1: vi.fn(() => true),
  setHeading2: vi.fn(() => true),
  setHeading3: vi.fn(() => true),
}));

vi.mock("./handlers/tableHandlers", () => ({
  insertTable: vi.fn(() => true),
}));

vi.mock("./handlers/linkHandlers", () => ({
  handleLinkCommand: vi.fn(() => true),
  setInternalLinkCallbacks: vi.fn(),
  getLinkContextAtPos: vi.fn(() => null),
  handleLinkClick: vi.fn(),
  closeLinkEditor: vi.fn(),
  closeLinkContextMenu: vi.fn(),
}));

// Mock CodeMirrorToolbar to simplify rendering
vi.mock("./CodeMirrorToolbar", () => ({
  CodeMirrorToolbar: () => <div data-testid="mock-toolbar" />,
}));

// Mock SourceEditor
vi.mock("../SourceEditor", () => ({
  SourceEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="source-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import { CodeMirrorEditor, type CodeMirrorEditorRef } from "./CodeMirrorEditor";
import React from "react";

function setupTabsStore(content: string, filePath = "/test/doc.md", tabId = "tab-1") {
  useTabsStore.setState({
    tabs: [{
      id: tabId,
      filePath,
      displayName: "doc",
      content,
      isDirty: false,
      isPinned: false,
      scrollTop: 0,
      lastSaved: null,
    }],
    activeTabId: tabId,
    saveStatus: "idle",
    saveError: null,
  });
  return tabId;
}

describe("CodeMirrorEditor lifecycle", () => {
  beforeEach(() => {
    useTabsStore.setState({
      tabs: [],
      activeTabId: null,
      saveStatus: "idle",
      saveError: null,
    });
    useEditorStore.setState({
      sourceMode: false,
      focusMode: false,
      fontFamily: "serif",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("mount and unmount", () => {
    it("creates EditorView on mount with content from tabsStore", async () => {
      setupTabsStore("# Hello World");

      const ref = React.createRef<CodeMirrorEditorRef>();
      const { unmount } = render(<CodeMirrorEditor ref={ref} />);

      // getMarkdown() reads directly from viewRef.current, which is set in the mount effect
      await waitFor(() => {
        expect(ref.current?.getMarkdown()).toBe("# Hello World");
      });

      unmount();
    });

    it("destroys EditorView on unmount", async () => {
      setupTabsStore("test content");

      const ref = React.createRef<CodeMirrorEditorRef>();
      const { unmount } = render(<CodeMirrorEditor ref={ref} />);

      // Wait for view to be created
      await waitFor(() => {
        expect(ref.current?.getMarkdown()).toBe("test content");
      });

      unmount();

      // After unmount, the ref is cleared and getMarkdown returns empty
      // (viewRef.current is set to null in cleanup)
      expect(ref.current).toBeNull();
    });

    it("creates EditorView with empty content when no active tab", async () => {
      // No tabs set up
      const ref = React.createRef<CodeMirrorEditorRef>();
      const { unmount } = render(<CodeMirrorEditor ref={ref} />);

      await waitFor(() => {
        expect(ref.current?.getMarkdown()).toBe("");
      });

      unmount();
    });
  });

  describe("fileSwitchAnnotation", () => {
    it("does not call onUpdate during file switch dispatch", async () => {
      setupTabsStore("initial content");

      const onUpdate = vi.fn();
      const ref = React.createRef<CodeMirrorEditorRef>();
      const { rerender, unmount } = render(
        <CodeMirrorEditor ref={ref} onUpdate={onUpdate} />
      );

      await waitFor(() => {
        expect(ref.current?.getMarkdown()).toBe("initial content");
      });

      // Clear any mount-time calls
      onUpdate.mockClear();

      // Simulate file switch by changing the active tab
      act(() => {
        useTabsStore.setState({
          tabs: [
            {
              id: "tab-1",
              filePath: "/test/doc.md",
              displayName: "doc",
              content: "initial content",
              isDirty: false,
              isPinned: false,
              scrollTop: 0,
              lastSaved: null,
            },
            {
              id: "tab-2",
              filePath: "/test/other.md",
              displayName: "other",
              content: "different content",
              isDirty: false,
              isPinned: false,
              scrollTop: 0,
              lastSaved: null,
            },
          ],
          activeTabId: "tab-2",
        });
      });

      // Re-render to trigger the filePath useEffect
      rerender(<CodeMirrorEditor ref={ref} onUpdate={onUpdate} />);

      // onUpdate should NOT have been called because the dispatch uses fileSwitchAnnotation
      expect(onUpdate).not.toHaveBeenCalled();

      unmount();
    });

    it("calls onUpdate on normal user edits", async () => {
      setupTabsStore("hello");

      const onUpdate = vi.fn();
      const ref = React.createRef<CodeMirrorEditorRef>();
      const { unmount } = render(
        <CodeMirrorEditor ref={ref} onUpdate={onUpdate} />
      );

      await waitFor(() => {
        expect(ref.current?.getMarkdown()).toBe("hello");
      });
      onUpdate.mockClear();

      // Simulate a user edit (no fileSwitchAnnotation) via setMarkdown
      // setMarkdown dispatches without annotation, so onUpdate should fire
      act(() => {
        ref.current?.setMarkdown("hello world");
      });

      expect(onUpdate).toHaveBeenCalledWith("hello world");

      unmount();
    });
  });

  describe("source mode round-trip", () => {
    it("preserves content through WYSIWYG -> Source -> WYSIWYG cycle", async () => {
      setupTabsStore("**bold** and *italic*");

      const onUpdate = vi.fn();
      const ref = React.createRef<CodeMirrorEditorRef>();
      const { rerender, unmount } = render(
        <CodeMirrorEditor ref={ref} onUpdate={onUpdate} />
      );

      await waitFor(() => {
        expect(ref.current?.getMarkdown()).toBe("**bold** and *italic*");
      });

      // Switch to source mode
      act(() => {
        useEditorStore.setState({ sourceMode: true });
      });
      rerender(<CodeMirrorEditor ref={ref} onUpdate={onUpdate} />);

      // Source editor should be shown
      expect(screen.getByTestId("source-editor")).toBeInTheDocument();

      // Switch back to WYSIWYG
      act(() => {
        useEditorStore.setState({ sourceMode: false });
      });
      rerender(<CodeMirrorEditor ref={ref} onUpdate={onUpdate} />);

      // Content should be preserved
      await waitFor(() => {
        expect(ref.current?.getMarkdown()).toBe("**bold** and *italic*");
      });

      unmount();
    });
  });

  describe("imperative handle", () => {
    it("exposes getMarkdown and setMarkdown", async () => {
      setupTabsStore("original");

      const ref = React.createRef<CodeMirrorEditorRef>();
      const { unmount } = render(<CodeMirrorEditor ref={ref} />);

      await waitFor(() => {
        expect(ref.current?.getMarkdown()).toBe("original");
      });

      act(() => {
        ref.current?.setMarkdown("replaced");
      });

      expect(ref.current?.getMarkdown()).toBe("replaced");

      unmount();
    });
  });
});
