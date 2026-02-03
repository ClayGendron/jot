/**
 * List Decorations for CodeMirror 6
 *
 * Phase 3: Hide list markers and replace with styled bullets/numbers/checkboxes.
 *
 * Key behaviors:
 * - Hides -, *, + markers and shows styled bullet
 * - Hides 1., 2., etc. markers and shows styled numbers
 * - Handles task list checkboxes [ ] and [x]
 * - Tracks nesting level for indentation
 */

import { StateField, RangeSetBuilder, type EditorState } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

/**
 * List item data for analysis
 */
export interface ListItemData {
  /** Type of list item */
  type: "bullet" | "ordered" | "task";
  /** The marker character (-, *, +) or number string */
  marker: string;
  /** For ordered lists, the number */
  number?: number;
  /** For task lists, whether checked */
  checked?: boolean;
  /** Nesting/indentation level (0 = top level) */
  indent: number;
  /** Text content of the item (without marker) */
  text: string;
  /** Start position of the list item line */
  from: number;
  /** End position of the list item line */
  to: number;
  /** Start position of the marker */
  markerFrom: number;
  /** End position of the marker (including trailing space) */
  markerTo: number;
}

/**
 * Widget for rendering a bullet point
 */
class BulletWidget extends WidgetType {
  constructor(readonly indent: number) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-list-bullet";
    span.textContent = "•";
    span.setAttribute("aria-hidden", "true");
    return span;
  }

  eq(other: BulletWidget): boolean {
    return other.indent === this.indent;
  }
}

/**
 * Widget for rendering an ordered list number
 */
class OrderedWidget extends WidgetType {
  constructor(
    readonly number: number,
    readonly indent: number
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-list-number";
    span.textContent = `${this.number}.`;
    span.setAttribute("aria-hidden", "true");
    return span;
  }

  eq(other: OrderedWidget): boolean {
    return other.number === this.number && other.indent === this.indent;
  }
}

/**
 * Widget for rendering a task checkbox
 */
class TaskWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly indent: number
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = `cm-task-checkbox ${this.checked ? "cm-task-checked" : "cm-task-unchecked"}`;
    span.textContent = this.checked ? "☑" : "☐";
    span.setAttribute("aria-checked", String(this.checked));
    span.setAttribute("role", "checkbox");
    return span;
  }

  eq(other: TaskWidget): boolean {
    return other.checked === this.checked && other.indent === this.indent;
  }
}

/**
 * Calculate indentation level from position
 */
function getIndentLevel(state: EditorState, pos: number): number {
  const line = state.doc.lineAt(pos);
  const lineText = state.doc.sliceString(line.from, pos);
  const leadingSpaces = lineText.match(/^(\s*)/)?.[1].length || 0;
  // Each indent level is typically 2 spaces
  return Math.floor(leadingSpaces / 2);
}

/**
 * Check if a list item is a task list item and extract checkbox state
 */
function parseTaskItem(
  state: EditorState,
  listItemFrom: number,
  listItemTo: number
): { isTask: boolean; checked: boolean; checkboxEnd: number } {
  const text = state.doc.sliceString(listItemFrom, Math.min(listItemFrom + 20, listItemTo));

  // Match task checkbox patterns: [ ], [x], [X]
  const taskMatch = text.match(/^(\s*[-*+]\s+)\[([ xX])\]/);
  if (taskMatch) {
    return {
      isTask: true,
      checked: taskMatch[2].toLowerCase() === "x",
      checkboxEnd: listItemFrom + taskMatch[0].length,
    };
  }

  return { isTask: false, checked: false, checkboxEnd: 0 };
}

/**
 * Build decorations for all lists in the document
 */
function buildListDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const tree = syntaxTree(state);

  tree.iterate({
    enter(node) {
      // Handle BulletList markers
      if (node.name === "ListMark") {
        const parent = node.node.parent;
        if (!parent) return;

        const markerText = state.doc.sliceString(node.from, node.to);
        const indent = getIndentLevel(state, node.from);

        // Check if it's a task item
        const lineEnd = state.doc.lineAt(node.from).to;
        const taskInfo = parseTaskItem(state, node.from - indent * 2, lineEnd);

        // Determine what to render
        if (taskInfo.isTask) {
          // Task list item - hide marker and checkbox, show widget
          const widget = Decoration.replace({
            widget: new TaskWidget(taskInfo.checked, indent),
            inclusive: false,
          });
          // Find the end of "- [ ] " or similar
          const afterMarker = node.to;
          const afterSpace = state.doc.sliceString(afterMarker, Math.min(afterMarker + 10, lineEnd));
          const spaceMatch = afterSpace.match(/^(\s*\[[xX ]\]\s*)/);
          if (spaceMatch) {
            builder.add(node.from, afterMarker + spaceMatch[0].length, widget);
          } else {
            builder.add(node.from, afterMarker + 1, widget);
          }
        } else if (markerText.match(/^[-*+]$/)) {
          // Bullet list item
          const widget = Decoration.replace({
            widget: new BulletWidget(indent),
            inclusive: false,
          });
          // Hide marker and trailing space
          const afterMarker = node.to;
          const afterSpace = state.doc.sliceString(afterMarker, Math.min(afterMarker + 2, lineEnd));
          const spaceLen = afterSpace.match(/^\s/)?.[0].length || 0;
          builder.add(node.from, afterMarker + spaceLen, widget);
        } else if (markerText.match(/^\d+\.$/)) {
          // Ordered list item
          const number = parseInt(markerText, 10);
          const widget = Decoration.replace({
            widget: new OrderedWidget(number, indent),
            inclusive: false,
          });
          // Hide marker and trailing space
          const afterMarker = node.to;
          const afterSpace = state.doc.sliceString(afterMarker, Math.min(afterMarker + 2, lineEnd));
          const spaceLen = afterSpace.match(/^\s/)?.[0].length || 0;
          builder.add(node.from, afterMarker + spaceLen, widget);
        }
      }
    },
  });

  return builder.finish();
}

/**
 * StateField that tracks list decorations
 */
export const listField = StateField.define<DecorationSet>({
  create: (state) => buildListDecorations(state),

  update: (value, tr) => {
    if (tr.docChanged) {
      return buildListDecorations(tr.state);
    }
    return value;
  },

  provide: (field) => [
    // Apply decorations only - hiddenSyntax.ts handles atomic ranges for list markers
    EditorView.decorations.from(field),
  ],
});

/**
 * Extract list item data from the document
 *
 * @param state - The editor state
 * @returns Array of list item data
 */
export function extractListData(state: EditorState): ListItemData[] {
  const items: ListItemData[] = [];
  const tree = syntaxTree(state);

  tree.iterate({
    enter(node) {
      if (node.name === "ListMark") {
        const markerText = state.doc.sliceString(node.from, node.to);
        const indent = getIndentLevel(state, node.from);
        const line = state.doc.lineAt(node.from);

        // Get the full line text after the marker
        const afterMarker = state.doc.sliceString(node.to, line.to).trimStart();

        // Check for task item
        const taskInfo = parseTaskItem(state, line.from, line.to);

        if (taskInfo.isTask) {
          // Task list item
          const textAfterCheckbox = state.doc.sliceString(taskInfo.checkboxEnd, line.to).trim();
          items.push({
            type: "task",
            marker: markerText.trim(),
            checked: taskInfo.checked,
            indent,
            text: textAfterCheckbox,
            from: line.from,
            to: line.to,
            markerFrom: node.from,
            markerTo: taskInfo.checkboxEnd,
          });
        } else if (markerText.match(/^[-*+]$/)) {
          // Bullet list
          items.push({
            type: "bullet",
            marker: markerText.trim(),
            indent,
            text: afterMarker,
            from: line.from,
            to: line.to,
            markerFrom: node.from,
            markerTo: node.to + 1, // +1 for space
          });
        } else if (markerText.match(/^\d+\.$/)) {
          // Ordered list
          const number = parseInt(markerText, 10);
          items.push({
            type: "ordered",
            marker: markerText,
            number,
            indent,
            text: afterMarker,
            from: line.from,
            to: line.to,
            markerFrom: node.from,
            markerTo: node.to + 1, // +1 for space
          });
        }
      }
    },
  });

  return items;
}
