/**
 * Tests for useInternalLinkNavigation hook
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useInternalLinkNavigation } from "./useInternalLinkNavigation";

// Mock the workspace store
vi.mock("@/stores/workspaceStore", () => {
  const mockFiles = [
    { name: "note.md", path: "/workspace/note.md", displayPath: "note.md" },
    { name: "guide.md", path: "/workspace/docs/guide.md", displayPath: "docs/guide.md" },
  ];

  const selectAllFilesForSuggestion = () => mockFiles;

  return {
    useWorkspaceStore: vi.fn((selector) => {
      const state = {
        workspacePath: "/workspace",
        fileTree: [],
      };

      if (typeof selector === "function") {
        // Check if it's the selectAllFilesForSuggestion selector by name
        if (selector.name === "selectAllFilesForSuggestion" || selector === selectAllFilesForSuggestion) {
          return mockFiles;
        }
        // Otherwise, call the selector with state
        return selector(state);
      }

      return state.workspacePath;
    }),
    selectAllFilesForSuggestion,
  };
});

// Mock the editor store
vi.mock("@/stores/editorStore", () => ({
  useEditorStore: vi.fn((selector) => {
    const state = {
      filePath: "/workspace/current.md",
    };

    if (typeof selector === "function") {
      return selector(state);
    }

    return state;
  }),
}));

describe("useInternalLinkNavigation", () => {
  let onNavigate: (path: string, heading?: string) => void;
  let containerRef: { current: HTMLElement | null };

  beforeEach(() => {
    onNavigate = vi.fn();
    containerRef = { current: document.createElement("div") };
  });

  it("returns handleLinkClick function", () => {
    const { result } = renderHook(() =>
      useInternalLinkNavigation({
        onNavigate,
        containerRef,
        enabled: true,
      })
    );

    expect(result.current.handleLinkClick).toBeDefined();
    expect(typeof result.current.handleLinkClick).toBe("function");
  });

  it("calls onNavigate with resolved path for internal links", () => {
    const { result } = renderHook(() =>
      useInternalLinkNavigation({
        onNavigate,
        containerRef,
        enabled: true,
      })
    );

    result.current.handleLinkClick("note.md");

    expect(onNavigate).toHaveBeenCalledWith("/workspace/note.md", undefined);
  });

  it("includes heading in navigation callback", () => {
    const { result } = renderHook(() =>
      useInternalLinkNavigation({
        onNavigate,
        containerRef,
        enabled: true,
      })
    );

    result.current.handleLinkClick("guide.md#intro");

    expect(onNavigate).toHaveBeenCalledWith("/workspace/docs/guide.md", "intro");
  });

  it("does not navigate for external links", () => {
    const { result } = renderHook(() =>
      useInternalLinkNavigation({
        onNavigate,
        containerRef,
        enabled: true,
      })
    );

    result.current.handleLinkClick("https://example.com");

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("does not navigate for non-existent files", () => {
    const { result } = renderHook(() =>
      useInternalLinkNavigation({
        onNavigate,
        containerRef,
        enabled: true,
      })
    );

    result.current.handleLinkClick("missing.md");

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("calls onBrokenLinkClick for non-existent files when provided", () => {
    const onBrokenLinkClick = vi.fn();

    const { result } = renderHook(() =>
      useInternalLinkNavigation({
        onNavigate,
        onBrokenLinkClick,
        containerRef,
        enabled: true,
      })
    );

    result.current.handleLinkClick("missing.md");

    expect(onNavigate).not.toHaveBeenCalled();
    expect(onBrokenLinkClick).toHaveBeenCalledWith("/workspace/missing.md");
  });

  it("handles same-file heading links", () => {
    const { result } = renderHook(() =>
      useInternalLinkNavigation({
        onNavigate,
        containerRef,
        enabled: true,
      })
    );

    result.current.handleLinkClick("#introduction");

    expect(onNavigate).toHaveBeenCalledWith("/workspace/current.md", "introduction");
  });

  it("handles same-file heading links with multiple words", () => {
    const { result } = renderHook(() =>
      useInternalLinkNavigation({
        onNavigate,
        containerRef,
        enabled: true,
      })
    );

    result.current.handleLinkClick("#getting-started");

    expect(onNavigate).toHaveBeenCalledWith("/workspace/current.md", "getting-started");
  });
});
