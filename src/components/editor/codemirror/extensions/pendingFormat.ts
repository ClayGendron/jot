/**
 * Pending Format
 *
 * Detects empty formatting patterns (e.g., **|**, *|*, `|`, ==|==) where the
 * cursor sits between opening/closing markers with no content. Hides these
 * markers via decorations and adds CSS classes to the editor for cursor styling.
 */

import { StateField, RangeSetBuilder } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";

// ===========================================
// PENDING FORMAT DETECTION
// ===========================================

type PendingFormatType = "bold" | "italic" | "code" | "strikethrough" | "highlight";

function getPendingFormat(state: EditorState): PendingFormatType | null {
  const doc = state.doc;
  const pos = state.selection.main.head;

  if (pos < 1) return null;

  const before2 = pos >= 2 ? doc.sliceString(pos - 2, pos) : "";
  const after2 = doc.sliceString(pos, pos + 2);
  const before1 = doc.sliceString(pos - 1, pos);
  const after1 = doc.sliceString(pos, pos + 1);

  if (before2 === "**" && after2 === "**") return "bold";
  if (before1 === "*" && after1 === "*" && before2 !== "**" && !after2.startsWith("**")) return "italic";
  if (before1 === "`" && after1 === "`") return "code";
  if (before2 === "~~" && after2 === "~~") return "strikethrough";
  if (before2 === "==" && after2 === "==") return "highlight";

  return null;
}

// ===========================================
// PENDING FORMAT DECORATIONS
// ===========================================

function buildPendingFormattingDecorations(state: EditorState) {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = state.doc;
  const pos = state.selection.main.head;

  if (pos < 1) return builder.finish();

  const before2 = pos >= 2 ? doc.sliceString(pos - 2, pos) : "";
  const after2 = doc.sliceString(pos, pos + 2);
  const before1 = pos >= 1 ? doc.sliceString(pos - 1, pos) : "";
  const after1 = doc.sliceString(pos, pos + 1);

  // Check for **|** (bold) - must check before *|*
  if (before2 === "**" && after2 === "**") {
    builder.add(pos - 2, pos, Decoration.replace({}));
    builder.add(pos, pos + 2, Decoration.replace({}));
  }
  // Check for *|* (italic) - but not **|**
  else if (before1 === "*" && after1 === "*" && before2 !== "**" && !after2.startsWith("**")) {
    builder.add(pos - 1, pos, Decoration.replace({}));
    builder.add(pos, pos + 1, Decoration.replace({}));
  }
  // Check for `|` (code)
  else if (before1 === "`" && after1 === "`") {
    builder.add(pos - 1, pos, Decoration.replace({}));
    builder.add(pos, pos + 1, Decoration.replace({}));
  }
  // Check for ==|== (highlight)
  else if (before2 === "==" && after2 === "==") {
    builder.add(pos - 2, pos, Decoration.replace({}));
    builder.add(pos, pos + 2, Decoration.replace({}));
  }
  // NOTE: Strikethrough (~~|~~) is intentionally NOT hidden.
  // When both sides of cursor are Decoration.replace(), CodeMirror
  // gets confused about text insertion position.

  return builder.finish();
}

// ===========================================
// STATE FIELD AND UPDATE LISTENER
// ===========================================

export const pendingFormattingField = StateField.define({
  create: (state) => buildPendingFormattingDecorations(state),
  update: (decorations, tr) => {
    if (!tr.docChanged && !tr.selection) return decorations;
    return buildPendingFormattingDecorations(tr.state);
  },
  provide: (field) => EditorView.decorations.from(field),
});

const PENDING_CLASSES = [
  "cm-pending-bold",
  "cm-pending-italic",
  "cm-pending-code",
  "cm-pending-strikethrough",
  "cm-pending-highlight",
];

export const pendingFormatTheme = EditorView.updateListener.of((update) => {
  if (!update.docChanged && !update.selectionSet) return;
  const format = getPendingFormat(update.state);
  const editorEl = update.view.dom;

  // Remove all pending format classes
  editorEl.classList.remove(...PENDING_CLASSES);

  // Add current pending format class
  if (format) {
    editorEl.classList.add(`cm-pending-${format}`);
  }
});
