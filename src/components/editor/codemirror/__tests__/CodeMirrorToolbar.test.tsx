/**
 * CodeMirror Toolbar Tests
 *
 * Basic render and click handler tests for the toolbar component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { CodeMirrorToolbar } from "../CodeMirrorToolbar";
import { useEditorStore } from "@/stores/editorStore";

// Mock the handlers
vi.mock("../handlers/formattingHandlers", () => ({
  toggleBoldOrEscape: vi.fn(() => true),
  toggleItalicOrEscape: vi.fn(() => true),
  toggleCodeOrEscape: vi.fn(() => true),
  toggleStrikethroughOrEscape: vi.fn(() => true),
  toggleHighlightOrEscape: vi.fn(() => true),
  getFormattingContext: vi.fn(() => null),
}));

vi.mock("../handlers/headingHandlers", () => ({
  setHeading1: vi.fn(() => true),
  setHeading2: vi.fn(() => true),
  setHeading3: vi.fn(() => true),
}));

vi.mock("../handlers/tableHandlers", () => ({
  insertTable: vi.fn(() => true),
}));

vi.mock("../handlers/linkHandlers", () => ({
  handleLinkCommand: vi.fn(() => true),
  getLinkContext: vi.fn(() => null),
}));

vi.mock("../handlers/listHandlers", () => ({
  toggleBulletList: vi.fn(() => true),
  toggleOrderedList: vi.fn(() => true),
  toggleTaskList: vi.fn(() => true),
  getListInfo: vi.fn(() => null),
}));

vi.mock("../handlers/blockquoteHandlers", () => ({
  toggleBlockquote: vi.fn(() => true),
  getBlockquoteInfo: vi.fn(() => null),
}));

vi.mock("../handlers/codeBlockHandlers", () => ({
  insertCodeBlock: vi.fn(() => true),
  isCursorInCodeBlock: vi.fn(() => false),
}));

vi.mock("../utils/sharedHelpers", () => ({
  HEADING_PREFIX_RE: /^(#{1,6})\s/,
}));

// Import the mocked handlers
import {
  toggleBoldOrEscape,
  toggleItalicOrEscape,
  toggleCodeOrEscape,
  toggleStrikethroughOrEscape,
  toggleHighlightOrEscape,
} from "../handlers/formattingHandlers";
import {
  setHeading1,
  setHeading2,
  setHeading3,
} from "../handlers/headingHandlers";
import { insertTable } from "../handlers/tableHandlers";
import { handleLinkCommand } from "../handlers/linkHandlers";

describe("CodeMirrorToolbar", () => {
  let view: EditorView;
  let container: HTMLDivElement;

  beforeEach(() => {
    // Reset store state
    useEditorStore.setState({
      sourceMode: false,
    });

    // Clear all mocks
    vi.clearAllMocks();

    // Create a test EditorView
    container = document.createElement("div");
    document.body.appendChild(container);

    const state = EditorState.create({
      doc: "Test content",
    });

    view = new EditorView({
      state,
      parent: container,
    });
  });

  afterEach(() => {
    view.destroy();
    container.remove();
  });

  describe("rendering", () => {
    it("renders the toolbar with all button groups", () => {
      render(<CodeMirrorToolbar view={view} />);

      // Text formatting buttons
      expect(screen.getByTestId("toolbar-bold")).toBeInTheDocument();
      expect(screen.getByTestId("toolbar-italic")).toBeInTheDocument();
      expect(screen.getByTestId("toolbar-strikethrough")).toBeInTheDocument();
      expect(screen.getByTestId("toolbar-highlight")).toBeInTheDocument();
      expect(screen.getByTestId("toolbar-inline-code")).toBeInTheDocument();

      // Heading buttons
      expect(screen.getByTestId("toolbar-paragraph")).toBeInTheDocument();
      expect(screen.getByTestId("toolbar-heading-1")).toBeInTheDocument();
      expect(screen.getByTestId("toolbar-heading-2")).toBeInTheDocument();
      expect(screen.getByTestId("toolbar-heading-3")).toBeInTheDocument();

      // List buttons
      expect(screen.getByTestId("toolbar-bullet-list")).toBeInTheDocument();
      expect(screen.getByTestId("toolbar-numbered-list")).toBeInTheDocument();
      expect(screen.getByTestId("toolbar-task-list")).toBeInTheDocument();

      // Block buttons
      expect(screen.getByTestId("toolbar-quote")).toBeInTheDocument();
      expect(screen.getByTestId("toolbar-code-block")).toBeInTheDocument();
      expect(screen.getByTestId("toolbar-horizontal-rule")).toBeInTheDocument();
      expect(screen.getByTestId("toolbar-insert-table")).toBeInTheDocument();

      // Insert buttons
      expect(screen.getByTestId("toolbar-link")).toBeInTheDocument();
      expect(screen.getByTestId("toolbar-image")).toBeInTheDocument();

      // View mode toggle
      expect(screen.getByTestId("view-mode-toggle")).toBeInTheDocument();
    });

    it("renders with null view (disabled state)", () => {
      render(<CodeMirrorToolbar view={null} />);

      const boldButton = screen.getByTestId("toolbar-bold");
      expect(boldButton).toBeDisabled();
    });

    it("disables buttons in source mode", () => {
      useEditorStore.setState({ sourceMode: true });
      render(<CodeMirrorToolbar view={view} />);

      const boldButton = screen.getByTestId("toolbar-bold");
      expect(boldButton).toBeDisabled();
    });
  });

  describe("text formatting handlers", () => {
    it("calls toggleBoldOrEscape when Bold is clicked", () => {
      render(<CodeMirrorToolbar view={view} />);

      fireEvent.click(screen.getByTestId("toolbar-bold"));

      expect(toggleBoldOrEscape).toHaveBeenCalledWith(view);
    });

    it("calls toggleItalicOrEscape when Italic is clicked", () => {
      render(<CodeMirrorToolbar view={view} />);

      fireEvent.click(screen.getByTestId("toolbar-italic"));

      expect(toggleItalicOrEscape).toHaveBeenCalledWith(view);
    });

    it("calls toggleStrikethroughOrEscape when Strikethrough is clicked", () => {
      render(<CodeMirrorToolbar view={view} />);

      fireEvent.click(screen.getByTestId("toolbar-strikethrough"));

      expect(toggleStrikethroughOrEscape).toHaveBeenCalledWith(view);
    });

    it("calls toggleHighlightOrEscape when Highlight is clicked", () => {
      render(<CodeMirrorToolbar view={view} />);

      fireEvent.click(screen.getByTestId("toolbar-highlight"));

      expect(toggleHighlightOrEscape).toHaveBeenCalledWith(view);
    });

    it("calls toggleCodeOrEscape when Code is clicked", () => {
      render(<CodeMirrorToolbar view={view} />);

      fireEvent.click(screen.getByTestId("toolbar-inline-code"));

      expect(toggleCodeOrEscape).toHaveBeenCalledWith(view);
    });
  });

  describe("heading handlers", () => {
    it("calls setHeading1 when H1 is clicked", () => {
      render(<CodeMirrorToolbar view={view} />);

      fireEvent.click(screen.getByTestId("toolbar-heading-1"));

      expect(setHeading1).toHaveBeenCalledWith(view);
    });

    it("calls setHeading2 when H2 is clicked", () => {
      render(<CodeMirrorToolbar view={view} />);

      fireEvent.click(screen.getByTestId("toolbar-heading-2"));

      expect(setHeading2).toHaveBeenCalledWith(view);
    });

    it("calls setHeading3 when H3 is clicked", () => {
      render(<CodeMirrorToolbar view={view} />);

      fireEvent.click(screen.getByTestId("toolbar-heading-3"));

      expect(setHeading3).toHaveBeenCalledWith(view);
    });
  });

  describe("block handlers", () => {
    it("calls insertTable when Table is clicked", () => {
      render(<CodeMirrorToolbar view={view} />);

      fireEvent.click(screen.getByTestId("toolbar-insert-table"));

      expect(insertTable).toHaveBeenCalledWith(view);
    });

    it("calls handleLinkCommand when Link is clicked", () => {
      render(<CodeMirrorToolbar view={view} />);

      fireEvent.click(screen.getByTestId("toolbar-link"));

      expect(handleLinkCommand).toHaveBeenCalledWith(view);
    });
  });

  describe("view mode toggle", () => {
    it("shows Source label in WYSIWYG mode", () => {
      useEditorStore.setState({ sourceMode: false });
      render(<CodeMirrorToolbar view={view} />);

      const toggle = screen.getByTestId("view-mode-toggle");
      expect(toggle).toHaveTextContent("Source");
    });

    it("shows WYSIWYG label in Source mode", () => {
      useEditorStore.setState({ sourceMode: true });
      render(<CodeMirrorToolbar view={view} />);

      const toggle = screen.getByTestId("view-mode-toggle");
      expect(toggle).toHaveTextContent("WYSIWYG");
    });

    it("toggles source mode when clicked", () => {
      const toggleSourceMode = vi.fn();
      useEditorStore.setState({ sourceMode: false, toggleSourceMode });
      render(<CodeMirrorToolbar view={view} />);

      fireEvent.click(screen.getByTestId("view-mode-toggle"));

      expect(toggleSourceMode).toHaveBeenCalled();
    });
  });
});
