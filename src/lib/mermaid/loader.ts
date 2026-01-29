/**
 * Mermaid Lazy Loader
 *
 * Handles dynamic import of mermaid.js (~2MB) to avoid bloating the initial bundle.
 * Caches the loaded instance for subsequent renders.
 */

import type { MermaidConfig } from "mermaid";

/** Cached mermaid instance after first load */
let mermaidInstance: typeof import("mermaid").default | null = null;

/** Promise for in-flight loading (prevents duplicate imports) */
let loadingPromise: Promise<typeof import("mermaid").default> | null = null;

/** Counter for generating unique diagram IDs */
let renderCounter = 0;

/** Track last initialized theme to avoid re-initialization */
let lastInitializedTheme: "light" | "dark" | null = null;

/**
 * Lazily load and initialize mermaid.js
 *
 * First call triggers dynamic import (~2MB).
 * Subsequent calls return cached instance immediately.
 */
export async function getMermaid(): Promise<typeof import("mermaid").default> {
  if (mermaidInstance) {
    return mermaidInstance;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = import("mermaid").then((mod) => {
    mermaidInstance = mod.default;

    // Initialize with secure defaults
    mermaidInstance.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "default",
      fontFamily: "var(--font-sans)",
    });

    return mermaidInstance;
  });

  return loadingPromise;
}

/**
 * Render a mermaid diagram to SVG
 *
 * @param source - Mermaid diagram source code
 * @param theme - Theme to use for rendering ("light" | "dark")
 * @returns Promise resolving to SVG string
 * @throws Error if mermaid syntax is invalid
 */
export async function renderMermaid(
  source: string,
  theme: "light" | "dark" = "light"
): Promise<string> {
  const mermaid = await getMermaid();

  // Generate unique ID for this render
  const id = `mermaid-${Date.now()}-${++renderCounter}`;

  // Only re-initialize if theme changed (performance optimization)
  if (lastInitializedTheme !== theme) {
    const themeConfig: MermaidConfig = {
      theme: theme === "dark" ? "dark" : "default",
    };

    mermaid.initialize({
      ...themeConfig,
      startOnLoad: false,
      securityLevel: "strict",
      fontFamily: "var(--font-sans)",
    });

    lastInitializedTheme = theme;
  }

  // Render diagram
  const { svg } = await mermaid.render(id, source);

  return svg;
}

/**
 * Check if mermaid is already loaded
 * Useful for showing loading states
 */
export function isMermaidLoaded(): boolean {
  return mermaidInstance !== null;
}
