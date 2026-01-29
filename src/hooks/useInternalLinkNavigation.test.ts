/**
 * Tests for useInternalLinkNavigation hook
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useInternalLinkNavigation } from "./useInternalLinkNavigation";

// Mock the workspace store
vi.mock("@/stores/workspaceStore", () => {
  // FileTree structure that the hook now uses directly
  const mockFileTree = [
    {
      name: "note.md",
      path: "/workspace/note.md",
      is_dir: false,
      is_markdown: true,
      modified: 1700000000,
      children: null,
    },
    {
      name: "docs",
      path: "/workspace/docs",
      is_dir: true,
      is_markdown: false,
      modified: 1700000000,
      children: [
        {
          name: "guide.md",
          path: "/workspace/docs/guide.md",
          is_dir: false,
          is_markdown: true,
          modified: 1700000001,
          children: null,
        },
      ],
    },
  ];

  return {
    useWorkspaceStore: vi.fn((selector) => {
      const state = {
        workspacePath: "/workspace",
        fileTree: mockFileTree,
      };

      if (typeof selector === "function") {
        return selector(state);
      }

      return state;
    }),
  };
});


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

  it("handles same-file heading links with onScrollToHeading callback", () => {
    const onScrollToHeading = vi.fn();

    const { result } = renderHook(() =>
      useInternalLinkNavigation({
        onNavigate,
        onScrollToHeading,
        containerRef,
        enabled: true,
      })
    );

    result.current.handleLinkClick("#introduction");

    // Should call onScrollToHeading instead of onNavigate for same-file headings
    expect(onScrollToHeading).toHaveBeenCalledWith("introduction");
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("handles same-file heading links with multiple words", () => {
    const onScrollToHeading = vi.fn();

    const { result } = renderHook(() =>
      useInternalLinkNavigation({
        onNavigate,
        onScrollToHeading,
        containerRef,
        enabled: true,
      })
    );

    result.current.handleLinkClick("#getting-started");

    expect(onScrollToHeading).toHaveBeenCalledWith("getting-started");
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("falls back to document.getElementById for same-file heading links without callback", () => {
    // Create a heading element to scroll to
    const headingElement = document.createElement("h2");
    headingElement.id = "test-heading";
    headingElement.scrollIntoView = vi.fn();
    document.body.appendChild(headingElement);

    const { result } = renderHook(() =>
      useInternalLinkNavigation({
        onNavigate,
        // No onScrollToHeading callback
        containerRef,
        enabled: true,
      })
    );

    result.current.handleLinkClick("#test-heading");

    // Should not call onNavigate, should scroll directly
    expect(onNavigate).not.toHaveBeenCalled();
    expect(headingElement.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });

    // Clean up
    document.body.removeChild(headingElement);
  });
});
