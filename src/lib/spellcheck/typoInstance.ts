/**
 * Spell Checker Core
 *
 * Provides spell checking functionality using SymSpell algorithm.
 * Manages dictionary loading and provides checkWord/getSuggestions functions.
 *
 * Includes false positive reduction strategies:
 * - Word heuristics (ALL CAPS, numbers, short words)
 * - Pattern filtering (URLs, emails, file paths, hashes)
 * - Identifier splitting (camelCase, snake_case)
 * - Technical terms dictionary
 * - Dictionary hierarchy (personal, workspace, built-in)
 */

import { spellService } from "./symspellService";
import { dictionaryHierarchy } from "./dictionaryHierarchy";
import type { SpellCheckLanguage, SpellCheckResult } from "./types";
import { DEFAULT_LANGUAGE } from "./types";

/** Maximum number of suggestions to return */
const MAX_SUGGESTIONS = 8;

/**
 * Title prefixes that don't end a sentence.
 * A capitalized word following these is likely a proper noun (e.g., "Dr. Smith").
 * Stored lowercase for case-insensitive matching.
 */
const TITLE_PREFIXES = new Set([
  "mr", "mrs", "ms", "miss", "dr", "prof", "sr", "jr",
  "rev", "fr", "st", "hon", "pres", "gov", "sen", "rep",
  "gen", "col", "maj", "capt", "lt", "sgt", "cpl",
]);

/**
 * Common technical terms that should not be flagged.
 * These are programming-related words that standard dictionaries don't include.
 *
 * Note: These are also included in data/dictionaries/tech-terms.txt for the
 * build-time dictionary generation. This runtime set is kept for backwards
 * compatibility and fast in-memory lookups.
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
  "src", "dist", "lib", "libs", "pkg", "deps", "devdeps",
  // Markdown specific
  "frontmatter", "codeblock", "codeblocks", "blockquote", "blockquotes",
  // Editor/Jot specific
  "tiptap", "prosemirror", "wysiwyg", "contenteditable", "spellcheck",
  "autosave", "autosaved", "autosaving", "undo", "redo", "keybinding",
]);

// Initialize the dictionary hierarchy with tech terms
dictionaryHierarchy.setTechTerms(TECH_TERMS);

/** Currently active language */
let currentLanguage: SpellCheckLanguage = DEFAULT_LANGUAGE;

/** Loading state */
let isLoading = false;

/** Promise for current loading operation */
let loadingPromise: Promise<void> | null = null;

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
  // Has uppercase followed by uppercase then lowercase (e.g., XMLParser)
  // This catches acronyms followed by words
  if (/[A-Z]{2,}[a-z]/.test(word)) {
    return true;
  }
  return false;
}

/**
 * Check if a word is hyphenated (compound word).
 * Examples: "well-known", "high-quality", "self-aware"
 */
function isHyphenatedWord(word: string): boolean {
  // Must contain at least one hyphen with letters on both sides
  return /[a-zA-Z]-[a-zA-Z]/.test(word);
}

/**
 * Split a hyphenated word into its component parts.
 * Example: "well-known" -> ["well", "known"]
 * Example: "high-quality-product" -> ["high", "quality", "product"]
 */
