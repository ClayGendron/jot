/**
 * Blockquote Bar Widget
 *
 * Widget that renders a blockquote bar indicator.
 */

import { WidgetType } from "@codemirror/view";

/**
 * Widget that renders a blockquote bar indicator
 * The bar appears on the left side to indicate a blockquote
 */
export class BlockquoteBarWidget extends WidgetType {
  constructor(readonly level: number = 1) {
    super();
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-blockquote-bar";
    // Create nested bars for nested blockquotes
    for (let i = 0; i < this.level; i++) {
      const bar = document.createElement("span");
      bar.className = "cm-blockquote-bar-segment";
      bar.style.display = "inline-block";
      bar.style.width = "3px";
      bar.style.height = "1.2em";
      bar.style.backgroundColor = "#6b7280";
      bar.style.marginRight = i < this.level - 1 ? "8px" : "12px";
      bar.style.verticalAlign = "text-bottom";
      bar.style.borderRadius = "1px";
      span.appendChild(bar);
    }
    return span;
  }

  eq(other: BlockquoteBarWidget) {
    return other.level === this.level;
  }
}
