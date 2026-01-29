import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import Image from "@tiptap/extension-image";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { common, createLowlight } from "lowlight";
import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { FileEntry } from "@/lib/tauri/files";
import { EditorToolbar } from "./EditorToolbar";
import { CodeBlockWithCopy } from "./extensions/CodeBlockWithCopy";
import { HeadingWithId } from "./extensions/HeadingWithId";
import { InternalLinkMark } from "./extensions/InternalLinkMark";
import { InternalLink } from "./extensions/InternalLink";
import { createSuggestionRender } from "./extensions/internalLinkSuggestionRender";
import { SourceEditor } from "./SourceEditor";
import { htmlToMarkdown } from "@/lib/markdown/htmlToMarkdown";
import { markdownToHtml } from "@/lib/markdown/markdownToHtml";
import { useInternalLinkNavigation } from "@/hooks/useInternalLinkNavigation";
import { readFile } from "@/lib/tauri/files";

// Create lowlight instance with common languages
const lowlight = createLowlight(common);

interface EditorProps {
  initialContent?: string;
  onUpdate?: (content: string) => void;
  placeholder?: string;
  autofocus?: boolean;
  /** Callback when an internal link is clicked (cross-file navigation) */
  onInternalLinkClick?: (path: string, heading?: string) => void;
  /** Callback when a same-file heading link is clicked - scroll without file reload */
  onScrollToHeading?: (heading: string) => void;
  /** Callback when a broken link is clicked - receives the intended file path */
  onBrokenLinkClick?: (intendedPath: string) => void;
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
  onInternalLinkClick,
  onScrollToHeading,
  onBrokenLinkClick,
}: EditorProps) {
  // Use individual selectors to avoid React 19 + Zustand issues
  const setContent = useEditorStore((state) => state.setContent);
  const content = useEditorStore((state) => state.content);
  const focusMode = useEditorStore((state) => state.focusMode);
  const sourceMode = useEditorStore((state) => state.sourceMode);
  const toggleSourceMode = useEditorStore((state) => state.toggleSourceMode);
  const filePath = useEditorStore((state) => state.filePath);

  // Ref for the editor container (for internal link click handling)
  const containerRef = useRef<HTMLDivElement>(null);

  // Get files for internal link suggestions - compute with useMemo for React 19 compatibility
  // Using primitive selectors to avoid Zustand snapshot caching issues
  const fileTree = useWorkspaceStore((state) => state.fileTree);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);

  const files = useMemo(() => {
    const result: { name: string; path: string; displayPath: string }[] = [];

    const collectFiles = (entries: FileEntry[]) => {
      for (const entry of entries) {
        if (entry.is_markdown) {
          const displayPath = workspacePath
            ? entry.path.replace(workspacePath + "/", "")
            : entry.name;

          result.push({
            name: entry.name,
            path: entry.path,
            displayPath,
          });
        }
        if (entry.children) {
          collectFiles(entry.children);
        }
      }
    };

    collectFiles(fileTree);
    return result;
  }, [fileTree, workspacePath]);

  const getFiles = useCallback(() => files, [files]);

  // Get current file path and content for same-file heading links
  const getCurrentFilePath = useCallback(() => filePath, [filePath]);
  const getCurrentFileContent = useCallback(() => content, [content]);

  // Create suggestion render function (memoized)
  const suggestionRender = useMemo(
    () => createSuggestionRender({
      getFiles,
      readFileContent: readFile,
      getCurrentFilePath,
      getCurrentFileContent,
    }),
    [getFiles, getCurrentFilePath, getCurrentFileContent]
  );

  // Handle internal link navigation
  const handleInternalLinkNavigate = useCallback(
    (path: string, heading?: string) => {
      onInternalLinkClick?.(path, heading);
    },
    [onInternalLinkClick]
  );

  // Set up internal link click handling
  useInternalLinkNavigation({
    onNavigate: handleInternalLinkNavigate,
    onScrollToHeading,
    onBrokenLinkClick,
    containerRef,
    enabled: !!onInternalLinkClick && !sourceMode,
    currentFilePath: filePath,
  });

  // Track markdown source when in source mode
  const [markdownSource, setMarkdownSource] = useState("");
  const wasInSourceMode = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // We use CodeBlockWithCopy instead
        heading: false, // We use HeadingWithId instead
      }),
      // Custom heading extension with auto-generated IDs for link navigation
      HeadingWithId.configure({
        levels: [1, 2, 3, 4, 5, 6],
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
      // Custom link extension with internal link attributes (class, data-internal-link)
      InternalLinkMark.configure({
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
      CodeBlockWithCopy.configure({
        lowlight,
        defaultLanguage: "plaintext",
      }),
      InternalLink.configure({
        suggestion: {
          render: suggestionRender,
        },
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

  // Handle mode switching
  useEffect(() => {
    if (!editor) return;

    if (sourceMode && !wasInSourceMode.current) {
      // Switching TO source mode: convert HTML to Markdown
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      setMarkdownSource(markdown);
      wasInSourceMode.current = true;
    } else if (!sourceMode && wasInSourceMode.current) {
      // Switching FROM source mode: convert Markdown to HTML
      const html = markdownToHtml(markdownSource);
      editor.commands.setContent(html);
      setContent(html);
      onUpdate?.(html);
      wasInSourceMode.current = false;
    }
  }, [sourceMode, editor, markdownSource, setContent, onUpdate]);

  // Handle source editor changes
  const handleSourceChange = useCallback(
    (newMarkdown: string) => {
      setMarkdownSource(newMarkdown);
      // Don't update HTML content until mode switch
    },
    []
  );

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey;

      // Cmd/Ctrl + S: Save (prevent default, we autosave)
      if (isMod && event.key === "s") {
        event.preventDefault();
        // Trigger manual save if needed
      }

      // Cmd/Ctrl + /: Toggle source mode
      if (isMod && event.key === "/") {
        event.preventDefault();
        toggleSourceMode();
      }
    },
    [toggleSourceMode]
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
      ref={containerRef}
      className={`editor-container ${focusMode ? "focus-mode" : ""} ${sourceMode ? "source-mode-active" : ""}`}
      data-testid="editor-container"
    >
      <EditorToolbar editor={editor} />
      {sourceMode ? (
        <SourceEditor
          value={markdownSource}
          onChange={handleSourceChange}
          placeholder={placeholder}
          autofocus
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}

export default Editor;
