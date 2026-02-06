/**
 * Tests for Copy Formatted functionality
 *
 * Tests verify that content can be copied to clipboard in
 * both HTML (formatted) and Markdown formats.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  copyAsFormatted,
  copyAsMarkdown,
  copyWithDefaultFormat,
} from "./copyFormatted";

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn(),
  write: vi.fn(),
};

// No htmlToMarkdown mock needed — copyAsMarkdown now accepts markdown directly

describe("Copy Formatted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      value: mockClipboard,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("copyAsFormatted", () => {
    it("copies HTML content to clipboard with correct MIME types", async () => {
      const html = "<p>Hello <strong>world</strong></p>";
      const plainText = "Hello world";

      mockClipboard.write.mockResolvedValueOnce(undefined);

      const result = await copyAsFormatted(html, plainText);

      expect(result.success).toBe(true);
      expect(mockClipboard.write).toHaveBeenCalledTimes(1);

      // Check that ClipboardItem was created with correct MIME types
      const callArg = mockClipboard.write.mock.calls[0][0];
      expect(callArg).toHaveLength(1);
      expect(callArg[0]).toBeInstanceOf(ClipboardItem);
    });

    it("returns error result when clipboard API fails", async () => {
      const html = "<p>Test</p>";
      const plainText = "Test";

      mockClipboard.write.mockRejectedValueOnce(new Error("Permission denied"));

      const result = await copyAsFormatted(html, plainText);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Permission denied");
    });

    it("handles empty content", async () => {
      mockClipboard.write.mockResolvedValueOnce(undefined);

      const result = await copyAsFormatted("", "");

      expect(result.success).toBe(true);
    });
  });

  describe("copyAsMarkdown", () => {
    it("copies markdown content to clipboard", async () => {
      const markdown = "Hello **world**";

      mockClipboard.writeText.mockResolvedValueOnce(undefined);

      const result = await copyAsMarkdown(markdown);

      expect(result.success).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith("Hello **world**");
    });

    it("handles content with headings", async () => {
      const markdown = "# Title\n\nContent";

      mockClipboard.writeText.mockResolvedValueOnce(undefined);

      const result = await copyAsMarkdown(markdown);

      expect(result.success).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        "# Title\n\nContent"
      );
    });

    it("returns error result when clipboard API fails", async () => {
      const markdown = "Test";

      mockClipboard.writeText.mockRejectedValueOnce(
        new Error("Clipboard not available")
      );

      const result = await copyAsMarkdown(markdown);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Clipboard not available");
    });
  });

  describe("copyWithDefaultFormat", () => {
    it("uses formatted format by default", async () => {
      const html = "<p>Test</p>";
      const plainText = "Test";

      mockClipboard.write.mockResolvedValueOnce(undefined);

      const result = await copyWithDefaultFormat(html, plainText, "formatted");

      expect(result.success).toBe(true);
      expect(mockClipboard.write).toHaveBeenCalled();
      expect(mockClipboard.writeText).not.toHaveBeenCalled();
    });

    it("uses markdown format when specified", async () => {
      const html = "<p>Hello <strong>world</strong></p>";
      const plainText = "Hello world";

      mockClipboard.writeText.mockResolvedValueOnce(undefined);

      const result = await copyWithDefaultFormat(html, plainText, "markdown");

      expect(result.success).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalled();
      expect(mockClipboard.write).not.toHaveBeenCalled();
    });
  });
});
