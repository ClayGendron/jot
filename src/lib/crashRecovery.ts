/**
 * Crash Recovery — Per-Tab Storage
 *
 * Stores recovery data for each dirty file independently so that a crash
 * preserves content for ALL open dirty tabs, not just the last-active one.
 *
 * v1 format (legacy): single entry under "jot_crash_recovery"
 * v2 format: Record<filePath, { content, timestamp }> under "jot_crash_recovery_v2"
 */

const KEY_V1 = "jot_crash_recovery";
const KEY_V2 = "jot_crash_recovery_v2";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface CrashRecoveryEntry {
  content: string;
  timestamp: number;
}

export type CrashRecoveryMap = Record<string, CrashRecoveryEntry>;

/**
 * Store crash recovery data for a single file.
 * Called whenever tab content becomes dirty.
 */
export function storeCrashRecoveryForFile(filePath: string, content: string): void {
  try {
    const map = readRawV2();
    map[filePath] = { content, timestamp: Date.now() };
    localStorage.setItem(KEY_V2, JSON.stringify(map));
  } catch {
    // localStorage might be full or unavailable
  }
}

/**
 * Clear crash recovery data for a single file.
 * Called after a successful save.
 */
export function clearCrashRecoveryForFile(filePath: string): void {
  try {
    const map = readRawV2();
    delete map[filePath];
    if (Object.keys(map).length === 0) {
      localStorage.removeItem(KEY_V2);
    } else {
      localStorage.setItem(KEY_V2, JSON.stringify(map));
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Clear all crash recovery data (both v1 and v2 keys).
 * Called after recovery is accepted or declined.
 */
export function clearAllCrashRecovery(): void {
  try {
    localStorage.removeItem(KEY_V1);
    localStorage.removeItem(KEY_V2);
  } catch {
    // Ignore errors
  }
}

/**
 * Read crash recovery data, handling v1 → v2 migration.
 * Returns a map of filePath → { content, timestamp }.
 * Entries older than 24 hours are pruned.
 */
export function readCrashRecoveryData(): CrashRecoveryMap {
  try {
    // Try v2 first
    const v2Raw = localStorage.getItem(KEY_V2);
    if (v2Raw) {
      const parsed = JSON.parse(v2Raw);
      if (typeof parsed === "object" && parsed !== null) {
        return pruneStaleEntries(parsed as CrashRecoveryMap);
      }
    }

    // Fall back to v1 and migrate
    const v1Raw = localStorage.getItem(KEY_V1);
    if (v1Raw) {
      const parsed = JSON.parse(v1Raw);
      if (isValidV1Data(parsed)) {
        const map: CrashRecoveryMap = {};
        // v1 has filePath which may be null (untitled doc)
        if (parsed.filePath) {
          map[parsed.filePath] = {
            content: parsed.content,
            timestamp: parsed.timestamp,
          };
        }
        // Migrate: write v2, delete v1
        if (Object.keys(map).length > 0) {
          localStorage.setItem(KEY_V2, JSON.stringify(map));
        }
        localStorage.removeItem(KEY_V1);
        return pruneStaleEntries(map);
      }
      // Invalid v1 data, clear it
      localStorage.removeItem(KEY_V1);
    }
  } catch {
    // Invalid JSON or other errors — clear both keys
    try {
      localStorage.removeItem(KEY_V1);
      localStorage.removeItem(KEY_V2);
    } catch {
      // Ignore
    }
  }

  return {};
}

/** Read raw v2 map from localStorage, returning empty object on missing/invalid */
function readRawV2(): CrashRecoveryMap {
  try {
    const raw = localStorage.getItem(KEY_V2);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        return parsed as CrashRecoveryMap;
      }
    }
  } catch {
    // Invalid JSON
  }
  return {};
}

/** Prune entries older than 24 hours */
function pruneStaleEntries(map: CrashRecoveryMap): CrashRecoveryMap {
  const now = Date.now();
  const result: CrashRecoveryMap = {};
  for (const [path, entry] of Object.entries(map)) {
    if (now - entry.timestamp < ONE_DAY_MS) {
      result[path] = entry;
    }
  }
  return result;
}

/** Validate v1 format shape */
function isValidV1Data(data: unknown): data is { filePath: string | null; content: string; timestamp: number } {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    (typeof obj.filePath === "string" || obj.filePath === null) &&
    typeof obj.content === "string" &&
    typeof obj.timestamp === "number"
  );
}
