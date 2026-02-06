/**
 * Shared Helper Functions
 *
 * Common utilities used across multiple modules.
 */

import { StateField } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

// ===========================================
// CONSTANTS
// ===========================================

/**
 * Regex to match heading prefix (# through ######, followed by a space)
 */
export const HEADING_PREFIX_RE = /^(#{1,6})\s/;

/**
 * Zero-width space used for strikethrough to prevent Lezer parsing issues
 */
export const ZWSP = "\u200B";

// ===========================================
// CODE BLOCK HELPERS
// ===========================================

/**
 * Collect fenced code block extents from the AST.
 * Shared by getHiddenRanges() and buildStyleDecorations() to skip code blocks.
 */
export function collectCodeBlockExtents(state: EditorState): Array<{ from: number; to: number }> {
  const extents: Array<{ from: number; to: number }> = [];
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === "FencedCode") {
        extents.push({ from: node.from, to: node.to });
      }
    },
  });
  return extents;
}

/**
 * StateField that caches code block extents, recomputing only on doc change.
 * Shared by hiddenRangesField and styleField to avoid duplicate AST walks.
 */
export const codeBlockExtentsField = StateField.define<Array<{ from: number; to: number }>>({
  create: (state) => collectCodeBlockExtents(state),
  update: (extents, tr) => tr.docChanged ? collectCodeBlockExtents(tr.state) : extents,
});

/**
 * Check if a position is inside a code block.
 */
export function isInCodeBlock(pos: number, extents: Array<{ from: number; to: number }>): boolean {
  return extents.some((r) => pos >= r.from && pos < r.to);
}

// ===========================================
// FORMATTING CONTEXT TYPES
// ===========================================

export interface FormattingContext {
  type: "strong" | "emphasis" | "code" | "strikethrough" | "highlight";
  from: number; // Start of the formatted region (including markers)
  to: number; // End of the formatted region (including markers)
  contentFrom: number; // Start of content (after opening marker)
  contentTo: number; // End of content (before closing marker)
  closingMarkerFrom: number; // Where closing marker starts
  closingMarkerTo: number; // Where closing marker ends
}

/**
 * Mapping of AST node names to formatting context types
 */
export const FORMATTING_NODE_TYPES: Array<{
  nodeName: string;
  markName: string;
  type: FormattingContext["type"];
}> = [
  { nodeName: "StrongEmphasis", markName: "EmphasisMark", type: "strong" },
  { nodeName: "Emphasis", markName: "EmphasisMark", type: "emphasis" },
  { nodeName: "InlineCode", markName: "CodeMark", type: "code" },
  { nodeName: "Strikethrough", markName: "StrikethroughMark", type: "strikethrough" },
  { nodeName: "Highlight", markName: "HighlightMark", type: "highlight" },
];

// ===========================================
// AST FORMATTING HELPERS
// ===========================================

/**
 * Shared AST walk for formatting contexts.
 * Each formatting node type uses the same logic - only the position predicate differs.
 */
export function findFormattingByAST(
  state: EditorState,
  predicate: (nodeFrom: number, nodeTo: number) => boolean,
): FormattingContext | null {
  let result: FormattingContext | null = null;

  syntaxTree(state).iterate({
    enter(node) {
      for (const ft of FORMATTING_NODE_TYPES) {
        if (node.name === ft.nodeName && predicate(node.from, node.to)) {
          const markers: { from: number; to: number }[] = [];
          node.node.cursor().iterate((child) => {
            if (child.name === ft.markName) {
              markers.push({ from: child.from, to: child.to });
            }
          });
          if (markers.length >= 2) {
            result = {
              type: ft.type,
              from: node.from,
              to: node.to,
              contentFrom: markers[0].to,
              contentTo: markers[markers.length - 1].from,
              closingMarkerFrom: markers[markers.length - 1].from,
              closingMarkerTo: markers[markers.length - 1].to,
            };
          }
        }
      }
    },
  });

  return result;
}

/**
 * Find ALL formatting regions of a specific type that overlap with a range.
 * Only returns contexts fully contained within [rangeFrom, rangeTo].
 */
