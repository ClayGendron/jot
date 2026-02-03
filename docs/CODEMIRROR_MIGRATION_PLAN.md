# Jot Editor Migration: TipTap to CodeMirror 6 (Typora-Style)

---

## Progress Tracker

| Phase | Status | Commit | Date |
|-------|--------|--------|------|
| Phase 1: Foundation | **COMPLETE** | `0a6338f` | 2026-02-03 |
| Phase 2: Hidden Syntax | **COMPLETE** | `01b4891` | 2026-02-03 |
| Phase 3: Block Structure | **COMPLETE** | `cfc40f6` | 2026-02-03 |
| Phase 4: Links/Images | **COMPLETE** | `f234853` | 2026-02-03 |
| Phase 5: Code/Mermaid | **COMPLETE** | `f6b4a1c` | 2026-02-03 |
| Phase 6: Tables | Pending | - | - |
| Phase 7: Search/Spell | Pending | - | - |
| Phase 8: Toolbar/Menus | Pending | - | - |
| Phase 9: CSS Migration | Pending | - | - |
| Phase 10: Cleanup | Pending | - | - |

---

## Goal
Replace TipTap with CodeMirror 6 to create a "Microsoft Word for Markdown" experience:
- **True source preservation**: Markdown edited directly, no conversion = no drift
- **Zero markdown visible**: Syntax ALWAYS hidden via decorations (unless raw view)
- **Word-like UX**: User never sees `**bold**`, just bold text
- **Raw view available**: User can toggle to see/edit raw markdown

## Core Constraints
1. **Markdown is the immutable source.** No parse/reserialize on load/save.
2. **No drift unless edited.** Only the specific range the user touched gets modified.
3. **Syntax always hidden** in WYSIWYG mode. Raw view toggle available.
4. **Export/copy uses Markdown → HTML**, never editor DOM (CM6 DOM is not semantic).

---

## Architecture

### Current (TipTap) - VIOLATES CONSTRAINTS
```
File (md) → markdownToHtml() → TipTap (HTML) → htmlToMarkdown() → File (md)
                                    ↑
                              Lossy conversion = drift
```

### New (CodeMirror 6)
```
File (md) → CodeMirror (md string) → File (md)
                  ↓
        Decorations hide syntax, render WYSIWYG
        (toggleable via rawMode)
```

No conversion on load. No conversion on save. Markdown is canonical everywhere.

---

## UX Decisions (Confirmed)

| Feature | Behavior |
|---------|----------|
| Default markers | `**` for bold, `*` for italic when user applies formatting |
| Typing `*` | Auto-close like IDE: `*` → `*\|*`, then another `*` → `**\|**` |
| Syntax visibility | Always hidden in WYSIWYG; raw view toggle shows all syntax |
| Tables | UI-based creation/editing, Tab navigation between cells |
| Table cell edits | **Commit on blur/Tab only** (not keystroke) to prevent focus glitches |
| Table multiline | Newlines serialize to `<br>`, preserve existing `<br>` style |
| Mermaid | Raw code when focused, rendered diagram otherwise |
| Links/images edit | Only replace edited range (URL, alt text), never normalize whole syntax |
| Input rules | `-`/`*`/`+` → list, `#` → heading, `>` → quote, `---` → hr |
| `==highlight==` | Custom decoration (non-Lezer), hides `==` markers |
| Export/copy | Render HTML from Markdown string, never from editor DOM |

---

## Priority-Ordered Issues in Current Codebase

### [P0] HTML is canonical today
- `editorStore.ts` line 17: `content: string` is HTML
- `tabsStore.ts`: Tab `content` is HTML
- `saveService.ts`: calls `htmlToMarkdown()` on save
- `App.tsx`: calls `markdownToHtml()` on load

**Fix**: Change to Markdown everywhere, remove conversions.

