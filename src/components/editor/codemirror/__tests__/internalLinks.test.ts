/**
 * Tests for internal link detection and navigation helpers
 */

import { describe, it, expect } from "vitest";
import {
  isInternalLink,
  parseInternalLinkTarget,
} from "../utils/sharedHelpers";

describe("isInternalLink", () => {
  describe("returns true for internal links", () => {
    it("detects .md file paths", () => {
      expect(isInternalLink("notes/todo.md")).toBe(true);
      expect(isInternalLink("readme.md")).toBe(true);
      expect(isInternalLink("./sibling.md")).toBe(true);
      expect(isInternalLink("../parent.md")).toBe(true);
      expect(isInternalLink("folder/subfolder/doc.md")).toBe(true);
    });

    it("detects .md file paths with heading anchors", () => {
      expect(isInternalLink("notes/todo.md#section")).toBe(true);
      expect(isInternalLink("readme.md#introduction")).toBe(true);
      expect(isInternalLink("./doc.md#my-heading")).toBe(true);
    });

    it("detects same-file heading links", () => {
      expect(isInternalLink("#my-heading")).toBe(true);
      expect(isInternalLink("#section-1")).toBe(true);
      expect(isInternalLink("#")).toBe(true);
    });
  });

  describe("returns false for external links", () => {
    it("rejects http URLs", () => {
      expect(isInternalLink("http://example.com")).toBe(false);
      expect(isInternalLink("http://example.com/page.md")).toBe(false);
    });

    it("rejects https URLs", () => {
      expect(isInternalLink("https://example.com")).toBe(false);
      expect(isInternalLink("https://example.com/page.md")).toBe(false);
    });

    it("rejects other protocols", () => {
      expect(isInternalLink("mailto:user@example.com")).toBe(false);
      expect(isInternalLink("ftp://files.example.com")).toBe(false);
      expect(isInternalLink("file:///path/to/file")).toBe(false);
      expect(isInternalLink("javascript:void(0)")).toBe(false);
    });

    it("rejects non-.md file paths", () => {
      expect(isInternalLink("image.png")).toBe(false);
      expect(isInternalLink("document.pdf")).toBe(false);
      expect(isInternalLink("script.js")).toBe(false);
      expect(isInternalLink("folder/file.txt")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("rejects empty URLs", () => {
      expect(isInternalLink("")).toBe(false);
      expect(isInternalLink("   ")).toBe(false);
    });

    it("handles URLs with query params (not internal)", () => {
      // Query params on .md files are unusual and treated as external
      expect(isInternalLink("file.md?foo=bar")).toBe(false);
    });

    it("handles mixed case extensions", () => {
      // Only lowercase .md is considered internal
      expect(isInternalLink("file.MD")).toBe(false);
      expect(isInternalLink("file.Md")).toBe(false);
    });
  });
});

describe("parseInternalLinkTarget", () => {
  describe("parses .md file paths", () => {
    it("extracts path from simple .md link", () => {
      const result = parseInternalLinkTarget("notes/todo.md");
      expect(result).toEqual({
        path: "notes/todo.md",
        heading: undefined,
        isSameFile: false,
      });
    });

    it("extracts path and heading from .md link with anchor", () => {
      const result = parseInternalLinkTarget("notes/todo.md#section-1");
      expect(result).toEqual({
        path: "notes/todo.md",
        heading: "section-1",
        isSameFile: false,
      });
    });

    it("handles relative paths", () => {
      const result = parseInternalLinkTarget("./sibling.md");
      expect(result).toEqual({
        path: "./sibling.md",
        heading: undefined,
        isSameFile: false,
      });
    });

    it("handles parent directory paths", () => {
      const result = parseInternalLinkTarget("../parent.md#heading");
      expect(result).toEqual({
        path: "../parent.md",
        heading: "heading",
        isSameFile: false,
      });
    });
  });

  describe("parses same-file heading links", () => {
    it("extracts heading from fragment-only link", () => {
      const result = parseInternalLinkTarget("#my-heading");
      expect(result).toEqual({
        path: "",
        heading: "my-heading",
        isSameFile: true,
      });
    });

    it("handles empty heading (just #)", () => {
      const result = parseInternalLinkTarget("#");
      expect(result).toEqual({
        path: "",
        heading: "",
        isSameFile: true,
      });
    });

    it("handles heading with special characters", () => {
      const result = parseInternalLinkTarget("#section-1-overview");
      expect(result).toEqual({
        path: "",
        heading: "section-1-overview",
        isSameFile: true,
      });
    });
  });

  describe("returns null for external links", () => {
    it("returns null for http URLs", () => {
      expect(parseInternalLinkTarget("http://example.com")).toBeNull();
    });

    it("returns null for https URLs", () => {
      expect(parseInternalLinkTarget("https://example.com")).toBeNull();
    });

    it("returns null for non-.md paths", () => {
      expect(parseInternalLinkTarget("image.png")).toBeNull();
    });

    it("returns null for empty URL", () => {
      expect(parseInternalLinkTarget("")).toBeNull();
    });
  });
});
