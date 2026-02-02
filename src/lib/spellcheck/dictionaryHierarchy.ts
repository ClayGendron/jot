/**
 * Dictionary Hierarchy
 *
 * Implements a tiered dictionary lookup system:
 * 1. Session ignores (highest priority, temporary)
 * 2. Personal dictionary (user-wide, persisted)
 * 3. Workspace dictionary (project-specific, in .jot/)
 * 4. Built-in dictionary (via SymSpell service)
 *
 * This hierarchy ensures that user customizations take precedence
 * over the built-in dictionary, and project-specific terms are
 * recognized within their workspace.
 */

import { spellService } from "./symspellService";

/**
 * Manages a tiered dictionary hierarchy for spell checking.
 *
 * Order of precedence (highest to lowest):
 * 1. Session ignores - temporary, cleared on editor close
 * 2. Personal dictionary - stored in app data, synced across workspaces
 * 3. Workspace dictionary - stored in .jot/dictionary.txt
 * 4. Built-in dictionary - SymSpell dictionary
 */
export class DictionaryHierarchy {
  /** Words ignored for this session only */
  private sessionIgnores = new Set<string>();

  /** Personal dictionary words (user-wide) */
  private personalDict = new Set<string>();

  /** Workspace-specific dictionary */
  private workspaceDict = new Set<string>();

  /** Technical terms that are always valid */
  private techTerms = new Set<string>();

  /**
   * Set the technical terms dictionary.
   * These are programming-related words that should always be valid.
   */
  setTechTerms(terms: Iterable<string>): void {
    this.techTerms.clear();
    for (const term of terms) {
      this.techTerms.add(term.toLowerCase());
    }
  }

  /**
   * Set the personal dictionary words.
   * Called after loading from disk.
   */
  setPersonalDictionary(words: Iterable<string>): void {
    this.personalDict.clear();
    for (const word of words) {
      const lower = word.toLowerCase();
      this.personalDict.add(lower);
      // Also update the spell service cache
      spellService.addToValidCache(lower);
    }
  }

  /**
   * Add a word to the personal dictionary.
   */
  addToPersonalDictionary(word: string): void {
    const lower = word.toLowerCase();
    this.personalDict.add(lower);
    spellService.addToValidCache(lower);
  }

  /**
   * Remove a word from the personal dictionary.
   */
  removeFromPersonalDictionary(word: string): void {
    const lower = word.toLowerCase();
    this.personalDict.delete(lower);
    // Don't remove from spell service cache - it might still be in built-in dict
  }

  /**
   * Set the workspace dictionary words.
   * Called after loading from .jot/dictionary.txt.
   */
  setWorkspaceDictionary(words: Iterable<string>): void {
    this.workspaceDict.clear();
    for (const word of words) {
      const lower = word.toLowerCase();
      this.workspaceDict.add(lower);
      spellService.addToValidCache(lower);
    }
  }

  /**
   * Add a word to the workspace dictionary.
   */
  addToWorkspaceDictionary(word: string): void {
    const lower = word.toLowerCase();
    this.workspaceDict.add(lower);
    spellService.addToValidCache(lower);
  }

  /**
   * Clear the workspace dictionary (when changing workspaces).
   */
  clearWorkspaceDictionary(): void {
    // Note: We don't remove from spell service cache because
    // the words might still be valid in the built-in dict
    this.workspaceDict.clear();
  }

  /**
   * Ignore a word for this session only.
   */
  ignoreForSession(word: string): void {
    const lower = word.toLowerCase();
    this.sessionIgnores.add(lower);
    spellService.addToValidCache(lower);
  }

  /**
   * Check if a word is ignored for this session.
   */
  isSessionIgnored(word: string): boolean {
    return this.sessionIgnores.has(word.toLowerCase());
  }

  /**
   * Clear session ignores.
   */
  clearSessionIgnores(): void {
    this.sessionIgnores.clear();
    // Note: We should ideally remove these from spell service cache,
    // but it's safer to leave them since they might be valid elsewhere
  }

  /**
   * Check if a word is valid according to the dictionary hierarchy.
   *
   * Checks in order:
   * 1. Session ignores
   * 2. Personal dictionary
   * 3. Workspace dictionary
   * 4. Tech terms dictionary
   * 5. Built-in SymSpell dictionary
   *
   * @param word The word to check
   * @returns true if the word is valid
   */
  isWordValid(word: string): boolean {
    const lower = word.toLowerCase();

    // 1. Session ignores (highest priority)
    if (this.sessionIgnores.has(lower)) {
      return true;
    }

    // 2. Personal dictionary
    if (this.personalDict.has(lower)) {
      return true;
    }

    // 3. Workspace dictionary
    if (this.workspaceDict.has(lower)) {
      return true;
    }

    // 4. Tech terms
    if (this.techTerms.has(lower)) {
      return true;
    }

    // 5. Built-in dictionary (via SymSpell)
    return spellService.checkWord(word);
  }

  /**
   * Check if a word is in the personal dictionary.
   */
  isInPersonalDictionary(word: string): boolean {
    return this.personalDict.has(word.toLowerCase());
  }

  /**
   * Check if a word is in the workspace dictionary.
   */
  isInWorkspaceDictionary(word: string): boolean {
    return this.workspaceDict.has(word.toLowerCase());
  }

  /**
   * Check if a word is a tech term.
   */
  isTechTerm(word: string): boolean {
    return this.techTerms.has(word.toLowerCase());
  }

  /**
   * Get all words from a specific dictionary tier.
   */
  getSessionIgnores(): Set<string> {
    return new Set(this.sessionIgnores);
  }

  getPersonalDictionaryWords(): string[] {
    return [...this.personalDict];
  }

  getWorkspaceDictionaryWords(): string[] {
    return [...this.workspaceDict];
  }

  /**
   * Get suggestions for a misspelled word.
   * Delegates to the spell service.
   */
  getSuggestions(word: string, limit?: number): string[] {
    return spellService.getSuggestions(word, limit);
  }
}

/** Singleton instance */
export const dictionaryHierarchy = new DictionaryHierarchy();
