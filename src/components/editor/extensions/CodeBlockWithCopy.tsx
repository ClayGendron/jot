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
import { cn } from "@/lib/utils";
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
        className={cn(
          "relative my-6 border border-[var(--color-border)] rounded-[10px] overflow-hidden bg-[var(--color-paper)] shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.5)]",
          selected && "border-[var(--color-border-strong)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-accent)_15%,transparent),0_1px_3px_rgba(0,0,0,0.04)]"
        )}
        data-testid="mermaid-block"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setShowExportMenu(false);
        }}
      >
        {/* Header with badge and controls */}
        <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-b from-[var(--color-border)] to-[color-mix(in_srgb,var(--color-border)_85%,var(--color-paper))] border-b border-[var(--color-border)]">
          <span className="inline-flex items-center gap-1.5 font-mono text-[0.6875rem] font-medium lowercase tracking-wide text-[var(--color-ink-muted)] px-2.5 py-0.5 bg-[var(--color-paper)] rounded-[5px] shadow-[0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.6)]">
            <GitBranch className="h-3 w-3 opacity-70" aria-hidden="true" />
            mermaid
          </span>

          <div className={cn(
            "flex items-center gap-1.5 opacity-0 translate-x-1 transition-all duration-[180ms] ease-out pointer-events-none",
            isHovered && "opacity-100 translate-x-0 pointer-events-auto"
          )}>
            {/* Copy button */}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 border-none rounded-[5px] bg-[var(--color-paper)] text-[var(--color-ink-muted)] font-sans text-[0.6875rem] font-medium cursor-pointer transition-all duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] hover:bg-[var(--color-paper-warm)] hover:text-[var(--color-ink)] hover:shadow-[0_2px_4px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.6)]"
              onClick={handleCopy}
              title="Copy source"
              aria-label={isCopied ? "Copied!" : "Copy source"}
            >
              {isCopied ? (
                <Check className="h-3.5 w-3.5 text-[#5a8f5a]" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{isCopied ? "Copied" : "Copy"}</span>
            </button>

            {/* Export dropdown - only when showing diagram */}
            {showDiagram && svgContent && (
              <div className="relative" ref={exportMenuRef}>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 border-none rounded-[5px] bg-[var(--color-paper)] text-[var(--color-ink-muted)] font-sans text-[0.6875rem] font-medium cursor-pointer transition-all duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] hover:bg-[var(--color-paper-warm)] hover:text-[var(--color-ink)]"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  title="Export diagram"
                  aria-label="Export diagram"
                  aria-expanded={showExportMenu}
                >
                  <Download className="h-3 w-3" aria-hidden="true" />
                  <span>Export</span>
                </button>

                {showExportMenu && (
                  <div className="absolute top-[calc(100%+4px)] right-0 min-w-[140px] p-1.5 bg-[var(--color-paper)] border border-[var(--color-border)] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06)] z-[100] animate-in fade-in-0 zoom-in-95 duration-150">
                    <button
                      type="button"
                      className="flex items-center gap-2 w-full px-2.5 py-2 border-none rounded-[5px] bg-transparent text-[var(--color-ink)] font-sans text-xs font-normal text-left cursor-pointer transition-colors duration-150 hover:bg-[var(--color-paper-warm)]"
                      onClick={handleExportSvg}
                    >
                      <FileCode className="h-3.5 w-3.5 text-[var(--color-ink-muted)]" aria-hidden="true" />
                      Export as SVG
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-2 w-full px-2.5 py-2 border-none rounded-[5px] bg-transparent text-[var(--color-ink)] font-sans text-xs font-normal text-left cursor-pointer transition-colors duration-150 hover:bg-[var(--color-paper-warm)]"
                      onClick={handleExportPng}
                    >
                      <Image className="h-3.5 w-3.5 text-[var(--color-ink-muted)]" aria-hidden="true" />
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
          <div className="p-0">
            <pre ref={codeRef} className="m-0 px-5 py-4 font-mono text-sm leading-relaxed text-[var(--color-ink)] whitespace-pre-wrap break-words bg-[var(--color-paper-warm)] rounded-b-[9px]">
              <NodeViewContent as={"code" as "div"} className="hljs" />
            </pre>
          </div>
        ) : (
          <div className="min-h-[120px] flex flex-col">
            {isLoading && (
              <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 text-[var(--color-ink-muted)] font-sans text-[0.8125rem]" data-testid="mermaid-loading">
                <div className="w-5 h-5 border-2 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin" />
                <span>Rendering diagram...</span>
              </div>
            )}

            {!isLoading && svgContent && (
              <div
                className="px-8 py-6 flex justify-center items-center cursor-pointer transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--color-paper-warm)_50%,transparent)] focus:outline-2 focus:outline-[var(--color-accent)] focus:outline-offset-[-2px] focus:rounded-b-[9px] [&_svg]:max-w-full [&_svg]:h-auto"
                aria-label="Mermaid diagram - click to edit"
                // Safe: SVG is sanitized by DOMPurify before rendering
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            )}

            {!isLoading && error && (
              <div className="px-5 py-4 bg-[color-mix(in_srgb,var(--color-accent)_8%,var(--color-paper))] border-t border-[color-mix(in_srgb,var(--color-accent)_25%,var(--color-border))]" data-testid="mermaid-error">
                <div className="flex items-center gap-2 mb-2 text-[var(--color-accent)] font-sans text-xs font-semibold uppercase tracking-wider">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Syntax Error</span>
                </div>
                <pre className="m-0 mb-3 px-3 py-2.5 font-mono text-xs leading-normal text-[var(--color-ink)] bg-[var(--color-paper)] rounded-[5px] border border-[var(--color-border)] whitespace-pre-wrap overflow-x-auto">{error}</pre>
                <p className="m-0 text-xs text-[var(--color-ink-muted)] italic">Click to edit and fix</p>
              </div>
            )}

            {!isLoading && !svgContent && !error && (
              <div className="flex flex-col items-center justify-center gap-2.5 py-8 px-4 text-[var(--color-ink-muted)] font-sans text-[0.8125rem]">
                <span>Empty diagram</span>
                <p className="m-0 text-xs text-[var(--color-ink-muted)] italic">Click to add diagram code</p>
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
      className="code-block-wrapper relative my-6"
      data-testid="code-block-container"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header bar with language and copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--color-border)] border border-[var(--color-border)] border-b-0 rounded-t-lg min-h-[2.25rem]">
        {showLanguageBadge && (
          <span className="font-mono text-[0.6875rem] font-medium lowercase tracking-wide text-[var(--color-ink-muted)] px-2 py-0.5 bg-[var(--color-paper-warm)] rounded" data-testid="code-language-badge">
            {language}
          </span>
        )}
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 border-none rounded bg-[var(--color-paper)] text-[var(--color-ink-muted)] font-sans text-[0.6875rem] font-medium cursor-pointer transition-all duration-150 ml-auto hover:bg-[var(--color-paper-warm)] hover:text-[var(--color-ink)] active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-1",
            isHovered ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
          onClick={handleCopy}
          aria-label={isCopied ? "Copied!" : "Copy code"}
          tabIndex={0}
        >
          {isCopied ? (
            <Check className="h-3.5 w-3.5 text-[#5a8f5a]" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span className="uppercase tracking-wide">{isCopied ? "Copied" : "Copy"}</span>
        </button>
      </div>

      {/* Code content rendered by TipTap */}
      <pre
        ref={codeRef}
        className={cn(
          "m-0 rounded-t-none rounded-b-lg",
          showLineNumbers && "with-line-numbers"
        )}
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
