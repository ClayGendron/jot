/**
 * Code Block Widgets
 *
 * Widgets that render code block opening and closing fences.
 */

import { WidgetType } from "@codemirror/view";

/**
 * Widget that renders the opening fence of a code block (```language)
 * Shows a language badge, the content remains editable inline
 */
export class CodeBlockOpenWidget extends WidgetType {
  constructor(readonly language: string) {
    super();
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-code-block-open";

    const badge = document.createElement("span");
    badge.className = "cm-code-block-lang-badge";
    badge.textContent = this.language || "code";
    span.appendChild(badge);

    return span;
  }

  eq(other: CodeBlockOpenWidget) {
    return other.language === this.language;
  }
}

/**
 * Widget that renders the closing fence of a code block (```)
 * Shows a subtle end indicator
 */
export class CodeBlockCloseWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-code-block-close";
    // Empty - just provides visual spacing/boundary
    return span;
  }

  eq(_other: CodeBlockCloseWidget) {
    return true;
  }
}
