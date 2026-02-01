/**
 * Typo.js Spell Checker Instance
 *
 * Manages a singleton Typo.js instance with lazy dictionary loading.
 * Provides checkWord and getSuggestions functions.
 *
 * Includes false positive reduction strategies:
 * - Word heuristics (ALL CAPS, numbers, short words)
 * - Pattern filtering (URLs, emails, file paths, hashes)
 * - Identifier splitting (camelCase, snake_case)
 * - Technical terms dictionary
 */

import Typo from "typo-js";
import type { SpellCheckLanguage, SpellCheckResult } from "./types";
import { DEFAULT_LANGUAGE } from "./types";

/** Maximum number of suggestions to return */
const MAX_SUGGESTIONS = 8;

/**
 * Common technical terms that Hunspell dictionaries don't include.
 * These are programming-related words that should not be flagged.
 */
const TECH_TERMS = new Set([
  // Languages & runtimes
  "javascript", "typescript", "golang", "python", "nodejs", "deno", "bun",
  "rust", "kotlin", "scala", "clojure", "elixir", "erlang", "haskell",
  // Frameworks & libraries
  "react", "vue", "svelte", "angular", "nextjs", "nuxt", "remix", "astro",
  "tailwind", "webpack", "vite", "rollup", "esbuild", "parcel", "turbopack",
  "redux", "zustand", "jotai", "mobx", "pinia", "vuex",
  "express", "fastify", "koa", "nestjs", "django", "flask", "fastapi",
  "prisma", "drizzle", "sequelize", "typeorm", "mongoose",
  "jest", "vitest", "mocha", "cypress", "playwright", "puppeteer",
  // Tools & platforms
  "github", "gitlab", "bitbucket", "vercel", "netlify", "heroku", "aws",
  "docker", "kubernetes", "nginx", "redis", "postgres", "postgresql",
  "mongodb", "sqlite", "mysql", "graphql", "restful", "grpc",
  "npm", "yarn", "pnpm", "homebrew", "chocolatey", "scoop",
  // Common programming terms
  "async", "await", "const", "middleware", "callback", "navbar", "dropdown",
  "tooltip", "popover", "sidebar", "frontend", "backend", "fullstack",
  "config", "configs", "env", "params", "args", "utils", "util", "helpers",
  "auth", "oauth", "jwt", "api", "apis", "sdk", "cli", "gui", "ui", "ux",
  "todo", "todos", "fixme", "hacky", "refactor", "changelog", "readme",
  "monorepo", "polyrepo", "microservice", "microservices", "serverless",
  "webhook", "webhooks", "websocket", "websockets", "pubsub", "ssr", "ssg",
  "hydration", "rehydration", "serialization", "deserialization",
  "stringify", "eslint", "prettier", "linter", "formatter", "bundler",
  "transpiler", "minifier", "polyfill", "shim", "treeshaking",
  "debounce", "debounced", "throttle", "throttled", "memoize", "memoized",
  "mutex", "semaphore", "deadlock", "livelock", "stylesheet", "stylesheets",
  "viewport", "breakpoint", "breakpoints", "responsive", "flexbox", "gridbox",
  "boolean", "booleans", "nullable", "nullish", "truthy", "falsy",
  "iterable", "iterator", "iterables", "destructure", "destructuring",
  "tuple", "tuples", "enum", "enums", "struct", "structs",
  // File types & extensions
  "json", "yaml", "yml", "toml", "xml", "csv", "tsx", "jsx", "mdx",
  "svg", "png", "jpg", "jpeg", "gif", "webp", "avif", "ico",
  "woff", "woff2", "ttf", "otf", "eot",
  // Protocols & standards
  "http", "https", "ftp", "ssh", "smtp", "imap", "tcp", "udp", "dns",
  "html", "css", "scss", "sass", "less", "postcss",
  // Version control
  "repo", "repos", "git", "gitignore", "gitkeep", "gitattributes",
  "rebase", "rebasing", "squash", "cherrypick", "stash", "unstaged",
  // Other common terms
  "favicon", "metadata", "timestamp", "timestamps", "uuid", "uuids",
  "regex", "regexp", "glob", "globs", "wildcard", "wildcards",
  "localhost", "hostname", "subdomain", "pathname", "querystring",
  "plugin", "plugins", "addon", "addons", "preset", "presets",
  "dev", "prod", "staging", "hotfix", "bugfix", "workaround",
  "whitelist", "blacklist", "allowlist", "blocklist", "denylist",
  "inline", "multiline", "readonly", "noop", "impl", "init",
  "src", "dist", "lib", "libs", "pkg", "deps", "devDeps",
  // Markdown specific
  "frontmatter", "codeblock", "codeblocks", "blockquote", "blockquotes",
  // Editor/Jot specific
  "tiptap", "prosemirror", "wysiwyg", "contenteditable", "spellcheck",
  "autosave", "autosaved", "autosaving", "undo", "redo", "keybinding",
]);

/** Cache of loaded Typo instances by language */
const typoCache = new Map<SpellCheckLanguage, Typo>();

/** Currently active language */
let currentLanguage: SpellCheckLanguage = DEFAULT_LANGUAGE;

