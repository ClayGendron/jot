/**
 * Keymap
 *
 * Aggregated keybindings for the WYSIWYG editor.
 * Combines all handler functions into a single keymap.
 */

import { keymap, type KeyBinding } from "@codemirror/view";
import { defaultKeymap, historyKeymap } from "@codemirror/commands";

// Formatting handlers
import {
  toggleBoldOrEscape,
  toggleItalicOrEscape,
  toggleCodeOrEscape,
  toggleStrikethroughOrEscape,
  toggleHighlightOrEscape,
  escapeFormatting,
  handleBackspaceAtClosingMarker,
  handleBackspaceAfterLink,
  handleBackspaceAtLinkTextStart,
  handleDeleteAtLinkTextEnd,
  handleDeleteEmptyFormatting,
  handleDeleteWithSelection,
  handleDeleteAtOpeningMarker,
  handleDeleteAtEndOfContent,
} from "../handlers/formattingHandlers";

// List handlers
import {
  handleBackspaceInList,
  handleTabInList,
  handleShiftTabInList,
  toggleTaskCheckboxOnLine,
} from "../handlers/listHandlers";

// Blockquote handlers
import { handleBackspaceInBlockquote } from "../handlers/blockquoteHandlers";

// Heading handlers
import {
  setHeading1,
  setHeading2,
  setHeading3,
  setHeading4,
  setHeading5,
  setHeading6,
  handleBackspaceAtHeadingStart,
} from "../handlers/headingHandlers";

// Table handlers
import {
  handleTabInTable,
  handleShiftTabInTable,
  handleEnterInTable,
  handleArrowUpInTable,
  handleArrowDownInTable,
  handleEscapeInTable,
  isCursorInTable,
  insertTable,
} from "../handlers/tableHandlers";

// Code block handlers
import {
  bypassInCodeBlock,
  isCursorInCodeBlock,
  handleBackspaceAfterCodeBlock,
  handleDeleteBeforeCodeBlock,
  handleTabInCodeBlock,
  handleShiftTabInCodeBlock,
} from "../handlers/codeBlockHandlers";

// Paragraph handlers
import {
  handleEnter,
  handleShiftEnter,
  handleBackspaceAfterHorizontalRule,
  handleDeleteBeforeHorizontalRule,
  handleDeleteAtEndOfLine,
  handleBackspaceAtParagraphStart,
} from "../handlers/paragraphHandlers";

// Link handlers
import { handleLinkCommand } from "../handlers/linkHandlers";

// ===========================================
// KEYMAP BINDINGS
// ===========================================

/**
 * Create keymap for formatting and editing commands.
 *
 * Key binding priorities:
 * - Backspace: code blocks → HR → lists → blockquotes → paragraphs → headings → empty formatting → selection → links → closing markers
 * - Delete: code blocks → HR → end of line → empty formatting → selection → links → opening markers → end of content
 */
