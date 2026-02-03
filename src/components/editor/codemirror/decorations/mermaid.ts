/**
 * Mermaid Diagram Decorations for CodeMirror 6
 *
 * Phase 5: Mermaid blocks that show raw code when focused, rendered diagram otherwise.
 *
 * Key behaviors:
 * - Replaces entire mermaid fenced block with a MermaidWidget
 * - Renders SVG diagram using existing mermaid loader
 * - Shows loading state during render
 * - Shows error state for invalid syntax
 * - Export buttons for SVG/PNG
 * - Copy button for source code
 */

import { StateField, RangeSetBuilder, type EditorState } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { renderMermaid } from "@/lib/mermaid/loader";
import { exportAsSvg, exportAsPng, downloadBlob, generateExportFilename } from "@/lib/mermaid/exporter";

/** Duration to show "Copied!" state before resetting */
const COPY_SUCCESS_DURATION_MS = 2000;

/** Inject CSS keyframes for spinner animation (once) */
let keyframesInjected = false;
function injectKeyframes(): void {
  if (keyframesInjected) return;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes cm-spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
  keyframesInjected = true;
}

/**
 * Mermaid block data for analysis
 */
export interface MermaidData {
  /** Start position of the entire fenced code block */
  from: number;
  /** End position of the entire fenced code block */
  to: number;
  /** Mermaid source code (without fence markers) */
  source: string;
}

/**
 * Widget that renders a mermaid diagram
 */
class MermaidWidget extends WidgetType {
  private copied = false;
  private copyTimeout: ReturnType<typeof setTimeout> | null = null;
  private renderedSvg: string | null = null;
  private renderError: string | null = null;
  private isRendering = false;

  constructor(readonly source: string) {
    super();
  }

