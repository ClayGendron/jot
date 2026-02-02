/**
 * SymSpell Spell Checker Service
 *
 * High-performance spell checking using spellchecker-wasm (SymSpell algorithm).
 * Provides sub-millisecond spell checking with frequency-ranked suggestions.
 *
 * Key features:
 * - O(1) word lookup after initialization
 * - Frequency-ranked suggestions (common words first)
 * - Lazy initialization with async loading
 * - Singleton pattern for memory efficiency
 */

import type { SuggestedItem } from "spellchecker-wasm";

// The browser and nodejs versions of SpellcheckerWasm are slightly different
// so we use a generic interface for the parts we need
interface SpellcheckerInstance {
  prepareSpellchecker(
    wasmLocation: string | Response,
    dictionaryLocation: string | Response,
    bigramLocation?: string | Response,
    options?: { dictionaryEditDistance: number; countThreshold: number }
  ): Promise<void>;
  checkSpelling(
    word: string,
    options?: {
      maxEditDistance?: number;
      verbosity?: number;
      includeUnknown?: boolean;
      includeSelf?: boolean;
    }
  ): void;
  resultHandler: ((items: SuggestedItem[]) => void) | null;
}

/** Minimum word length to provide suggestions for */
const MIN_SUGGESTION_LENGTH = 4;

/** Maximum edit distance for suggestions */
const MAX_EDIT_DISTANCE = 2;

/** Maximum number of suggestions to return */
const MAX_SUGGESTIONS = 5;

/**
 * Singleton service managing the SymSpell spell checker.
 *
 * Uses spellchecker-wasm for sub-millisecond spell checking.
 */
export class SymSpellService {
  private checker: SpellcheckerInstance | null = null;
  private ready = false;
  private loading = false;
  private loadPromise: Promise<void> | null = null;

  // Cache for word validity (reduces WASM calls)
  private validWords = new Set<string>();
  private invalidWords = new Set<string>();

  // Latest results from async callback
  private lastResults: SuggestedItem[] = [];

  /**
   * Initialize the spell checker with dictionary data.
   * Safe to call multiple times - will only initialize once.
   */
  async init(): Promise<void> {
    // Already ready
    if (this.ready) return;

    // Already loading
    if (this.loading && this.loadPromise) {
      return this.loadPromise;
    }

    this.loading = true;
    this.loadPromise = this.doInit();

    try {
      await this.loadPromise;
    } finally {
      this.loading = false;
      this.loadPromise = null;
    }
  }

  private async doInit(): Promise<void> {
    try {
      // Dynamic import for browser compatibility
      const { SpellcheckerWasm } = await import("spellchecker-wasm/lib/browser/index.js");

      // Set up result handler
      const instance = new SpellcheckerWasm((results: SuggestedItem[]) => {
        this.lastResults = results;
      });
      this.checker = instance as unknown as SpellcheckerInstance;

      // Fetch the WASM binary and dictionary
      // Browser version of spellchecker-wasm expects raw Response objects from fetch()
      const [wasmResponse, dictResponse] = await Promise.all([
        fetch("/spellchecker-wasm/spellchecker-wasm.wasm"),
        fetch("/dictionaries/en-dictionary.txt"),
      ]);

      if (!wasmResponse.ok) {
        throw new Error(
          `Failed to load WASM: ${wasmResponse.status} ${wasmResponse.statusText}`
        );
      }

      if (!dictResponse.ok) {
        throw new Error(
          `Failed to load dictionary: ${dictResponse.status} ${dictResponse.statusText}`
        );
      }

      // Pass raw Response objects directly - the library streams them internally
      await this.checker.prepareSpellchecker(
        wasmResponse,
        dictResponse,
        undefined,
        {
          dictionaryEditDistance: MAX_EDIT_DISTANCE,
          countThreshold: 1,
        }
      );
      this.ready = true;
    } catch (error) {
      console.error("Failed to initialize SymSpell spell checker:", error);
      throw error;
    }
  }

  /**
   * Check if the spell checker is ready.
   */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Check if a word is spelled correctly.
   *
   * Returns true for:
   * - Words in the dictionary
   * - Words that are too short (< 2 chars)
   * - When the checker isn't ready (fail open)
   *
   * @param word The word to check
   * @returns true if the word is correct or unknown
   */
  checkWord(word: string): boolean {
    // Very short words are always "correct"
    if (!word || word.length < 2) {
      return true;
    }

    // If not ready, assume correct (fail open)
    if (!this.ready || !this.checker) {
      return true;
    }

    const lower = word.toLowerCase();

    // Check cache first
    if (this.validWords.has(lower)) {
      return true;
    }
    if (this.invalidWords.has(lower)) {
      return false;
    }

    // Check with SymSpell
    // includeSelf: true is CRITICAL - without it, correctly spelled words return []
    this.lastResults = [];
    this.checker.checkSpelling(lower, {
      maxEditDistance: MAX_EDIT_DISTANCE,
      verbosity: 0, // Top result only
      includeUnknown: false,
      includeSelf: true, // Return the word itself if it's in the dictionary
    });

    // If the word appears in results with distance 0, it's valid (exact match in dictionary)
    // If results are empty or all have distance > 0, the word is misspelled
    const isValid =
      this.lastResults.length > 0 && this.lastResults[0].distance === 0;

    // Cache the result
    if (isValid) {
      this.validWords.add(lower);
    } else {
      this.invalidWords.add(lower);
    }

    return isValid;
  }

  /**
   * Get spelling suggestions for a word.
   *
   * Only provides suggestions for words of sufficient length.
   * Suggestions are ordered by frequency (most common first).
   *
   * @param word The misspelled word
   * @param limit Maximum number of suggestions
   * @returns Array of suggested corrections
   */
  getSuggestions(word: string, limit: number = MAX_SUGGESTIONS): string[] {
    // Don't suggest for very short words
    if (!word || word.length < MIN_SUGGESTION_LENGTH) {
      return [];
    }

    // If not ready, no suggestions
    if (!this.ready || !this.checker) {
      return [];
    }

    const lower = word.toLowerCase();

    // Get suggestions with edit distance up to MAX_EDIT_DISTANCE
    // Use verbosity 1 (closest) for good balance of quality and speed
    this.lastResults = [];
    this.checker.checkSpelling(lower, {
      maxEditDistance: MAX_EDIT_DISTANCE,
      verbosity: 1, // All suggestions at smallest edit distance
      includeUnknown: false,
      includeSelf: false, // Don't include the misspelled word itself
    });

    // Sort by count (highest first) and take top N
    // Note: SuggestedItem uses 'count' not 'frequency'
    const sorted = [...this.lastResults].sort((a, b) => b.count - a.count);

    // Preserve original case if word was capitalized
    const preserveCase = word[0] === word[0].toUpperCase();

    return sorted.slice(0, limit).map((r) => {
      if (preserveCase && r.term.length > 0) {
        return r.term[0].toUpperCase() + r.term.slice(1);
      }
      return r.term;
    });
  }

  /**
   * Add a word to the valid words cache.
   * Used for personal dictionary and session ignores.
   */
  addToValidCache(word: string): void {
    const lower = word.toLowerCase();
    this.validWords.add(lower);
    this.invalidWords.delete(lower);
  }

  /**
   * Remove a word from the valid words cache.
   */
  removeFromValidCache(word: string): void {
    const lower = word.toLowerCase();
    this.validWords.delete(lower);
  }

  /**
   * Clear the word caches.
   */
  clearCache(): void {
    this.validWords.clear();
    this.invalidWords.clear();
  }
}

/** Singleton instance */
export const spellService = new SymSpellService();
