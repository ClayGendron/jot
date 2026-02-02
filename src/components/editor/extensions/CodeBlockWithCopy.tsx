/**
 * Unified Code Block Extension
 *
 * TipTap extension that renders code blocks with:
 * - Syntax highlighting via lowlight
 * - Copy button with success feedback
 * - Optional line numbers
 * - Mermaid diagram rendering (shows code when focused, diagram when not)
 * - Export functionality for mermaid diagrams
 */

import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useEditorStore } from "@/stores/editorStore";
import DOMPurify from "dompurify";
import { renderMermaid, isMermaidLoaded } from "@/lib/mermaid/loader";
import { resolveTheme } from "@/lib/mermaid/themes";
import {
  exportAsSvg,
  exportAsPng,
  downloadBlob,
  generateExportFilename,
} from "@/lib/mermaid/exporter";
import {
  Copy,
  Check,
  GitBranch,
  Download,
  FileCode,
  Image,
  AlertCircle,
} from "lucide-react";

/** Duration to show "Copied!" state before resetting to "Copy" */
const COPY_SUCCESS_DURATION_MS = 2000;

/** Debounce delay for mermaid re-rendering while editing (ms) */
const RENDER_DEBOUNCE_MS = 400;

/**
 * Configure DOMPurify for SVG sanitization
 * Only allow safe SVG elements and attributes
 */
const purifyConfig = {
  USE_PROFILES: { svg: true, svgFilters: true },
  ADD_TAGS: ["foreignObject"] as string[],
  ADD_ATTR: ["target", "xlink:href", "xlink:title"] as string[],
};

/**
 * Unified code block view that handles both regular code and mermaid diagrams
 *
 * For mermaid blocks:
 * - Shows code when the block is selected (cursor inside)
 * - Shows rendered diagram when the block is not selected
 *
 * For regular code blocks:
 * - Always shows code with syntax highlighting
 * - Copy button and optional line numbers
 */
