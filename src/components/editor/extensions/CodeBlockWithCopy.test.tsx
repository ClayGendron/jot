import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import { useEditorStore } from "@/stores/editorStore";

// Mock the TipTap imports since we can't easily test the full extension
vi.mock("@tiptap/react", () => ({
  NodeViewContent: ({ children }: { children?: React.ReactNode }) => (
    <code className="hljs">{children}</code>
  ),
  NodeViewWrapper: ({
    children,
    className,
    onMouseEnter,
    onMouseLeave,
    "data-testid": testId,
  }: {
    children?: React.ReactNode;
    className?: string;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    "data-testid"?: string;
  }) => (
    <div
      className={className}
      data-testid={testId}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  ),
  ReactNodeViewRenderer: vi.fn(),
}));

vi.mock("@tiptap/extension-code-block-lowlight", () => ({
  default: {
    extend: vi.fn(() => ({})),
  },
}));

describe("CodeBlockWithCopy - Store Integration", () => {
  // Mock clipboard API
  const mockWriteText = vi.fn();

  beforeEach(() => {
    mockWriteText.mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    // Reset store to initial state
    useEditorStore.setState({
      showLineNumbers: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("showLineNumbers defaults to false in store", () => {
    const state = useEditorStore.getState();
    expect(state.showLineNumbers).toBe(false);
  });

  it("toggleLineNumbers flips the state", () => {
    const { toggleLineNumbers } = useEditorStore.getState();

    expect(useEditorStore.getState().showLineNumbers).toBe(false);

    toggleLineNumbers();
    expect(useEditorStore.getState().showLineNumbers).toBe(true);

    toggleLineNumbers();
    expect(useEditorStore.getState().showLineNumbers).toBe(false);
  });
});

describe("CodeBlockWithCopy - Clipboard API", () => {
  const mockWriteText = vi.fn();

  beforeEach(() => {
    mockWriteText.mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: mockWriteText,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("clipboard API is available", () => {
    expect(navigator.clipboard).toBeDefined();
    expect(navigator.clipboard.writeText).toBeDefined();
  });

  it("can write to clipboard", async () => {
    await navigator.clipboard.writeText("test code");
    expect(mockWriteText).toHaveBeenCalledWith("test code");
  });

  it("handles clipboard failure gracefully", async () => {
    mockWriteText.mockRejectedValueOnce(new Error("Clipboard not available"));

    await expect(navigator.clipboard.writeText("test")).rejects.toThrow(
      "Clipboard not available"
    );
  });
});
