/**
 * Editor Toolbar Component
 *
 * Supports both TipTap (HTML) and CodeMirror 6 (Markdown) editors.
 * Automatically uses the appropriate commands based on which editor is provided.
 *
 * Phase 8: Updated to support CM6 via cmView prop.
 */

import { type Editor } from "@tiptap/react";
import { type EditorView } from "@codemirror/view";
import { useCallback, useSyncExternalStore } from "react";
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

// CM6 commands
import {
  toggleBold as cmToggleBold,
  toggleItalic as cmToggleItalic,
  toggleStrikethrough as cmToggleStrikethrough,
  toggleInlineCode as cmToggleInlineCode,
  toggleHighlight as cmToggleHighlight,
} from "./codemirror/commands/formatting";

import {
  toggleHeading as cmToggleHeading,
  setParagraph as cmSetParagraph,
  toggleBulletList as cmToggleBulletList,
  toggleOrderedList as cmToggleOrderedList,
  toggleTaskList as cmToggleTaskList,
  toggleBlockquote as cmToggleBlockquote,
  toggleCodeBlock as cmToggleCodeBlock,
  insertHorizontalRule as cmInsertHorizontalRule,
  insertLink as cmInsertLink,
  insertImage as cmInsertImage,
} from "./codemirror/commands/blocks";

// CM6 format detection
import {
  isBoldActive as cmIsBoldActive,
  isItalicActive as cmIsItalicActive,
  isStrikethroughActive as cmIsStrikethroughActive,
  isCodeActive as cmIsCodeActive,
  getHeadingLevel as cmGetHeadingLevel,
  isBulletListActive as cmIsBulletListActive,
  isOrderedListActive as cmIsOrderedListActive,
  isTaskListActive as cmIsTaskListActive,
  isBlockquoteActive as cmIsBlockquoteActive,
  isCodeBlockActive as cmIsCodeBlockActive,
} from "./codemirror/utils/formatActive";

