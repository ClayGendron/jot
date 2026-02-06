/**
 * Bullet Widget
 *
 * Widget that renders a bullet point for unordered lists.
 */

import { WidgetType } from "@codemirror/view";

/**
 * Widget that renders a bullet point for unordered lists
 * Note: Indentation comes from preserved whitespace before the marker,
 * so we don't need to add margin-left here.
 */
export class BulletWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-list-bullet";
    span.textContent = "\u2022"; // bullet character
    span.style.marginRight = "6px";
    span.style.color = "#666";
    return span;
  }

  eq(_other: BulletWidget) {
    return true; // All bullets are the same
  }
}
