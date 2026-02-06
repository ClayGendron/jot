/**
 * Checkbox Widget
 *
 * Widget that renders an interactive checkbox for task list items.
 */

import { WidgetType, type EditorView } from "@codemirror/view";
import { toggleTaskCheckbox } from "../handlers/listHandlers";

/**
 * Widget that renders an interactive checkbox for task list items
 * Handles click events to toggle between [ ] and [x]
 */
export class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly pos: number
  ) {
    super();
  }

  toDOM(view: EditorView) {
    const span = document.createElement("span");
    span.className = "cm-task-checkbox";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = this.checked;
    checkbox.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleTaskCheckbox(view, this.pos, this.checked);
    });

    span.appendChild(checkbox);
    return span;
  }

  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.pos === this.pos;
  }

  ignoreEvent() {
    return true;
  }
}
