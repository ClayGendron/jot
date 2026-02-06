/**
 * Hidden Ranges
 *
 * Defines HiddenRange types and the getHiddenRanges() function that walks
 * the Lezer AST + regex fallback to produce HiddenRange[].
 *
 * This is cached in hiddenRangesField StateField (recomputes on doc change).
 * Both decorations (buildDecorationsFromRanges) and selection snapping consume
 * the same field.
 */

import { StateField } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import {
  codeBlockExtentsField,
  isInCodeBlock,
} from "../utils/sharedHelpers";
import { getBlockquoteInfo } from "../handlers/blockquoteHandlers";
import { parseTableFromAST } from "../parsers/tableParser";

// ===========================================
// HIDDEN RANGE TYPES
// ===========================================

export type HiddenRangeKind =
  | "inline-marker"      // **, *, ~~, `
  | "heading-prefix"     // ## (and trailing space)
  | "list-marker"        // - , 1. (and trailing space)
  | "task-marker"        // [ ] or [x] (and trailing space)
  | "blockquote-prefix"  // > (one or more levels)
  | "link-bracket-open"  // the [ of [text](url)
  | "link-tail"          // ](url) portion
  | "code-fence-open"    // opening ``` line
  | "code-fence-close"   // closing ``` line
  | "horizontal-rule"    // entire --- line
  | "table-delimiter";   // entire GFM table delimiter row

export interface HiddenRange {
  from: number;
  to: number;
  kind: HiddenRangeKind;
  /** Start of the AST node this range belongs to */
  nodeFrom: number;
  /** End of the AST node this range belongs to */
  nodeTo: number;
  /** For line-prefix kinds: visible start after ALL stacked prefixes */
  contentStart?: number;
  /** For line-prefix kinds: end of visible content */
  contentEnd?: number;
  /** Extra metadata (e.g., language for code-fence-open, level for blockquote) */
  meta?: Record<string, unknown>;
}

// ===========================================
// GET HIDDEN RANGES
// ===========================================

/**
 * Walk the Lezer AST and return all hidden ranges.
 * Both decorations and selection snapping consume this cached result.
 *
 * Prefix stacking (blockquote + list + task): computes per-line
 * "effectiveContentStart" by walking the line from its start and
 * accumulating all prefix ranges.
 *
 * Code block exclusion: first pass collects fenced code extents;
 * subsequent iteration ignores positions inside code blocks.
 */