const formattingEscapeBindings: KeyBinding[] = [
  // Backspace: handle code blocks, HR, lists, blockquotes, paragraph merging, headings, empty formatting, selection, links, then skip over invisible closing markers
  {
    key: "Backspace",
    run: bypassInCodeBlock((view) =>
      handleBackspaceAfterCodeBlock(view) ||
      handleBackspaceAfterHorizontalRule(view) ||
      handleBackspaceInList(view) ||
      handleBackspaceInBlockquote(view) ||
      handleBackspaceAtParagraphStart(view) ||
      handleBackspaceAtHeadingStart(view) ||
      handleDeleteEmptyFormatting(view) ||
      handleDeleteWithSelection(view) ||
      handleBackspaceAfterLink(view) ||
      handleBackspaceAtLinkTextStart(view) ||
      handleBackspaceAtClosingMarker(view)
    ),
  },
  // Delete: handle code blocks, HR, end of line (merge with content below), empty formatting, selection, links, then skip over invisible markers
  {
    key: "Delete",
    run: bypassInCodeBlock((view) =>
      handleDeleteBeforeCodeBlock(view) ||
      handleDeleteBeforeHorizontalRule(view) ||
      handleDeleteAtEndOfLine(view) ||
      handleDeleteEmptyFormatting(view) ||
      handleDeleteWithSelection(view) ||
      handleDeleteAtLinkTextEnd(view) ||
      handleDeleteAtOpeningMarker(view) ||
      handleDeleteAtEndOfContent(view)
    ),
  },
  // Arrow Right/Left: navigation handled by selectionSnapper transaction filter
  // Cmd+B: toggle bold or escape
  {
    key: "Mod-b",
    run: bypassInCodeBlock(toggleBoldOrEscape),
  },
  // Cmd+I: toggle italic or escape
  {
    key: "Mod-i",
    run: bypassInCodeBlock(toggleItalicOrEscape),
  },
  // Cmd+K: create or edit link
  {
    key: "Mod-k",
    run: bypassInCodeBlock(handleLinkCommand),
  },
  // Cmd+`: toggle inline code or escape
  {
    key: "Mod-`",
    run: bypassInCodeBlock(toggleCodeOrEscape),
  },
  // Cmd+Shift+S: toggle strikethrough or escape
  {
    key: "Mod-Shift-s",
    run: bypassInCodeBlock(toggleStrikethroughOrEscape),
  },
  // Cmd+Shift+H: toggle highlight or escape
  {
    key: "Mod-Shift-h",
    run: bypassInCodeBlock(toggleHighlightOrEscape),
  },
  // Cmd+T: insert table
  {
    key: "Mod-t",
    run: (view) => isCursorInCodeBlock(view) || isCursorInTable(view) ? false : insertTable(view),
  },
  // Cmd+1-6: set heading level
  {
    key: "Mod-1",
    run: bypassInCodeBlock(setHeading1),
  },
  {
    key: "Mod-2",
    run: bypassInCodeBlock(setHeading2),
  },
  {
    key: "Mod-3",
    run: bypassInCodeBlock(setHeading3),
  },
  {
    key: "Mod-4",
    run: bypassInCodeBlock(setHeading4),
  },
  {
    key: "Mod-5",
    run: bypassInCodeBlock(setHeading5),
  },
  {
    key: "Mod-6",
    run: bypassInCodeBlock(setHeading6),
  },
  // Tab: table navigation, indent list, or escape formatting
  {
    key: "Tab",
    run: (view) => handleTabInTable(view) || handleTabInCodeBlock(view) || handleTabInList(view) || escapeFormatting(view),
  },
  // Shift+Tab: table navigation or outdent list
  {
    key: "Shift-Tab",
    run: (view) => handleShiftTabInTable(view) || handleShiftTabInCodeBlock(view) || handleShiftTabInList(view),
  },
  // Enter: table navigation, then new paragraph (double newline for proper markdown)
  {
    key: "Enter",
    run: (view) => handleEnterInTable(view) || bypassInCodeBlock(handleEnter)(view),
  },
  // Shift+Enter: soft line break (single newline, same paragraph)
  {
    key: "Shift-Enter",
    run: bypassInCodeBlock(handleShiftEnter),
  },
  // Mod+Enter: toggle task checkbox on current line
  {
    key: "Mod-Enter",
    run: bypassInCodeBlock(toggleTaskCheckboxOnLine),
  },
  // Arrow Up: table navigation (column-wise), then default
  {
    key: "ArrowUp",
    run: handleArrowUpInTable,
  },
  // Arrow Down: table navigation (column-wise), then default
  {
    key: "ArrowDown",
    run: handleArrowDownInTable,
  },
  // Escape: exit table
  {
    key: "Escape",
    run: handleEscapeInTable,
  },
];

/**
 * Keymap extension for the WYSIWYG editor
 */
export const formattingEscapeKeymap = keymap.of(formattingEscapeBindings);

/**
 * Default keymap with history (undo/redo)
 */
export const defaultKeymapWithHistory = keymap.of([...defaultKeymap, ...historyKeymap]);
