/**
 * Code Block Decorations for CodeMirror 6
 *
 * Phase 5: Fenced code blocks with syntax highlighting, language badge, and copy button.
 *
 * Key behaviors:
 * - Replaces entire fenced code block with a CodeBlockWidget
 * - Syntax highlighting via Shiki (VS Code quality)
 * - Language badge in header
 * - Copy button with success feedback
 * - Mermaid blocks are excluded (handled by mermaid.ts)
 */

import { StateField, RangeSetBuilder, type EditorState } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { createHighlighter, type Highlighter, type BundledLanguage } from "shiki";

/** Duration to show "Copied!" state before resetting */
const COPY_SUCCESS_DURATION_MS = 2000;

/** Cached Shiki highlighter instance */
let highlighterPromise: Promise<Highlighter> | null = null;

/** Common languages to preload for fast highlighting */
const PRELOAD_LANGUAGES: BundledLanguage[] = [
  "javascript",
  "typescript",
  "jsx",
  "tsx",
  "json",
  "html",
  "css",
  "markdown",
  "python",
  "rust",
  "go",
  "shell",
  "bash",
  "sql",
];

/**
 * Get or create the Shiki highlighter instance
 * Lazy-loaded and cached for performance
 */
async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: PRELOAD_LANGUAGES,
    });
  }
  return highlighterPromise;
}

/**
 * Highlight code using Shiki
 * Returns HTML string with syntax highlighting
 */
async function highlightCode(code: string, language: string): Promise<string> {
  const highlighter = await getHighlighter();

  // Normalize language identifier
  const lang = normalizeLanguage(language);

  // Check if language is loaded, if not load it dynamically
  const loadedLangs = highlighter.getLoadedLanguages();
  if (lang && !loadedLangs.includes(lang as BundledLanguage)) {
    try {
      await highlighter.loadLanguage(lang as BundledLanguage);
    } catch {
      // Language not supported, will fall back to plaintext
    }
  }

  // Detect current theme
  const isDark = document.documentElement.classList.contains("dark") ||
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const theme = isDark ? "github-dark" : "github-light";

  try {
    return highlighter.codeToHtml(code, {
      lang: lang || "text",
      theme,
    });
  } catch {
    // Fallback to plain text if highlighting fails
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }
}

/**
 * Normalize common language aliases to Shiki language identifiers
 */
function normalizeLanguage(lang: string): string {
  const aliases: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    py: "python",
    rb: "ruby",
    rs: "rust",
    sh: "bash",
    zsh: "bash",
    yml: "yaml",
    md: "markdown",
    "c++": "cpp",
    "c#": "csharp",
    dockerfile: "docker",
  };

  const normalized = lang.toLowerCase();
  return aliases[normalized] || normalized;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Code block data for analysis
 */
export interface CodeBlockData {
  /** Start position of the entire fenced code block */
  from: number;
  /** End position of the entire fenced code block */
  to: number;
  /** Language identifier (e.g., "js", "python") */
  language: string;
  /** Code content (without fence markers) */
  code: string;
  /** Whether this is a mermaid block */
  isMermaid: boolean;
}

/**
 * Widget that renders a syntax-highlighted code block
 */
class CodeBlockWidget extends WidgetType {
  private copied = false;
  private copyTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    readonly language: string,
    readonly code: string
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-code-block-widget";

    // Header with language badge and copy button
    const header = document.createElement("div");
    header.className = "cm-code-block-header";

    // Language badge
    if (this.language && this.language !== "plaintext" && this.language !== "text") {
      const badge = document.createElement("span");
      badge.className = "cm-code-language-badge";
      badge.textContent = this.language;
      header.appendChild(badge);
    }

    // Spacer to push copy button to the right
    const spacer = document.createElement("div");
    spacer.style.flex = "1";
    header.appendChild(spacer);

    // Copy button
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "cm-code-copy-button";
    copyBtn.setAttribute("aria-label", "Copy code");

    const copyIcon = this.createCopyIcon();
    const copyText = document.createElement("span");
    copyText.className = "cm-code-copy-text";
    copyText.textContent = "Copy";

    copyBtn.appendChild(copyIcon);
    copyBtn.appendChild(copyText);

    copyBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleCopy(copyBtn, copyIcon, copyText);
    });

    header.appendChild(copyBtn);
    wrapper.appendChild(header);

    // Code content container
    const codeContainer = document.createElement("div");
    codeContainer.className = "cm-code-block-content cm-code-loading";

    // Show loading placeholder
    codeContainer.innerHTML = `<pre class="cm-code-block-pre"><code class="cm-code-content">${escapeHtml(this.code)}</code></pre>`;

    wrapper.appendChild(codeContainer);

    // Apply syntax highlighting asynchronously
    this.applyHighlighting(codeContainer);

    return wrapper;
  }

  private async applyHighlighting(container: HTMLElement): Promise<void> {
    try {
      const html = await highlightCode(this.code, this.language);
      container.innerHTML = html;
      container.classList.remove("cm-code-loading");
      container.classList.add("cm-code-highlighted");

      // Ensure the generated pre/code elements have our classes
      const pre = container.querySelector("pre");
      const code = container.querySelector("code");
      if (pre) pre.classList.add("cm-code-block-pre");
      if (code) code.classList.add("cm-code-content");
    } catch (err) {
      console.error("Failed to highlight code:", err);
      container.classList.remove("cm-code-loading");
    }
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
    svg.classList.add("cm-code-copy-icon");

    const rect1 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect1.setAttribute("x", "9");
    rect1.setAttribute("y", "9");
    rect1.setAttribute("width", "13");
    rect1.setAttribute("height", "13");
    rect1.setAttribute("rx", "2");
    rect1.setAttribute("ry", "2");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1");

    svg.appendChild(rect1);
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
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.classList.add("cm-code-check-icon");

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
      await navigator.clipboard.writeText(this.code);
      this.copied = true;

      btn.classList.add("cm-code-copied");
      const checkIcon = this.createCheckIcon();
      btn.replaceChild(checkIcon, icon);
      text.textContent = "Copied";

      if (this.copyTimeout) {
        clearTimeout(this.copyTimeout);
      }
      this.copyTimeout = setTimeout(() => {
        this.copied = false;
        btn.classList.remove("cm-code-copied");
        const newCopyIcon = this.createCopyIcon();
        btn.replaceChild(newCopyIcon, checkIcon);
        text.textContent = "Copy";
      }, COPY_SUCCESS_DURATION_MS);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  }

  eq(other: CodeBlockWidget): boolean {
    return other.language === this.language && other.code === this.code;
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
 * Extract code block data from an editor state
 * Uses Lezer syntax tree to find FencedCode nodes
 */
export function extractCodeBlockData(state: EditorState): CodeBlockData[] {
  const blocks: CodeBlockData[] = [];
  const tree = syntaxTree(state);

  tree.iterate({
    enter(node) {
      if (node.name === "FencedCode") {
        const fullText = state.doc.sliceString(node.from, node.to);
        const lines = fullText.split("\n");
        const firstLine = lines[0];
        const lastLine = lines[lines.length - 1];

        const openMatch = firstLine.match(/^`{3,}(\S*)/);
        const language = openMatch ? openMatch[1] : "";

        let code = "";
        if (lines.length > 2) {
          code = lines.slice(1, -1).join("\n");
        } else if (lines.length === 2 && !lastLine.startsWith("```")) {
          code = lines[1];
        }

        blocks.push({
          from: node.from,
          to: node.to,
          language,
          code,
          isMermaid: language.toLowerCase() === "mermaid",
        });
      }
    },
  });

  return blocks;
}

/**
 * Build decorations for all code blocks in the document
 * Excludes mermaid blocks (handled separately)
 */
function buildCodeBlockDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const blocks = extractCodeBlockData(state);

  for (const block of blocks) {
    if (block.isMermaid) {
      continue;
    }

    const widget = Decoration.replace({
      widget: new CodeBlockWidget(block.language, block.code),
      block: true,
      inclusive: false,
    });

    builder.add(block.from, block.to, widget);
  }

  return builder.finish();
}

/**
 * StateField that tracks code block decorations
 */
export const codeBlockField = StateField.define<DecorationSet>({
  create: (state) => buildCodeBlockDecorations(state),

  update: (value, tr) => {
    if (tr.docChanged) {
      return buildCodeBlockDecorations(tr.state);
    }
    return value;
  },

  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
});

/**
 * Preload the Shiki highlighter for faster first render
 * Call this during app initialization if desired
 */
export async function preloadHighlighter(): Promise<void> {
  await getHighlighter();
}
