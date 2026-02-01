/**
 * Tests for Changed Ranges Utility
 */

import { describe, it, expect } from "vitest";
import { getChangedRanges } from "./changedRanges";
import { EditorState } from "@tiptap/pm/state";
import { Schema } from "@tiptap/pm/model";

// Create a minimal schema for testing
const schema = new Schema({
  nodes: {
    doc: { content: "text*" },
    text: { inline: true },
  },
});

/**
 * Create an EditorState with the given text content
 */
function createState(text: string): EditorState {
  const doc = schema.node("doc", null, text ? [schema.text(text)] : []);
  return EditorState.create({ doc });
}

describe("getChangedRanges", () => {
  describe("insertions", () => {
    it("returns the range of inserted text", () => {
      const state = createState("hello");
      const tr = state.tr.insertText(" world", 5);

      const ranges = getChangedRanges(tr);

      expect(ranges).toHaveLength(1);
      expect(ranges[0].from).toBe(5);
      expect(ranges[0].to).toBe(11);
    });

    it("returns range for insertion at start", () => {
      const state = createState("world");
      const tr = state.tr.insertText("hello ", 0);

      const ranges = getChangedRanges(tr);

      expect(ranges).toHaveLength(1);
      expect(ranges[0].from).toBe(0);
      expect(ranges[0].to).toBe(6);
    });

    it("returns range for insertion in middle", () => {
      const state = createState("helloworld");
      const tr = state.tr.insertText(" ", 5);

      const ranges = getChangedRanges(tr);

      expect(ranges).toHaveLength(1);
      expect(ranges[0].from).toBe(5);
      expect(ranges[0].to).toBe(6);
    });
  });

  describe("deletions", () => {
    it("returns the range where deletion occurred", () => {
      const state = createState("hello world");
      const tr = state.tr.delete(5, 11); // Delete " world"

      const ranges = getChangedRanges(tr);

      expect(ranges).toHaveLength(1);
      // After deletion, the range collapses to a point
      expect(ranges[0].from).toBe(5);
      expect(ranges[0].to).toBe(5);
    });

    it("returns range for deletion at start", () => {
      const state = createState("hello world");
      const tr = state.tr.delete(0, 6); // Delete "hello "

      const ranges = getChangedRanges(tr);

      expect(ranges).toHaveLength(1);
      expect(ranges[0].from).toBe(0);
      expect(ranges[0].to).toBe(0);
    });
  });

  describe("replacements", () => {
    it("returns the range of replacement text", () => {
      const state = createState("hello world");
      const tr = state.tr.insertText("there", 6, 11); // Replace "world" with "there"

      const ranges = getChangedRanges(tr);

      expect(ranges).toHaveLength(1);
      expect(ranges[0].from).toBe(6);
      expect(ranges[0].to).toBe(11);
    });
  });

  describe("multiple changes", () => {
    it("returns merged ranges for overlapping changes", () => {
      const state = createState("hello world");
      const tr = state.tr
        .insertText("x", 5) // "hellox world"
        .insertText("y", 6); // "helloxy world"

      const ranges = getChangedRanges(tr);

      // Should merge into a single range
      expect(ranges).toHaveLength(1);
      expect(ranges[0].from).toBe(5);
      expect(ranges[0].to).toBe(7);
    });

    it("returns separate ranges for non-overlapping changes", () => {
      const state = createState("hello world test");
      // Start from end to avoid position shifting issues
      const tr = state.tr
        .insertText("_", 11) // "hello world_ test"
        .insertText("_", 5); // "hello_ world_ test"

      const ranges = getChangedRanges(tr);

      // Two distinct ranges
      expect(ranges).toHaveLength(2);
      // Ranges should be sorted by from position
      expect(ranges[0].from).toBeLessThan(ranges[1].from);
    });
  });

  describe("no changes", () => {
    it("returns empty array for transaction with no doc changes", () => {
      const state = createState("hello world");
      const tr = state.tr; // Empty transaction

      const ranges = getChangedRanges(tr);

      expect(ranges).toHaveLength(0);
    });
  });

  describe("empty document", () => {
    it("handles insertion into empty document", () => {
      const state = createState("");
      const tr = state.tr.insertText("hello");

      const ranges = getChangedRanges(tr);

      expect(ranges).toHaveLength(1);
      expect(ranges[0].from).toBe(0);
      expect(ranges[0].to).toBe(5);
    });
  });
});

describe("mergeOverlappingRanges (via getChangedRanges)", () => {
  // We test the merge behavior through the public API

  it("merges adjacent ranges", () => {
    const state = createState("hello world");
    // Create adjacent changes
    const tr = state.tr
      .insertText("a", 5)
      .insertText("b", 6);

    const ranges = getChangedRanges(tr);

    // Should merge into single range
    expect(ranges).toHaveLength(1);
  });

  it("merges overlapping ranges", () => {
    const state = createState("hello world test");
    // Create overlapping changes
    const tr = state.tr
      .insertText("abc", 5)
      .insertText("xyz", 7);

    const ranges = getChangedRanges(tr);

    // Should merge into single range
    expect(ranges).toHaveLength(1);
  });

  it("handles single range", () => {
    const state = createState("hello");
    const tr = state.tr.insertText("x", 2);

    const ranges = getChangedRanges(tr);

    expect(ranges).toHaveLength(1);
    expect(ranges[0].from).toBe(2);
    expect(ranges[0].to).toBe(3);
  });
});