export function findAllFormattingOfTypeInRange(
  state: EditorState,
  formattingType: FormattingContext["type"],
  rangeFrom: number,
  rangeTo: number,
): FormattingContext[] {
  const results: FormattingContext[] = [];
  const targetNodeType = FORMATTING_NODE_TYPES.find(ft => ft.type === formattingType);
  if (!targetNodeType) return results;

  // AST walk
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === targetNodeType.nodeName && node.from >= rangeFrom && node.to <= rangeTo) {
        const markers: { from: number; to: number }[] = [];
        node.node.cursor().iterate((child) => {
          if (child.name === targetNodeType.markName) {
            markers.push({ from: child.from, to: child.to });
          }
        });
        if (markers.length >= 2) {
          results.push({
            type: targetNodeType.type as FormattingContext["type"],
            from: node.from,
            to: node.to,
            contentFrom: markers[0].to,
            contentTo: markers[markers.length - 1].from,
            closingMarkerFrom: markers[markers.length - 1].from,
            closingMarkerTo: markers[markers.length - 1].to,
          });
        }
      }
    },
  });

  // Regex fallback for patterns the parser misses
  const regexMap: Record<string, RegExp> = {
    strong: /\*\*(.+?)\*\*/g,
    emphasis: /(?<!\*)\*([^*]+?)\*(?!\*)/g,
    code: /`([^`]+?)`/g,
    strikethrough: /~~(.+?)~~/g,
    highlight: /==([^=]+)==/g,
  };

  const markerLenMap: Record<string, number> = {
    strong: 2, emphasis: 1, code: 1, strikethrough: 2, highlight: 2,
  };

  const regex = regexMap[formattingType];
  const markerLen = markerLenMap[formattingType];
  if (regex) {
    const text = state.doc.toString();
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const nodeFrom = match.index;
      const nodeTo = match.index + match[0].length;
      // Only fully contained in range
      if (nodeFrom >= rangeFrom && nodeTo <= rangeTo) {
        const alreadyFound = results.some(r => r.from === nodeFrom && r.to === nodeTo);
        if (!alreadyFound) {
          results.push({
            type: formattingType,
            from: nodeFrom,
            to: nodeTo,
            contentFrom: nodeFrom + markerLen,
            contentTo: nodeTo - markerLen,
            closingMarkerFrom: nodeTo - markerLen,
            closingMarkerTo: nodeTo,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Find a formatting context of a SPECIFIC type that contains the given range.
 */
export function findContainingFormattingOfType(
  state: EditorState,
  formattingType: FormattingContext["type"],
  from: number,
  to: number,
): FormattingContext | null {
  const targetNodeType = FORMATTING_NODE_TYPES.find(ft => ft.type === formattingType);
  if (!targetNodeType) return null;

  let result: FormattingContext | null = null;
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === targetNodeType.nodeName && node.from <= from && node.to >= to) {
        const markers: { from: number; to: number }[] = [];
        node.node.cursor().iterate((child) => {
          if (child.name === targetNodeType.markName) {
            markers.push({ from: child.from, to: child.to });
          }
        });
        if (markers.length >= 2) {
          result = {
            type: formattingType,
            from: node.from,
            to: node.to,
            contentFrom: markers[0].to,
            contentTo: markers[markers.length - 1].from,
            closingMarkerFrom: markers[markers.length - 1].from,
            closingMarkerTo: markers[markers.length - 1].to,
          };
        }
      }
    },
  });
  return result;
}

/**
 * Check if the entire selection range is covered by formatting of the given type.
 */
export function isEntireSelectionFormatted(
  state: EditorState,
  formattingType: FormattingContext["type"],
  selFrom: number,
  selTo: number,
): boolean {
  const doc = state.doc;
  const startLine = doc.lineAt(selFrom);
  const endLine = doc.lineAt(selTo);

  // Multi-line: check each non-empty line independently
  if (startLine.number !== endLine.number) {
    for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
      const line = doc.line(lineNum);
      // Clip to selection boundaries
      const lineFrom = Math.max(line.from, selFrom);
      const lineTo = Math.min(line.to, selTo);
      if (lineFrom >= lineTo) continue;

      const lineText = doc.sliceString(lineFrom, lineTo).trim();
      if (lineText === "") continue;

      const contexts = findAllFormattingOfTypeInRange(state, formattingType, lineFrom, lineTo);
      if (contexts.length === 0) return false;

      // Check coverage
      const sorted = [...contexts].sort((a, b) => a.from - b.from);
      let covered = lineFrom;
      for (const ctx of sorted) {
        if (ctx.from > covered) return false;
        covered = Math.max(covered, ctx.to);
      }
      if (covered < lineTo) return false;
    }
    return true;
  }

  // Single-line
  const contexts = findAllFormattingOfTypeInRange(state, formattingType, selFrom, selTo);
  if (contexts.length === 0) return false;

  const sorted = [...contexts].sort((a, b) => a.from - b.from);
  let covered = selFrom;
  for (const ctx of sorted) {
    if (ctx.from > covered) return false;
    covered = Math.max(covered, ctx.to);
  }
  return covered >= selTo;
}

/**
 * Strip all marker pairs of a specific formatting type from text.
 */
export function stripMarkersOfType(text: string, formattingType: FormattingContext["type"]): string {
  const regexMap: Record<string, RegExp> = {
    strong: /\*\*(.+?)\*\*/g,
    emphasis: /(?<!\*)\*([^*]+?)\*(?!\*)/g,
    code: /`([^`]+?)`/g,
    strikethrough: /~~(.+?)~~/g,
    highlight: /==([^=]+)==/g,
  };

  const regex = regexMap[formattingType];
  if (!regex) return text;
  return text.replace(regex, "$1");
}

