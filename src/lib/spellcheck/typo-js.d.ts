/**
 * Type declarations for typo-js
 *
 * Typo.js is a JavaScript spell checker using Hunspell dictionaries.
 */

declare module "typo-js" {
  /**
   * Typo.js spell checker class
   */
  class Typo {
    /**
     * Create a new Typo instance
     *
     * @param dictionary - The dictionary name (e.g., "en_US")
     * @param affData - The contents of the .aff file
     * @param dicData - The contents of the .dic file
     * @param settings - Optional settings
     */
    constructor(
      dictionary: string,
      affData?: string | null,
      dicData?: string | null,
      settings?: {
        dictionaryPath?: string;
        asyncLoad?: boolean;
        loadedCallback?: (dictionary: Typo) => void;
      }
    );

    /**
     * Check if a word is spelled correctly
     *
     * @param word - The word to check
     * @returns True if the word is spelled correctly
     */
    check(word: string): boolean;

    /**
     * Get spelling suggestions for a word
     *
     * @param word - The word to get suggestions for
     * @param limit - Maximum number of suggestions (default: 5)
     * @returns Array of suggested corrections
     */
    suggest(word: string, limit?: number): string[];

    /**
     * Whether the dictionary has been loaded
     */
    loaded: boolean;
  }

  export default Typo;
}
