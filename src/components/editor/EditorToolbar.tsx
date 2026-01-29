import { type Editor } from "@tiptap/react";
import { useCallback } from "react";
import { useEditorStore } from "@/stores/editorStore";

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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`toolbar-button ${isActive ? "is-active" : ""}`}
      data-testid={`toolbar-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="toolbar-divider" />;
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
          <BoldIcon />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleItalic}
          isActive={editor.isActive("italic")}
          title="Italic"
          disabled={sourceMode}
        >
          <ItalicIcon />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleStrike}
          isActive={editor.isActive("strike")}
          title="Strikethrough"
          disabled={sourceMode}
        >
          <StrikeIcon />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleHighlight}
          isActive={editor.isActive("highlight")}
          title="Highlight"
          disabled={sourceMode}
        >
          <HighlightIcon />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleCode}
          isActive={editor.isActive("code")}
          title="Inline Code"
          disabled={sourceMode}
        >
          <CodeIcon />
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
          <BulletListIcon />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleOrderedList}
          isActive={editor.isActive("orderedList")}
          title="Numbered List"
          disabled={sourceMode}
        >
          <OrderedListIcon />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleTaskList}
          isActive={editor.isActive("taskList")}
          title="Task List"
          disabled={sourceMode}
        >
          <TaskListIcon />
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
          <QuoteIcon />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleCodeBlock}
          isActive={editor.isActive("codeBlock")}
          title="Code Block"
          disabled={sourceMode}
        >
          <CodeBlockIcon />
        </ToolbarButton>
        <ToolbarButton onClick={insertHorizontalRule} title="Horizontal Rule" disabled={sourceMode}>
          <HorizontalRuleIcon />
        </ToolbarButton>
        <ToolbarButton onClick={insertTable} title="Insert Table" disabled={sourceMode}>
          <TableIcon />
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
          <LinkIcon />
        </ToolbarButton>
        <ToolbarButton onClick={insertImage} title="Image" disabled={sourceMode}>
          <ImageIcon />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* View Mode Toggle */}
      <div className="toolbar-group">
        <button
          type="button"
          onClick={toggleSourceMode}
          title={sourceMode ? "Switch to WYSIWYG (⌘/)" : "Switch to Source (⌘/)"}
          className={`view-toggle-btn ${sourceMode ? "is-active" : ""}`}
          data-testid="view-mode-toggle"
        >
          {sourceMode ? <WysiwygIcon /> : <SourceIcon />}
          <span>{sourceMode ? "WYSIWYG" : "Source"}</span>
        </button>
      </div>
    </div>
  );
}

// Simple SVG icons - keeping them minimal and inline for now
// In production, these would come from an icon library like Lucide

function BoldIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
      <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="19" y1="4" x2="10" y2="4" />
      <line x1="14" y1="20" x2="5" y2="20" />
      <line x1="15" y1="4" x2="9" y2="20" />
    </svg>
  );
}

function StrikeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" y1="12" x2="20" y2="12" />
      <path d="M17.5 7.5c-.7-1.1-2-2-4-2.3-3-.4-5 1.1-5 3.3 0 1.5.8 2.4 2.5 3" />
      <path d="M8.5 16.5c.7 1.1 2.5 2 4.5 2 2.5 0 4.5-1 4.5-3.5 0-1.5-.5-2.5-2-3" />
    </svg>
  );
}

function HighlightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 11-6 6v3h9l3-3" />
      <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function BulletListIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <circle cx="4" cy="6" r="1" fill="currentColor" />
      <circle cx="4" cy="12" r="1" fill="currentColor" />
      <circle cx="4" cy="18" r="1" fill="currentColor" />
    </svg>
  );
}

function OrderedListIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <text
        x="4"
        y="7"
        fontSize="6"
        fill="currentColor"
        fontFamily="sans-serif"
      >
        1
      </text>
      <text
        x="4"
        y="13"
        fontSize="6"
        fill="currentColor"
        fontFamily="sans-serif"
      >
        2
      </text>
      <text
        x="4"
        y="19"
        fontSize="6"
        fill="currentColor"
        fontFamily="sans-serif"
      >
        3
      </text>
    </svg>
  );
}

function TaskListIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="6" height="6" rx="1" />
      <path d="m5 8 1 1 2-2" />
      <line x1="13" y1="8" x2="21" y2="8" />
      <rect x="3" y="13" width="6" height="6" rx="1" />
      <line x1="13" y1="16" x2="21" y2="16" />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21" />
      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3" />
    </svg>
  );
}

function CodeBlockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <polyline points="8 10 5 12 8 14" />
      <polyline points="16 10 19 12 16 14" />
      <line x1="12" y1="8" x2="12" y2="16" />
    </svg>
  );
}

function HorizontalRuleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

/** Source code icon - angle brackets */
function SourceIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

/** WYSIWYG icon - text lines with formatting */
function WysiwygIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="16" y2="12" />
      <line x1="4" y1="18" x2="12" y2="18" />
    </svg>
  );
}

export default EditorToolbar;
