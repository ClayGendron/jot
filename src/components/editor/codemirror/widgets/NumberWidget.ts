/**
 * Number Widget
 *
 * Widget that renders a number for ordered lists.
 */

import { WidgetType } from "@codemirror/view";

/**
 * Widget that renders a number for ordered lists
 * Note: Indentation comes from preserved whitespace before the marker.
 */
export class NumberWidget extends WidgetType {
  constructor(readonly num: number) {
    super();
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-list-number";
    span.textContent = `${this.num}.`;
    span.style.marginRight = "6px";
    span.style.color = "#666";
    return span;
  }

  eq(other: NumberWidget) {
    return other.num === this.num;
  }
}