### [P1] TipTap/HTML-bound UX
- `src/components/editor/Editor.tsx` - TipTap component
- `src/components/editor/extensions/*` - TipTap extensions
- `EditorToolbar.tsx` - calls `editor.chain().focus()` TipTap API
- `FindReplaceBar.tsx` - uses TipTap storage
- `useDocumentOutline.ts` - parses HTML content
- `useInternalLinkNavigation.ts` - relies on DOM `data-internal-link`

**Fix**: Replace with CM6 equivalents.

### [P1] Export/clipboard uses editor DOM
- Context menu "copy as formatted" likely uses editor DOM
- Future export features need HTML

**Fix**: Build HTML from `markdownToHtml(markdown)`, never from editor DOM.

### [P2] CSS targets `.tiptap-editor`
- `editor.css` styles won't apply to CodeMirror
- **Fix**: Port to `.cm-editor`, `.cm-content`, semantic classes

---

## Core CM6 Patterns

### 1. Hidden Syntax with Compartment (for Raw View Toggle)
```typescript
// src/components/editor/codemirror/extensions/hiddenSyntax.ts
import { Compartment, StateField, RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

const hidden = Decoration.replace({ inclusive: false });

function isSyntaxToken(name: string) {
  return name.endsWith("Mark") || name === "HeaderMark" ||
         name === "ListMark" || name === "QuoteMark";
}

function buildHiddenSyntax(state: any) {
  const builder = new RangeSetBuilder<Decoration>();
  syntaxTree(state).iterate({
    enter(node) {
      if (isSyntaxToken(node.name)) {
        builder.add(node.from, node.to, hidden);
      }
    },
  });
  return builder.finish();
}

export const hiddenSyntaxField = StateField.define({
  create: (state) => buildHiddenSyntax(state),
  update: (value, tr) => (tr.docChanged ? buildHiddenSyntax(tr.state) : value),
  provide: (f) => [
    EditorView.decorations.from(f),
    EditorView.atomicRanges.of((view) => view.state.field(f)),
  ],
});

// Compartment for toggling raw view
export const hiddenSyntaxCompartment = new Compartment();

// Toggle function
export function toggleRawView(view: EditorView, rawMode: boolean) {
  view.dispatch({
    effects: hiddenSyntaxCompartment.reconfigure(
      rawMode ? [] : hiddenSyntaxField
    ),
  });
}
```

### 2. Auto-Close `*` and `**` (IDE-like)
```typescript
// src/components/editor/codemirror/extensions/autoCloseMarkdown.ts
// When user types *, insert paired *|*
// When cursor between *|* and user types *, upgrade to **|**
// Exception: line start allows list markers (- * +)
```

### 3. Delimiter-Preserving Commands
```typescript
// src/components/editor/codemirror/commands/formatting.ts
function surround(view: EditorView, marker: string): boolean {
  // Only insert/remove markers, never normalize
  // Check if markers exist around selection → remove
  // Otherwise → add markers
}
export const toggleBold = (view) => surround(view, "**");
export const toggleItalic = (view) => surround(view, "*");
```

### 4. Input Rules for Structure Creation
```typescript
// src/components/editor/codemirror/extensions/inputRules.ts
// These trigger on Enter or Space at line start:
// - / * / + followed by space → bullet list item
// 1. followed by space → ordered list item
// # / ## / ### → heading (apply on Enter)
// > followed by space → blockquote
// --- or *** on its own line → horizontal rule
// [ ] or [x] → task list item checkbox
```

### 5. Format Active Detection (for toolbar)
```typescript
// src/components/editor/codemirror/utils/formatActive.ts
export function isFormatActive(state: EditorState, nodeName: string): boolean {
  // Walk syntax tree at selection to detect if inside bold/italic/etc
}
```

### 6. Boundary-Safe Delete/Backspace
```typescript
// src/components/editor/codemirror/extensions/deleteBehavior.ts
// Handle backspace near hidden markers: delete ** as unit, not one char
```

### 7. Highlight (==...==) Custom Decoration
```typescript
// src/components/editor/codemirror/decorations/highlight.ts
// NOT Lezer-based (==...== not in GFM)
// Regex-based decoration that:
// 1. Finds ==...== patterns (skipping code spans/blocks)
// 2. Hides == markers with Decoration.replace()
// 3. Applies highlight styling to content
// 4. Creates atomic ranges for the markers
```

