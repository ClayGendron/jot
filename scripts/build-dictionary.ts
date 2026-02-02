#!/usr/bin/env bun
/**
 * Build Dictionary Script
 *
 * Merges SCOWL word list + Google frequency data + tech terms
 * into gzipped dictionary files for the SymSpell service.
 *
 * Output:
 * - public/dictionaries/en-core.txt.gz (top 100K words with frequency ranks)
 * - public/dictionaries/en-extended.txt.gz (remaining words)
 *
 * Usage:
 *   bun run scripts/build-dictionary.ts
 *
 * Sources required in data/dictionaries/:
 *   - scowl-95.txt (from SCOWL 2020.12.07, combined word files up to size 95)
 *   - google-freq.txt (from https://github.com/hackerb9/gwordlist)
 *   - tech-terms.txt (custom curated)
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { gzipSync } from "zlib";

// Get current directory (works in both ESM and Bun)
const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const DATA_DIR = join(__dirname, "..", "data", "dictionaries");
const OUTPUT_DIR = join(__dirname, "..", "public", "dictionaries");
const CORE_SIZE = 100_000;
const FREQ_FLOOR = 10; // Minimum frequency to include from SCOWL
const TECH_FREQ_CAP = 100_000; // Frequency for tech terms
const DEFAULT_FREQ = 1000; // Default frequency for SCOWL words without freq data

interface WordEntry {
  word: string;
  frequency: number;
  source: "scowl" | "tech" | "both";
}

/**
 * Load a word list file (one word per line)
 */
async function loadWordList(path: string): Promise<Set<string>> {
  if (!existsSync(path)) {
    console.warn(`Warning: ${path} not found, skipping...`);
    return new Set();
  }

  const content = await readFile(path, "utf-8");
  const words = new Set<string>();

  for (const line of content.split("\n")) {
    const trimmed = line.trim().toLowerCase();
    // Skip comments and empty lines
    if (trimmed && !trimmed.startsWith("#")) {
      words.add(trimmed);
    }
  }

  return words;
}

/**
 * Load frequency data from Google Ngram format
 * Format: RANKING   WORD   COUNT   PERCENT   CUMULATIVE
 * Example: 1          the                    109,892,823,605    7.591474%    7.591474%
 */
async function loadFrequencies(path: string): Promise<Map<string, number>> {
  if (!existsSync(path)) {
    console.warn(`Warning: ${path} not found, skipping frequency data...`);
    return new Map();
  }

  const content = await readFile(path, "utf-8");
  const frequencies = new Map<string, number>();

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Split by whitespace
    const parts = trimmed.split(/\s+/);

    // Google Ngram format: RANKING WORD COUNT PERCENT CUMULATIVE
    // parts[0] = ranking, parts[1] = word, parts[2] = count (with commas)
    if (parts.length >= 3) {
      const word = parts[1].toLowerCase();
      // Remove commas from count and parse
      const countStr = parts[2].replace(/,/g, "");
      const freq = parseInt(countStr, 10);
      if (word && /^[a-z]+$/.test(word) && !isNaN(freq) && freq > 0) {
        frequencies.set(word, freq);
      }
    }
  }

  return frequencies;
}

/**
 * Filter out garbage words
 */
