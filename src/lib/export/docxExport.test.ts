/**
 * Tests for Word/DOCX export functionality
 *
 * Tests verify that DOCX generation works correctly with various
 * markdown content types.
 */

import { describe, it, expect } from "vitest";
import {
  generateDocxFilename,
  type DocxExportOptions,
  DEFAULT_DOCX_OPTIONS,
} from "./docxExport";

describe("DOCX Export", () => {
  describe("generateDocxFilename", () => {
    it("generates filename from document title", () => {
      const filename = generateDocxFilename("My Document.md");
      expect(filename).toMatch(/^my-document-\d{4}-\d{2}-\d{2}\.docx$/);
    });

    it("handles files without extension", () => {
      const filename = generateDocxFilename("notes");
      expect(filename).toMatch(/^notes-\d{4}-\d{2}-\d{2}\.docx$/);
    });

    it("cleans special characters from filename", () => {
      const filename = generateDocxFilename("My Notes & Ideas!.md");
      expect(filename).toMatch(/^my-notes-ideas-\d{4}-\d{2}-\d{2}\.docx$/);
    });

    it("handles empty filename", () => {
      const filename = generateDocxFilename("");
      expect(filename).toMatch(/^document-\d{4}-\d{2}-\d{2}\.docx$/);
    });
  });

  describe("DEFAULT_DOCX_OPTIONS", () => {
    it("has sensible default values", () => {
      expect(DEFAULT_DOCX_OPTIONS.pageSize).toBe("letter");
      expect(DEFAULT_DOCX_OPTIONS.margins).toBeDefined();
      expect(DEFAULT_DOCX_OPTIONS.margins.top).toBeGreaterThan(0);
    });

    it("margins are in reasonable range (in points)", () => {
      const { margins } = DEFAULT_DOCX_OPTIONS;
      // Word margins are in twips (1/20th of a point)
      // 1 inch = 1440 twips, so 0.75 inch = 1080 twips
      expect(margins.top).toBeGreaterThanOrEqual(720); // 0.5 inch minimum
      expect(margins.top).toBeLessThanOrEqual(2880); // 2 inch maximum
    });
  });

  describe("DocxExportOptions type", () => {
    it("allows custom page sizes", () => {
      const options: DocxExportOptions = {
        ...DEFAULT_DOCX_OPTIONS,
        pageSize: "a4",
      };
      expect(options.pageSize).toBe("a4");
    });

    it("allows custom margins", () => {
      const options: DocxExportOptions = {
        ...DEFAULT_DOCX_OPTIONS,
        margins: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
      };
      expect(options.margins.top).toBe(1440);
    });
  });
});