### 8. Tables with Minimal Mutation
```typescript
// Parse table into model with cell ranges
type CellRange = { from: number; to: number; padLeft: string; padRight: string };
type TableModel = { rows: string[][]; ranges: CellRange[][] };

// Only update the specific cell that was edited
function updateCell(view: EditorView, cell: CellRange, value: string) {
  const escaped = value.replace(/\|/g, "\\|");
  // Preserve line break style (<br>, <br/>, <br />)
  // Preserve padLeft and padRight from original
  view.dispatch({ changes: { from: cell.from, to: cell.to, insert: escaped } });
}
```

**Table Behavior:**
- Always rendered as widget (never raw markdown in WYSIWYG)
- Tab: move right, wrap to first cell of next row
- Shift+Tab: move left, wrap to last cell of previous row
- Enter: insert newline (stored as `<br>`)
- **Edits commit on blur/Tab only** (not keystroke) to avoid CM6 focus glitches
- Preserve cell padding (`padLeft`, `padRight`) from original
- Preserve existing `<br>` style per cell
- Row/column add via UI buttons only
- **Never normalize table** except the specific cell being edited

### 9. Links/Images - No Normalization
```typescript
// When editing a link:
// - Only replace the URL range or the text range
// - Never rewrite [text](url) as a whole
// - Preserve whitespace, escaping as-is

// Example: user edits "Google" to "Google Search" in [Google](https://google.com)
// Only the text range changes, URL and brackets untouched
```

---

## Phased Implementation

### Phase 1: Foundation + Markdown Canonical ✅ COMPLETE
**Make Markdown the source of truth and get basic CM6 running.**

> **Completed:** 2026-02-03 | **Commit:** `0a6338f`

**Store Changes:** ✅
- `editorStore.ts`: Added `useMarkdownEditor` feature flag (default: false)
- `editorStore.ts`: Updated `content` comment to note format depends on flag
- `tabsStore.ts`: Updated `content` comment to note format depends on flag
- **Kept `sourceMode`** - will toggle hidden syntax in Phase 2

**Load/Save Changes:** ✅
- `App.tsx`: Conditionally skips `markdownToHtml()` when flag is true
- `saveService.ts`: Conditionally skips `htmlToMarkdown()` when flag is true

**Export/Copy Pipeline:** ⏳ (Deferred - existing code already uses markdownToHtml)
- Context menu already converts via `copyAsMarkdown()` / `copyAsFormatted()`
- Will verify in Phase 8 when connecting toolbar

**Created:** ✅
- `src/components/editor/MarkdownEditor.tsx` - CM6 React component
- `src/components/editor/codemirror/setup.ts` - GFM-enabled markdown config
- `src/components/editor/codemirror/theme.ts` - Jot theme using CSS variables
- `src/components/editor/codemirror/keymap.ts` - Placeholder for Phase 2

**Feature flag:** ✅ `useMarkdownEditor` in editorStore (default false)

**Dependencies Added:** ✅
```
@codemirror/autocomplete@6.20.0
@codemirror/commands@6.10.1
@codemirror/lang-markdown@6.5.0
@codemirror/language@6.12.1
@codemirror/search@6.6.0
@codemirror/state@6.5.4
@codemirror/view@6.39.12
@lezer/markdown@1.6.3
```

**Tests Added:** ✅
- `src/components/editor/codemirror/__tests__/setup.test.ts` (9 tests)
- `src/services/__tests__/saveService.test.ts` (6 tests)

**Verification:** ✅
- All 945 tests pass
- TypeScript check passes
- Rust build passes

**How to Test:**
1. Set `useMarkdownEditor: true` in `src/stores/editorStore.ts` line 116
2. Run `bun run tauri dev`
3. Open a markdown file - you'll see raw markdown (expected for Phase 1)
4. Edit and save - verify file on disk matches editor content exactly

