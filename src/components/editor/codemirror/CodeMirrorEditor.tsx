/**
 * CodeMirror Editor Component
 *
 * React wrapper for the CodeMirror-based WYSIWYG markdown editor.
 * Drop-in replacement for the TipTap Editor component.
 */

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEditorStore } from "@/stores/editorStore";
import { cn } from "@/lib/utils";
import { markdownToHtml } from "@/lib/markdown/markdownToHtml";
import { createWysiwygExtensions } from "./extensions";
import { getMarkdownFromStore, setMarkdownToStore } from "./storeAdapter";

// Handlers from modular structure
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

export interface CodeMirrorEditorProps {
  /** Initial content as HTML (converted to MD internally) */
  initialContent?: string;
  /** Callback when content changes (returns HTML for compatibility) */
  onUpdate?: (content: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Auto-focus on mount */
  autofocus?: boolean;
  /** Callback when an internal link is clicked (cross-file navigation) */
  onInternalLinkClick?: (path: string, heading?: string) => void;
  /** Callback when a same-file heading link is clicked */
  onScrollToHeading?: (heading: string) => void;
  /** Callback when a broken link is clicked */
  onBrokenLinkClick?: (intendedPath: string) => void;
}

/**
 * Editor ref handle for external access
 */
export interface CodeMirrorEditorRef {
  view: EditorView | null;
  // Formatting commands
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleCode: () => void;
  toggleStrikethrough: () => void;
  toggleHighlight: () => void;
  // Heading commands
  setHeading1: () => void;
  setHeading2: () => void;
  setHeading3: () => void;
  // Block commands
  insertTable: () => void;
  insertLink: () => void;
  // Content access
  getMarkdown: () => string;
  setMarkdown: (content: string) => void;
}

/**
 * CodeMirror-based WYSIWYG Markdown Editor
 */
export const CodeMirrorEditor = forwardRef<
  CodeMirrorEditorRef,
  CodeMirrorEditorProps
>(function CodeMirrorEditor(
  {
    initialContent: _initialContent = "",
    onUpdate,
    placeholder = "Start writing...",
    autofocus = true,
    onInternalLinkClick: _onInternalLinkClick,
    onScrollToHeading: _onScrollToHeading,
    onBrokenLinkClick: _onBrokenLinkClick,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Store state
  const focusMode = useEditorStore((state) => state.focusMode);
  const sourceMode = useEditorStore((state) => state.sourceMode);
  const fontFamily = useEditorStore((state) => state.fontFamily);
  const filePath = useEditorStore((state) => state.filePath);

  // Create command wrappers
  const createCommand = useCallback(
    (handler: (view: EditorView) => boolean) => {
      return () => {
        if (viewRef.current) {
          handler(viewRef.current);
          viewRef.current.focus();
        }
      };
    },
    []
  );

  // Expose editor API via ref
  useImperativeHandle(
    ref,
    () => ({
      view: viewRef.current,
      toggleBold: createCommand(toggleBoldOrEscape),
      toggleItalic: createCommand(toggleItalicOrEscape),
      toggleCode: createCommand(toggleCodeOrEscape),
      toggleStrikethrough: createCommand(toggleStrikethroughOrEscape),
      toggleHighlight: createCommand(toggleHighlightOrEscape),
      setHeading1: createCommand(setHeading1),
      setHeading2: createCommand(setHeading2),
      setHeading3: createCommand(setHeading3),
      insertTable: createCommand(insertTable),
      insertLink: createCommand(handleLinkCommand),
      getMarkdown: () => viewRef.current?.state.doc.toString() ?? "",
      setMarkdown: (content: string) => {
        if (viewRef.current) {
          viewRef.current.dispatch({
            changes: {
              from: 0,
              to: viewRef.current.state.doc.length,
              insert: content,
            },
          });
        }
      },
    }),
    [createCommand]
  );

  // Initialize CodeMirror
  useEffect(() => {
    if (!containerRef.current) return;

    // Get initial markdown content
    const initialMarkdown = getMarkdownFromStore() || "";

    // Create extensions
    const extensions = [
      ...createWysiwygExtensions(),
      // Update listener for content changes
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const markdown = update.state.doc.toString();
          setMarkdownToStore(markdown);
          // Also call onUpdate callback with HTML for compatibility
          if (onUpdate) {
            onUpdate(markdownToHtml(markdown));
          }
        }
      }),
      // Placeholder extension
      EditorView.contentAttributes.of({
        "data-placeholder": placeholder,
      }),
    ];

    // Create editor state
    const state = EditorState.create({
      doc: initialMarkdown,
      extensions,
    });

    // Create editor view
    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    setIsReady(true);

    // Autofocus
    if (autofocus) {
      view.focus();
    }

    // Cleanup
    return () => {
      view.destroy();
      viewRef.current = null;
      setIsReady(false);
    };
  }, []); // Only run on mount

  // Sync content when filePath changes (new document loaded)
  useEffect(() => {
    if (!viewRef.current || !isReady) return;

    const markdown = getMarkdownFromStore();
    const currentContent = viewRef.current.state.doc.toString();

    // Only update if content is different
    if (markdown !== currentContent) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: markdown,
        },
      });
    }
  }, [filePath, isReady]);

  // TODO: Add context menu handling for links
  // TODO: Add internal link navigation handling

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col h-screen bg-[var(--color-paper)]",
        focusMode && "focus-mode",
        sourceMode && "source-mode-active",
        `font-${fontFamily}`,
        "cm-editor-container"
      )}
      data-testid="codemirror-editor-container"
    />
  );
});

export default CodeMirrorEditor;