// ===========================================
// LINK CONTEXT
// ===========================================

export interface LinkContext {
  from: number;           // Start of entire link [text](url)
  to: number;             // End of entire link
  textFrom: number;       // Start of text (after [)
  textTo: number;         // End of text (before ])
  urlFrom: number;        // Start of URL (after ()
  urlTo: number;          // End of URL (before ))
  bracketOpen: number;    // Position of [
  bracketClose: number;   // Position of ]
  parenOpen: number;      // Position of (
  parenClose: number;     // Position of )
  url: string;            // The URL string
  text: string;           // The link text
}

/**
 * Shared regex-based link finder.
 */
export function findLinkByRegex(
  state: EditorState,
  predicate: (from: number, to: number) => boolean,
): LinkContext | null {
  const text = state.doc.toString();
  const linkRegex = /\[([^\]]*)]\(([^)]*)\)/g;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    const from = match.index;
    const to = match.index + match[0].length;

    if (predicate(from, to)) {
      const bracketOpen = from;
      const bracketClose = from + 1 + match[1].length;
      const parenOpen = bracketClose + 1;
      const parenClose = to - 1;
      const textFrom = bracketOpen + 1;
      const textTo = bracketClose;
      const urlFrom = parenOpen + 1;
      const urlTo = parenClose;

      return {
        from,
        to,
        textFrom,
        textTo,
        urlFrom,
        urlTo,
        bracketOpen,
        bracketClose,
        parenOpen,
        parenClose,
        url: match[2],
        text: match[1],
      };
    }
  }

  return null;
}

/**
 * Find the link context at cursor position.
 */
export function getLinkContext(state: EditorState): LinkContext | null {
  const pos = state.selection.main.head;
  let result: LinkContext | null = null;

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === "Link" && pos >= node.from && pos <= node.to) {
        let bracketOpen = -1;
        let bracketClose = -1;
        let parenOpen = -1;
        let parenClose = -1;
        let urlFrom = -1;
        let urlTo = -1;

        node.node.cursor().iterate((child) => {
          if (child.name === "LinkMark") {
            const markText = state.doc.sliceString(child.from, child.to);
            if (markText === "[") bracketOpen = child.from;
            else if (markText === "]") bracketClose = child.from;
            else if (markText === "(") parenOpen = child.from;
            else if (markText === ")") parenClose = child.from;
          }
          if (child.name === "URL") {
            urlFrom = child.from;
            urlTo = child.to;
          }
        });

        if (bracketOpen !== -1 && bracketClose !== -1 && parenOpen !== -1 && parenClose !== -1) {
          const textFrom = bracketOpen + 1;
          const textTo = bracketClose;
          if (urlFrom === -1) {
            urlFrom = parenOpen + 1;
            urlTo = parenClose;
          }

          result = {
            from: node.from,
            to: node.to,
            textFrom,
            textTo,
            urlFrom,
            urlTo,
            bracketOpen,
            bracketClose,
            parenOpen,
            parenClose,
            url: state.doc.sliceString(urlFrom, urlTo),
            text: state.doc.sliceString(textFrom, textTo),
          };
        }
      }
    },
  });

  // Regex fallback
  if (!result) {
    result = findLinkByRegex(state, (from, to) => pos >= from && pos <= to);
  }

  return result;
}