**Known Limitations (Phase 1):**
- Raw markdown visible (no WYSIWYG) - hidden syntax added in Phase 2
- Find/Replace disabled for CM6 - added in Phase 7
- Toolbar doesn't work with CM6 - connected in Phase 8
- No placeholder text shown - needs CM6 placeholder extension

---

### Phase 2: Hidden Syntax + Inline Formatting ✅ COMPLETE
**Syntax always hidden (in WYSIWYG), basic formatting works.**

> **Completed:** 2026-02-03

**Created:** ✅
- `codemirror/extensions/hiddenSyntax.ts` - hide all syntax markers + Compartment for toggle ✅
- `codemirror/extensions/autoCloseMarkdown.ts` - IDE-like `*` behavior ✅
- `codemirror/extensions/deleteBehavior.ts` - boundary-safe delete ✅
- `codemirror/commands/formatting.ts` - toggle bold/italic/strikethrough/code/highlight ✅
- `codemirror/utils/formatActive.ts` - detect active format at cursor ✅
- `codemirror/decorations/highlight.ts` - custom `==...==` decoration ✅

**Updated:** ✅
- `codemirror/setup.ts` - integrated Phase 2 extensions ✅
- `codemirror/keymap.ts` - added formatting keyboard shortcuts ✅
- `MarkdownEditor.tsx` - added sourceMode toggle for raw view ✅

**Features:** ✅
- Bold, italic, strikethrough, highlight, inline code formatting
- Atomic ranges prevent cursor from entering hidden syntax
- Auto-close `*`, `_`, `~` when typing (IDE-like behavior)
- Raw view toggle works via sourceMode (shows all syntax)
- Keyboard shortcuts: Cmd+B (bold), Cmd+I (italic), Cmd+E (code), Cmd+Shift+S (strikethrough), Cmd+Shift+H (highlight)
- Boundary-safe delete (backspace/delete markers as unit)

**Tests Added:** ✅
- `hiddenSyntax.test.ts` (20 tests)
- `formatting.test.ts` (21 tests)
- `formatActive.test.ts` (27 tests)
- `highlight.test.ts` (18 tests)
- `autoCloseMarkdown.test.ts` (14 tests)
- `deleteBehavior.test.ts` (17 tests)

**Verification:** ✅
- All 1062 tests pass
- TypeScript check passes
- Rust build passes

**Known Limitations (Phase 2):**
- Toolbar buttons not yet connected to CM6 commands - done in Phase 8
- Headings/lists/blockquotes syntax still visible - done in Phase 3
- Find/Replace not connected - done in Phase 7

---

### Phase 3: Block Structure + Input Rules ✅ COMPLETE
**Headings, lists, blockquotes, horizontal rules with input rules.**

> **Completed:** 2026-02-03 | **Commit:** `cfc40f6`

**Created:** ✅
- `codemirror/decorations/headings.ts` - hide `#`, apply h1-h6 styles, generate unique IDs with github-slugger ✅
- `codemirror/decorations/lists.ts` - bullets, ordered, task checkboxes with widget decorations ✅
- `codemirror/decorations/blockquotes.ts` - hide `>`, apply quote style with nested depth support ✅
- `codemirror/extensions/inputRules.ts` - pattern utilities for future enhancements ✅

**Ported:** ✅
- `HeadingWithId.ts` functionality → `extractHeadingData()` in headings.ts

**Updated:** ✅
- `useDocumentOutline.ts`: Now supports both TipTap (HTML) and CodeMirror (Markdown) modes
- `codemirror/setup.ts`: Integrated Phase 3 extensions with rawMode support
- `codemirror/theme.ts`: Added styles for headings, lists, blockquotes, highlights

**Tests Added:** ✅
- `headings.test.ts` (23 tests) - levels, ID generation, navigation
- `lists.test.ts` (30 tests) - bullets, ordered, tasks, nesting
- `blockquotes.test.ts` (26 tests) - depth tracking, nested quotes
- `inputRules.test.ts` (31 tests) - pattern matching, edge cases

