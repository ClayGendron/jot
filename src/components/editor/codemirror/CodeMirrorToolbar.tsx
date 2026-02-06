/**
 * CodeMirror Toolbar
 *
 * Formatting toolbar for the CodeMirror editor.
 * Mirrors the TipTap EditorToolbar interface.
 */

import { useCallback, useEffect, useState } from "react";
import type { EditorView } from "@codemirror/view";
import {
  Bold,
  Italic,
  Strikethrough,
  Highlighter,
  Code,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  SquareCode,
  Minus,
  Table,
  Link,
  Image,
  AlignLeft,
} from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import { ThemeStyleDropdown } from "../ThemeStyleDropdown";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Import handlers
import {
  toggleBoldOrEscape,
  toggleItalicOrEscape,
  toggleCodeOrEscape,
  toggleStrikethroughOrEscape,
  toggleHighlightOrEscape,
} from "./handlers/formattingHandlers";
import {
  setHeading1,
  setHeading2,
  setHeading3,
} from "./handlers/headingHandlers";
import { insertTable } from "./handlers/tableHandlers";
import { handleLinkCommand } from "./handlers/linkHandlers";
import {
  toggleBulletList,
  toggleOrderedList,
  toggleTaskList,
  getListInfo,
} from "./handlers/listHandlers";
import { toggleBlockquote, getBlockquoteInfo } from "./handlers/blockquoteHandlers";
import { insertCodeBlock, isCursorInCodeBlock } from "./handlers/codeBlockHandlers";
import { getFormattingContext } from "./handlers/formattingHandlers";
import { HEADING_PREFIX_RE } from "./utils/sharedHelpers";
import { getLinkContext } from "./handlers/linkHandlers";

