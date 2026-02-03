/**
 * Link Decorations for CodeMirror 6
 *
 * Phase 4: Hide [text](url) syntax and show styled clickable links.
 *
 * Key behaviors:
 * - Hides []() syntax markers via Decoration.replace()
 * - Shows link text with link styling via Decoration.mark()
 * - Link text is EDITABLE (like Microsoft Word)
 * - Distinguishes internal links (.md files) from external links
 * - Adds data-href and data-internal-link attributes for click detection
 * - URL can be edited via right-click context menu
 * - Preserves original markdown on edit (no normalization)
 */

import { StateField, RangeSetBuilder, type EditorState } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { isInternalLink } from "@/lib/links/resolver";

/**
 * Link data for analysis and navigation
 */
export interface LinkData {
  /** Start position of the entire link syntax */
  from: number;
  /** End position of the entire link syntax */
  to: number;
  /** Link text (what's displayed) */
  text: string;
  /** Link URL/href */
  url: string;
  /** Whether this is an internal link (.md file) */
  isInternal: boolean;
  /** Position ranges for hiding syntax */
  textFrom: number;
  textTo: number;
  urlFrom: number;
  urlTo: number;
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

  // Check start position
  let node = tree.resolveInner(from, 1);
  while (node) {
    if (codeNodes.has(node.name)) {
      return true;
    }
    node = node.parent!;
  }

  // Check end position
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
 * Extract link data from an editor state
 * Uses Lezer syntax tree to find Link nodes
 */
export function extractLinkData(state: EditorState): LinkData[] {
  const links: LinkData[] = [];
  const tree = syntaxTree(state);

  tree.iterate({
    enter(node) {
      // Match Link nodes (markdown links [text](url))
      if (node.name === "Link") {
        // Skip if inside code
        if (isInsideCode(state, node.from, node.to)) {
          return;
        }

        // Find child nodes within the Link
        let linkTextFrom = -1;
        let linkTextTo = -1;
        let urlFrom = -1;
        let urlTo = -1;

        const linkNode = node.node;
        const cursor = linkNode.cursor();

        // Enter the link node and look for children
        if (cursor.firstChild()) {
          do {
            // LinkMark is [ or ] or ( or )
            // LinkLabel is [text] or the text itself
            // URL is the url
            if (cursor.name === "LinkLabel") {
              // LinkLabel includes the brackets [text]
              linkTextFrom = cursor.from + 1; // After [
              linkTextTo = cursor.to - 1; // Before ]
            } else if (cursor.name === "URL") {
              urlFrom = cursor.from;
              urlTo = cursor.to;
            }
          } while (cursor.nextSibling());
        }

        // If we couldn't find proper structure, try to parse manually
        if (linkTextFrom === -1 || urlFrom === -1) {
          const fullText = state.doc.sliceString(node.from, node.to);
          const match = fullText.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
          if (match) {
            linkTextFrom = node.from + 1;
            linkTextTo = node.from + 1 + match[1].length;
            urlFrom = linkTextTo + 2; // Skip ](
            urlTo = node.to - 1; // Before )
          }
        }

        if (linkTextFrom !== -1 && urlFrom !== -1) {
          const text = state.doc.sliceString(linkTextFrom, linkTextTo);
          const url = state.doc.sliceString(urlFrom, urlTo);

          links.push({
            from: node.from,
            to: node.to,
            text,
            url,
            isInternal: isInternalLink(url),
            textFrom: linkTextFrom,
            textTo: linkTextTo,
            urlFrom,
            urlTo,
          });
        }
      }
    },
  });

  return links;
}

/**
 * Decoration to hide link syntax markers
 */
const hideSyntax = Decoration.replace({ inclusive: false });

/**
 * Build decorations for all links in the document
 *
 * Uses marks for display text (editable) and replace for syntax (hidden).
 * This allows Word-like behavior where you can click and edit the link text.
 */
function buildLinkDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const links = extractLinkData(state);

  for (const link of links) {
    // Hide opening bracket: [
    builder.add(link.from, link.textFrom, hideSyntax);

    // Mark the display text (editable, styled)
    const linkClass = link.isInternal ? "cm-link cm-internal-link" : "cm-link cm-external-link";
    const linkMark = Decoration.mark({
      class: linkClass,
      attributes: {
        "data-href": link.url,
        ...(link.isInternal ? { "data-internal-link": "true" } : {}),
      },
    });
    builder.add(link.textFrom, link.textTo, linkMark);

    // Hide closing bracket and URL: ](url)
    builder.add(link.textTo, link.to, hideSyntax);
  }

  return builder.finish();
}

/**
 * StateField that tracks link decorations
 */
export const linkField = StateField.define<DecorationSet>({
  create: (state) => buildLinkDecorations(state),

  update: (value, tr) => {
    if (tr.docChanged) {
      return buildLinkDecorations(tr.state);
    }
    return value;
  },

  provide: (field) => [
    // Apply decorations only - no atomicRanges so text is editable
    EditorView.decorations.from(field),
  ],
});

/**
 * Get link data at a specific position in the document
 * Useful for click handlers and context menus
 *
 * @param state - The editor state
 * @param pos - The position to check
 * @returns LinkData if position is within a link, null otherwise
 */
export function getLinkAtPosition(state: EditorState, pos: number): LinkData | null {
  const links = extractLinkData(state);
  for (const link of links) {
    if (pos >= link.textFrom && pos <= link.textTo) {
      return link;
    }
  }
  return null;
}

/**
 * Autolink decoration - handles raw URLs in text
 * This is optional and can be added later if needed
 */
export function extractAutolinks(state: EditorState): LinkData[] {
  const autolinks: LinkData[] = [];
  const tree = syntaxTree(state);

  tree.iterate({
    enter(node) {
      // Match Autolink nodes (<url>)
      if (node.name === "Autolink") {
        if (isInsideCode(state, node.from, node.to)) {
          return;
        }

        // Autolink syntax is <url>, extract URL without angle brackets
        const fullText = state.doc.sliceString(node.from, node.to);
        const url = fullText.slice(1, -1); // Remove < and >

        autolinks.push({
          from: node.from,
          to: node.to,
          text: url,
          url,
          isInternal: isInternalLink(url),
          textFrom: node.from + 1,
          textTo: node.to - 1,
          urlFrom: node.from + 1,
          urlTo: node.to - 1,
        });
      }
    },
  });

  return autolinks;
}