**Verification:** ✅
- All 1172 tests pass
- TypeScript check passes
- Rust build passes

**Features:** ✅
- Headings: Hide # markers, apply level styles, generate unique IDs for navigation
- Lists: Bullet widgets (•), ordered number widgets, task checkboxes (☐/☑)
- Blockquotes: Hide > markers, apply border-left styling, support 5 levels of nesting
- Document outline: Works with both TipTap and CodeMirror editors

**Known Limitations (Phase 3):**
- Horizontal rule decoration not implemented (renders as raw `---`)
- Input rules are passive (markdown syntax works naturally, decorations render WYSIWYG)
- List continuation on Enter not implemented (future enhancement)

---

### Phase 4: Links and Images ✅ COMPLETE
**Regular links, internal `[[]]` with autocomplete, images.**

> **Completed:** 2026-02-03

**Created:** ✅
- `codemirror/decorations/links.ts` - LinkWidget hides `[]()` syntax, shows styled clickable text ✅
- `codemirror/decorations/images.ts` - ImageWidget renders `<img>` with fallback on error ✅
- `codemirror/extensions/internalLinkCompletion.ts` - `[[` triggers file/heading autocomplete ✅

**Updated:** ✅
- `codemirror/setup.ts` - Integrated Phase 4 extensions with rawMode support ✅
- `codemirror/theme.ts` - Added link and image styles with CSS variables ✅
- `MarkdownEditor.tsx` - Added internal link navigation props and hook ✅
- `App.tsx` - Pass link navigation callbacks to MarkdownEditor ✅

**Features:** ✅
- Links: Hide []() markers, show styled text, distinguish internal/external links
- Internal links: `data-internal-link` attribute for click detection, uses existing resolver
- External links: Open in new tab with `rel="noopener noreferrer"`, arrow indicator
- Images: Replace ![alt](src) with rendered image, alt text fallback on error
- Autocomplete: `[[` triggers file suggestions, filtered by query, inserts markdown link

**Tests Added:** ✅
- `links.test.ts` (31 tests) - Link decorations, type detection, atomic ranges
- `images.test.ts` (29 tests) - Image widget rendering, URL handling, edge cases
- `internalLinkCompletion.test.ts` (16 tests) - Trigger detection, filtering, suggestions

**Verification:** ✅
- All 1248 tests pass
- TypeScript check passes
- Rust build passes

**Known Limitations (Phase 4):**
- `[[` autocomplete extension created but not integrated into editor (requires workspace context)
- Autolink (`<url>`) decoration created but not enabled (minor feature)
- Title attribute in images (`![alt](src "title")`) parsed but widget styling minimal

---

### Phase 5: Code Blocks and Mermaid ✅ COMPLETE
**Syntax-highlighted code, mermaid diagrams.**

> **Completed:** 2026-02-03 | **Commit:** `f6b4a1c`

**Created:** ✅
- `codemirror/decorations/codeBlocks.ts` - CodeBlockWidget with Shiki syntax highlighting ✅
- `codemirror/decorations/mermaid.ts` - MermaidWidget with live diagram rendering ✅

**Features:** ✅
- Code blocks: Shiki syntax highlighting (VS Code quality), language badge, copy button
- Mermaid: Rendered SVG diagram, loading/error states, SVG/PNG export buttons
- Mermaid focus: Raw code when cursor inside, rendered diagram when cursor outside
- Theme-aware: Detects dark/light mode from document or system preferences
- Copy button: Copies code/source to clipboard with success feedback
- Lazy-loaded highlighter: Cached for performance, dynamically loads languages

**Dependencies Added:** ✅
```
shiki@3.22.0
```

**Dependencies Removed:** ✅
```
lowlight
hast-util-to-html
```

**Tests Added:** ✅
- `codeBlocks.test.ts` (28 tests) - extraction, decorations, copy, highlighting
- `mermaid.test.ts` (13 tests) - extraction, decorations, rendering, error handling

**Verification:** ✅
- All 1289 tests pass
- TypeScript check passes
- Rust build passes

