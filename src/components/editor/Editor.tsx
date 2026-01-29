import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { useCallback, useEffect } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { EditorToolbar } from "./EditorToolbar";

// Create lowlight instance with common languages
const lowlight = createLowlight(common);

interface EditorProps {
  initialContent?: string;
  onUpdate?: (content: string) => void;
  placeholder?: string;
  autofocus?: boolean;
}

/**
 * Core WYSIWYG markdown editor built on TipTap
 *
 * Features:
 * - Full markdown support via StarterKit
 * - Syntax highlighting for code blocks
 * - Task lists, tables, images
 * - Typography improvements (smart quotes, etc.)
 * - Internal link support
 */
export function Editor({
  initialContent = "",
  onUpdate,
  placeholder = "Start writing...",
  autofocus = true,
}: EditorProps) {
  const { setContent, content, focusMode } = useEditorStore();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // We use CodeBlockLowlight instead
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
      Typography.configure({
        // Smart quotes, ellipsis, em-dashes
        oneHalf: false,
        oneQuarter: false,
        threeQuarters: false,
      }),
      Link.configure({
        openOnClick: false, // We handle this manually
        HTMLAttributes: {
          rel: "noopener noreferrer",
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Highlight.configure({
        multicolor: false,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table,
      TableRow,
      TableCell,
      TableHeader,
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: "plaintext",
      }),
    ],
    content: initialContent || content,
    autofocus,
    editorProps: {
      attributes: {
        class: "tiptap-editor",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setContent(html);
      onUpdate?.(html);
    },
  });

  // Sync content when initialContent changes
  useEffect(() => {
    if (editor && initialContent && editor.getHTML() !== initialContent) {
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!editor) return;

      const isMod = event.metaKey || event.ctrlKey;

      // Cmd/Ctrl + S: Save (prevent default, we autosave)
      if (isMod && event.key === "s") {
        event.preventDefault();
        // Trigger manual save if needed
      }
    },
    [editor]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!editor) {
    return null;
  }

  return (
    <div
      className={`editor-container ${focusMode ? "focus-mode" : ""}`}
      data-testid="editor-container"
    >
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

export default Editor;
