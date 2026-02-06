/**
 * Custom Lezer Markdown Extensions
 *
 * Extends the Lezer markdown parser with additional syntax support.
 */

import { tags } from "@lezer/highlight";
import type { InlineContext, MarkdownConfig } from "@lezer/markdown";

// ===========================================
// HIGHLIGHT LEZER EXTENSION (==text==)
// ===========================================

const HighlightDelim = { resolve: "Highlight", mark: "HighlightMark" };
const HighlightPunctuation = /[!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~\xA1\u2010-\u2027]/;

/**
 * Lezer markdown extension for ==highlight== syntax.
 * Similar to strikethrough but uses = instead of ~.
 *
 * Unlike strikethrough, this doesn't conflict with other syntax,
 * so no ZWSP workaround is needed.
 */
export const HighlightExtension: MarkdownConfig = {
  defineNodes: [
    { name: "Highlight", style: { "Highlight/...": tags.special(tags.content) } },
    { name: "HighlightMark", style: tags.processingInstruction },
  ],
  parseInline: [{
    name: "Highlight",
    parse(cx: InlineContext, next: number, pos: number) {
      // Must be '=' character (char code 61)
      if (next != 61 || cx.char(pos + 1) != 61 || cx.char(pos + 2) == 61) return -1;

      const before = cx.slice(pos - 1, pos);
      const after = cx.slice(pos + 2, pos + 3);
      const sBefore = /\s|^$/.test(before);
      const sAfter = /\s|^$/.test(after);
      const pBefore = HighlightPunctuation.test(before);
      const pAfter = HighlightPunctuation.test(after);

      return cx.addDelimiter(
        HighlightDelim,
        pos,
        pos + 2,
        !sAfter && (!pAfter || sBefore || pBefore),
        !sBefore && (!pBefore || sAfter || pAfter)
      );
    },
    after: "Emphasis",
  }],
};