**Known Limitations (Phase 5):**
- Code block editing requires clicking into widget (atomic range behavior)

---

### Phase 6: Tables
**Full table editing with minimal mutation.**

**Create:**
- `codemirror/tables/parseTable.ts` - parse table with cell ranges + padding
- `codemirror/tables/updateCell.ts` - minimal cell mutation
- `codemirror/widgets/TableWidget.tsx` - editable table UI
- `codemirror/commands/insertTable.ts` - create new table

**Features:**
- Tab/Shift+Tab navigation between cells
- Enter inserts `<br>` newline
- **Edits commit on blur/Tab only** (not on keystroke)
- Preserve original cell padding (`padLeft`, `padRight`)
- Preserve existing `<br>` style per cell (`<br>`, `<br/>`, `<br />`)
- Add/remove rows/columns via UI buttons
- **Never normalize table** outside the edited cell

**Test:** Create table, edit cells, Tab navigation, multiline cells, verify no drift

---

### Phase 7: Search, Replace, Spell Check
**Port remaining features.**

**Create:**
- `codemirror/extensions/search.ts` - use `@codemirror/search`
- `codemirror/extensions/spellCheck.ts` - adapt SymSpell integration

**Update:**
- `FindReplaceBar.tsx` - use CM6 search API
- `SpellCheckContextMenu.tsx` - adapt for CM6 view

**Test:** Cmd+F works, spell errors underlined, suggestions work

---

### Phase 8: Toolbar + Context Menus
**Connect toolbar to CM6, finalize context menus.**

**Update:**
- `EditorToolbar.tsx` - call CM6 commands, use `isFormatActive()`
- `EditorContextMenu.tsx` - adapt for CM6 view
- Keep raw mode toggle button (replaces source mode)
- "Copy as formatted": use `markdownToHtml(selectedMarkdown)`, not editor DOM

**Test:** All toolbar buttons work, active states correct, raw mode toggle works

---

### Phase 9: CSS Migration
**Port styles from TipTap to CodeMirror.**

**Create/Update:**
- New CM6 styles for `.cm-editor`, `.cm-content`
- Semantic classes: `.cm-strong`, `.cm-em`, `.cm-inline-code`, etc.
- Port relevant styles from `editor.css`

**Test:** Visual appearance matches current design

---

### Phase 10: Cleanup
**Remove TipTap, finalize.**

**Delete:**
- `src/components/editor/Editor.tsx`
- `src/components/editor/SourceEditor.tsx`
- `src/components/editor/extensions/*` (all TipTap extensions)
- `src/lib/markdown/htmlToMarkdown.ts`

**Keep:**
- `src/lib/markdown/markdownToHtml.ts` (for export/copy)

**Remove from package.json:**
- All `@tiptap/*` packages
- `turndown`

**Keep:**
- `lowlight` (code highlighting)
- `markdown-it` (for export rendering)

**Rename:**
- `MarkdownEditor.tsx` → `Editor.tsx`
- Remove feature flag

---

## Files Summary

### Created (Phase 1) ✅
```
src/components/editor/
├── MarkdownEditor.tsx              ✅ Phase 1
├── codemirror/
│   ├── setup.ts                    ✅ Phase 1, updated Phase 2
│   ├── theme.ts                    ✅ Phase 1
│   ├── keymap.ts                   ✅ Phase 1 (placeholder), updated Phase 2
│   ├── __tests__/
│   │   └── setup.test.ts           ✅ Phase 1
```

