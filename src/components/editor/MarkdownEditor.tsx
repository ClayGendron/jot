/**
 * CodeMirror 6 Markdown Editor
 *
 * A WYSIWYG-capable markdown editor where markdown is the canonical format.
 * No conversion on load/save - what you edit is what gets stored.
 *
 * Phase 1: Basic editing
 * Phase 2: Hidden syntax decorations for true WYSIWYG, formatting commands
 * Phase 4: Links and images with internal link navigation
 */

import {
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { EditorView } from "@codemirror/view";
import { createEditorState, createEditorView, createExtensions, toggleRawView } from "./codemirror/setup";
import { useEditorStore } from "@/stores/editorStore";
import { useInternalLinkNavigation } from "@/hooks/useInternalLinkNavigation";
import { cn } from "@/lib/utils";

export interface MarkdownEditorProps {
  /** Initial markdown content */
  initialContent?: string;
  /** Callback when content changes */
  onUpdate?: (content: string) => void;
  /** Placeholder text shown when editor is empty */
  placeholder?: string;
  /** Whether to focus editor on mount */
  autofocus?: boolean;
  /** Current file path - used for same-file heading navigation */
  filePath?: string | null;
  /** Callback when an internal link is clicked (cross-file navigation) */
  onInternalLinkClick?: (path: string, heading?: string) => void;
  /** Callback when a same-file heading link is clicked */
  onScrollToHeading?: (headingId: string) => void;
  /** Callback when a broken link is clicked */
  onBrokenLinkClick?: (intendedPath: string) => void;
}

/**
 * Editor ref handle for external access
 */
export interface MarkdownEditorRef {
  /** The CodeMirror EditorView instance */
  view: EditorView | null;
  /** Get current document content */
  getContent: () => string;
  /** Set document content */
  setContent: (content: string) => void;
}

/**
 * CodeMirror 6 based Markdown editor
 *
 * Key differences from TipTap Editor:
 * - Markdown is the canonical format (no HTML conversion)
 * - Content is stored and edited as raw markdown
 * - Phase 2: Hidden syntax decorations provide WYSIWYG feel
 * - sourceMode toggles between WYSIWYG and raw markdown view
 */
export const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      initialContent = "",
      onUpdate,
      placeholder = "Start writing...",
      autofocus = true,
      filePath,
      onInternalLinkClick,
      onScrollToHeading,
      onBrokenLinkClick,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onUpdateRef = useRef(onUpdate);

    // Keep callback ref updated without recreating editor
    useEffect(() => {
      onUpdateRef.current = onUpdate;
    }, [onUpdate]);

    // Get editor settings from store
    const fontFamily = useEditorStore((state) => state.fontFamily);
    const focusMode = useEditorStore((state) => state.focusMode);
    const showLineNumbers = useEditorStore((state) => state.showLineNumbers);
    const sourceMode = useEditorStore((state) => state.sourceMode);

    // Handle internal link navigation (clicks on links in editor)
    const handleInternalLinkNavigate = useCallback(
      (path: string, heading?: string) => {
        onInternalLinkClick?.(path, heading);
      },
      [onInternalLinkClick]
    );

    // Set up internal link click handling for CodeMirror
    useInternalLinkNavigation({
      onNavigate: handleInternalLinkNavigate,
      onScrollToHeading,
      onBrokenLinkClick,
      containerRef,
      enabled: !!onInternalLinkClick && !sourceMode,
      currentFilePath: filePath,
    });

    // Initialize CodeMirror
    useEffect(() => {
      if (!containerRef.current) return;

      // Create extensions with current settings
      // sourceMode = true means show raw markdown (rawMode = true)
      const extensions = createExtensions({
        showLineNumbers,
        rawMode: sourceMode,
      });

      // Add update listener
      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const content = update.state.doc.toString();
          onUpdateRef.current?.(content);
        }
      });

      // Create editor state and view
      const state = createEditorState(initialContent, [...extensions, updateListener]);
      const view = createEditorView(state, containerRef.current);
      viewRef.current = view;

      // Focus if requested
      if (autofocus) {
        // Small delay to ensure DOM is ready
        requestAnimationFrame(() => {
          view.focus();
        });
      }

      // Cleanup on unmount
      return () => {
        view.destroy();
        viewRef.current = null;
      };
      // Only run on mount - content updates handled separately
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Handle sourceMode (raw view) toggle
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;

      // Toggle hidden syntax based on sourceMode
      // sourceMode = true means show raw markdown
      toggleRawView(view, sourceMode);
    }, [sourceMode]);

    // Sync external content changes (e.g., switching files)
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;

      const currentContent = view.state.doc.toString();
      if (currentContent !== initialContent) {
        view.dispatch({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: initialContent,
          },
        });
      }
    }, [initialContent]);

    // Helper functions for ref
    const getContent = useCallback(() => {
      return viewRef.current?.state.doc.toString() ?? "";
    }, []);

    const setContent = useCallback((content: string) => {
      const view = viewRef.current;
      if (!view) return;

      const currentContent = view.state.doc.toString();
      view.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: content,
        },
      });
    }, []);

    // Expose ref API
    useImperativeHandle(
      ref,
      () => ({
        view: viewRef.current,
        getContent,
        setContent,
      }),
      [getContent, setContent]
    );

    return (
      <div
        className={cn(
          "markdown-editor flex-1 overflow-y-auto",
          `font-${fontFamily}`,
          focusMode && "focus-mode",
          sourceMode && "source-mode-active"
        )}
        data-testid="markdown-editor-container"
      >
        <div
          ref={containerRef}
          className="cm-wrapper min-h-full"
          data-placeholder={placeholder}
        />
      </div>
    );
  }
);

export default MarkdownEditor;