function isValidWord(word: string): boolean {
  // Must be at least 2 characters
  if (word.length < 2) return false;

  // Must contain only letters (and optionally apostrophes for contractions)
  if (!/^[a-z']+$/.test(word)) return false;

  // Can't start or end with apostrophe
  if (word.startsWith("'") || word.endsWith("'")) return false;

  // Can't have multiple consecutive apostrophes
  if (/''+/.test(word)) return false;

  return true;
}

/**
 * Main build function
 */
async function buildDictionary(): Promise<void> {
  console.log("Building spell check dictionary...\n");

  // 1. Load sources
  console.log("Loading source data...");
  const scowlWords = await loadWordList(join(DATA_DIR, "scowl-95.txt"));
  const frequencies = await loadFrequencies(join(DATA_DIR, "google-freq.txt"));
  const techTerms = await loadWordList(join(DATA_DIR, "tech-terms.txt"));

  console.log(`  SCOWL: ${scowlWords.size} words`);
  console.log(`  Frequencies: ${frequencies.size} entries`);
  console.log(`  Tech terms: ${techTerms.size} terms`);

  // 2. Merge dictionaries
  console.log("\nMerging dictionaries...");
  const merged = new Map<string, WordEntry>();

  // If SCOWL exists, use it as ground truth
  if (scowlWords.size > 0) {
    for (const word of scowlWords) {
      if (!isValidWord(word)) continue;
      const freq = frequencies.get(word) ?? DEFAULT_FREQ;
      merged.set(word, { word, frequency: freq, source: "scowl" });
    }
  } else {
    // Fall back to using frequency data as word source
    // Google Ngram words are verified dictionary words
    console.log("  (Using frequency data as word source since SCOWL not found)");
    for (const [word, freq] of frequencies) {
      if (!isValidWord(word)) continue;
      merged.set(word, { word, frequency: freq, source: "scowl" });
    }
  }

  // 3. Add tech terms with boosted frequency
  let techAdded = 0;
  for (const word of techTerms) {
    if (!isValidWord(word)) continue;

    if (!merged.has(word)) {
      merged.set(word, { word, frequency: TECH_FREQ_CAP, source: "tech" });
      techAdded++;
    } else {
      // Boost existing word if it's a tech term
      const existing = merged.get(word)!;
      existing.frequency = Math.max(existing.frequency, TECH_FREQ_CAP);
      existing.source = "both";
    }
  }

  console.log(`  Merged: ${merged.size} unique words`);
  console.log(`  Tech terms added: ${techAdded}`);

  // 4. Apply frequency floor (drop garbage from SCOWL)
  const filtered = [...merged.values()].filter(
    (e) => e.frequency >= FREQ_FLOOR || e.source !== "scowl"
  );

  console.log(`  After frequency filter: ${filtered.length} words`);

  // 5. Sort by frequency (descending), then alphabetically for ties
  const sorted = filtered.sort((a, b) => {
    if (b.frequency !== a.frequency) return b.frequency - a.frequency;
    return a.word.localeCompare(b.word);
  });

  // 6. Convert to ranked format (1 = most common)
  const ranked = sorted.map((e, i) => ({
    word: e.word,
    rank: i + 1,
  }));

  // 7. Split into core and extended
  const core = ranked.slice(0, CORE_SIZE);
  const extended = ranked.slice(CORE_SIZE);

  console.log(`\nOutput:`);
  console.log(`  Core: ${core.length} words (top ${CORE_SIZE})`);
  console.log(`  Extended: ${extended.length} words`);

  // 8. Create output directory
  await mkdir(OUTPUT_DIR, { recursive: true });

  // 9. Output as gzipped text (word<TAB>rank per line)
  const formatEntry = (e: { word: string; rank: number }) =>
    `${e.word}\t${e.rank}`;

  const coreContent = core.map(formatEntry).join("\n");
  const extendedContent = extended.map(formatEntry).join("\n");

  const coreGz = gzipSync(Buffer.from(coreContent, "utf-8"));
  const extendedGz = gzipSync(Buffer.from(extendedContent, "utf-8"));

  await writeFile(join(OUTPUT_DIR, "en-core.txt.gz"), coreGz);
  await writeFile(join(OUTPUT_DIR, "en-extended.txt.gz"), extendedGz);

  console.log(`\nFiles written:`);
  console.log(
    `  ${join(OUTPUT_DIR, "en-core.txt.gz")} (${(coreGz.length / 1024).toFixed(1)} KB)`
  );
  console.log(
    `  ${join(OUTPUT_DIR, "en-extended.txt.gz")} (${(extendedGz.length / 1024).toFixed(1)} KB)`
  );

  // 10. Output the full dictionary for spellchecker-wasm (uncompressed)
  // The library expects: word frequency (space-separated) with frequency counts
  // Browser version needs uncompressed file - it streams directly via fetch Response
  // IMPORTANT: Frequencies must be < 2^31 (2147483647) for SymSpell WASM parser
  // We normalize by scaling all frequencies proportionally
  const MAX_SAFE_FREQ = 2_000_000_000; // 2 billion, safe for 32-bit signed int
  const maxFreq = Math.max(...filtered.map((e) => e.frequency));
  const scaleFactor = maxFreq > MAX_SAFE_FREQ ? MAX_SAFE_FREQ / maxFreq : 1;

  const allEntries = filtered
    .map((e) => {
      const normalizedFreq = Math.max(1, Math.floor(e.frequency * scaleFactor));
      return `${e.word} ${normalizedFreq}`;
    })
    .join("\n");

  await writeFile(join(OUTPUT_DIR, "en-dictionary.txt"), allEntries);
  console.log(
    `  ${join(OUTPUT_DIR, "en-dictionary.txt")} (${(allEntries.length / 1024).toFixed(1)} KB)`
  );

  console.log("\nDone!");
}

// Run
buildDictionary().catch((error) => {
  console.error("Build failed:", error);
  process.exit(1);
});