### Created (Phase 2) ✅
```
src/components/editor/codemirror/
│   ├── extensions/
│   │   ├── hiddenSyntax.ts         ✅ Phase 2 - hide syntax + Compartment
│   │   ├── autoCloseMarkdown.ts    ✅ Phase 2 - IDE-like auto-close
│   │   ├── deleteBehavior.ts       ✅ Phase 2 - boundary-safe delete
│   ├── commands/
│   │   └── formatting.ts           ✅ Phase 2 - toggle bold/italic/etc
│   ├── decorations/
│   │   └── highlight.ts            ✅ Phase 2 - custom ==...== decoration
│   ├── utils/
│   │   └── formatActive.ts         ✅ Phase 2 - detect active format
│   ├── __tests__/
│   │   ├── hiddenSyntax.test.ts    ✅ Phase 2 (20 tests)
│   │   ├── formatting.test.ts      ✅ Phase 2 (21 tests)
│   │   ├── formatActive.test.ts    ✅ Phase 2 (27 tests)
│   │   ├── highlight.test.ts       ✅ Phase 2 (18 tests)
│   │   ├── autoCloseMarkdown.test.ts ✅ Phase 2 (14 tests)
│   │   └── deleteBehavior.test.ts  ✅ Phase 2 (17 tests)
```

### Created (Phase 3) ✅
```
src/components/editor/codemirror/
│   ├── extensions/
│   │   └── inputRules.ts           ✅ Phase 3 - pattern utilities
│   ├── decorations/
│   │   ├── headings.ts             ✅ Phase 3 - hide #, apply styles, IDs
│   │   ├── lists.ts                ✅ Phase 3 - bullets, numbers, checkboxes
│   │   └── blockquotes.ts          ✅ Phase 3 - hide >, apply style
│   ├── __tests__/
│   │   ├── headings.test.ts        ✅ Phase 3 (23 tests)
│   │   ├── lists.test.ts           ✅ Phase 3 (30 tests)
│   │   ├── blockquotes.test.ts     ✅ Phase 3 (26 tests)
│   │   └── inputRules.test.ts      ✅ Phase 3 (31 tests)
```

### Created (Phase 4) ✅
```
src/components/editor/codemirror/
│   ├── extensions/
│   │   └── internalLinkCompletion.ts ✅ Phase 4 - [[ autocomplete
│   ├── decorations/
│   │   ├── links.ts                ✅ Phase 4 - hide []() syntax, LinkWidget
│   │   └── images.ts               ✅ Phase 4 - ImageWidget renders <img>
│   ├── __tests__/
│   │   ├── links.test.ts           ✅ Phase 4 (31 tests)
│   │   ├── images.test.ts          ✅ Phase 4 (29 tests)
│   │   └── internalLinkCompletion.test.ts ✅ Phase 4 (16 tests)
```

### Created (Phase 5) ✅
```
src/components/editor/codemirror/
│   ├── decorations/
│   │   ├── codeBlocks.ts           ✅ Phase 5 - Shiki syntax highlighting, CodeBlockWidget
│   │   └── mermaid.ts              ✅ Phase 5 - MermaidWidget with live rendering
│   ├── __tests__/
│   │   ├── codeBlocks.test.ts      ✅ Phase 5 (28 tests)
│   │   └── mermaid.test.ts         ✅ Phase 5 (13 tests)
```

### To Create (Future Phases)
```
src/components/editor/codemirror/
│   ├── extensions/
│   │   ├── search.ts               # Phase 7 - CM6 search integration
│   │   └── spellCheck.ts           # Phase 7 - spell check integration
│   ├── commands/
│   │   └── insertTable.ts          # Phase 6 - table creation
│   ├── tables/
│   │   ├── parseTable.ts           # Phase 6 - parse with cell ranges
│   │   └── updateCell.ts           # Phase 6 - minimal cell mutation
│   ├── widgets/
│   │   └── TableWidget.tsx         # Phase 6 - editable table UI
```

### Modified (Phase 1) ✅
- `src/stores/editorStore.ts` - Added `useMarkdownEditor` flag, updated comments ✅
- `src/stores/tabsStore.ts` - Updated content format comment ✅
- `src/services/saveService.ts` - Skip htmlToMarkdown when flag enabled ✅
- `src/App.tsx` - Conditional editor rendering, skip markdownToHtml when flag enabled ✅

### Modified (Phase 2) ✅
- `src/components/editor/codemirror/setup.ts` - Added Phase 2 extensions, rawMode option ✅
- `src/components/editor/codemirror/keymap.ts` - Added formatting keyboard shortcuts ✅
- `src/components/editor/MarkdownEditor.tsx` - Added sourceMode toggle via toggleRawView ✅

