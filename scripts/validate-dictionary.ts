#!/usr/bin/env bun
/**
 * Validate Dictionary Completeness
 *
 * Verifies that the dictionary contains common inflected forms.
 * Run after building dictionary to ensure completeness.
 *
 * Usage:
 *   bun run scripts/validate-dictionary.ts
 */

import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DICTIONARY_PATH = join(
  __dirname,
  "..",
  "public",
  "dictionaries",
  "en-dictionary.txt"
);

const TEST_WORDS = [
  // Original problem words
  "runs",
  "decisions",
  "weeks",
  "prevents",
  // Plurals
  "boxes",
  "cities",
  "days",
  "children",
  "men",
  "women",
  // Past tense
  "decided",
  "prevented",
  "walked",
  "played",
  "tried",
  "ran",
  "went",
  // Present participle
  "running",
  "making",
  "going",
  "playing",
  "trying",
  // Third person singular
  "makes",
  "goes",
  "plays",
  "tries",
  "has",
  "does",
  // Comparatives/superlatives
  "bigger",
  "biggest",
  "faster",
  "fastest",
  "better",
  "best",
  // Common affixes
  "unhappy",
  "rewrite",
  "dislike",
  "preview",
  "unfortunately",
  // Tech terms (only ones expected in SCOWL, not custom tech-terms.txt)
  "roadmap",
];

async function validate(): Promise<void> {
  console.log("Validating dictionary completeness...\n");

  const content = await readFile(DICTIONARY_PATH, "utf-8");
  const dictionary = new Set(
    content
      .split("\n")
      .map((line) => line.split(" ")[0].toLowerCase())
      .filter(Boolean)
  );

  console.log(`Dictionary contains ${dictionary.size} words\n`);

  const missing = TEST_WORDS.filter(
    (word) => !dictionary.has(word.toLowerCase())
  );
  const found = TEST_WORDS.filter((word) =>
    dictionary.has(word.toLowerCase())
  );

  console.log(`Found: ${found.length}/${TEST_WORDS.length} test words`);

  if (missing.length > 0) {
    console.error(`\n❌ Missing words: ${missing.join(", ")}`);
    process.exit(1);
  }

  console.log(`\n✓ All ${TEST_WORDS.length} test words present`);
  console.log("✓ Dictionary validation passed");
}

validate().catch((error) => {
  console.error("Validation failed:", error);
  process.exit(1);
});