/**
 * Find link context when cursor is right after the closing )
 */
export function getLinkContextAfterClosing(state: EditorState): LinkContext | null {
  const pos = state.selection.main.head;
  return findLinkByRegex(state, (_from, to) => pos === to);
}

/**
 * Get link context at a specific document position.
 */
export function getLinkContextAtPos(state: EditorState, pos: number): LinkContext | null {
  return findLinkByRegex(state, (from, to) => pos >= from && pos <= to);
}

/**
 * Check if cursor is at the end of link text (right before ])
 */
export function isAtEndOfLinkText(state: EditorState, ctx: LinkContext): boolean {
  const pos = state.selection.main.head;
  return pos === ctx.textTo;
}

/**
 * Check if cursor is at the start of link text (right after [)
 */
export function isAtStartOfLinkText(state: EditorState, ctx: LinkContext): boolean {
  const pos = state.selection.main.head;
  return pos === ctx.textFrom;
}

// ===========================================
// TABLE HELPERS
// ===========================================

/**
 * Collect table extents from the AST.
 */
export function collectTableExtents(state: EditorState): Array<{ from: number; to: number }> {
  const extents: Array<{ from: number; to: number }> = [];
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === "Table") {
        // Walk children to compute validated extent
        let maxTo = node.from;
        let child = node.node.firstChild;
        while (child) {
          if (child.name === "TableHeader" || child.name === "TableDelimiter") {
            if (child.to > maxTo) maxTo = child.to;
          } else if (child.name === "TableRow") {
            const rowText = state.doc.sliceString(child.from, child.to);
            if (rowText.includes("|")) {
              if (child.to > maxTo) maxTo = child.to;
            }
          }
          child = child.nextSibling;
        }
        const trueTo = state.doc.lineAt(maxTo).to;
        extents.push({ from: node.from, to: trueTo });
      }
    },
  });
  return extents;
}

/**
 * Check if a position is inside a table.
 */
export function isInTable(pos: number, extents: Array<{ from: number; to: number }>): boolean {
  return extents.some((r) => pos >= r.from && pos < r.to);
}

// ===========================================
// INTERNAL LINK HELPERS
// ===========================================

/**
 * Parsed internal link target information
 */
export interface InternalLinkTarget {
  /** Full path or relative path to the file */
  path: string;
  /** Heading anchor (without #), if any */
  heading?: string;
  /** Whether this is a same-file heading link (starts with #) */
  isSameFile: boolean;
}

/**
 * Check if a URL is an internal link (points to a .md file or heading anchor)
 *
 * Internal links are:
 * - Relative paths ending in .md (e.g., "notes/todo.md")
 * - Relative paths with heading anchors (e.g., "notes/todo.md#section")
 * - Same-file heading links (e.g., "#my-heading")
 * - Paths without protocol that end in .md
 *
 * External links are:
 * - URLs with protocols (http://, https://, mailto:, etc.)
 * - Paths that don't end in .md
 */
export function isInternalLink(url: string): boolean {
  // Empty URL is not a link
  if (!url || url.trim() === "") return false;

  // Same-file heading link
  if (url.startsWith("#")) return true;

  // Has protocol = external link
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return false;

  // Check for .md extension (with or without heading anchor)
  const pathWithoutAnchor = url.split("#")[0];
  return pathWithoutAnchor.endsWith(".md");
}

/**
 * Parse an internal link URL into path and heading components
 */
export function parseInternalLinkTarget(url: string): InternalLinkTarget | null {
  if (!isInternalLink(url)) return null;

  // Same-file heading link
  if (url.startsWith("#")) {
    return {
      path: "",
      heading: url.slice(1), // Remove #
      isSameFile: true,
    };
  }

  // Split on # to get path and heading
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) {
    return {
      path: url,
      heading: undefined,
      isSameFile: false,
    };
  }

  return {
    path: url.slice(0, hashIndex),
    heading: url.slice(hashIndex + 1),
    isSameFile: false,
  };
}
