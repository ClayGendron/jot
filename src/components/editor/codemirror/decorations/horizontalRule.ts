/**
 * Horizontal Rule Decorations for CodeMirror 6
 *
 * Phase 9: Replaces markdown horizontal rules (---, ***, ___) with
 * styled <hr> widget decorations for WYSIWYG display.
 */

import { StateField, RangeSetBuilder, type EditorState } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

/**
 * Data extracted from a horizontal rule
 */
export interface HorizontalRuleData {
  /** Start position in document */
  from: number;
  /** End position in document */
  to: number;
  /** The raw marker text (e.g., "---", "***", "___") */
  marker: string;
  /** Line number (1-indexed) */
  lineNumber: number;
}

/**
 * Widget that renders a horizontal rule
 */
class HorizontalRuleWidget extends WidgetType {
  constructor() {
    super();
  }

  eq(_other: HorizontalRuleWidget): boolean {
    return true; // All HR widgets are equivalent
  }

  toDOM(): HTMLElement {
    const hr = document.createElement("hr");
    hr.className = "cm-horizontal-rule";
    return hr;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Extract horizontal rule data from the editor state
 *
 * @param state - The editor state to extract from
 * @returns Array of HorizontalRuleData objects
 */
export function extractHorizontalRuleData(state: EditorState): HorizontalRuleData[] {
  const rules: HorizontalRuleData[] = [];

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === "HorizontalRule") {
        const marker = state.doc.sliceString(node.from, node.to);
        const line = state.doc.lineAt(node.from);

        rules.push({
          from: node.from,
          to: node.to,
          marker,
          lineNumber: line.number,
        });
      }
    },
  });

  return rules;
}

/**
 * Build decorations for horizontal rules
 *
 * Replaces the markdown syntax (---, ***, ___) with a styled <hr> widget.
 */
function buildHorizontalRuleDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  const rules = extractHorizontalRuleData(state);

  for (const rule of rules) {
    // Replace the entire horizontal rule line with a widget
    const widget = Decoration.replace({
      widget: new HorizontalRuleWidget(),
      inclusive: false,
      block: true,
    });

    builder.add(rule.from, rule.to, widget);
  }

  return builder.finish();
}

/**
 * StateField that tracks horizontal rule decorations
 */
export const horizontalRuleField = StateField.define<DecorationSet>({
  create: (state) => buildHorizontalRuleDecorations(state),

  update: (value, tr) => {
    if (tr.docChanged) {
      return buildHorizontalRuleDecorations(tr.state);
    }
    return value;
  },

  provide: (field) => [
    EditorView.decorations.from(field),
    // Make horizontal rules atomic (cursor skips over them)
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
});
