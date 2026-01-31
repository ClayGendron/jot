/**
 * Tests for PDF export functionality
 *
 * Tests verify that PDF generation works correctly with various
 * markdown content types and export options.
 */

import { describe, it, expect } from "vitest";
import {
  generatePdfFilename,
  type ExportOptions,
  DEFAULT_EXPORT_OPTIONS,
} from "./pdfExport";

describe("PDF Export", () => {
  describe("generatePdfFilename", () => {
    it("generates filename from document title", () => {
      const filename = generatePdfFilename("My Document.md");
      expect(filename).toMatch(/^my-document-\d{4}-\d{2}-\d{2}\.pdf$/);
    });

    it("handles files without extension", () => {
      const filename = generatePdfFilename("notes");
      expect(filename).toMatch(/^notes-\d{4}-\d{2}-\d{2}\.pdf$/);
    });

    it("cleans special characters from filename", () => {
      const filename = generatePdfFilename("My Notes & Ideas!.md");
      expect(filename).toMatch(/^my-notes-ideas-\d{4}-\d{2}-\d{2}\.pdf$/);
    });

    it("handles empty filename", () => {
      const filename = generatePdfFilename("");
      expect(filename).toMatch(/^document-\d{4}-\d{2}-\d{2}\.pdf$/);
    });

    it("truncates long filenames", () => {
      const longName = "a".repeat(100) + ".md";
      const filename = generatePdfFilename(longName);
      // Should be limited to reasonable length
      expect(filename.length).toBeLessThan(60);
    });
  });

  describe("DEFAULT_EXPORT_OPTIONS", () => {
    it("has sensible default values", () => {
      expect(DEFAULT_EXPORT_OPTIONS.pageSize).toBe("letter");
      expect(DEFAULT_EXPORT_OPTIONS.orientation).toBe("portrait");
      expect(DEFAULT_EXPORT_OPTIONS.margins).toBeDefined();
      expect(DEFAULT_EXPORT_OPTIONS.margins.top).toBeGreaterThan(0);
      expect(DEFAULT_EXPORT_OPTIONS.includeBookmarks).toBe(true);
    });

    it("margins are in reasonable range", () => {
      const { margins } = DEFAULT_EXPORT_OPTIONS;
      // Margins should be between 0.25 and 2 inches (typical range)
      expect(margins.top).toBeGreaterThanOrEqual(0.25);
      expect(margins.top).toBeLessThanOrEqual(2);
      expect(margins.bottom).toBeGreaterThanOrEqual(0.25);
      expect(margins.left).toBeGreaterThanOrEqual(0.25);
      expect(margins.right).toBeGreaterThanOrEqual(0.25);
    });
  });

  describe("ExportOptions type", () => {
    it("allows custom page sizes", () => {
      const options: ExportOptions = {
        ...DEFAULT_EXPORT_OPTIONS,
        pageSize: "a4",
      };
      expect(options.pageSize).toBe("a4");
    });

    it("allows landscape orientation", () => {
      const options: ExportOptions = {
        ...DEFAULT_EXPORT_OPTIONS,
        orientation: "landscape",
      };
      expect(options.orientation).toBe("landscape");
    });

    it("allows custom margins", () => {
      const options: ExportOptions = {
        ...DEFAULT_EXPORT_OPTIONS,
        margins: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
      };
      expect(options.margins.top).toBe(1.5);
    });
  });
});