function CodeBlockView({ node, selected }: NodeViewProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const codeRef = useRef<HTMLPreElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const showLineNumbers = useEditorStore((state) => state.showLineNumbers);

  const language = (node.attrs.language as string) || "plaintext";
  const isMermaid = language === "mermaid";
  const showLanguageBadge = language && language !== "plaintext";

  // Mermaid-specific state
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isMermaid && !isMermaidLoaded());
  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const source = node.textContent || "";

  // Detect system theme
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() =>
    resolveTheme("system")
  );

  // Listen for system theme changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Debounced mermaid render function
  const debouncedRender = useMemo(() => {
    return (src: string, theme: "light" | "dark") => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }

      renderTimeoutRef.current = setTimeout(async () => {
        if (!src.trim()) {
          setSvgContent(null);
          setError(null);
          setIsLoading(false);
          return;
        }

        try {
          setIsLoading(true);
          setError(null);
          const svg = await renderMermaid(src, theme);
          const sanitizedSvg = DOMPurify.sanitize(svg, purifyConfig) as string;
          setSvgContent(sanitizedSvg);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Render failed";
          setError(message);
          setSvgContent(null);
        } finally {
          setIsLoading(false);
        }
      }, RENDER_DEBOUNCE_MS);
    };
  }, []);

  // Render mermaid diagram when source or theme changes
  useEffect(() => {
    if (!isMermaid) return;

    debouncedRender(source, systemTheme);

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [source, systemTheme, debouncedRender, isMermaid]);

  // Handle click outside export menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showExportMenu]);

  const handleCopy = useCallback(async () => {
    const code = codeRef.current?.textContent || source;

    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), COPY_SUCCESS_DURATION_MS);
    } catch (err) {
      // Intentional console.error - helps debug clipboard permission issues
      console.error("Failed to copy code:", err);
    }
  }, [source]);

  // Export handlers for mermaid
  const handleExportSvg = useCallback(() => {
    if (!svgContent) return;
    const blob = exportAsSvg(svgContent);
    const filename = generateExportFilename(source, "svg");
    downloadBlob(blob, filename);
    setShowExportMenu(false);
  }, [svgContent, source]);

  const handleExportPng = useCallback(async () => {
    if (!svgContent) return;
    try {
      const blob = await exportAsPng(svgContent);
      const filename = generateExportFilename(source, "png");
      downloadBlob(blob, filename);
    } catch (err) {
      // Intentional console.error - helps debug canvas/export issues
      console.error("PNG export failed:", err);
    }
    setShowExportMenu(false);
  }, [svgContent, source]);

  // Determine if we should show diagram (mermaid + not selected)
  const showDiagram = isMermaid && !selected;

  // Render mermaid block
  if (isMermaid) {
    return (
      <NodeViewWrapper
        className={`mermaid-block ${selected ? "is-editing" : ""}`}
        data-testid="mermaid-block"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setShowExportMenu(false);
        }}
      >
        {/* Header with badge and controls */}
        <div className="mermaid-header">
          <span className="mermaid-badge">
            <GitBranch className="h-3 w-3" aria-hidden="true" />
            mermaid
          </span>

          <div className={`mermaid-controls ${isHovered ? "visible" : ""}`}>
            {/* Copy button */}
            <button
              type="button"
              className="mermaid-control-btn"
              onClick={handleCopy}
              title="Copy source"
              aria-label={isCopied ? "Copied!" : "Copy source"}
            >
              {isCopied ? (
                <Check className="h-3.5 w-3.5 code-copy-check" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{isCopied ? "Copied" : "Copy"}</span>
            </button>

            {/* Export dropdown - only when showing diagram */}
            {showDiagram && svgContent && (
              <div className="mermaid-export-wrapper" ref={exportMenuRef}>
                <button
                  type="button"
                  className="mermaid-control-btn"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  title="Export diagram"
                  aria-label="Export diagram"
                  aria-expanded={showExportMenu}
                >
                  <Download className="h-3 w-3" aria-hidden="true" />
                  <span>Export</span>
                </button>

                {showExportMenu && (
                  <div className="mermaid-export-menu">
                    <button
                      type="button"
                      className="mermaid-export-option"
                      onClick={handleExportSvg}
                    >
                      <FileCode className="h-3.5 w-3.5" aria-hidden="true" />
                      Export as SVG
                    </button>
                    <button
                      type="button"
                      className="mermaid-export-option"
                      onClick={handleExportPng}
                    >
                      <Image className="h-3.5 w-3.5" aria-hidden="true" />
                      Export as PNG
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content area - code when selected, diagram when not */}
        {selected ? (
          <div className="mermaid-source-wrapper">
            <pre ref={codeRef} className="mermaid-source">
              <NodeViewContent as={"code" as "div"} className="hljs" />
            </pre>
          </div>
        ) : (
          <div className="mermaid-content">
            {isLoading && (
              <div className="mermaid-loading" data-testid="mermaid-loading">
                <div className="mermaid-loading-spinner" />
                <span>Rendering diagram...</span>
              </div>
            )}

            {!isLoading && svgContent && (
              <div
                className="mermaid-diagram"
                aria-label="Mermaid diagram - click to edit"
                // Safe: SVG is sanitized by DOMPurify before rendering
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            )}

            {!isLoading && error && (
              <div className="mermaid-error" data-testid="mermaid-error">
                <div className="mermaid-error-header">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Syntax Error</span>
                </div>
                <pre className="mermaid-error-message">{error}</pre>
                <p className="mermaid-error-hint">Click to edit and fix</p>
              </div>
            )}

            {!isLoading && !svgContent && !error && (
              <div className="mermaid-empty">
                <span>Empty diagram</span>
                <p className="mermaid-empty-hint">Click to add diagram code</p>
              </div>
            )}
          </div>
        )}
      </NodeViewWrapper>
    );
  }

  // Render regular code block
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
          {isCopied ? (
            <Check className="h-3.5 w-3.5 code-copy-check" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span className="code-copy-text">{isCopied ? "Copied" : "Copy"}</span>
        </button>
      </div>

      {/* Code content rendered by TipTap */}
      <pre
        ref={codeRef}
        className={showLineNumbers ? "with-line-numbers" : ""}
        data-show-line-numbers={showLineNumbers}
      >
        <NodeViewContent as={"code" as "div"} className="hljs" />
      </pre>
    </NodeViewWrapper>
  );
}

// ============================================================================
// TipTap Extension
// ============================================================================

/**
 * Unified code block extension with copy functionality and mermaid rendering
 *
 * Handles all code blocks:
 * - Regular code: syntax highlighting + copy button + line numbers
 * - Mermaid code: shows code when focused, renders diagram when not
 *
 * This single extension eliminates conflicts from having separate extensions
 * for regular code blocks and mermaid blocks.
 */
export const CodeBlockWithCopy = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
});

export default CodeBlockWithCopy;
