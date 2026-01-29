import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { useState, useCallback, useRef } from "react";
import { useEditorStore } from "@/stores/editorStore";

/** Duration to show "Copied!" state before resetting to "Copy" */
const COPY_SUCCESS_DURATION_MS = 2000;

/**
 * Custom node view for code blocks with copy functionality and line numbers
 *
 * Renders code blocks with a header containing:
 * - Language badge (when not plaintext)
 * - Copy button (appears on hover)
 * - Optional line numbers (controlled by editor settings)
 */
function CodeBlockView({ node }: NodeViewProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const codeRef = useRef<HTMLPreElement>(null);
  const showLineNumbers = useEditorStore((state) => state.showLineNumbers);

  const language = (node.attrs.language as string) || "plaintext";
  const showLanguageBadge = language && language !== "plaintext";

  const handleCopy = useCallback(async () => {
    // Get the code content from the ref
    const code = codeRef.current?.textContent || "";

    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), COPY_SUCCESS_DURATION_MS);
    } catch (err) {
      // Intentional console.error for clipboard failures - these are user-facing
      // errors that should be logged but don't crash the app
      console.error("Failed to copy code:", err);
    }
  }, []);

  return (
    <NodeViewWrapper
      className="code-block-wrapper"
      data-testid="code-block-container"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header bar with language and copy button */}
      <div className="code-block-header">
        {showLanguageBadge && (
          <span className="code-language-badge" data-testid="code-language-badge">
            {language}
          </span>
        )}
        <button
          type="button"
          className={`code-copy-btn ${isHovered ? "opacity-100" : "opacity-0"}`}
          onClick={handleCopy}
          aria-label={isCopied ? "Copied!" : "Copy code"}
          tabIndex={0}
        >
          {isCopied ? <CheckIcon /> : <CopyIcon />}
          <span className="code-copy-text">{isCopied ? "Copied" : "Copy"}</span>
        </button>
      </div>

      {/* Code content rendered by TipTap */}
      <pre
        ref={codeRef}
        className={showLineNumbers ? "with-line-numbers" : ""}
        data-show-line-numbers={showLineNumbers}
      >
        {/* Type assertion needed because NodeViewContent only accepts "div" in its types,
            but "code" is the correct semantic element for code blocks */}
        <NodeViewContent as={"code" as "div"} className="hljs" />
      </pre>
    </NodeViewWrapper>
  );
}

/** Copy icon - two overlapping rectangles */
function CopyIcon() {
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
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/** Check icon - animated checkmark for success state */
function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="code-copy-check"
    >
      <polyline points="20 6 9 17 4 12" className="code-copy-check-path" />
    </svg>
  );
}

/**
 * Extended CodeBlockLowlight with custom node view for copy functionality
 *
 * This wraps TipTap's CodeBlockLowlight extension and adds a React node view
 * that renders the copy button header.
 */
export const CodeBlockWithCopy = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
});

export default CodeBlockWithCopy;