interface EditorToolbarProps {
  /** TipTap editor instance (for legacy HTML-based editing) */
  editor?: Editor | null;
  /** CodeMirror view instance (for markdown-based editing) */
  cmView?: EditorView | null;
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
 * Subscribe to CM6 state changes for reactive format detection.
 * Uses a simple version counter that increments on each state change.
 */
function useCMState(view: EditorView | null | undefined): number {
  return useSyncExternalStore(
    (callback) => {
      if (!view) return () => {};

      // Create an update listener that calls the callback
      const updateListener = () => {
        callback();
      };

      // Listen for DOM updates which occur after state changes
      const handler = () => updateListener();
      view.dom.addEventListener("input", handler);
      view.dom.addEventListener("focus", handler);
      view.dom.addEventListener("keyup", handler);
      view.dom.addEventListener("mouseup", handler);

      return () => {
        view.dom.removeEventListener("input", handler);
        view.dom.removeEventListener("focus", handler);
        view.dom.removeEventListener("keyup", handler);
        view.dom.removeEventListener("mouseup", handler);
      };
    },
    () => view?.state.doc.length ?? 0
  );
}

/**
 * Formatting toolbar for the editor
 *
 * Groups:
 * - Text styles: Bold, Italic, Strikethrough, Highlight, Code
 * - Headings: P, H1, H2, H3
 * - Lists: Bullet, Numbered, Task
 * - Blocks: Quote, Code block, Table, Horizontal rule
 * - Insert: Link, Image
 *
 * Supports both TipTap (editor prop) and CodeMirror 6 (cmView prop).
 */
export function EditorToolbar({ editor, cmView }: EditorToolbarProps) {
  const sourceMode = useEditorStore((state) => state.sourceMode);
  const toggleSourceMode = useEditorStore((state) => state.toggleSourceMode);

  // Subscribe to CM6 state for reactive updates
  useCMState(cmView);

  const isCM = !!cmView;
  const hasEditor = !!editor || !!cmView;

  // ============================================================================
  // Text Formatting Commands
  // ============================================================================

  const toggleBold = useCallback(() => {
    if (cmView) {
      cmToggleBold(cmView);
    } else if (editor) {
      editor.chain().focus().toggleBold().run();
    }
  }, [editor, cmView]);

  const toggleItalic = useCallback(() => {
    if (cmView) {
      cmToggleItalic(cmView);
    } else if (editor) {
      editor.chain().focus().toggleItalic().run();
    }
  }, [editor, cmView]);

  const toggleStrike = useCallback(() => {
    if (cmView) {
      cmToggleStrikethrough(cmView);
    } else if (editor) {
      editor.chain().focus().toggleStrike().run();
    }
  }, [editor, cmView]);

  const toggleHighlight = useCallback(() => {
    if (cmView) {
      cmToggleHighlight(cmView);
    } else if (editor) {
      editor.chain().focus().toggleHighlight().run();
    }
  }, [editor, cmView]);

  const toggleCode = useCallback(() => {
    if (cmView) {
      cmToggleInlineCode(cmView);
    } else if (editor) {
      editor.chain().focus().toggleCode().run();
    }
  }, [editor, cmView]);

  // ============================================================================
  // Heading Commands
  // ============================================================================

  const setHeading = useCallback(
    (level: 1 | 2 | 3 | 4 | 5 | 6) => {
      if (cmView) {
        cmToggleHeading(cmView, level);
      } else if (editor) {
        editor.chain().focus().toggleHeading({ level }).run();
      }
    },
    [editor, cmView]
  );

  const setParagraph = useCallback(() => {
    if (cmView) {
      cmSetParagraph(cmView);
    } else if (editor) {
      editor.chain().focus().setParagraph().run();
    }
  }, [editor, cmView]);

  // ============================================================================
  // List Commands
  // ============================================================================

  const toggleBulletList = useCallback(() => {
    if (cmView) {
      cmToggleBulletList(cmView);
    } else if (editor) {
      editor.chain().focus().toggleBulletList().run();
    }
  }, [editor, cmView]);

  const toggleOrderedList = useCallback(() => {
    if (cmView) {
      cmToggleOrderedList(cmView);
    } else if (editor) {
      editor.chain().focus().toggleOrderedList().run();
    }
  }, [editor, cmView]);

  const toggleTaskList = useCallback(() => {
    if (cmView) {
      cmToggleTaskList(cmView);
    } else if (editor) {
      editor.chain().focus().toggleTaskList().run();
    }
  }, [editor, cmView]);

  // ============================================================================
  // Block Commands
  // ============================================================================

  const toggleBlockquote = useCallback(() => {
    if (cmView) {
      cmToggleBlockquote(cmView);
    } else if (editor) {
      editor.chain().focus().toggleBlockquote().run();
    }
  }, [editor, cmView]);

  const toggleCodeBlock = useCallback(() => {
    if (cmView) {
      cmToggleCodeBlock(cmView);
    } else if (editor) {
      editor.chain().focus().toggleCodeBlock().run();
    }
  }, [editor, cmView]);

  const insertHorizontalRule = useCallback(() => {
    if (cmView) {
      cmInsertHorizontalRule(cmView);
    } else if (editor) {
      editor.chain().focus().setHorizontalRule().run();
    }
  }, [editor, cmView]);

  // ============================================================================
  // Table Command
  // ============================================================================

  const insertTable = useCallback(() => {
    if (cmView) {
      // For CM6, insert a basic 3x3 markdown table
      const pos = cmView.state.selection.main.head;
      const table = `\n| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |\n`;
      cmView.dispatch({
        changes: { from: pos, to: pos, insert: table },
      });
    } else if (editor) {
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    }
  }, [editor, cmView]);

  // ============================================================================
  // Link Command
  // ============================================================================

  const setLink = useCallback(() => {
    if (cmView) {
      const url = window.prompt("URL");
      if (url) {
        cmInsertLink(cmView, url);
      }
    } else if (editor) {
      const previousUrl = editor.getAttributes("link").href;
      const url = window.prompt("URL", previousUrl);

      if (url === null) return;

      if (url === "") {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
        return;
      }

      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    }
  }, [editor, cmView]);

  // ============================================================================
  // Image Command
  // ============================================================================

  const insertImage = useCallback(() => {
    const url = window.prompt("Image URL");
    if (url) {
      if (cmView) {
        cmInsertImage(cmView, url);
      } else if (editor) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    }
  }, [editor, cmView]);

  // ============================================================================
  // Active State Detection
  // ============================================================================

  const isBoldActive = isCM && cmView
    ? cmIsBoldActive(cmView.state)
    : editor?.isActive("bold") ?? false;

  const isItalicActive = isCM && cmView
    ? cmIsItalicActive(cmView.state)
    : editor?.isActive("italic") ?? false;

  const isStrikeActive = isCM && cmView
    ? cmIsStrikethroughActive(cmView.state)
    : editor?.isActive("strike") ?? false;

  const isHighlightActive = isCM && cmView
    ? false // CM6 highlight detection not in formatActive (uses custom regex)
    : editor?.isActive("highlight") ?? false;

  const isCodeInlineActive = isCM && cmView
    ? cmIsCodeActive(cmView.state)
    : editor?.isActive("code") ?? false;

  const isParagraphActive = isCM && cmView
    ? cmGetHeadingLevel(cmView.state) === 0 &&
      !cmIsBulletListActive(cmView.state) &&
      !cmIsOrderedListActive(cmView.state) &&
      !cmIsTaskListActive(cmView.state) &&
      !cmIsBlockquoteActive(cmView.state) &&
      !cmIsCodeBlockActive(cmView.state)
    : editor?.isActive("paragraph") ?? false;

  const isH1Active = isCM && cmView
    ? cmGetHeadingLevel(cmView.state) === 1
    : editor?.isActive("heading", { level: 1 }) ?? false;

  const isH2Active = isCM && cmView
    ? cmGetHeadingLevel(cmView.state) === 2
    : editor?.isActive("heading", { level: 2 }) ?? false;

  const isH3Active = isCM && cmView
    ? cmGetHeadingLevel(cmView.state) === 3
    : editor?.isActive("heading", { level: 3 }) ?? false;

  const isBulletActive = isCM && cmView
    ? cmIsBulletListActive(cmView.state)
    : editor?.isActive("bulletList") ?? false;

  const isOrderedActive = isCM && cmView
    ? cmIsOrderedListActive(cmView.state)
    : editor?.isActive("orderedList") ?? false;

  const isTaskActive = isCM && cmView
    ? cmIsTaskListActive(cmView.state)
    : editor?.isActive("taskList") ?? false;

  const isQuoteActive = isCM && cmView
    ? cmIsBlockquoteActive(cmView.state)
    : editor?.isActive("blockquote") ?? false;

  const isCodeBlockActiveState = isCM && cmView
    ? cmIsCodeBlockActive(cmView.state)
    : editor?.isActive("codeBlock") ?? false;

  const isLinkActive = isCM
    ? false // CM6 doesn't have inline link mark detection
    : editor?.isActive("link") ?? false;

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
          disabled={sourceMode || !hasEditor}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleItalic}
          isActive={isItalicActive}
          label="Italic"
          shortcut="⌘I"
          disabled={sourceMode || !hasEditor}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleStrike}
          isActive={isStrikeActive}
          label="Strikethrough"
          shortcut="⌘⇧S"
          disabled={sourceMode || !hasEditor}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleHighlight}
          isActive={isHighlightActive}
          label="Highlight"
          shortcut="⌘⇧H"
          disabled={sourceMode || !hasEditor}
        >
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleCode}
          isActive={isCodeInlineActive}
          label="Inline Code"
          shortcut="⌘E"
          disabled={sourceMode || !hasEditor}
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Headings */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={setParagraph}
          isActive={isParagraphActive}
          label="Paragraph"
          shortcut="⌘⌥0"
          disabled={sourceMode || !hasEditor}
        >
          P
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setHeading(1)}
          isActive={isH1Active}
          label="Heading 1"
          shortcut="⌘⌥1"
          disabled={sourceMode || !hasEditor}
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setHeading(2)}
          isActive={isH2Active}
          label="Heading 2"
          shortcut="⌘⌥2"
          disabled={sourceMode || !hasEditor}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setHeading(3)}
          isActive={isH3Active}
          label="Heading 3"
          shortcut="⌘⌥3"
          disabled={sourceMode || !hasEditor}
        >
          H3
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Lists */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={toggleBulletList}
          isActive={isBulletActive}
          label="Bullet List"
          shortcut="⌘⇧8"
          disabled={sourceMode || !hasEditor}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleOrderedList}
          isActive={isOrderedActive}
          label="Numbered List"
          shortcut="⌘⇧7"
          disabled={sourceMode || !hasEditor}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleTaskList}
          isActive={isTaskActive}
          label="Task List"
          shortcut="⌘⇧9"
          disabled={sourceMode || !hasEditor}
        >
          <ListTodo className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Blocks */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={toggleBlockquote}
          isActive={isQuoteActive}
          label="Quote"
          shortcut="⌘⇧B"
          disabled={sourceMode || !hasEditor}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleCodeBlock}
          isActive={isCodeBlockActiveState}
          label="Code Block"
          shortcut="⌘⌥C"
          disabled={sourceMode || !hasEditor}
        >
          <SquareCode className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={insertHorizontalRule}
          label="Horizontal Rule"
          disabled={sourceMode || !hasEditor}
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={insertTable}
          label="Insert Table"
          disabled={sourceMode || !hasEditor}
        >
          <Table className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Insert */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={setLink}
          isActive={isLinkActive}
          label="Link"
          shortcut="⌘K"
          disabled={sourceMode || !hasEditor}
        >
          <Link className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={insertImage}
          label="Image"
          disabled={sourceMode || !hasEditor}
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

export default EditorToolbar;
