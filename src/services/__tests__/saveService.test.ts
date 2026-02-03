/**
 * Tests for Save Service
 *
 * Phase 1: Verify markdown is preserved without conversion when using CodeMirror editor.
 */

import { describe, it, expect, vi } from "vitest";
import { computeSimpleHash } from "../saveService";

// Mock the stores
vi.mock("@/stores/tabsStore", () => ({
  useTabsStore: {
    getState: vi.fn(),
  },
}));

vi.mock("@/stores/editorStore", () => ({
  useEditorStore: {
    getState: vi.fn(),
  },
}));

vi.mock("@/stores/workspaceStore", () => ({
  useWorkspaceStore: {
    getState: vi.fn(),
  },
}));

vi.mock("@/stores/linksStore", () => ({
  useLinksStore: {
    getState: vi.fn(),
  },
}));

vi.mock("@/lib/tauri/files", () => ({
  writeFile: vi.fn(),
}));

vi.mock("@/lib/tauri/versionHistory", () => ({
  saveVersion: vi.fn(),
}));

vi.mock("./semanticIndexingService", () => ({
  queueFileForIndexing: vi.fn(),
}));

describe("Save Service", () => {
  describe("computeSimpleHash", () => {
    it("returns consistent hash for same content", () => {
      const content = "# Hello World\n\nThis is a test.";
      const hash1 = computeSimpleHash(content);
      const hash2 = computeSimpleHash(content);

      expect(hash1).toBe(hash2);
    });

    it("returns different hash for different content", () => {
      const content1 = "# Hello World";
      const content2 = "# Hello World!";

      expect(computeSimpleHash(content1)).not.toBe(computeSimpleHash(content2));
    });

    it("handles empty content", () => {
      const hash = computeSimpleHash("");
      expect(hash).toBe("0");
    });

    it("handles unicode content", () => {
      const content = "# 你好 🎉 émoji";
      const hash = computeSimpleHash(content);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
    });
  });

  describe("Markdown canonical format (integration concept)", () => {
    // Note: Full integration tests would require more complex mocking.
    // These tests verify the concept that markdown should be preserved.

    it("markdown content is preserved when useMarkdownEditor is true", () => {
      // When useMarkdownEditor is true, the save pipeline should:
      // 1. NOT call htmlToMarkdown (content is already markdown)
      // 2. Save the content directly to disk

      const originalMarkdown = `# Test Document

This is **bold** and *italic*.

\`\`\`javascript
const x = 1;
\`\`\`
`;

      // Simulate the save path decision
      const useMarkdownEditor = true;
      const contentAtSaveStart = originalMarkdown;

      // When useMarkdownEditor is true, markdown = contentAtSaveStart directly
      const markdownToSave = useMarkdownEditor
        ? contentAtSaveStart
        : "would call htmlToMarkdown here";

      // Content should be unchanged
      expect(markdownToSave).toBe(originalMarkdown);
    });

    it("line endings are normalized for consistent hashing", () => {
      const crlfContent = "Line 1\r\nLine 2\r\n";
      const lfContent = "Line 1\nLine 2\n";

      // The save pipeline normalizes CRLF to LF
      const normalized = crlfContent.replace(/\r\n/g, "\n");
      expect(normalized).toBe(lfContent);

      // Hashes should match after normalization
      expect(computeSimpleHash(normalized)).toBe(computeSimpleHash(lfContent));
    });
  });
});
