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

interface EditorToolbarProps {
  editor: Editor;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      title={title}
      active={isActive}
      data-testid={`toolbar-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {children}
    </Button>
  );
}

function ToolbarDivider() {
  return <div className="h-6 w-px mx-2 bg-border" />;
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
    <div className="toolbar" data-testid="editor-toolbar">
      {/* Text Formatting */}
      <div className="toolbar-group">
        <ToolbarButton
          onClick={toggleBold}
          isActive={editor.isActive("bold")}
          title="Bold"
          disabled={sourceMode}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleItalic}
          isActive={editor.isActive("italic")}
          title="Italic"
          disabled={sourceMode}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleStrike}
          isActive={editor.isActive("strike")}
          title="Strikethrough"
          disabled={sourceMode}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleHighlight}
          isActive={editor.isActive("highlight")}
          title="Highlight"
          disabled={sourceMode}
        >
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleCode}
          isActive={editor.isActive("code")}
          title="Inline Code"
          disabled={sourceMode}
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Headings */}
      <div className="toolbar-group">
        <ToolbarButton
          onClick={setParagraph}
          isActive={editor.isActive("paragraph")}
          title="Paragraph"
          disabled={sourceMode}
        >
          P
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setHeading(1)}
          isActive={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
          disabled={sourceMode}
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setHeading(2)}
          isActive={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
          disabled={sourceMode}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setHeading(3)}
          isActive={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
          disabled={sourceMode}
        >
          H3
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Lists */}
      <div className="toolbar-group">
        <ToolbarButton
          onClick={toggleBulletList}
          isActive={editor.isActive("bulletList")}
          title="Bullet List"
          disabled={sourceMode}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleOrderedList}
          isActive={editor.isActive("orderedList")}
          title="Numbered List"
          disabled={sourceMode}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleTaskList}
          isActive={editor.isActive("taskList")}
          title="Task List"
          disabled={sourceMode}
        >
          <ListTodo className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Blocks */}
      <div className="toolbar-group">
        <ToolbarButton
          onClick={toggleBlockquote}
          isActive={editor.isActive("blockquote")}
          title="Quote"
          disabled={sourceMode}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleCodeBlock}
          isActive={editor.isActive("codeBlock")}
          title="Code Block"
          disabled={sourceMode}
        >
          <SquareCode className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={insertHorizontalRule} title="Horizontal Rule" disabled={sourceMode}>
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={insertTable} title="Insert Table" disabled={sourceMode}>
          <Table className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Insert */}
      <div className="toolbar-group">
        <ToolbarButton
          onClick={setLink}
          isActive={editor.isActive("link")}
          title="Link"
          disabled={sourceMode}
        >
          <Link className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={insertImage} title="Image" disabled={sourceMode}>
          <Image className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* View Mode Toggle */}
      <div className="toolbar-group">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleSourceMode}
          title={sourceMode ? "Switch to WYSIWYG (⌘/)" : "Switch to Source (⌘/)"}
          active={sourceMode}
          data-testid="view-mode-toggle"
        >
          {sourceMode ? <AlignLeft className="size-3.5" /> : <Code className="size-3.5" />}
          <span className="text-xs font-medium">{sourceMode ? "WYSIWYG" : "Source"}</span>
        </Button>
      </div>

      <ToolbarDivider />

      {/* Theme & Style */}
      <div className="toolbar-group">
        <ThemeStyleDropdown />
      </div>
    </div>
  );
}

export default EditorToolbar;
