/**
 * Horizontal Rule Widget
 *
 * Widget that renders a horizontal rule (---, ***, ___).
 */

import { WidgetType } from "@codemirror/view";

/**
 * Widget that renders a horizontal rule (---, ***, ___)
 * Replaces the raw syntax with a visual hr element
 */
export class HorizontalRuleWidget extends WidgetType {
  toDOM() {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-horizontal-rule";

    const line = document.createElement("hr");
    line.className = "cm-horizontal-rule-line";

    wrapper.appendChild(line);
    return wrapper;
  }

  eq(_other: HorizontalRuleWidget) {
    return true; // All HRs are identical
  }
}
