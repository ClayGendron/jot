/**
 * Hidden Syntax Decorations
 *
 * StateField that builds decorations from HiddenRange[].
 * Replaces markdown syntax with visual widgets (bullets, checkboxes, etc.)
 * while keeping the underlying text editable.
 */

import { StateField, RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { hiddenRangesField, type HiddenRange } from "./hiddenRanges";
import {
  BulletWidget,
  NumberWidget,
  BlockquoteBarWidget,
  HorizontalRuleWidget,
  CodeBlockOpenWidget,
  CodeBlockCloseWidget,
  CheckboxWidget,
  TableBlockWidget,
} from "../widgets";
import type { TableInfo } from "../parsers/tableParser";

// ===========================================
// HIDDEN DECORATION
// ===========================================

const hiddenDecoration = Decoration.replace({});

// ===========================================
// BUILD DECORATIONS FROM RANGES
// ===========================================

/**
 * Build decorations from HiddenRange[].
 * Unified decoration builder — single source of truth.
 *
 * - inline-marker -> Decoration.replace({})
 * - heading-prefix -> Decoration.replace({})
 * - list-marker -> BulletWidget or NumberWidget
 * - task-marker -> CheckboxWidget
 * - blockquote-prefix -> BlockquoteBarWidget
 * - code-fence-open -> CodeBlockOpenWidget
 * - code-fence-close -> CodeBlockCloseWidget
 * - horizontal-rule -> HorizontalRuleWidget
 * - link-bracket-open -> Decoration.replace({})
 * - link-tail -> Decoration.replace({})
 * - table-delimiter -> TableBlockWidget
 */
export function buildDecorationsFromRanges(hiddenRanges: HiddenRange[]) {
  // Collect HR and code fence ranges for overlap filtering
  const hrRanges = hiddenRanges.filter(r => r.kind === "horizontal-rule");
  const codeFenceRanges = hiddenRanges.filter(r => r.kind === "code-fence-open" || r.kind === "code-fence-close");
  const tableRanges = hiddenRanges
    .filter(r => r.kind === "table-delimiter")
    .map(r => ({ from: r.nodeFrom, to: r.nodeTo }));

  const overlapsWithHR = (from: number, to: number): boolean =>
    hrRanges.some(hr => from >= hr.from && to <= hr.to);

  const overlapsWithCodeFence = (from: number, to: number): boolean =>
    codeFenceRanges.some(cb => from >= cb.from && to <= cb.to);

  const isInsideTable = (from: number, to: number): boolean =>
    tableRanges.some(t => from >= t.from && to <= t.to);

  type DecorationEntry = { from: number; to: number; deco: Decoration };
  const entries: DecorationEntry[] = [];

  for (const r of hiddenRanges) {
    if (r.kind !== "table-delimiter" && isInsideTable(r.from, r.to)) continue;

    // Filter out ranges that overlap with HR or code fences (except those ranges themselves)
    if (r.kind !== "horizontal-rule" && r.kind !== "code-fence-open" && r.kind !== "code-fence-close"
        && r.kind !== "table-delimiter") {
      if (overlapsWithHR(r.from, r.to) || overlapsWithCodeFence(r.from, r.to)) continue;
    }

    switch (r.kind) {
      case "inline-marker":
      case "link-bracket-open":
      case "link-tail":
      case "heading-prefix":
        entries.push({ from: r.from, to: r.to, deco: hiddenDecoration });
        break;
      case "list-marker": {
        const isOrdered = r.meta?.isOrdered as boolean;
        const num = r.meta?.num as number;
        const widget = isOrdered ? new NumberWidget(num) : new BulletWidget();
        entries.push({ from: r.from, to: r.to, deco: Decoration.replace({ widget }) });
        break;
      }
      case "task-marker": {
        const checked = r.meta?.checked as boolean;
        const pos = r.meta?.pos as number;
        const widget = new CheckboxWidget(checked, pos);
        entries.push({ from: r.from, to: r.to, deco: Decoration.replace({ widget }) });
        break;
      }
      case "blockquote-prefix": {
        const level = r.meta?.level as number;
        const widget = new BlockquoteBarWidget(level);
        entries.push({ from: r.from, to: r.to, deco: Decoration.replace({ widget }) });
        break;
      }
      case "horizontal-rule": {
        const widget = new HorizontalRuleWidget();
        entries.push({ from: r.from, to: r.to, deco: Decoration.replace({ widget, block: true }) });
        break;
      }
      case "code-fence-open": {
        const language = r.meta?.language as string;
        const widget = new CodeBlockOpenWidget(language);
        entries.push({ from: r.from, to: r.to, deco: Decoration.replace({ widget, block: true }) });
        break;
      }
      case "code-fence-close": {
        const widget = new CodeBlockCloseWidget();
        entries.push({ from: r.from, to: r.to, deco: Decoration.replace({ widget, block: true }) });
        break;
      }
      case "table-delimiter": {
        const tableInfo = r.meta?.tableInfo as TableInfo | undefined;
        if (tableInfo) {
          const widget = new TableBlockWidget(
            r.nodeFrom,
            tableInfo.columnCount,
            tableInfo.rowCount
          );
          entries.push({ from: r.nodeFrom, to: r.nodeTo, deco: Decoration.replace({ widget, block: true }) });
        } else {
          entries.push({ from: r.from, to: r.to, deco: hiddenDecoration });
        }
        break;
      }
    }
  }

  // Sort by 'from' position, then 'to' (required by RangeSetBuilder)
  entries.sort((a, b) => a.from - b.from || a.to - b.to);

  const builder = new RangeSetBuilder<Decoration>();
  for (const e of entries) {
    builder.add(e.from, e.to, e.deco);
  }
  return builder.finish();
}

// ===========================================
// STATE FIELD
// ===========================================

/**
 * StateField that tracks hidden syntax decorations.
 * Consumes HiddenRange[] from hiddenRangesField.
 *
 * NOTE: We only provide EditorView.decorations, NOT EditorView.atomicRanges.
 */
export const hiddenSyntaxField = StateField.define({
  create: (state) => buildDecorationsFromRanges(state.field(hiddenRangesField)),
  update: (value, tr) => {
    if (tr.docChanged) {
      return buildDecorationsFromRanges(tr.state.field(hiddenRangesField));
    }
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});