/** Currently active Typo instance */
let currentTypo: Typo | null = null;

/** Loading state */
let isLoading = false;

/** Promise for current loading operation */
let loadingPromise: Promise<void> | null = null;

/** Personal dictionary words (loaded separately) */
let personalDictionaryWords = new Set<string>();

/**
 * Patterns to skip during spell checking.
 * These match technical content that should not be spell checked.
 */
const SKIP_PATTERNS: RegExp[] = [
  // URLs (http, https, ftp, etc.)
  /https?:\/\/\S+/gi,
  /ftp:\/\/\S+/gi,
  /file:\/\/\S+/gi,
  // Email addresses
  /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,
  // File paths (Unix and Windows style)
  /(?:^|[\s(])(?:\/[\w.-]+){2,}/g,
  /[A-Za-z]:\\(?:[\w.-]+\\)+[\w.-]*/g,
  // Hex colors
  /#[0-9a-f]{3,8}\b/gi,
  // UUIDs
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
  // Git commit hashes (7-40 hex chars, standalone)
  /\b[0-9a-f]{7,40}\b/gi,
  // Version numbers
  /v?\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?/gi,
];

/**
 * Check if a word should be skipped based on heuristics.
 * Returns true if the word should NOT be spell checked.
 */
export function shouldSkipWord(word: string): boolean {
  // Skip empty or very short words (< 3 chars)
  if (!word || word.length < 3) {
    return true;
  }

  // Skip ALL CAPS words (likely acronyms like API, HTTP, JSON)
  if (word.length >= 2 && word === word.toUpperCase() && /^[A-Z]+$/.test(word)) {
    return true;
  }

  // Skip words containing digits (like ES6, HTML5, v2)
  if (/\d/.test(word)) {
    return true;
  }

  // Skip words starting with @ (like @Component, @mention)
  if (word.startsWith("@")) {
    return true;
  }

  // Skip words starting with # followed by letters (hashtags)
  if (/^#[a-zA-Z]/.test(word)) {
    return true;
  }

  // Skip hex-like words (6+ hex chars)
  if (/^[0-9a-f]{6,}$/i.test(word)) {
    return true;
  }

  return false;
}

/**
 * Split a camelCase or snake_case identifier into component words.
 * Example: "getUserName" -> ["get", "User", "Name"]
 * Example: "API_KEY_VALUE" -> ["API", "KEY", "VALUE"]
 */
export function splitIdentifier(word: string): string[] {
  // First split by underscores (snake_case)
  const snakeParts = word.split("_").filter((p) => p.length > 0);

  // Then split each part by camelCase boundaries
  const allParts: string[] = [];
  for (const part of snakeParts) {
    // Split on camelCase: "getUserName" -> ["get", "User", "Name"]
    // This regex matches:
    // - lowercase followed by uppercase (camelCase boundary)
    // - uppercase followed by uppercase+lowercase (acronym end)
    const camelParts = part
      .replace(/([a-z])([A-Z])/g, "$1\0$2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1\0$2")
      .split("\0");
    allParts.push(...camelParts);
  }

  return allParts.filter((p) => p.length > 0);
}

/**
 * Check if a word looks like an identifier (camelCase or snake_case)
 */
function looksLikeIdentifier(word: string): boolean {
  // Has underscore (snake_case)
  if (word.includes("_")) {
    return true;
  }
  // Has mixed case pattern (camelCase or PascalCase)
  // Must have at least one lowercase followed by uppercase
  if (/[a-z][A-Z]/.test(word)) {
    return true;
  }
  return false;
}

/**
 * Regex to tokenize text into words.
 * Handles:
 * - Basic words
 * - Contractions (don't, it's)
 * - Hyphenated words (well-known)
 * - Possessives (John's)
 */
const WORD_REGEX = /[a-zA-Z\u00C0-\u024F\u0400-\u04FF]+(?:[''][a-zA-Z]+)?(?:-[a-zA-Z]+)*/g;

/**
 * Load a dictionary for the specified language
 */
async function loadDictionary(language: SpellCheckLanguage): Promise<Typo> {
  // Check cache first
  const cached = typoCache.get(language);
  if (cached) {
    return cached;
  }

  // Fetch dictionary files from public directory
  const basePath = `/dictionaries/${language}`;

  try {
    const [affResponse, dicResponse] = await Promise.all([
      fetch(`${basePath}/${language}.aff`),
      fetch(`${basePath}/${language}.dic`),
    ]);

    if (!affResponse.ok || !dicResponse.ok) {
      throw new Error(`Failed to load dictionary for ${language}`);
    }

    const [affData, dicData] = await Promise.all([
      affResponse.text(),
      dicResponse.text(),
    ]);

    // Create Typo instance with loaded dictionary data
    const typo = new Typo(language, affData, dicData);

    // Cache for future use
    typoCache.set(language, typo);

    return typo;
  } catch (error) {
    console.error(`Failed to load spell check dictionary for ${language}:`, error);
    throw error;
  }
}

/**
 * Initialize or change the spell checker language
 */
export async function initSpellChecker(
  language: SpellCheckLanguage = DEFAULT_LANGUAGE
): Promise<void> {
  // If already loading this language, wait for it
  if (isLoading && currentLanguage === language && loadingPromise) {
    return loadingPromise;
  }

  // If already loaded this language, nothing to do
  if (currentTypo && currentLanguage === language) {
    return;
  }

  isLoading = true;
  currentLanguage = language;

  loadingPromise = (async () => {
    try {
      currentTypo = await loadDictionary(language);
    } finally {
      isLoading = false;
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

/**
 * Get the current spell checker language
 */
export function getCurrentLanguage(): SpellCheckLanguage {
  return currentLanguage;
}

/**
 * Check if the spell checker is ready
 */
export function isSpellCheckerReady(): boolean {
  const ready = currentTypo !== null && !isLoading;
  return ready;
}

/**
 * Set the personal dictionary words
 * These words will be considered correct in addition to dictionary words
 */
export function setPersonalDictionary(words: string[]): void {
  personalDictionaryWords = new Set(words.map((w) => w.toLowerCase()));
}

/**
 * Add a word to the personal dictionary (in memory)
 * Note: This doesn't persist - use personalDictionary.ts for persistence
 */
export function addToPersonalDictionaryMemory(word: string): void {
  personalDictionaryWords.add(word.toLowerCase());
}

/**
 * Check if a single word part is spelled correctly.
 * This is used internally for checking split identifier parts.
 */
function checkWordPart(word: string): boolean {
  // Empty or very short words are considered correct
  if (!word || word.length < 2) {
    return true;
  }

  // Check personal dictionary first (case-insensitive)
  if (personalDictionaryWords.has(word.toLowerCase())) {
    return true;
  }

  // Check technical terms dictionary (case-insensitive)
  if (TECH_TERMS.has(word.toLowerCase())) {
    return true;
  }

  // If spell checker not ready, assume correct
  if (!currentTypo) {
    return true;
  }

  // Check the dictionary
  return currentTypo.check(word);
}

/**
 * Check if a word is spelled correctly.
 * Includes false positive reduction:
 * - Skips words matching heuristics (ALL CAPS, numbers, short words)
 * - Checks technical terms dictionary
 * - Splits camelCase/snake_case identifiers and checks each part
 */
export function checkWord(word: string): boolean {
  // Apply heuristics to skip technical content
  if (shouldSkipWord(word)) {
    return true;
  }

  // Check personal dictionary first (case-insensitive)
  if (personalDictionaryWords.has(word.toLowerCase())) {
    return true;
  }

  // Check technical terms dictionary (case-insensitive)
  if (TECH_TERMS.has(word.toLowerCase())) {
    return true;
  }

  // If word looks like an identifier (camelCase/snake_case),
  // split it and check each part individually
  if (looksLikeIdentifier(word)) {
    const parts = splitIdentifier(word);
    // Word is correct if ALL parts are correct
    return parts.every((part) => checkWordPart(part));
  }

  // If spell checker not ready, assume correct
  if (!currentTypo) {
    return true;
  }

  // Check the dictionary
  return currentTypo.check(word);
}

/**
 * Get spelling suggestions for a word
 */
export function getSuggestions(word: string): string[] {
  if (!currentTypo || !word) {
    return [];
  }

  const suggestions = currentTypo.suggest(word);
  return suggestions.slice(0, MAX_SUGGESTIONS);
}

/**
 * Check a word and get full result with suggestions
 */
export function checkWordWithSuggestions(word: string): SpellCheckResult {
  const correct = checkWord(word);

  return {
    word,
    correct,
    suggestions: correct ? [] : getSuggestions(word),
  };
}

/**
 * Find all ranges in the text that should be skipped (URLs, emails, etc.)
 */
function findSkipRanges(text: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];

  for (const pattern of SKIP_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      ranges.push({
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  return ranges;
}

/**
 * Check if a position is within any of the skip ranges
 */
function isInSkipRange(
  pos: number,
  ranges: Array<{ start: number; end: number }>
): boolean {
  return ranges.some((range) => pos >= range.start && pos < range.end);
}

/**
 * Tokenize text into words with their positions.
 * Filters out words that are part of URLs, emails, file paths, etc.
 */
export function tokenizeText(
  text: string
): Array<{ word: string; start: number; end: number }> {
  const words: Array<{ word: string; start: number; end: number }> = [];
  const skipRanges = findSkipRanges(text);

  let match: RegExpExecArray | null;
  while ((match = WORD_REGEX.exec(text)) !== null) {
    // Skip words that fall within skip ranges (URLs, emails, etc.)
    if (isInSkipRange(match.index, skipRanges)) {
      continue;
    }

    words.push({
      word: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return words;
}

/**
 * Check all words in a text and return misspelled ones
 */
export function checkText(
  text: string
): Array<{ word: string; start: number; end: number }> {
  const tokens = tokenizeText(text);
  return tokens.filter((token) => !checkWord(token.word));
}

/**
 * Clear the dictionary cache (useful for testing)
 */
export function clearCache(): void {
  typoCache.clear();
  currentTypo = null;
  isLoading = false;
  loadingPromise = null;
}
