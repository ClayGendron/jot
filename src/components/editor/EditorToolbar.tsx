import { type Editor } from "@tiptap/react";
import { useCallback } from "react";
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
import { ThemeStyleDropdown } from "./ThemeStyleDropdown";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EditorToolbarProps {
  editor: Editor;
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
 * Formatting toolbar for the editor
 *
 * Groups:
 * - Text styles: Bold, Italic, Strikethrough, Highlight, Code
 * - Headings: H1-H6 dropdown
 * - Lists: Bullet, Numbered, Task
 * - Blocks: Quote, Code block, Table, Horizontal rule
 * - Insert: Link, Image
 */
export function EditorToolbar({ editor }: EditorToolbarProps) {
  // Use individual selectors to avoid React 19 + Zustand issues
  const sourceMode = useEditorStore((state) => state.sourceMode);
  const toggleSourceMode = useEditorStore((state) => state.toggleSourceMode);

  // Text formatting
  const toggleBold = useCallback(
    () => editor.chain().focus().toggleBold().run(),
    [editor]
  );

  const toggleItalic = useCallback(
    () => editor.chain().focus().toggleItalic().run(),
    [editor]
  );

  const toggleStrike = useCallback(
    () => editor.chain().focus().toggleStrike().run(),
    [editor]
  );

  const toggleHighlight = useCallback(
    () => editor.chain().focus().toggleHighlight().run(),
    [editor]
  );

  const toggleCode = useCallback(
    () => editor.chain().focus().toggleCode().run(),
    [editor]
  );

  // Headings
  const setHeading = useCallback(
    (level: 1 | 2 | 3 | 4 | 5 | 6) =>
      editor.chain().focus().toggleHeading({ level }).run(),
    [editor]
  );

  const setParagraph = useCallback(
    () => editor.chain().focus().setParagraph().run(),
    [editor]
  );

  // Lists
  const toggleBulletList = useCallback(
    () => editor.chain().focus().toggleBulletList().run(),
    [editor]
  );

  const toggleOrderedList = useCallback(
    () => editor.chain().focus().toggleOrderedList().run(),
    [editor]
  );

  const toggleTaskList = useCallback(
    () => editor.chain().focus().toggleTaskList().run(),
    [editor]
  );

  // Blocks
  const toggleBlockquote = useCallback(
    () => editor.chain().focus().toggleBlockquote().run(),
    [editor]
  );

  const toggleCodeBlock = useCallback(
    () => editor.chain().focus().toggleCodeBlock().run(),
    [editor]
  );

  const insertHorizontalRule = useCallback(
    () => editor.chain().focus().setHorizontalRule().run(),
    [editor]
  );

  // Table
  const insertTable = useCallback(
    () =>
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
    [editor]
  );

  // Link
  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    if (url === null) return;

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  // Image
  const insertImage = useCallback(() => {
    const url = window.prompt("Image URL");

    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  return (
    <div
      className="sticky top-0 z-[100] flex items-center gap-1 px-4 py-2 bg-[var(--color-paper)] border-b border-[var(--color-border)] transition-all duration-200"
      data-testid="editor-toolbar"
    >
      {/* Text Formatting */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={toggleBold}
          isActive={editor.isActive("bold")}
          label="Bold"
          shortcut="⌘B"
          disabled={sourceMode}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleItalic}
          isActive={editor.isActive("italic")}
          label="Italic"
          shortcut="⌘I"
          disabled={sourceMode}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleStrike}
          isActive={editor.isActive("strike")}
          label="Strikethrough"
          shortcut="⌘⇧S"
          disabled={sourceMode}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleHighlight}
          isActive={editor.isActive("highlight")}
          label="Highlight"
          shortcut="⌘⇧H"
          disabled={sourceMode}
        >
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleCode}
          isActive={editor.isActive("code")}
          label="Inline Code"
          shortcut="⌘E"
          disabled={sourceMode}
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Headings */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={setParagraph}
          isActive={editor.isActive("paragraph")}
          label="Paragraph"
          shortcut="⌘⌥0"
          disabled={sourceMode}
        >
          P
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setHeading(1)}
          isActive={editor.isActive("heading", { level: 1 })}
          label="Heading 1"
          shortcut="⌘⌥1"
          disabled={sourceMode}
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setHeading(2)}
          isActive={editor.isActive("heading", { level: 2 })}
          label="Heading 2"
          shortcut="⌘⌥2"
          disabled={sourceMode}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setHeading(3)}
          isActive={editor.isActive("heading", { level: 3 })}
          label="Heading 3"
          shortcut="⌘⌥3"
          disabled={sourceMode}
        >
          H3
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Lists */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={toggleBulletList}
          isActive={editor.isActive("bulletList")}
          label="Bullet List"
          shortcut="⌘⇧8"
          disabled={sourceMode}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleOrderedList}
          isActive={editor.isActive("orderedList")}
          label="Numbered List"
          shortcut="⌘⇧7"
          disabled={sourceMode}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleTaskList}
          isActive={editor.isActive("taskList")}
          label="Task List"
          shortcut="⌘⇧9"
          disabled={sourceMode}
        >
          <ListTodo className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Blocks */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={toggleBlockquote}
          isActive={editor.isActive("blockquote")}
          label="Quote"
          shortcut="⌘⇧B"
          disabled={sourceMode}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleCodeBlock}
          isActive={editor.isActive("codeBlock")}
          label="Code Block"
          shortcut="⌘⌥C"
          disabled={sourceMode}
        >
          <SquareCode className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={insertHorizontalRule}
          label="Horizontal Rule"
          disabled={sourceMode}
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={insertTable}
          label="Insert Table"
          disabled={sourceMode}
        >
          <Table className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Insert */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={setLink}
          isActive={editor.isActive("link")}
          label="Link"
          shortcut="⌘K"
          disabled={sourceMode}
        >
          <Link className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={insertImage}
          label="Image"
          disabled={sourceMode}
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
              {sourceMode ? <AlignLeft className="size-3.5" /> : <Code className="size-3.5" />}
              <span className="text-xs font-medium">{sourceMode ? "WYSIWYG" : "Source"}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            <span>{sourceMode ? "Switch to WYSIWYG" : "Switch to Source"}</span>
            <kbd className="ml-2 text-[10px] text-muted-foreground/70 font-mono">⌘/</kbd>
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

export default EditorToolbar;
