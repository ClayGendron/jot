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
import { Annotation, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { openSearchPanel, closeSearchPanel } from "@codemirror/search";
import { useEditorStore } from "@/stores/editorStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";
import { createWysiwygExtensions } from "./extensions";
import {
  createSpellcheckExtension,
  setSpellcheckEnabledCmd,
  subscribeSpellcheckContextMenu,
  closeSpellcheckContextMenu,
  handleSpellcheckSuggestion,
  handleAddToPersonalDictionary,
  handleIgnoreWord,
} from "./extensions/spellcheck";
import { CodeMirrorToolbar } from "./CodeMirrorToolbar";
import { SourceEditor } from "../SourceEditor";

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
import {
  handleLinkCommand,
  setInternalLinkCallbacks,
  getLinkContextAtPos,
  handleLinkClick,
} from "./handlers/linkHandlers";

/**
 * Annotation to mark file-switch and source-mode return dispatches.
 * The updateListener skips these to prevent spurious autosaves.
 */
const fileSwitchAnnotation = Annotation.define<boolean>();

export interface CodeMirrorEditorProps {
  /** Initial content (unused — content comes from store) */
  initialContent?: string;
  /** Callback when content changes (returns markdown) */
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
 * Provides compatibility layer for TipTap-style commands
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
  // Search (compatibility with TipTap)
  openSearch: () => void;
  closeSearch: () => void;
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
    onInternalLinkClick,
    onScrollToHeading,
    onBrokenLinkClick: _onBrokenLinkClick,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Keep a ref to the latest onUpdate so the mount-only effect always uses
  // the current callback (avoids stale closure with wrong activeTabId)
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);

  // Store state
  const focusMode = useEditorStore((state) => state.focusMode);
  const sourceMode = useEditorStore((state) => state.sourceMode);
  const fontFamily = useEditorStore((state) => state.fontFamily);
  const filePath = useEditorStore((state) => state.filePath);

  // Settings store for spellcheck
  const spellCheckEnabled = useSettingsStore(
    (s) => s.appearance?.spellCheckEnabled ?? true
  );

  // Source mode state
  const [markdownSource, setMarkdownSource] = useState("");
  const wasInSourceMode = useRef(false);

  // Spellcheck context menu state
  const [spellcheckMenu, setSpellcheckMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    word: string;
    suggestions: string[];
  } | null>(null);

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
      openSearch: () => {
        if (viewRef.current) {
          openSearchPanel(viewRef.current);
        }
      },
      closeSearch: () => {
        if (viewRef.current) {
          closeSearchPanel(viewRef.current);
        }
      },
    }),
    [createCommand]
  );

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorContainerRef.current) return;

    // Get initial markdown content directly from store
    const initialMarkdown = useEditorStore.getState().content || "";

    // Create extensions
    const extensions = [
      ...createWysiwygExtensions(),
      // Spellcheck extension
      ...createSpellcheckExtension({ enabled: spellCheckEnabled }),
      // Update listener for content changes
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          // Skip file-switch and source-mode return dispatches to prevent spurious autosaves
          const isFileSwitch = update.transactions.some(
            (tr) => tr.annotation(fileSwitchAnnotation)
          );
          if (isFileSwitch) return;

          const markdown = update.state.doc.toString();
          useEditorStore.getState().setContent(markdown);
          // Use ref to always call the latest onUpdate (avoids stale closure)
          if (onUpdateRef.current) {
            onUpdateRef.current(markdown);
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
      parent: editorContainerRef.current,
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

    const markdown = useEditorStore.getState().content;
    const currentContent = viewRef.current.state.doc.toString();

    // Only update if content is different
    if (markdown !== currentContent) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: markdown,
        },
        annotations: fileSwitchAnnotation.of(true),
      });
    }
  }, [filePath, isReady]);

  // Handle mode switching (WYSIWYG ↔ Source)
  useEffect(() => {
    if (!viewRef.current) return;

    if (sourceMode && !wasInSourceMode.current) {
      // Switching TO source mode: get current markdown
      const markdown = viewRef.current.state.doc.toString();
      setMarkdownSource(markdown);
      wasInSourceMode.current = true;
    } else if (!sourceMode && wasInSourceMode.current) {
      // Switching FROM source mode: update the editor
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: markdownSource,
        },
        annotations: fileSwitchAnnotation.of(true),
      });
      // Sync to store
      useEditorStore.getState().setContent(markdownSource);
      if (onUpdate) {
        onUpdate(markdownSource);
      }
      wasInSourceMode.current = false;
    }
  }, [sourceMode, markdownSource, onUpdate]);

  // Handle source editor changes
  const handleSourceChange = useCallback((newMarkdown: string) => {
    setMarkdownSource(newMarkdown);
  }, []);

  // Set up internal link callbacks
  useEffect(() => {
    setInternalLinkCallbacks({
      onInternalLinkClick,
      onScrollToHeading,
    });

    // Clear callbacks on unmount
    return () => {
      setInternalLinkCallbacks({});
    };
  }, [onInternalLinkClick, onScrollToHeading]);

  // Subscribe to spellcheck context menu state
  useEffect(() => {
    const unsubscribe = subscribeSpellcheckContextMenu((state) => {
      if (state.visible) {
        setSpellcheckMenu({
          visible: true,
          x: state.x,
          y: state.y,
          word: state.word,
          suggestions: state.suggestions,
        });
      } else {
        setSpellcheckMenu(null);
      }
    });

    return unsubscribe;
  }, []);

  // Sync spellcheck enabled state with settings
  useEffect(() => {
    if (viewRef.current && isReady) {
      setSpellcheckEnabledCmd(viewRef.current, spellCheckEnabled);
    }
  }, [spellCheckEnabled, isReady]);

  // Handle link clicks
  useEffect(() => {
    if (!editorContainerRef.current || !viewRef.current) return;

    const handleClick = (event: MouseEvent) => {
      const view = viewRef.current;
      if (!view) return;

      // Check if click is on a link element (cm-link class)
      const target = event.target as HTMLElement;
      if (!target.classList.contains("cm-link")) return;

      // Get the document position from the click coordinates
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return;

      // Find link context at this position
      const linkCtx = getLinkContextAtPos(view.state, pos);
      if (!linkCtx) return;

      // Handle the link click
      handleLinkClick(linkCtx, event);
    };

    const container = editorContainerRef.current;
    container.addEventListener("click", handleClick);

    return () => {
      container.removeEventListener("click", handleClick);
    };
  }, [isReady]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col h-full bg-[var(--color-paper)]",
        focusMode && "focus-mode",
        sourceMode && "source-mode-active",
        `font-${fontFamily}`,
        "cm-editor-container"
      )}
      data-testid="codemirror-editor-container"
    >
      {/* Toolbar */}
      <CodeMirrorToolbar view={viewRef.current} />

      {/* Editor Content */}
      {sourceMode ? (
        <SourceEditor
          value={markdownSource}
          onChange={handleSourceChange}
          placeholder={placeholder}
          autofocus
        />
      ) : (
        <div
          ref={editorContainerRef}
          className="flex-1 min-h-0"
          data-testid="codemirror-editor"
        />
      )}

      {/* Spellcheck Context Menu */}
      {spellcheckMenu && spellcheckMenu.visible && (
        <div
          className="fixed z-50 bg-[var(--color-paper)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 min-w-[160px]"
          style={{ left: spellcheckMenu.x, top: spellcheckMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {spellcheckMenu.suggestions.length > 0 ? (
            <>
              {spellcheckMenu.suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--color-paper-warm)] text-[var(--color-ink)]"
                  onClick={() => {
                    if (viewRef.current) {
                      handleSpellcheckSuggestion(viewRef.current, suggestion);
                    }
                  }}
                >
                  {suggestion}
                </button>
              ))}
              <div className="h-px bg-[var(--color-border)] my-1" />
            </>
          ) : (
            <div className="px-3 py-1.5 text-sm text-[var(--color-ink-muted)] italic">
              No suggestions
            </div>
          )}
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--color-paper-warm)] text-[var(--color-ink)]"
            onClick={() => {
              if (viewRef.current) {
                handleAddToPersonalDictionary(viewRef.current);
              }
            }}
          >
            Add to Dictionary
          </button>
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--color-paper-warm)] text-[var(--color-ink-muted)]"
            onClick={() => {
              handleIgnoreWord();
            }}
          >
            Ignore
          </button>
        </div>
      )}

      {/* Click outside to close spellcheck menu */}
      {spellcheckMenu && spellcheckMenu.visible && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => closeSpellcheckContextMenu()}
        />
      )}
    </div>
  );
});

export default CodeMirrorEditor;
