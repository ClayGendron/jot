/**
 * MermaidBlock Extension
 *
 * TipTap extension that renders Mermaid diagrams inline.
 * Detects ```mermaid code blocks and displays rendered diagrams
 * with edit mode, theme support, and export functionality.
 */

import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import DOMPurify from "dompurify";
import { renderMermaid, isMermaidLoaded } from "@/lib/mermaid/loader";
import { resolveTheme } from "@/lib/mermaid/themes";
import {
  exportAsSvg,
  exportAsPng,
  downloadBlob,
  generateExportFilename,
} from "@/lib/mermaid/exporter";

/**
 * Configure DOMPurify for SVG sanitization
 * Only allow safe SVG elements and attributes
 */
const purifyConfig = {
  USE_PROFILES: { svg: true, svgFilters: true },
  // Allow common SVG elements and attributes that Mermaid uses
  ADD_TAGS: ["foreignObject"] as string[],
  ADD_ATTR: ["target", "xlink:href", "xlink:title"] as string[],
};

/** Debounce delay for re-rendering while editing (ms) */
const RENDER_DEBOUNCE_MS = 400;

/**
 * Custom node view for Mermaid diagram blocks
 *
 * Features:
 * - Lazy-loaded mermaid.js rendering
 * - Toggle between diagram view and source edit mode
 * - Theme synchronization (light/dark)
 * - Export as SVG/PNG
 * - Error display for invalid syntax
 */
function MermaidBlockView({ node }: NodeViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!isMermaidLoaded());
  const [showExportMenu, setShowExportMenu] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get source from node
  const source = node.textContent || "";

  // Detect system theme (simplified - could use Zustand store if available)
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

  // Debounced render function
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
          // Sanitize SVG output to prevent XSS
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

  // Render diagram when source or theme changes
  useEffect(() => {
    debouncedRender(source, systemTheme);

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [source, systemTheme, debouncedRender]);

  // Handle click outside export menu to close it
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

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape exits edit mode
      if (e.key === "Escape" && isEditing) {
        e.preventDefault();
        setIsEditing(false);
      }
    };

    if (isEditing) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isEditing]);

  // Toggle edit mode
  const handleToggleEdit = useCallback(() => {
    setIsEditing((prev) => !prev);
  }, []);

  // Click on diagram enters edit mode
  const handleDiagramClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  // Export handlers
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
      // Log export failures - user sees menu close but no file, so log helps debug
      console.error("PNG export failed:", err);
    }
    setShowExportMenu(false);
  }, [svgContent, source]);

  return (
    <NodeViewWrapper
      ref={containerRef}
      className="mermaid-block"
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
          <DiagramIcon />
          mermaid
        </span>

        <div className={`mermaid-controls ${isHovered ? "visible" : ""}`}>
          {/* Edit/View toggle */}
          <button
            type="button"
            className={`mermaid-control-btn ${isEditing ? "active" : ""}`}
            onClick={handleToggleEdit}
            title={isEditing ? "Preview diagram" : "Edit source"}
            aria-label={isEditing ? "Preview diagram" : "Edit source"}
          >
            {isEditing ? <EyeIcon /> : <CodeIcon />}
            <span>{isEditing ? "Preview" : "Edit"}</span>
          </button>

          {/* Export dropdown */}
          {!isEditing && svgContent && (
            <div className="mermaid-export-wrapper" ref={exportMenuRef}>
              <button
                type="button"
                className="mermaid-control-btn"
                onClick={() => setShowExportMenu(!showExportMenu)}
                title="Export diagram"
                aria-label="Export diagram"
                aria-expanded={showExportMenu}
              >
                <DownloadIcon />
                <span>Export</span>
              </button>

              {showExportMenu && (
                <div className="mermaid-export-menu">
                  <button
                    type="button"
                    className="mermaid-export-option"
                    onClick={handleExportSvg}
                  >
                    <SvgIcon />
                    Export as SVG
                  </button>
                  <button
                    type="button"
                    className="mermaid-export-option"
                    onClick={handleExportPng}
                  >
                    <ImageIcon />
                    Export as PNG
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content area - either diagram or source code */}
      {isEditing ? (
        <div className="mermaid-source-wrapper">
          <pre className="mermaid-source">
            <NodeViewContent as={"code" as "div"} />
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
              onClick={handleDiagramClick}
              onKeyDown={(e) => e.key === "Enter" && handleDiagramClick()}
              role="button"
              tabIndex={0}
              aria-label="Click to edit diagram source"
              // Safe: SVG is sanitized by DOMPurify before rendering (see purifyConfig)
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          )}

          {!isLoading && error && (
            <div className="mermaid-error" data-testid="mermaid-error">
              <div className="mermaid-error-header">
                <ErrorIcon />
                <span>Syntax Error</span>
              </div>
              <pre className="mermaid-error-message">{error}</pre>
              <button
                type="button"
                className="mermaid-error-action"
                onClick={handleToggleEdit}
              >
                Edit source to fix
              </button>
            </div>
          )}

          {!isLoading && !svgContent && !error && (
            <div className="mermaid-empty">
              <span>Empty diagram</span>
              <button
                type="button"
                className="mermaid-empty-action"
                onClick={handleToggleEdit}
              >
                Add diagram code
              </button>
            </div>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}

// ============================================================================
// Icons
// ============================================================================

function DiagramIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 17.5h7" />
      <path d="M17.5 14v7" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function SvgIcon() {
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 12l3-3 3 3 4-4" />
    </svg>
  );
}

function ImageIcon() {
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

function ErrorIcon() {
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
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

// ============================================================================
// TipTap Extension
// ============================================================================

/**
 * Extended CodeBlockLowlight that renders Mermaid diagrams
 *
 * This extension renders Mermaid diagrams visually when the language is "mermaid".
 * For non-mermaid blocks, it behaves like CodeBlockLowlight.
 *
 * Design note: We extend CodeBlockLowlight and always use our NodeView renderer.
 * The MermaidBlockView component checks the language and either:
 * - Renders the diagram (for mermaid blocks)
 * - Could fall back to regular code display (but we rely on CodeBlockWithCopy for that)
 *
 * In Editor.tsx, both CodeBlockWithCopy and MermaidBlock should be registered,
 * with MermaidBlock having a higher priority to intercept mermaid blocks.
 *
 * IMPORTANT: We disable input rules and keyboard shortcuts to prevent this extension
 * from intercepting regular code block creation. Only HTML parsing should create
 * mermaidBlock nodes (from existing ```mermaid blocks in documents).
 */
export const MermaidBlock = CodeBlockLowlight.extend({
  name: "mermaidBlock",

  // Higher priority than codeBlock to intercept mermaid blocks first
  priority: 1001,

  // Only parse mermaid code blocks
  parseHTML() {
    return [
      {
        tag: "pre",
        preserveWhitespace: "full",
        getAttrs: (node) => {
          if (typeof node === "string") return false;
          const codeEl = node.querySelector("code");
          if (!codeEl) return false;

          // Only match mermaid language
          const classAttr = codeEl.getAttribute("class") || "";
          const isMermaid =
            classAttr.includes("language-mermaid") ||
            classAttr.includes("mermaid");

          if (!isMermaid) return false;

          return {
            language: "mermaid",
          };
        },
      },
    ];
  },

  // Disable input rules - we don't want ``` to create mermaid blocks
  // Regular code blocks are handled by CodeBlockWithCopy
  addInputRules() {
    return [];
  },

  // Disable keyboard shortcuts inherited from CodeBlockLowlight
  addKeyboardShortcuts() {
    return {};
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidBlockView);
  },
});

export default MermaidBlock;
