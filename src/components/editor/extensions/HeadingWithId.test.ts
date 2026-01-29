import { describe, it, expect } from "vitest";
import { generateHeadingId } from "@/lib/markdown/parser";

/**
 * Tests for HeadingWithId extension
 *
 * Note: Testing TipTap extensions in isolation is complex because the ProseMirror
 * plugin system requires a full editor context. These tests focus on the
 * generateHeadingId function that powers the extension.
 *
 * Integration tests with the full editor setup would be better done
 * as E2E tests with Playwright.
 */

describe("HeadingWithId extension - generateHeadingId", () => {
  // Tests updated to match github-slugger behavior (GitHub's actual algorithm)

  it("generates id from simple text", () => {
    expect(generateHeadingId("My Title")).toBe("my-title");
  });

  it("handles multiple words", () => {
    expect(generateHeadingId("Hello World Example")).toBe("hello-world-example");
  });

  it("removes special characters", () => {
    expect(generateHeadingId("What's New?")).toBe("whats-new");
  });

  it("handles numbers", () => {
    expect(generateHeadingId("Heading 1")).toBe("heading-1");
    expect(generateHeadingId("2024 Update")).toBe("2024-update");
  });

  it("handles multiple spaces", () => {
    // github-slugger preserves each space as a hyphen
    expect(generateHeadingId("Multiple   Spaces")).toBe("multiple---spaces");
  });

  it("handles leading/trailing spaces", () => {
    // github-slugger preserves leading/trailing as hyphens
    expect(generateHeadingId("  Trimmed  ")).toBe("--trimmed--");
  });

  it("handles consecutive special characters", () => {
    // github-slugger preserves consecutive hyphens
    expect(generateHeadingId("Test---Case")).toBe("test---case");
  });

  it("handles empty string", () => {
    expect(generateHeadingId("")).toBe("");
  });

  it("handles all special characters", () => {
    expect(generateHeadingId("!@#$%^&*()")).toBe("");
  });

  it("converts to lowercase", () => {
    expect(generateHeadingId("UPPERCASE")).toBe("uppercase");
    expect(generateHeadingId("MixedCase")).toBe("mixedcase");
  });

  it("handles underscores and dashes", () => {
    expect(generateHeadingId("snake_case")).toBe("snake_case");
    expect(generateHeadingId("kebab-case")).toBe("kebab-case");
  });

  it("handles unicode characters", () => {
    expect(generateHeadingId("Café au lait")).toBe("café-au-lait");
    expect(generateHeadingId("日本語")).toBe("日本語");
  });
});