interface CodeMirrorToolbarProps {
  view: EditorView | null;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  label: string;
  shortcut?: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  label,
  shortcut,
  children,
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          disabled={disabled}
          active={isActive}
          data-testid={`toolbar-${label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        <span>{label}</span>
        {shortcut && (
          <kbd className="ml-2 text-[10px] text-muted-foreground/70 font-mono">
            {shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function ToolbarDivider() {
  return <div className="h-6 w-px mx-2 bg-[var(--color-border)]" />;
}

/**
 * Formatting toolbar for CodeMirror editor
 */
export function CodeMirrorToolbar({ view }: CodeMirrorToolbarProps) {
  const sourceMode = useEditorStore((state) => state.sourceMode);
  const toggleSourceMode = useEditorStore((state) => state.toggleSourceMode);

  // Helper to run a command
  const runCommand = useCallback(
    (handler: (view: EditorView) => boolean) => {
      if (view) {
        handler(view);
        view.focus();
      }
    },
    [view]
  );

  // Text formatting
  const toggleBold = useCallback(
    () => runCommand(toggleBoldOrEscape),
    [runCommand]
  );
  const toggleItalic = useCallback(
    () => runCommand(toggleItalicOrEscape),
    [runCommand]
  );
  const toggleStrike = useCallback(
    () => runCommand(toggleStrikethroughOrEscape),
    [runCommand]
  );
  const toggleHighlight = useCallback(
    () => runCommand(toggleHighlightOrEscape),
    [runCommand]
  );
  const toggleCode = useCallback(
    () => runCommand(toggleCodeOrEscape),
    [runCommand]
  );

  // Headings
  const handleSetHeading1 = useCallback(
    () => runCommand(setHeading1),
    [runCommand]
  );
  const handleSetHeading2 = useCallback(
    () => runCommand(setHeading2),
    [runCommand]
  );
  const handleSetHeading3 = useCallback(
    () => runCommand(setHeading3),
    [runCommand]
  );
  const handleSetParagraph = useCallback(() => {
    if (view) {
      // Remove heading prefix from current line
      const { state } = view;
      const pos = state.selection.main.head;
      const line = state.doc.lineAt(pos);
      const match = line.text.match(/^(#{1,6})\s+/);
      if (match) {
        view.dispatch({
          changes: { from: line.from, to: line.from + match[0].length, insert: "" },
        });
      }
      view.focus();
    }
  }, [view]);

  // Lists
  const handleToggleBulletList = useCallback(
    () => runCommand(toggleBulletList),
    [runCommand]
  );
  const handleToggleOrderedList = useCallback(
    () => runCommand(toggleOrderedList),
    [runCommand]
  );
  const handleToggleTaskList = useCallback(
    () => runCommand(toggleTaskList),
    [runCommand]
  );

  // Blocks
  const handleToggleBlockquote = useCallback(
    () => runCommand(toggleBlockquote),
    [runCommand]
  );
  const handleToggleCodeBlock = useCallback(
    () => runCommand(insertCodeBlock),
    [runCommand]
  );

  const handleInsertHorizontalRule = useCallback(() => {
    if (view) {
      // Insert --- on a new line
      const pos = view.state.selection.main.head;
      const line = view.state.doc.lineAt(pos);
      const insert = line.text.trim() === "" ? "---\n" : "\n---\n";
      view.dispatch({
        changes: { from: line.to, insert },
        selection: { anchor: line.to + insert.length },
      });
      view.focus();
    }
  }, [view]);

  // Table
  const handleInsertTable = useCallback(
    () => runCommand(insertTable),
    [runCommand]
  );

  // Link
  const handleSetLink = useCallback(
    () => runCommand(handleLinkCommand),
    [runCommand]
  );

  // Image (placeholder)
  const handleInsertImage = useCallback(() => {
    const url = window.prompt("Image URL");
    if (url && view) {
      const pos = view.state.selection.main.head;
      view.dispatch({
        changes: { from: pos, insert: `![](${url})` },
        selection: { anchor: pos + 2 },
      });
      view.focus();
    }
  }, [view]);

  // Active state tracking
  const [activeStates, setActiveStates] = useState({
    bold: false,
    italic: false,
    strike: false,
    highlight: false,
    code: false,
    heading: 0 as 0 | 1 | 2 | 3,
    bulletList: false,
    orderedList: false,
    taskList: false,
    blockquote: false,
    codeBlock: false,
    link: false,
  });

  // Update active states when view state changes
  useEffect(() => {
    if (!view) return;

    const updateActiveStates = () => {
      const state = view.state;
      const pos = state.selection.main.head;
      const line = state.doc.lineAt(pos);

      // Get formatting context for inline formatting
      const formattingCtx = getFormattingContext(state);

      // Check heading prefix
      const headingMatch = line.text.match(HEADING_PREFIX_RE);
      const headingLevel = headingMatch ? Math.min(headingMatch[1].length, 3) as 0 | 1 | 2 | 3 : 0;

      // Check list info
      const listInfo = getListInfo(line);

      // Check blockquote info
      const blockquoteInfo = getBlockquoteInfo(line);

      // Check code block
      const inCodeBlock = isCursorInCodeBlock(view);

      // Check link
      const linkCtx = getLinkContext(state);

      setActiveStates({
        bold: formattingCtx?.type === "strong",
        italic: formattingCtx?.type === "emphasis",
        strike: formattingCtx?.type === "strikethrough",
        highlight: formattingCtx?.type === "highlight",
        code: formattingCtx?.type === "code",
        heading: headingLevel,
        bulletList: listInfo !== null && !listInfo.isOrdered && !listInfo.isTask,
        orderedList: listInfo !== null && listInfo.isOrdered && !listInfo.isTask,
        taskList: listInfo !== null && listInfo.isTask,
        blockquote: blockquoteInfo !== null,
        codeBlock: inCodeBlock,
        link: linkCtx !== null,
      });
    };

    // Initial update
    updateActiveStates();

    // Subscribe to view updates
    view.dom.addEventListener("keyup", updateActiveStates);
    view.dom.addEventListener("mouseup", updateActiveStates);

    // Also listen to selection changes
    const observer = new MutationObserver(updateActiveStates);
    observer.observe(view.dom, { characterData: true, subtree: true });

    return () => {
      view.dom.removeEventListener("keyup", updateActiveStates);
      view.dom.removeEventListener("mouseup", updateActiveStates);
      observer.disconnect();
    };
  }, [view]);

  // Destructure for cleaner usage
  const isBoldActive = activeStates.bold;
  const isItalicActive = activeStates.italic;
  const isStrikeActive = activeStates.strike;
  const isHighlightActive = activeStates.highlight;
  const isCodeActive = activeStates.code;
  const isParagraphActive = activeStates.heading === 0;
  const isH1Active = activeStates.heading === 1;
  const isH2Active = activeStates.heading === 2;
  const isH3Active = activeStates.heading === 3;
  const isBulletListActive = activeStates.bulletList;
  const isOrderedListActive = activeStates.orderedList;
  const isTaskListActive = activeStates.taskList;
  const isBlockquoteActive = activeStates.blockquote;
  const isCodeBlockActive = activeStates.codeBlock;
  const isLinkActive = activeStates.link;

  const disabled = !view || sourceMode;

  return (
    <div
      className="sticky top-0 z-[100] flex items-center gap-1 px-4 py-2 bg-[var(--color-paper)] border-b border-[var(--color-border)] transition-all duration-200"
      data-testid="editor-toolbar"
    >
      {/* Text Formatting */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={toggleBold}
          isActive={isBoldActive}
          label="Bold"
          shortcut="⌘B"
          disabled={disabled}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleItalic}
          isActive={isItalicActive}
          label="Italic"
          shortcut="⌘I"
          disabled={disabled}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleStrike}
          isActive={isStrikeActive}
          label="Strikethrough"
          shortcut="⌘⇧S"
          disabled={disabled}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleHighlight}
          isActive={isHighlightActive}
          label="Highlight"
          shortcut="⌘⇧H"
          disabled={disabled}
        >
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleCode}
          isActive={isCodeActive}
          label="Inline Code"
          shortcut="⌘E"
          disabled={disabled}
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Headings */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={handleSetParagraph}
          isActive={isParagraphActive}
          label="Paragraph"
          shortcut="⌘⌥0"
          disabled={disabled}
        >
          P
        </ToolbarButton>
        <ToolbarButton
          onClick={handleSetHeading1}
          isActive={isH1Active}
          label="Heading 1"
          shortcut="⌘⌥1"
          disabled={disabled}
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          onClick={handleSetHeading2}
          isActive={isH2Active}
          label="Heading 2"
          shortcut="⌘⌥2"
          disabled={disabled}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={handleSetHeading3}
          isActive={isH3Active}
          label="Heading 3"
          shortcut="⌘⌥3"
          disabled={disabled}
        >
          H3
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Lists */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={handleToggleBulletList}
          isActive={isBulletListActive}
          label="Bullet List"
          shortcut="⌘⇧8"
          disabled={disabled}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleToggleOrderedList}
          isActive={isOrderedListActive}
          label="Numbered List"
          shortcut="⌘⇧7"
          disabled={disabled}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleToggleTaskList}
          isActive={isTaskListActive}
          label="Task List"
          shortcut="⌘⇧9"
          disabled={disabled}
        >
          <ListTodo className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Blocks */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={handleToggleBlockquote}
          isActive={isBlockquoteActive}
          label="Quote"
          shortcut="⌘⇧B"
          disabled={disabled}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleToggleCodeBlock}
          isActive={isCodeBlockActive}
          label="Code Block"
          shortcut="⌘⌥C"
          disabled={disabled}
        >
          <SquareCode className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleInsertHorizontalRule}
          label="Horizontal Rule"
          disabled={disabled}
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleInsertTable}
          label="Insert Table"
          disabled={disabled}
        >
          <Table className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Insert */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={handleSetLink}
          isActive={isLinkActive}
          label="Link"
          shortcut="⌘K"
          disabled={disabled}
        >
          <Link className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleInsertImage}
          label="Image"
          disabled={disabled}
        >
          <Image className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* View Mode Toggle */}
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSourceMode}
              active={sourceMode}
              data-testid="view-mode-toggle"
            >
              {sourceMode ? (
                <AlignLeft className="size-3.5" />
              ) : (
                <Code className="size-3.5" />
              )}
              <span className="text-xs font-medium">
                {sourceMode ? "WYSIWYG" : "Source"}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            <span>{sourceMode ? "Switch to WYSIWYG" : "Switch to Source"}</span>
            <kbd className="ml-2 text-[10px] text-muted-foreground/70 font-mono">
              ⌘/
            </kbd>
          </TooltipContent>
        </Tooltip>
      </div>

      <ToolbarDivider />

      {/* Theme & Style */}
      <div className="flex items-center gap-0.5">
        <ThemeStyleDropdown />
      </div>
    </div>
  );
}

export default CodeMirrorToolbar;
