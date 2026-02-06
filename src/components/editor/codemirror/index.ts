/**
 * CodeMirror Editor Module
 *
 * Public API for the CodeMirror-based WYSIWYG markdown editor.
 */

// Main components
export { CodeMirrorEditor, type CodeMirrorEditorProps, type CodeMirrorEditorRef } from "./CodeMirrorEditor";
export { CodeMirrorToolbar } from "./CodeMirrorToolbar";

// Extensions
export { createWysiwygExtensions, historyCompartment } from "./extensions";
export {
  hiddenRangesField,
  getHiddenRanges,
  type HiddenRange,
  type HiddenRangeKind,
} from "./extensions/hiddenRanges";
export { hiddenSyntaxField } from "./extensions/hiddenSyntax";
export { selectionSnapper } from "./extensions/selectionSnapper";
export { styleField, codeHighlightStyle } from "./extensions/styleDecorations";
export { formattingInputHandler, clearPendingEscape } from "./extensions/inputHandler";
export { formattingEscapeKeymap, defaultKeymapWithHistory } from "./extensions/keymap";
export { theme } from "./extensions/theme";
export { HighlightExtension } from "./extensions/lezerExtensions";
export {
  createSpellcheckExtension,
  spellcheckField,
  setSpellcheckEnabledCmd,
  refreshSpellcheck,
  subscribeSpellcheckContextMenu,
  closeSpellcheckContextMenu,
  getSpellcheckContextMenuState,
  handleSpellcheckSuggestion,
  handleAddToPersonalDictionary,
  handleIgnoreWord,
  type SpellcheckConfig,
} from "./extensions/spellcheck";

// Handlers
export {
  toggleBoldOrEscape,
  toggleItalicOrEscape,
  toggleCodeOrEscape,
  toggleStrikethroughOrEscape,
  toggleHighlightOrEscape,
  getFormattingContext,
  escapeFormatting,
} from "./handlers/formattingHandlers";
export {
  setHeadingLevel,
  setHeading1,
  setHeading2,
  setHeading3,
  setHeading4,
  setHeading5,
  setHeading6,
  handleBackspaceAtHeadingStart,
} from "./handlers/headingHandlers";
export {
  handleEnterInList,
  handleBackspaceInList,
  handleTabInList,
  handleShiftTabInList,
  getListInfo,
  toggleBulletList,
  toggleOrderedList,
  toggleTaskList,
} from "./handlers/listHandlers";
export {
  handleEnterInBlockquote,
  handleBackspaceInBlockquote,
  getBlockquoteInfo,
  toggleBlockquote,
} from "./handlers/blockquoteHandlers";
export {
  isCursorInCodeBlock,
  insertCodeBlock,
} from "./handlers/codeBlockHandlers";
export {
  insertTable,
  isCursorInTable,
  handleTabInTable,
  handleShiftTabInTable,
  handleEnterInTable,
  handleArrowUpInTable,
  handleArrowDownInTable,
  handleEscapeInTable,
  addTableRow,
  removeTableRow,
  addTableColumn,
  removeTableColumn,
} from "./handlers/tableHandlers";
export {
  handleLinkCommand,
  getLinkContext,
  openLinkEditor,
  closeLinkEditor,
  applyLink,
  removeLink,
  subscribeLinkEditor,
  openLinkContextMenu,
  closeLinkContextMenu,
  handleContextMenuEditLink,
  handleContextMenuRemoveLink,
  handleContextMenuCopyLink,
  handleContextMenuOpenLink,
  subscribeLinkContextMenu,
} from "./handlers/linkHandlers";

// Parsers
export {
  parseTableFromAST,
  getCurrentTableInfo,
  generateTableMarkdown,
  getAllTableCells,
  extractCellPositions,
  parseAlignments,
  type TableInfo,
  type TableCellInfo,
} from "./parsers/tableParser";

// Utilities
export {
  WidgetEventManager,
  createManagedHandler,
  readAnchorFromDOM,
  captureFocus,
  restoreFocus,
  type ManagedWidgetConfig,
  type ManagedEventContext,
  type FocusState,
} from "./utils/managedWidget";
export {
  findFormattingByAST,
  findAllFormattingOfTypeInRange,
  findContainingFormattingOfType,
  isEntireSelectionFormatted,
  stripMarkersOfType,
  findLinkByRegex,
  collectCodeBlockExtents,
  codeBlockExtentsField,
  isInCodeBlock,
  collectTableExtents,
  isInTable,
  HEADING_PREFIX_RE,
  FORMATTING_NODE_TYPES,
  ZWSP,
  type FormattingContext,
  type LinkContext,
} from "./utils/sharedHelpers";