export function getHiddenRanges(state: EditorState): HiddenRange[] {
  const doc = state.doc;
  const ranges: HiddenRange[] = [];
  const tableRanges: Array<{ from: number; to: number }> = [];

  // Read cached code block extents from shared StateField
  const codeBlockExtents = state.field(codeBlockExtentsField);

  const isInsideCodeBlock = (pos: number) =>
    isInCodeBlock(pos, codeBlockExtents);

  // Track which lines we've processed for blockquotes (to handle nested)
  const processedBlockquoteLines = new Set<number>();

  // Second pass: walk the AST to find all hidden ranges
  syntaxTree(state).iterate({
    enter(node) {
      // Skip nodes inside code blocks (but still process FencedCode itself)
      if (isInsideCodeBlock(node.from) && node.name !== "FencedCode") return;

      // Inline markers: EmphasisMark, CodeMark, StrikethroughMark, HighlightMark
      if (node.name === "EmphasisMark" || node.name === "CodeMark" || node.name === "StrikethroughMark" || node.name === "HighlightMark") {
        ranges.push({
          from: node.from,
          to: node.to,
          kind: "inline-marker",
          nodeFrom: node.from,
          nodeTo: node.to,
        });
      }

      // Heading prefix: HeaderMark + trailing space
      if (node.name === "HeaderMark") {
        const nextChar = doc.sliceString(node.to, node.to + 1);
        const to = nextChar === " " ? node.to + 1 : node.to;
        // Find the ATXHeading parent to get full line info
        const line = doc.lineAt(node.from);
        ranges.push({
          from: node.from,
          to,
          kind: "heading-prefix",
          nodeFrom: node.from,
          nodeTo: line.to,
          contentStart: to,
          contentEnd: line.to,
        });
      }

      // List markers
      if (node.name === "ListMark") {
        const nextChar = doc.sliceString(node.to, node.to + 1);
        const to = nextChar === " " ? node.to + 1 : node.to;
        const markText = doc.sliceString(node.from, node.to);
        const isOrdered = /^\d+\.$/.test(markText);
        const num = isOrdered ? parseInt(markText) : 0;
        const line = doc.lineAt(node.from);
        ranges.push({
          from: node.from,
          to,
          kind: "list-marker",
          nodeFrom: node.from,
          nodeTo: line.to,
          contentStart: to,
          contentEnd: line.to,
          meta: { isOrdered, num },
        });
      }

      // Task markers
      if (node.name === "TaskMarker") {
        const markerText = doc.sliceString(node.from, node.to);
        const isChecked = /\[[xX]]/.test(markerText);
        const nextChar = doc.sliceString(node.to, node.to + 1);
        const to = nextChar === " " ? node.to + 1 : node.to;
        const line = doc.lineAt(node.from);
        ranges.push({
          from: node.from,
          to,
          kind: "task-marker",
          nodeFrom: node.from,
          nodeTo: line.to,
          contentStart: to,
          contentEnd: line.to,
          meta: { checked: isChecked, pos: node.from },
        });
      }

      // Blockquote prefix (QuoteMark)
      if (node.name === "QuoteMark") {
        const line = doc.lineAt(node.from);
        if (!processedBlockquoteLines.has(line.number)) {
          processedBlockquoteLines.add(line.number);
          const quoteInfo = getBlockquoteInfo(line);
          if (quoteInfo) {
            ranges.push({
              from: line.from,
              to: quoteInfo.contentStart,
              kind: "blockquote-prefix",
              nodeFrom: line.from,
              nodeTo: line.to,
              contentStart: quoteInfo.contentStart,
              contentEnd: line.to,
              meta: { level: quoteInfo.level },
            });
          }
        }
      }

      // Horizontal rule
      if (node.name === "HorizontalRule") {
        const line = doc.lineAt(node.from);
        ranges.push({
          from: line.from,
          to: line.to,
          kind: "horizontal-rule",
          nodeFrom: line.from,
          nodeTo: line.to,
        });
      }

      // Fenced code blocks
      if (node.name === "FencedCode") {
        const startLine = doc.lineAt(node.from);
        const endLine = doc.lineAt(node.to);
        const langMatch = startLine.text.match(/^`{3,}(\w*)/);
        const language = langMatch ? langMatch[1] : "";

        // Opening fence
        ranges.push({
          from: startLine.from,
          to: startLine.to,
          kind: "code-fence-open",
          nodeFrom: node.from,
          nodeTo: node.to,
          meta: { language },
        });

        // Closing fence (if different line)
        if (endLine.number !== startLine.number) {
          ranges.push({
            from: endLine.from,
            to: endLine.to,
            kind: "code-fence-close",
            nodeFrom: node.from,
            nodeTo: node.to,
          });
        }
      }

      // GFM Table: produce delimiter hidden range (table block widget rendering)
      if (node.name === "Table") {
        const tableInfo = parseTableFromAST(state, { from: node.from, to: node.to, node: node.node });
        if (!tableInfo) return;

        tableRanges.push({ from: tableInfo.from, to: tableInfo.to });

        // Delimiter row: hide entire line
        ranges.push({
          from: tableInfo.delimiterFrom,
          to: tableInfo.delimiterTo,
          kind: "table-delimiter",
          nodeFrom: tableInfo.from,
          nodeTo: tableInfo.to,
          meta: { tableInfo },
        });
      }

      // Links: hide [ and ](url)
      if (node.name === "Link") {
        let bracketOpen = -1;
        let bracketClose = -1;
        let parenClose = -1;

        node.node.cursor().iterate((child) => {
          if (child.name === "LinkMark") {
            const markText = doc.sliceString(child.from, child.to);
            if (markText === "[") bracketOpen = child.from;
            else if (markText === "]") bracketClose = child.from;
            else if (markText === ")") parenClose = child.from;
          }
        });

        if (bracketOpen !== -1) {
          ranges.push({
            from: bracketOpen,
            to: bracketOpen + 1,
            kind: "link-bracket-open",
            nodeFrom: node.from,
            nodeTo: node.to,
          });
        }
        if (bracketClose !== -1 && parenClose !== -1) {
          ranges.push({
            from: bracketClose,
            to: parenClose + 1,
            kind: "link-tail",
            nodeFrom: node.from,
            nodeTo: node.to,
          });
        }
      }
    },
  });

  // ===========================================
  // REGEX FALLBACK: catch markers the parser misses
  // ===========================================

  const text = doc.toString();

  const collectedKeys = new Set<string>();
  for (const r of ranges) {
    collectedKeys.add(`${r.from}-${r.to}`);
  }
  const isAlreadyCollected = (from: number, to: number) =>
    collectedKeys.has(`${from}-${to}`);

  // Bold markers: **
  const boldRegex = /\*\*(.+?)\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(text)) !== null) {
    const openFrom = match.index;
    const openTo = match.index + 2;
    const closeFrom = match.index + 2 + match[1].length;
    const closeTo = closeFrom + 2;
    if (isInsideCodeBlock(openFrom)) continue;
    if (!isAlreadyCollected(openFrom, openTo)) {
      ranges.push({ from: openFrom, to: openTo, kind: "inline-marker", nodeFrom: openFrom, nodeTo: closeTo });
      collectedKeys.add(`${openFrom}-${openTo}`);
    }
    if (!isAlreadyCollected(closeFrom, closeTo)) {
      ranges.push({ from: closeFrom, to: closeTo, kind: "inline-marker", nodeFrom: openFrom, nodeTo: closeTo });
      collectedKeys.add(`${closeFrom}-${closeTo}`);
    }
  }

  // Italic markers: * (but not **)
  const italicRegex = /(?<!\*)\*([^*]+?)\*(?!\*)/g;
  while ((match = italicRegex.exec(text)) !== null) {
    const openFrom = match.index;
    const openTo = match.index + 1;
    const closeFrom = match.index + 1 + match[1].length;
    const closeTo = closeFrom + 1;
    if (isInsideCodeBlock(openFrom)) continue;
    if (!isAlreadyCollected(openFrom, openTo)) {
      ranges.push({ from: openFrom, to: openTo, kind: "inline-marker", nodeFrom: openFrom, nodeTo: closeTo });
      collectedKeys.add(`${openFrom}-${openTo}`);
    }
    if (!isAlreadyCollected(closeFrom, closeTo)) {
      ranges.push({ from: closeFrom, to: closeTo, kind: "inline-marker", nodeFrom: openFrom, nodeTo: closeTo });
      collectedKeys.add(`${closeFrom}-${closeTo}`);
    }
  }

  // Strikethrough markers: ~~
  const strikeRegex = /~~(.+?)~~/g;
  while ((match = strikeRegex.exec(text)) !== null) {
    const openFrom = match.index;
    const openTo = match.index + 2;
    const closeFrom = match.index + 2 + match[1].length;
    const closeTo = closeFrom + 2;
    if (isInsideCodeBlock(openFrom)) continue;
    if (!isAlreadyCollected(openFrom, openTo)) {
      ranges.push({ from: openFrom, to: openTo, kind: "inline-marker", nodeFrom: openFrom, nodeTo: closeTo });
      collectedKeys.add(`${openFrom}-${openTo}`);
    }
    if (!isAlreadyCollected(closeFrom, closeTo)) {
      ranges.push({ from: closeFrom, to: closeTo, kind: "inline-marker", nodeFrom: openFrom, nodeTo: closeTo });
      collectedKeys.add(`${closeFrom}-${closeTo}`);
    }
  }

  // Highlight markers: ==
  const highlightRegex = /==([^=]+)==/g;
  while ((match = highlightRegex.exec(text)) !== null) {
    const openFrom = match.index;
    const openTo = match.index + 2;
    const closeFrom = match.index + 2 + match[1].length;
    const closeTo = closeFrom + 2;
    if (isInsideCodeBlock(openFrom)) continue;
    if (!isAlreadyCollected(openFrom, openTo)) {
      ranges.push({ from: openFrom, to: openTo, kind: "inline-marker", nodeFrom: openFrom, nodeTo: closeTo });
      collectedKeys.add(`${openFrom}-${openTo}`);
    }
    if (!isAlreadyCollected(closeFrom, closeTo)) {
      ranges.push({ from: closeFrom, to: closeTo, kind: "inline-marker", nodeFrom: openFrom, nodeTo: closeTo });
      collectedKeys.add(`${closeFrom}-${closeTo}`);
    }
  }

  // Link markers: [text](url)
  const linkRegex = /\[([^\]]*)]\(([^)]*)\)/g;
  while ((match = linkRegex.exec(text)) !== null) {
    const bracketOpen = match.index;
    const bracketClose = match.index + 1 + match[1].length;
    const parenClose = match.index + match[0].length - 1;
    if (isInsideCodeBlock(bracketOpen)) continue;
    if (!isAlreadyCollected(bracketOpen, bracketOpen + 1)) {
      ranges.push({ from: bracketOpen, to: bracketOpen + 1, kind: "link-bracket-open", nodeFrom: bracketOpen, nodeTo: parenClose + 1 });
      collectedKeys.add(`${bracketOpen}-${bracketOpen + 1}`);
    }
    if (!isAlreadyCollected(bracketClose, parenClose + 1)) {
      ranges.push({ from: bracketClose, to: parenClose + 1, kind: "link-tail", nodeFrom: bracketOpen, nodeTo: parenClose + 1 });
      collectedKeys.add(`${bracketClose}-${parenClose + 1}`);
    }
  }

  // Blockquote markers: regex fallback for lines the parser missed
  for (let i = 1; i <= doc.lines; i++) {
    if (processedBlockquoteLines.has(i)) continue;
    const line = doc.line(i);
    if (isInsideCodeBlock(line.from)) continue;
    const quoteInfo = getBlockquoteInfo(line);
    if (quoteInfo) {
      ranges.push({
        from: line.from,
        to: quoteInfo.contentStart,
        kind: "blockquote-prefix",
        nodeFrom: line.from,
        nodeTo: line.to,
        contentStart: quoteInfo.contentStart,
        contentEnd: line.to,
        meta: { level: quoteInfo.level },
      });
    }
  }

  // ===========================================
  // Compute per-line effective contentStart for stacked prefixes
  // ===========================================

  // Group prefix ranges by line and compute effective contentStart
  const prefixKinds: Set<HiddenRangeKind> = new Set([
    "heading-prefix", "list-marker", "task-marker", "blockquote-prefix",
  ]);
  const prefixRangesByLine = new Map<number, HiddenRange[]>();

  for (const r of ranges) {
    if (!prefixKinds.has(r.kind)) continue;
    const lineNum = doc.lineAt(r.from).number;
    let arr = prefixRangesByLine.get(lineNum);
    if (!arr) {
      arr = [];
      prefixRangesByLine.set(lineNum, arr);
    }
    arr.push(r);
  }

  for (const [, lineRanges] of prefixRangesByLine) {
    if (lineRanges.length <= 1) continue;
    // Sort by from position (leftmost first)
    lineRanges.sort((a, b) => a.from - b.from);
    // The effective contentStart is the `to` of the last (rightmost) prefix range
    const effectiveContentStart = lineRanges[lineRanges.length - 1].to;
    const line = doc.lineAt(lineRanges[0].from);
    // Update all prefix ranges on this line to share the same contentStart
    for (const r of lineRanges) {
      r.contentStart = effectiveContentStart;
      r.contentEnd = line.to;
    }
  }

  // Post-process: remove ranges that fall entirely within a table range
  // (prevents overlapping Decoration.replace ranges once the table is replaced)
  if (tableRanges.length > 0) {
    const filtered = ranges.filter(r => {
      if (r.kind === "table-delimiter") return true;
      return !tableRanges.some(t => r.from >= t.from && r.to <= t.to);
    });
    return filtered;
  }

  return ranges;
}

// ===========================================
// STATE FIELD
// ===========================================

/**
 * StateField that caches HiddenRange[] and recomputes on doc change.
 * All consumers (decorations, snapper) read from this field.
 */
export const hiddenRangesField = StateField.define<HiddenRange[]>({
  create: (state) => getHiddenRanges(state),
  update: (value, tr) => {
    if (tr.docChanged) {
      return getHiddenRanges(tr.state);
    }
    return value;
  },
});