### Modified (Phase 3) ✅
- `src/components/editor/codemirror/setup.ts` - Added Phase 3 decorations, re-exports ✅
- `src/components/editor/codemirror/theme.ts` - Added heading, list, blockquote, highlight styles ✅
- `src/hooks/useDocumentOutline.ts` - Now supports both TipTap (HTML) and CodeMirror (Markdown) ✅

### Modified (Phase 4) ✅
- `src/components/editor/codemirror/setup.ts` - Added linkField, imageField, Phase 4 re-exports ✅
- `src/components/editor/codemirror/theme.ts` - Added link and image styles with CSS variables ✅
- `src/components/editor/MarkdownEditor.tsx` - Added internal link navigation props and hook ✅
- `src/App.tsx` - Pass link navigation callbacks to MarkdownEditor ✅

### Modified (Phase 5) ✅
- `src/components/editor/codemirror/setup.ts` - Added codeBlockField, mermaidField, Phase 5 re-exports ✅
- `src/components/editor/codemirror/theme.ts` - Added code block and mermaid widget styles ✅
- `package.json` - Added shiki, removed lowlight and hast-util-to-html ✅

### To Modify (Future Phases)
- `src/components/editor/EditorToolbar.tsx` - CM6 commands, raw mode toggle
- `src/components/editor/EditorContextMenu.tsx` - copy uses markdownToHtml
- `src/components/search/FindReplaceBar.tsx` - CM6 search

### Delete (Phase 10)
- `src/components/editor/Editor.tsx`
- `src/components/editor/SourceEditor.tsx`
- `src/components/editor/extensions/*`
- `src/lib/markdown/htmlToMarkdown.ts`

---

## Dependencies

### Added (Phase 1) ✅
```json
{
  "@codemirror/autocomplete": "6.20.0",
  "@codemirror/commands": "6.10.1",
  "@codemirror/lang-markdown": "6.5.0",
  "@codemirror/language": "6.12.1",
  "@codemirror/search": "6.6.0",
  "@codemirror/state": "6.5.4",
  "@codemirror/view": "6.39.12",
  "@lezer/markdown": "1.6.3"
}
```

### Added (Phase 5) ✅
```json
{
  "shiki": "3.22.0"
}
```

### Removed (Phase 5) ✅
- `lowlight` - replaced by shiki
- `hast-util-to-html` - no longer needed

### Configure for GFM
```typescript
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
const md = markdown({ extensions: [GFM] });
```

Note: `==highlight==` uses **custom regex-based decoration** (not Lezer).

### Remove (Phase 10)
- `@tiptap/*` (all)
- `turndown`

### Keep
- `shiki` - VS Code quality syntax highlighting (Phase 5)
- `markdown-it` - for export/copy rendering

---

## Verification

### Per-Phase
1. Unit tests for position mapping, decorations, commands
2. Integration tests for toolbar → editor flow
3. Manual: visual inspection, cursor behavior

### End-to-End
1. Open markdown file with all formatting types
2. Verify WYSIWYG display (no syntax visible)
3. Toggle raw mode - verify syntax shows
4. Edit various elements (bold, headings, lists, links, code, tables)
5. Save file
6. **Critical**: Diff saved file against original - only edited regions changed
7. Reload, verify renders correctly
8. Test copy formatted - verify HTML is from markdown, not DOM

### Commands
```bash
bun run test -- --run
bun run typecheck
bun run build
```

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Table editing complexity | MVP first (basic grid), iterate |
| Cursor position bugs | Extensive unit tests |
| CM6 focus glitches with widgets | Commit edits on blur/Tab, not keystroke |
| `==highlight==` not in GFM | Custom regex decoration (defined in plan) |
| Performance large docs | Profile early, virtualize |
| Duplicate heading IDs | Review `generateHeadingId` behavior, fix if needed |

## Rollback
- Feature flag allows instant revert
- TipTap code kept until Phase 10 complete
- Git branches per phase
