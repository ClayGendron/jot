/**
 * Shiki Lazy Loader
 *
 * Handles dynamic import of Shiki syntax highlighter to avoid bloating the initial bundle.
 * Caches the loaded instance and languages for subsequent renders.
 * Follows the pattern established by src/lib/mermaid/loader.ts
 */

import type { Highlighter, BundledTheme, BundledLanguage } from "shiki";

/** Cached Shiki highlighter instance after first load */
let highlighterInstance: Highlighter | null = null;

/** Promise for in-flight loading (prevents duplicate imports) */
let loadingPromise: Promise<Highlighter> | null = null;

/** Track which languages have been loaded */
const loadedLanguages = new Set<string>();

/** Default themes to bundle */
const DEFAULT_THEMES: BundledTheme[] = ["github-light", "github-dark"];

/** Common languages to preload */
const COMMON_LANGUAGES: BundledLanguage[] = [
  "javascript",
  "typescript",
  "json",
  "html",
  "css",
  "markdown",
  "bash",
  "python",
  "rust",
  "go",
];

/**
 * Lazily load and initialize Shiki highlighter
 *
 * First call triggers dynamic import.
 * Subsequent calls return cached instance immediately.
 */
export async function getShikiHighlighter(): Promise<Highlighter> {
  if (highlighterInstance) {
    return highlighterInstance;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = import("shiki").then(async ({ createHighlighter }) => {
    highlighterInstance = await createHighlighter({
      themes: DEFAULT_THEMES,
      langs: COMMON_LANGUAGES,
    });
    COMMON_LANGUAGES.forEach((lang) => loadedLanguages.add(lang));
    return highlighterInstance;
  });

  return loadingPromise;
}

/**
 * Highlight code with syntax coloring
 *
 * @param code - Source code to highlight
 * @param lang - Language identifier (e.g., "typescript", "python")
 * @param theme - Theme to use ("github-light" or "github-dark")
 * @returns Promise resolving to HTML string with syntax highlighting
 */
export async function highlightCode(
  code: string,
  lang: string,
  theme: BundledTheme = "github-light"
): Promise<string> {
  const highlighter = await getShikiHighlighter();

  // Load language on demand if not already loaded
  if (lang && !loadedLanguages.has(lang)) {
    try {
      await highlighter.loadLanguage(lang as BundledLanguage);
      loadedLanguages.add(lang);
    } catch {
      // Language not supported, fall back to plain text
      lang = "text";
    }
  }

  return highlighter.codeToHtml(code, {
    lang: lang || "text",
    theme,
  });
}

/**
 * Check if Shiki is already loaded
 * Useful for showing loading states
 */
export function isShikiLoaded(): boolean {
  return highlighterInstance !== null;
}

/**
 * Check if a specific language is loaded
 */
export function isLanguageLoaded(lang: string): boolean {
  return loadedLanguages.has(lang);
}
