/**
 * CodeMirror Toolbar
 *
 * Formatting toolbar for the CodeMirror editor.
 * Mirrors the TipTap EditorToolbar interface.
 */

import { useCallback } from "react";
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

// Import list/block handlers (these will be implemented)
// For now, we'll use placeholder implementations

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

  // Lists - placeholder handlers (Phase 2 of toolbar implementation)
  // These buttons are present but do not modify the document yet.
  // Implementation requires: toggle list at cursor position, convert paragraph to list item
  const toggleBulletList = useCallback(() => {
    // TODO(Phase 2): Implement toggleBulletList in listHandlers.ts
    // Should toggle bullet list marker on current line(s)
  }, []);

  const toggleOrderedList = useCallback(() => {
    // TODO(Phase 2): Implement toggleOrderedList in listHandlers.ts
    // Should toggle ordered list marker on current line(s)
  }, []);

  const toggleTaskList = useCallback(() => {
    // TODO(Phase 2): Implement toggleTaskList in listHandlers.ts
    // Should toggle task list checkbox on current line(s)
  }, []);

  // Blocks - placeholder handlers (Phase 2 of toolbar implementation)
  const toggleBlockquote = useCallback(() => {
    // TODO(Phase 2): Implement toggleBlockquote in blockquoteHandlers.ts
    // Should toggle blockquote prefix on current line(s)
  }, []);

  const toggleCodeBlock = useCallback(() => {
    // TODO(Phase 2): Implement toggleCodeBlock in codeBlockHandlers.ts
    // Should wrap selection in code fence or insert empty code block
  }, []);

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

  // Check active states (simplified for now)
  // TODO: Implement proper active state detection from AST
  const isBoldActive = false;
  const isItalicActive = false;
  const isStrikeActive = false;
  const isHighlightActive = false;
  const isCodeActive = false;
  const isParagraphActive = true;
  const isH1Active = false;
  const isH2Active = false;
  const isH3Active = false;
  const isBulletListActive = false;
  const isOrderedListActive = false;
  const isTaskListActive = false;
  const isBlockquoteActive = false;
  const isCodeBlockActive = false;
  const isLinkActive = false;

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
          onClick={toggleBulletList}
          isActive={isBulletListActive}
          label="Bullet List"
          shortcut="⌘⇧8"
          disabled={disabled}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleOrderedList}
          isActive={isOrderedListActive}
          label="Numbered List"
          shortcut="⌘⇧7"
          disabled={disabled}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleTaskList}
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
          onClick={toggleBlockquote}
          isActive={isBlockquoteActive}
          label="Quote"
          shortcut="⌘⇧B"
          disabled={disabled}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleCodeBlock}
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