function splitHyphenatedWord(word: string): string[] {
  return word.split("-").filter((part) => part.length > 0);
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
 * Initialize or change the spell checker language.
 *
 * Note: Currently only English (en_US) is supported with the SymSpell backend.
 * Other languages will fall back to English until additional dictionaries are added.
 */
export async function initSpellChecker(
  language: SpellCheckLanguage = DEFAULT_LANGUAGE
): Promise<void> {
  // If already loading, wait for it
  if (isLoading && loadingPromise) {
    return loadingPromise;
  }

  // If already loaded and same language, nothing to do
  if (spellService.isReady() && currentLanguage === language) {
    return;
  }

  isLoading = true;
  currentLanguage = language;

  loadingPromise = (async () => {
    try {
      // Initialize the SymSpell service
      await spellService.init();
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
  return spellService.isReady() && !isLoading;
}

/**
 * Set the personal dictionary words.
 * These words will be considered correct in addition to dictionary words.
 */
export function setPersonalDictionary(words: string[]): void {
  dictionaryHierarchy.setPersonalDictionary(words);
}

/**
 * Add a word to the personal dictionary (in memory).
 * Note: This doesn't persist - use personalDictionary.ts for persistence.
 */
export function addToPersonalDictionaryMemory(word: string): void {
  dictionaryHierarchy.addToPersonalDictionary(word);
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

  // ALL CAPS parts are likely acronyms (API, HTTP, OSX) - skip them
  if (word === word.toUpperCase() && /^[A-Z]+$/.test(word)) {
    return true;
  }

  // Check through the dictionary hierarchy
  return dictionaryHierarchy.isWordValid(word);
}

/**
 * Check if a word is spelled correctly.
 * Includes false positive reduction:
 * - Skips words matching heuristics (ALL CAPS, numbers, short words)
 * - Checks technical terms dictionary
 * - Splits camelCase/snake_case identifiers and checks each part
 * - Splits hyphenated compound words and checks each part
 */
export function checkWord(word: string): boolean {
  // Apply heuristics to skip technical content
  if (shouldSkipWord(word)) {
    return true;
  }

  // Check the dictionary hierarchy first (includes tech terms and personal dict)
  // This catches words like "JavaScript" or compound words like "well-known"
  // that might be in the dictionary as a whole
  if (dictionaryHierarchy.isWordValid(word)) {
    return true;
  }

  // If word looks like an identifier (camelCase/snake_case),
  // split it and check each part individually
  if (looksLikeIdentifier(word)) {
    const parts = splitIdentifier(word);
    // Word is correct if ALL parts are correct
    return parts.every((part) => checkWordPart(part));
  }

  // If word is hyphenated (compound word like "well-known", "high-quality"),
  // split on hyphens and check each part individually
  if (isHyphenatedWord(word)) {
    const parts = splitHyphenatedWord(word);
    // Word is correct if ALL parts are correct
    return parts.every((part) => checkWordPart(part));
  }

  // Not valid and not an identifier or hyphenated compound
  return false;
}

/**
 * Get spelling suggestions for a word
 */
export function getSuggestions(word: string): string[] {
  if (!word || !spellService.isReady()) {
    return [];
  }

  const suggestions = dictionaryHierarchy.getSuggestions(word, MAX_SUGGESTIONS);
  return suggestions;
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
  spellService.clearCache();
  isLoading = false;
  loadingPromise = null;
}

/**
 * Context about where a word appears in its sentence.
 */
export interface SentenceContext {
  /** Whether the word appears at the start of a sentence */
  isAtSentenceStart: boolean;
  /** Whether the word follows a title prefix like "Dr." or "Mr." */
  isAfterTitlePrefix: boolean;
}

/**
 * Get context about where a word appears relative to sentence boundaries.
 *
 * @param text - The full text containing the word
 * @param wordStart - Start position of the word in text
 * @param wordEnd - End position of the word in text
 * @returns Context about the word's position
 */
export function getSentenceContext(
  text: string,
  wordStart: number,
  _wordEnd: number
): SentenceContext {
  // Get text before the word
  const textBefore = text.slice(0, wordStart);

  // Check if at start of text
  const trimmedBefore = textBefore.trimEnd();
  if (trimmedBefore.length === 0) {
    return { isAtSentenceStart: true, isAfterTitlePrefix: false };
  }

  // Check what character precedes the word (ignoring whitespace)
  const lastChar = trimmedBefore[trimmedBefore.length - 1];

  // Check for title prefix (e.g., "Dr.", "Mr.")
  // Look for pattern: word + period at end of trimmedBefore
  const titleMatch = trimmedBefore.match(/\b([a-zA-Z]+)\.\s*$/);
  if (titleMatch) {
    const potentialTitle = titleMatch[1].toLowerCase();
    if (TITLE_PREFIXES.has(potentialTitle)) {
      return { isAtSentenceStart: false, isAfterTitlePrefix: true };
    }
  }

  // Sentence-ending punctuation
  if (lastChar === "." || lastChar === "!" || lastChar === "?") {
    return { isAtSentenceStart: true, isAfterTitlePrefix: false };
  }

  // Mid-sentence
  return { isAtSentenceStart: false, isAfterTitlePrefix: false };
}

/**
 * Check if a word is likely a proper noun based on capitalization and context.
 *
 * Heuristics:
 * 1. Lowercase words are never proper nouns
 * 2. Words at sentence start are NOT assumed to be proper nouns (could be either)
 * 3. Capitalized words mid-sentence are likely proper nouns
 * 4. Words after title prefixes (Dr., Mr.) are likely proper nouns
 *
 * @param word - The word to check
 * @param fullText - The full text containing the word (for context)
 * @returns true if the word is likely a proper noun
 */
export function isLikelyProperNoun(word: string, fullText: string): boolean {
  // Must be capitalized (first letter uppercase)
  if (!word || word[0] !== word[0].toUpperCase() || word[0] === word[0].toLowerCase()) {
    return false;
  }

  // Find word position in text
  const wordIndex = fullText.indexOf(word);
  if (wordIndex === -1) {
    return false;
  }

  const context = getSentenceContext(fullText, wordIndex, wordIndex + word.length);

  // Words after title prefixes are proper nouns
  if (context.isAfterTitlePrefix) {
    return true;
  }

  // Words at sentence start are not assumed to be proper nouns
  if (context.isAtSentenceStart) {
    return false;
  }

  // Mid-sentence capitalized word = likely proper noun
  return true;
}

/**
 * Check if a word has internal capitals (camelCase pattern).
 * This detects words like: iPhone, MacBook, GitHub, getUserName
 *
 * These words should be handled by identifier splitting rather than
 * proper noun detection.
 */
export function hasMultipleCapitals(word: string): boolean {
  if (!word || word.length < 2) return false;
  // Check for internal capitals (lowercase followed by uppercase)
  return /[a-z][A-Z]/.test(word);
}

/**
 * Check a word's spelling considering its context in the text.
 * This is the context-aware version of checkWord that handles proper nouns.
 *
 * @param word - The word to check
 * @param fullText - The full text containing the word (for context)
 * @returns true if the word is spelled correctly or is a proper noun
 */
export function checkWordInContext(word: string, fullText: string): boolean {
  // First apply all standard heuristics
  if (shouldSkipWord(word)) {
    return true;
  }

  // Skip words with multiple capitals (likely brand names: iPhone, MacBook, GitHub)
  if (hasMultipleCapitals(word)) {
    return true;
  }

  // Check if it's likely a proper noun based on context
  if (isLikelyProperNoun(word, fullText)) {
    return true;
  }

  // Standard spell check
  return checkWord(word);
}
