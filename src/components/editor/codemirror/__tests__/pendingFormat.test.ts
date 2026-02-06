/**
 * Tests for pendingFormat extension
 *
 * Verifies that:
 * - Empty formatting patterns (e.g., **|**) are detected
 * - Pending format decorations hide marker characters
 * - The StateField guard skips recompute when no doc/selection change
 */

import { describe, it, expect, afterEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { pendingFormattingField, pendingFormatTheme } from "../extensions/pendingFormat";
import { codeBlockExtentsField } from "../utils/sharedHelpers";
import { hiddenRangesField } from "../extensions/hiddenRanges";
import { hiddenSyntaxField } from "../extensions/hiddenSyntax";
import { selectionSnapper } from "../extensions/selectionSnapper";
import { styleField } from "../extensions/styleDecorations";
import { HighlightExtension } from "../extensions/lezerExtensions";

// ===========================================
// TEST UTILITIES
// ===========================================

let activeViews: EditorView[] = [];

function createView(docWithCursor: string): EditorView {
  const cursorPos = docWithCursor.indexOf("|");
  const doc = cursorPos >= 0
    ? docWithCursor.slice(0, cursorPos) + docWithCursor.slice(cursorPos + 1)
    : docWithCursor;
  const pos = cursorPos >= 0 ? cursorPos : doc.length;

  const container = document.createElement("div");
  document.body.appendChild(container);

  const view = new EditorView({
    state: EditorState.create({
      doc,
      selection: { anchor: pos },
      extensions: [
        markdown({ extensions: [GFM, HighlightExtension] }),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        codeBlockExtentsField,
        hiddenRangesField,
        hiddenSyntaxField,
        selectionSnapper,
        pendingFormattingField,
        pendingFormatTheme,
        styleField,
      ],
    }),
    parent: container,
  });

  activeViews.push(view);
  return view;
}

afterEach(() => {
  for (const v of activeViews) {
    const parent = v.dom.parentElement;
    v.destroy();
    parent?.remove();
  }
  activeViews = [];
});

// ===========================================
// TESTS
// ===========================================

describe("pendingFormat", () => {
  describe("detection", () => {
    it("detects bold pending format (**|**)", () => {
      const view = createView("**|**");
      // The pendingFormattingField should produce decorations that hide the markers
      const decos = view.state.field(pendingFormattingField);
      // Two replace decorations: one for opening **, one for closing **
      let count = 0;
      const iter = decos.iter();
      while (iter.value) {
        count++;
        iter.next();
      }
      expect(count).toBe(2);
    });

    it("detects italic pending format (*|*)", () => {
      const view = createView("*|*");
      const decos = view.state.field(pendingFormattingField);
      let count = 0;
      const iter = decos.iter();
      while (iter.value) {
        count++;
        iter.next();
      }
      expect(count).toBe(2);
    });

    it("detects code pending format (`|`)", () => {
      const view = createView("`|`");
      const decos = view.state.field(pendingFormattingField);
      let count = 0;
      const iter = decos.iter();
      while (iter.value) {
        count++;
        iter.next();
      }
      expect(count).toBe(2);
    });

    it("detects highlight pending format (==|==)", () => {
      const view = createView("==|==");
      const decos = view.state.field(pendingFormattingField);
      let count = 0;
      const iter = decos.iter();
      while (iter.value) {
        count++;
        iter.next();
      }
      expect(count).toBe(2);
    });

    it("no pending format for regular text", () => {
      const view = createView("hello| world");
      const decos = view.state.field(pendingFormattingField);
      let count = 0;
      const iter = decos.iter();
      while (iter.value) {
        count++;
        iter.next();
      }
      expect(count).toBe(0);
    });
  });

  describe("update guard", () => {
    it("skips recompute when neither doc nor selection changed", () => {
      const view = createView("**|**");
      const decos1 = view.state.field(pendingFormattingField);

      // Dispatch a no-op transaction (no doc change, no selection change)
      view.dispatch({});

      const decos2 = view.state.field(pendingFormattingField);
      // Should return the same reference (no recompute)
      expect(decos1).toBe(decos2);
    });

    it("recomputes when selection changes", () => {
      const view = createView("**|** text");
      const decos1 = view.state.field(pendingFormattingField);

      // Move cursor to "text"
      view.dispatch({ selection: { anchor: view.state.doc.length } });

      const decos2 = view.state.field(pendingFormattingField);
      // Should recompute (different reference)
      expect(decos1).not.toBe(decos2);
    });

    it("recomputes when document changes", () => {
      const view = createView("**|**");
      const decos1 = view.state.field(pendingFormattingField);

      // Type a character
      const pos = view.state.selection.main.head;
      view.dispatch({
        changes: { from: pos, to: pos, insert: "a" },
        selection: { anchor: pos + 1 },
      });

      const decos2 = view.state.field(pendingFormattingField);
      // Should recompute
      expect(decos1).not.toBe(decos2);
    });
  });

  describe("pending format cleared on cursor movement", () => {
    it("no decorations when cursor moves outside pending markers", () => {
      const view = createView("**|** hello");

      // Verify pending format is detected initially
      let decos = view.state.field(pendingFormattingField);
      let count = 0;
      let iter = decos.iter();
      while (iter.value) { count++; iter.next(); }
      expect(count).toBe(2);

      // Move cursor to end of document
      view.dispatch({ selection: { anchor: view.state.doc.length } });

      decos = view.state.field(pendingFormattingField);
      count = 0;
      iter = decos.iter();
      while (iter.value) { count++; iter.next(); }
      expect(count).toBe(0);
    });
  });
});
