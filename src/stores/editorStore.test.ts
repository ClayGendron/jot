import { describe, it, expect, beforeEach } from "vitest";
import {
  useEditorStore,
  DEFAULT_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
} from "./editorStore";

describe("editorStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useEditorStore.setState({
      filePath: null,
      content: "",
      isDirty: false,
      lastSaved: null,
      saveStatus: "idle",
      saveError: null,
      sidebarOpen: true,
      focusMode: false,
      theme: "system",
      fontFamily: "serif",
      fontSize: 18,
      lineHeight: 1.8,
      maxLineWidth: 72,
      typewriterMode: false,
      sourceMode: false,
      showLineNumbers: false,
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
      zenMode: false,
    });
  });

  describe("Document State", () => {
    it("initializes with empty document state", () => {
      const state = useEditorStore.getState();

      expect(state.filePath).toBeNull();
      expect(state.content).toBe("");
      expect(state.isDirty).toBe(false);
      expect(state.lastSaved).toBeNull();
      expect(state.saveStatus).toBe("idle");
      expect(state.saveError).toBeNull();
    });

    it("setContent updates content and marks dirty", () => {
      const { setContent } = useEditorStore.getState();

      setContent("Hello, world!");

      const state = useEditorStore.getState();
      expect(state.content).toBe("Hello, world!");
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

      setContent("Some content");
      expect(useEditorStore.getState().isDirty).toBe(true);

      markSaved();

      const state = useEditorStore.getState();
      expect(state.isDirty).toBe(false);
      expect(state.lastSaved).toBeInstanceOf(Date);
    });

    it("resetDocument returns to initial state", () => {
      const { setContent, setFilePath, resetDocument } =
        useEditorStore.getState();

      setContent("Some content");
      setFilePath("/path/to/file.md");

      resetDocument();

      const state = useEditorStore.getState();
      expect(state.content).toBe("");
      expect(state.filePath).toBeNull();
      expect(state.isDirty).toBe(false);
      expect(state.saveStatus).toBe("idle");
    });

    it("setSaveStatus updates save status", () => {
      const { setSaveStatus } = useEditorStore.getState();

      setSaveStatus("saving");
      expect(useEditorStore.getState().saveStatus).toBe("saving");
      expect(useEditorStore.getState().saveError).toBeNull();

      setSaveStatus("saved");
      expect(useEditorStore.getState().saveStatus).toBe("saved");

      setSaveStatus("error", "Failed to save");
      expect(useEditorStore.getState().saveStatus).toBe("error");
      expect(useEditorStore.getState().saveError).toBe("Failed to save");

      setSaveStatus("idle");
      expect(useEditorStore.getState().saveStatus).toBe("idle");
    });
  });

  describe("UI State", () => {
    it("initializes with default UI state", () => {
      const state = useEditorStore.getState();

      expect(state.sidebarOpen).toBe(true);
      expect(state.focusMode).toBe(false);
      expect(state.theme).toBe("system");
      expect(state.sourceMode).toBe(false);
      expect(state.showLineNumbers).toBe(false);
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

    it("toggleLineNumbers flips line numbers state", () => {
      const { toggleLineNumbers } = useEditorStore.getState();

      expect(useEditorStore.getState().showLineNumbers).toBe(false);

      toggleLineNumbers();
      expect(useEditorStore.getState().showLineNumbers).toBe(true);

      toggleLineNumbers();
      expect(useEditorStore.getState().showLineNumbers).toBe(false);
    });

    it("setFontFamily updates font family", () => {
      const { setFontFamily } = useEditorStore.getState();

      expect(useEditorStore.getState().fontFamily).toBe("serif");

      setFontFamily("sans");
      expect(useEditorStore.getState().fontFamily).toBe("sans");

      setFontFamily("mono");
      expect(useEditorStore.getState().fontFamily).toBe("mono");

      setFontFamily("serif");
      expect(useEditorStore.getState().fontFamily).toBe("serif");
    });

    it("setFontSize updates font size", () => {
      const { setFontSize } = useEditorStore.getState();

      expect(useEditorStore.getState().fontSize).toBe(18);

      setFontSize(16);
      expect(useEditorStore.getState().fontSize).toBe(16);

      setFontSize(24);
      expect(useEditorStore.getState().fontSize).toBe(24);
    });

    it("setLineHeight updates line height", () => {
      const { setLineHeight } = useEditorStore.getState();

      expect(useEditorStore.getState().lineHeight).toBe(1.8);

      setLineHeight(1.5);
      expect(useEditorStore.getState().lineHeight).toBe(1.5);

      setLineHeight(2.0);
      expect(useEditorStore.getState().lineHeight).toBe(2.0);
    });

    it("setMaxLineWidth updates max line width", () => {
      const { setMaxLineWidth } = useEditorStore.getState();

      expect(useEditorStore.getState().maxLineWidth).toBe(72);

      setMaxLineWidth(60);
      expect(useEditorStore.getState().maxLineWidth).toBe(60);

      setMaxLineWidth(100);
      expect(useEditorStore.getState().maxLineWidth).toBe(100);
    });

    it("toggleTypewriterMode flips typewriter mode state", () => {
      const { toggleTypewriterMode } = useEditorStore.getState();

      expect(useEditorStore.getState().typewriterMode).toBe(false);

      toggleTypewriterMode();
      expect(useEditorStore.getState().typewriterMode).toBe(true);

      toggleTypewriterMode();
      expect(useEditorStore.getState().typewriterMode).toBe(false);
    });
  });

  describe("Layout State", () => {
    it("initializes with default layout state", () => {
      const state = useEditorStore.getState();

      expect(state.sidebarWidth).toBe(DEFAULT_SIDEBAR_WIDTH);
      expect(state.zenMode).toBe(false);
    });

    it("setSidebarWidth updates sidebar width", () => {
      const { setSidebarWidth } = useEditorStore.getState();

      setSidebarWidth(300);
      expect(useEditorStore.getState().sidebarWidth).toBe(300);

      setSidebarWidth(400);
      expect(useEditorStore.getState().sidebarWidth).toBe(400);
    });

    it("setSidebarWidth clamps to minimum width", () => {
      const { setSidebarWidth } = useEditorStore.getState();

      setSidebarWidth(100); // Below MIN_SIDEBAR_WIDTH
      expect(useEditorStore.getState().sidebarWidth).toBe(MIN_SIDEBAR_WIDTH);

      setSidebarWidth(0);
      expect(useEditorStore.getState().sidebarWidth).toBe(MIN_SIDEBAR_WIDTH);
    });

    it("setSidebarWidth clamps to maximum width", () => {
      const { setSidebarWidth } = useEditorStore.getState();

      setSidebarWidth(600); // Above MAX_SIDEBAR_WIDTH
      expect(useEditorStore.getState().sidebarWidth).toBe(MAX_SIDEBAR_WIDTH);

      setSidebarWidth(1000);
      expect(useEditorStore.getState().sidebarWidth).toBe(MAX_SIDEBAR_WIDTH);
    });

    it("toggleZenMode flips zen mode state", () => {
      const { toggleZenMode } = useEditorStore.getState();

      expect(useEditorStore.getState().zenMode).toBe(false);

      toggleZenMode();
      expect(useEditorStore.getState().zenMode).toBe(true);

      toggleZenMode();
      expect(useEditorStore.getState().zenMode).toBe(false);
    });

    it("setLayoutState updates multiple layout properties", () => {
      const { setLayoutState } = useEditorStore.getState();

      setLayoutState({ sidebarWidth: 350, zenMode: true });

      const state = useEditorStore.getState();
      expect(state.sidebarWidth).toBe(350);
      expect(state.zenMode).toBe(true);
    });

    it("setLayoutState allows partial updates", () => {
      const { setLayoutState, setSidebarWidth } = useEditorStore.getState();

      // Set initial width
      setSidebarWidth(300);

      // Partial update - only zen mode
      setLayoutState({ zenMode: true });

      const state = useEditorStore.getState();
      expect(state.sidebarWidth).toBe(300); // Unchanged
      expect(state.zenMode).toBe(true);
    });
  });
});
