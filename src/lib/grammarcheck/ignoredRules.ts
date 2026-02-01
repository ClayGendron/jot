/**
 * Ignored Grammar Rules Management
 *
 * Handles loading, saving, and managing ignored grammar rules via Tauri.
 * The ignored rules are stored in the app data directory.
 */

import { invoke } from "@tauri-apps/api/core";
import type { IgnoredRules } from "./types";
import { DEFAULT_IGNORED_RULES } from "./types";
import { setIgnoredRules as setInMemory, addIgnoredRuleMemory } from "./harperInstance";

/** Cached ignored rules */
let cachedRules: IgnoredRules | null = null;

/**
 * Load the ignored rules from disk
 */
export async function loadIgnoredRules(): Promise<IgnoredRules> {
  try {
    const result = await invoke<IgnoredRules | null>("jot_read_ignored_grammar_rules");

    if (result) {
      cachedRules = result;
      // Update in-memory set
      setInMemory(result.rules.map((r) => r.ruleId));
      return result;
    }

    // Return default if no rules exist
    cachedRules = DEFAULT_IGNORED_RULES;
    return cachedRules;
  } catch (error) {
    console.error("Failed to load ignored grammar rules:", error);
    cachedRules = DEFAULT_IGNORED_RULES;
    return cachedRules;
  }
}

/**
 * Get the cached ignored rules (or load if not cached)
 */
export async function getIgnoredRules(): Promise<IgnoredRules> {
  if (cachedRules) {
    return cachedRules;
  }
  return loadIgnoredRules();
}

/**
 * Add a rule to the ignored list
 */
export async function addIgnoredRule(ruleId: string): Promise<void> {
  const normalizedRuleId = ruleId.trim();
  if (!normalizedRuleId) {
    return;
  }

  try {
    await invoke("jot_add_ignored_grammar_rule", { ruleId: normalizedRuleId });

    // Update cache
    if (cachedRules) {
      const exists = cachedRules.rules.some(
        (r) => r.ruleId === normalizedRuleId
      );
      if (!exists) {
        cachedRules.rules.push({
          ruleId: normalizedRuleId,
          addedAt: Date.now(),
        });
      }
    }

    // Update in-memory set
    addIgnoredRuleMemory(normalizedRuleId);
  } catch (error) {
    console.error("Failed to add ignored grammar rule:", error);
    throw error;
  }
}

/**
 * Remove a rule from the ignored list
 */
export async function removeIgnoredRule(ruleId: string): Promise<void> {
  const normalizedRuleId = ruleId.trim();
  if (!normalizedRuleId) {
    return;
  }

  try {
    await invoke("jot_remove_ignored_grammar_rule", { ruleId: normalizedRuleId });

    // Update cache
    if (cachedRules) {
      cachedRules.rules = cachedRules.rules.filter(
        (r) => r.ruleId !== normalizedRuleId
      );
    }

    // Reload in-memory set from cache
    if (cachedRules) {
      setInMemory(cachedRules.rules.map((r) => r.ruleId));
    }
  } catch (error) {
    console.error("Failed to remove ignored grammar rule:", error);
    throw error;
  }
}

/**
 * Check if a rule is in the ignored list
 */
export async function isRuleInIgnoredList(ruleId: string): Promise<boolean> {
  const rules = await getIgnoredRules();
  return rules.rules.some((r) => r.ruleId === ruleId);
}

/**
 * Get all ignored rule IDs
 */
export async function getIgnoredRuleIds(): Promise<string[]> {
  const rules = await getIgnoredRules();
  return rules.rules.map((r) => r.ruleId);
}

/**
 * Clear the ignored rules cache (useful for testing)
 */
export function clearCache(): void {
  cachedRules = null;
}
