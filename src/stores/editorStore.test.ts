import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "./editorStore";

describe("editorStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useEditorStore.setState({
      filePath: null,
      content: "",
      isDirty: false,
      lastSaved: null,
      sidebarOpen: true,
      focusMode: false,
      theme: "system",
      sourceMode: false,
    });
  });

  describe("Document State", () => {
    it("initializes with empty document state", () => {
      const state = useEditorStore.getState();

      expect(state.filePath).toBeNull();
      expect(state.content).toBe("");
      expect(state.isDirty).toBe(false);
      expect(state.lastSaved).toBeNull();
    });

    it("setContent updates content and marks dirty", () => {
      const { setContent } = useEditorStore.getState();

      setContent("<p>Hello, world!</p>");

      const state = useEditorStore.getState();
      expect(state.content).toBe("<p>Hello, world!</p>");
      expect(state.isDirty).toBe(true);
    });

    it("setFilePath updates file path", () => {
      const { setFilePath } = useEditorStore.getState();

      setFilePath("/path/to/document.md");

      const state = useEditorStore.getState();
      expect(state.filePath).toBe("/path/to/document.md");
    });

    it("markSaved clears dirty flag and sets timestamp", () => {
      const { setContent, markSaved } = useEditorStore.getState();

      setContent("<p>Some content</p>");
      expect(useEditorStore.getState().isDirty).toBe(true);

      markSaved();

      const state = useEditorStore.getState();
      expect(state.isDirty).toBe(false);
      expect(state.lastSaved).toBeInstanceOf(Date);
    });

    it("resetDocument returns to initial state", () => {
      const { setContent, setFilePath, resetDocument } =
        useEditorStore.getState();

      setContent("<p>Some content</p>");
      setFilePath("/path/to/file.md");

      resetDocument();

      const state = useEditorStore.getState();
      expect(state.content).toBe("");
      expect(state.filePath).toBeNull();
      expect(state.isDirty).toBe(false);
    });
  });

  describe("UI State", () => {
    it("initializes with default UI state", () => {
      const state = useEditorStore.getState();

      expect(state.sidebarOpen).toBe(true);
      expect(state.focusMode).toBe(false);
      expect(state.theme).toBe("system");
      expect(state.sourceMode).toBe(false);
    });

    it("toggleSidebar flips sidebar state", () => {
      const { toggleSidebar } = useEditorStore.getState();

      expect(useEditorStore.getState().sidebarOpen).toBe(true);

      toggleSidebar();
      expect(useEditorStore.getState().sidebarOpen).toBe(false);

      toggleSidebar();
      expect(useEditorStore.getState().sidebarOpen).toBe(true);
    });

    it("toggleFocusMode flips focus mode state", () => {
      const { toggleFocusMode } = useEditorStore.getState();

      expect(useEditorStore.getState().focusMode).toBe(false);

      toggleFocusMode();
      expect(useEditorStore.getState().focusMode).toBe(true);

      toggleFocusMode();
      expect(useEditorStore.getState().focusMode).toBe(false);
    });

    it("toggleSourceMode flips source mode state", () => {
      const { toggleSourceMode } = useEditorStore.getState();

      expect(useEditorStore.getState().sourceMode).toBe(false);

      toggleSourceMode();
      expect(useEditorStore.getState().sourceMode).toBe(true);
    });

    it("setTheme updates theme", () => {
      const { setTheme } = useEditorStore.getState();

      setTheme("dark");
      expect(useEditorStore.getState().theme).toBe("dark");

      setTheme("light");
      expect(useEditorStore.getState().theme).toBe("light");
    });
  });
});
