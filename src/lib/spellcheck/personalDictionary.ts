/**
 * Personal Dictionary Management
 *
 * Handles loading, saving, and managing the personal dictionary via Tauri.
 * The personal dictionary is stored in the app data directory.
 */

import { invoke } from "@tauri-apps/api/core";
import type { PersonalDictionary } from "./types";
import { DEFAULT_PERSONAL_DICTIONARY } from "./types";
import { dictionaryHierarchy } from "./dictionaryHierarchy";

/** Cached personal dictionary */
let cachedDictionary: PersonalDictionary | null = null;

/**
 * Load the personal dictionary from disk
 */
export async function loadPersonalDictionary(): Promise<PersonalDictionary> {
  try {
    const result = await invoke<PersonalDictionary | null>("jot_read_personal_dictionary");

    if (result) {
      cachedDictionary = result;
      // Update dictionary hierarchy
      dictionaryHierarchy.setPersonalDictionary(result.words.map((w) => w.word));
      return result;
    }

    // Return default if no dictionary exists
    cachedDictionary = DEFAULT_PERSONAL_DICTIONARY;
    return cachedDictionary;
  } catch (error) {
    console.error("Failed to load personal dictionary:", error);
    cachedDictionary = DEFAULT_PERSONAL_DICTIONARY;
    return cachedDictionary;
  }
}

/**
 * Get the cached personal dictionary (or load if not cached)
 */
export async function getPersonalDictionary(): Promise<PersonalDictionary> {
  if (cachedDictionary) {
    return cachedDictionary;
  }
  return loadPersonalDictionary();
}

/**
 * Add a word to the personal dictionary
 */
export async function addToPersonalDictionary(word: string): Promise<void> {
  const normalizedWord = word.trim();
  if (!normalizedWord) {
    return;
  }

  try {
    await invoke("jot_add_to_personal_dictionary", { word: normalizedWord });

    // Update cache
    if (cachedDictionary) {
      const exists = cachedDictionary.words.some(
        (w) => w.word.toLowerCase() === normalizedWord.toLowerCase()
      );
      if (!exists) {
        cachedDictionary.words.push({
          word: normalizedWord,
          addedAt: Date.now(),
        });
      }
    }

    // Update dictionary hierarchy
    dictionaryHierarchy.addToPersonalDictionary(normalizedWord);
  } catch (error) {
    console.error("Failed to add word to personal dictionary:", error);
    throw error;
  }
}

/**
 * Remove a word from the personal dictionary
 */
export async function removeFromPersonalDictionary(word: string): Promise<void> {
  const normalizedWord = word.trim();
  if (!normalizedWord) {
    return;
  }

  try {
    await invoke("jot_remove_from_personal_dictionary", { word: normalizedWord });

    // Update cache
    if (cachedDictionary) {
      cachedDictionary.words = cachedDictionary.words.filter(
        (w) => w.word.toLowerCase() !== normalizedWord.toLowerCase()
      );
    }

    // Reload dictionary hierarchy from cache
    if (cachedDictionary) {
      dictionaryHierarchy.setPersonalDictionary(cachedDictionary.words.map((w) => w.word));
    }
  } catch (error) {
    console.error("Failed to remove word from personal dictionary:", error);
    throw error;
  }
}

/**
 * Check if a word is in the personal dictionary
 */
export async function isInPersonalDictionary(word: string): Promise<boolean> {
  const dict = await getPersonalDictionary();
  return dict.words.some(
    (w) => w.word.toLowerCase() === word.toLowerCase()
  );
}

/**
 * Get all words in the personal dictionary
 */
export async function getPersonalDictionaryWords(): Promise<string[]> {
  const dict = await getPersonalDictionary();
  return dict.words.map((w) => w.word);
}

/**
 * Clear the personal dictionary cache (useful for testing)
 */
export function clearCache(): void {
  cachedDictionary = null;
}