  toDOM(view: EditorView): HTMLElement {
    // Inject keyframes for spinner animation
    injectKeyframes();

    const wrapper = document.createElement("div");
    wrapper.className = "cm-mermaid-widget";

    // Header with badge and actions
    const header = document.createElement("div");
    header.className = "cm-mermaid-header";

    // Mermaid badge
    const badge = document.createElement("span");
    badge.className = "cm-mermaid-badge";
    badge.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>mermaid`;
    header.appendChild(badge);

    // Spacer
    const spacer = document.createElement("div");
    spacer.style.flex = "1";
    header.appendChild(spacer);

    // Action buttons container
    const actions = document.createElement("div");
    actions.className = "cm-mermaid-actions";

    // Copy button
    const copyBtn = this.createCopyButton();
    actions.appendChild(copyBtn);

    // Export dropdown
    const exportBtn = this.createExportButton();
    actions.appendChild(exportBtn);

    header.appendChild(actions);
    wrapper.appendChild(header);

    // Diagram container (or loading/error state)
    const diagramArea = document.createElement("div");
    diagramArea.className = "cm-mermaid-diagram";
    wrapper.appendChild(diagramArea);

    // Start rendering
    this.renderDiagram(diagramArea, view);

    return wrapper;
  }

  private createCopyButton(): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cm-mermaid-copy-button";
    btn.setAttribute("aria-label", "Copy source");

    const icon = this.createCopyIcon();
    const text = document.createElement("span");
    text.textContent = "Copy";

    btn.appendChild(icon);
    btn.appendChild(text);

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleCopy(btn, icon, text);
    });

    return btn;
  }

  private createExportButton(): HTMLDivElement {
    const container = document.createElement("div");
    container.className = "cm-mermaid-export-dropdown";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cm-mermaid-export-button";
    btn.setAttribute("aria-label", "Export diagram");

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("width", "14");
    icon.setAttribute("height", "14");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "2");
    icon.innerHTML = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>';

    const text = document.createElement("span");
    text.textContent = "Export";

    btn.appendChild(icon);
    btn.appendChild(text);

    // Dropdown menu
    const menu = document.createElement("div");
    menu.className = "cm-mermaid-export-menu";
    menu.style.display = "none";

    const svgOption = document.createElement("button");
    svgOption.type = "button";
    svgOption.textContent = "Export as SVG";
    svgOption.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleExport("svg");
      menu.style.display = "none";
    });

    const pngOption = document.createElement("button");
    pngOption.type = "button";
    pngOption.textContent = "Export as PNG";
    pngOption.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleExport("png");
      menu.style.display = "none";
    });

    menu.appendChild(svgOption);
    menu.appendChild(pngOption);

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      menu.style.display = menu.style.display === "none" ? "flex" : "none";
    });

    // Close menu when clicking outside
    document.addEventListener("click", () => {
      menu.style.display = "none";
    });

    container.appendChild(btn);
    container.appendChild(menu);

    return container;
  }

  private createCopyIcon(): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.classList.add("cm-mermaid-copy-icon");

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "9");
    rect.setAttribute("y", "9");
    rect.setAttribute("width", "13");
    rect.setAttribute("height", "13");
    rect.setAttribute("rx", "2");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1");

    svg.appendChild(rect);
    svg.appendChild(path);

    return svg;
  }

  private createCheckIcon(): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.classList.add("cm-mermaid-check-icon");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    path.setAttribute("points", "20 6 9 17 4 12");

    svg.appendChild(path);

    return svg;
  }

  private async handleCopy(
    btn: HTMLButtonElement,
    icon: SVGSVGElement,
    text: HTMLSpanElement
  ): Promise<void> {
    if (this.copied) return;

    try {
      await navigator.clipboard.writeText(this.source);
      this.copied = true;

      btn.classList.add("cm-mermaid-copied");
      const checkIcon = this.createCheckIcon();
      btn.replaceChild(checkIcon, icon);
      text.textContent = "Copied";

      if (this.copyTimeout) clearTimeout(this.copyTimeout);
      this.copyTimeout = setTimeout(() => {
        this.copied = false;
        btn.classList.remove("cm-mermaid-copied");
        const newCopyIcon = this.createCopyIcon();
        btn.replaceChild(newCopyIcon, checkIcon);
        text.textContent = "Copy";
      }, COPY_SUCCESS_DURATION_MS);
    } catch (err) {
      console.error("Failed to copy mermaid source:", err);
    }
  }

  private async handleExport(format: "svg" | "png"): Promise<void> {
    if (!this.renderedSvg) return;

    try {
      const filename = generateExportFilename(this.source, format);

      if (format === "svg") {
        const blob = exportAsSvg(this.renderedSvg);
        downloadBlob(blob, filename);
      } else {
        const blob = await exportAsPng(this.renderedSvg);
        downloadBlob(blob, filename);
      }
    } catch (err) {
      console.error("Failed to export diagram:", err);
    }
  }

  private async renderDiagram(container: HTMLElement, _view: EditorView): Promise<void> {
    if (this.isRendering) return;
    this.isRendering = true;

    // Show loading state
    container.innerHTML = "";
    container.className = "cm-mermaid-diagram cm-mermaid-loading";

    const loadingEl = document.createElement("div");
    loadingEl.className = "cm-mermaid-loading-content";
    loadingEl.innerHTML = `
      <div class="cm-mermaid-spinner"></div>
      <span>Rendering diagram...</span>
    `;
    container.appendChild(loadingEl);

    try {
      // Detect theme from CSS variables or system preference
      const theme = this.detectTheme();
      const svg = await renderMermaid(this.source, theme);
      this.renderedSvg = svg;
      this.renderError = null;

      // Show rendered diagram
      container.innerHTML = "";
      container.className = "cm-mermaid-diagram cm-mermaid-rendered";
      container.innerHTML = svg;

      // Make SVG responsive
      const svgEl = container.querySelector("svg");
      if (svgEl) {
        svgEl.style.maxWidth = "100%";
        svgEl.style.height = "auto";
      }
    } catch (err) {
      this.renderError = err instanceof Error ? err.message : "Failed to render diagram";
      this.renderedSvg = null;

      // Show error state
      container.innerHTML = "";
      container.className = "cm-mermaid-diagram cm-mermaid-error";

      const errorEl = document.createElement("div");
      errorEl.className = "cm-mermaid-error-content";
      errorEl.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div class="cm-mermaid-error-text">
          <strong>Syntax Error</strong>
          <span>${this.escapeHtml(this.renderError)}</span>
        </div>
      `;
      container.appendChild(errorEl);
    } finally {
      this.isRendering = false;
    }
  }

  private detectTheme(): "light" | "dark" {
    // Try to detect from document or system
    const isDark = document.documentElement.classList.contains("dark") ||
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    return isDark ? "dark" : "light";
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  eq(other: MermaidWidget): boolean {
    return other.source === this.source;
  }

  destroy(): void {
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
    }
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Extract mermaid block data from an editor state
 */
export function extractMermaidData(state: EditorState): MermaidData[] {
  const blocks: MermaidData[] = [];
  const tree = syntaxTree(state);

  tree.iterate({
    enter(node) {
      if (node.name === "FencedCode") {
        const fullText = state.doc.sliceString(node.from, node.to);
        const lines = fullText.split("\n");
        const firstLine = lines[0];

        // Check if this is a mermaid block
        const openMatch = firstLine.match(/^`{3,}(\S*)/);
        const language = openMatch ? openMatch[1].toLowerCase() : "";

        if (language === "mermaid") {
          // Extract source (everything between first and last lines)
          let source = "";
          if (lines.length > 2) {
            source = lines.slice(1, -1).join("\n");
          } else if (lines.length === 2 && !lines[1].startsWith("```")) {
            source = lines[1];
          }

          blocks.push({
            from: node.from,
            to: node.to,
            source,
          });
        }
      }
    },
  });

  return blocks;
}

/**
 * Build decorations for all mermaid blocks in the document
 */
function buildMermaidDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const blocks = extractMermaidData(state);

  for (const block of blocks) {
    const widget = Decoration.replace({
      widget: new MermaidWidget(block.source),
      block: true,
      inclusive: false,
    });

    builder.add(block.from, block.to, widget);
  }

  return builder.finish();
}

/**
 * StateField that tracks mermaid decorations
 */
export const mermaidField = StateField.define<DecorationSet>({
  create: (state) => buildMermaidDecorations(state),

  update: (value, tr) => {
    if (tr.docChanged) {
      return buildMermaidDecorations(tr.state);
    }
    return value;
  },

  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
});
