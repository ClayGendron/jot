/**
 * Image Decorations for CodeMirror 6
 *
 * Phase 4: Hide ![alt](src) syntax and show rendered images.
 *
 * Key behaviors:
 * - Replaces entire image syntax with an ImageWidget
 * - Renders <img> element with proper sizing
 * - Shows alt text as fallback/caption on error
 * - Handles both local and remote URLs
 * - Creates atomic range for entire image syntax
 */

import { StateField, RangeSetBuilder, type EditorState } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

/**
 * Image data for analysis
 */
export interface ImageData {
  /** Start position of the entire image syntax */
  from: number;
  /** End position of the entire image syntax */
  to: number;
  /** Alt text for the image */
  alt: string;
  /** Image source URL */
  src: string;
  /** Optional title attribute */
  title?: string;
}

/**
 * Widget that renders an image
 */
class ImageWidget extends WidgetType {
  constructor(
    readonly alt: string,
    readonly src: string,
    readonly title?: string
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const container = document.createElement("span");
    container.className = "cm-image-widget";

    const img = document.createElement("img");
    img.className = "cm-image";
    img.src = this.src;
    img.alt = this.alt;
    if (this.title) {
      img.title = this.title;
    }

    // Handle loading errors - show alt text as fallback
    img.onerror = () => {
      container.classList.add("cm-image-error");
      const fallback = document.createElement("span");
      fallback.className = "cm-image-fallback";
      fallback.textContent = this.alt || `[Image: ${this.src}]`;
      container.replaceChild(fallback, img);
    };

    // Handle successful load - ensure reasonable sizing
    img.onload = () => {
      container.classList.add("cm-image-loaded");
    };

    container.appendChild(img);
    return container;
  }

  eq(other: ImageWidget): boolean {
    return other.alt === this.alt && other.src === this.src && other.title === this.title;
  }

  // Prevent selection within the widget
  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Check if a position is inside a code block or inline code
 */
function isInsideCode(state: EditorState, from: number, to: number): boolean {
  const tree = syntaxTree(state);

  const codeNodes = new Set([
    "CodeBlock",
    "FencedCode",
    "InlineCode",
    "CodeText",
    "CodeMark",
  ]);

  let node = tree.resolveInner(from, 1);
  while (node) {
    if (codeNodes.has(node.name)) {
      return true;
    }
    node = node.parent!;
  }

  node = tree.resolveInner(to, -1);
  while (node) {
    if (codeNodes.has(node.name)) {
      return true;
    }
    node = node.parent!;
  }

  return false;
}

/**
 * Extract image data from an editor state
 * Uses Lezer syntax tree to find Image nodes
 */
export function extractImageData(state: EditorState): ImageData[] {
  const images: ImageData[] = [];
  const tree = syntaxTree(state);

  tree.iterate({
    enter(node) {
      // Match Image nodes (markdown images ![alt](src))
      if (node.name === "Image") {
        // Skip if inside code
        if (isInsideCode(state, node.from, node.to)) {
          return;
        }

        // Parse the image syntax manually for reliability
        const fullText = state.doc.sliceString(node.from, node.to);

        // Match ![alt](src) or ![alt](src "title")
        const match = fullText.match(/^!\[([^\]]*)\]\(([^)"]*?)(?:\s+"([^"]*)")?\)$/);
        if (match) {
          images.push({
            from: node.from,
            to: node.to,
            alt: match[1],
            src: match[2],
            title: match[3],
          });
        }
      }
    },
  });

  return images;
}

/**
 * Build decorations for all images in the document
 */
function buildImageDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const images = extractImageData(state);

  for (const image of images) {
    // Replace entire image syntax with a widget
    const widget = Decoration.replace({
      widget: new ImageWidget(image.alt, image.src, image.title),
      inclusive: false,
      // block: true would make it a block widget, but images can be inline
    });

    builder.add(image.from, image.to, widget);
  }

  return builder.finish();
}

/**
 * StateField that tracks image decorations
 */
export const imageField = StateField.define<DecorationSet>({
  create: (state) => buildImageDecorations(state),

  update: (value, tr) => {
    if (tr.docChanged) {
      return buildImageDecorations(tr.state);
    }
    return value;
  },

  provide: (field) => [
    // Apply decorations
    EditorView.decorations.from(field),

    // Make image syntax atomic (cursor skips the widget)
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
});
