import type { FileEntry } from "@/lib/tauri/files";

export type SortBy = "name" | "modified";
export type SortDirection = "asc" | "desc";

/**
 * Recursively sorts file entries.
 * Folders always come first, then sorted by specified criteria.
 */
export function sortFileEntries(
  entries: FileEntry[],
  sortBy: SortBy,
  sortDirection: SortDirection
): FileEntry[] {
  const sorted = [...entries].sort((a, b) => {
    // Folders always first
    if (a.is_dir && !b.is_dir) return -1;
    if (!a.is_dir && b.is_dir) return 1;

    // Sort by criteria
    let comparison = 0;
    if (sortBy === "name") {
      comparison = a.name.localeCompare(b.name, undefined, {
        sensitivity: "base",
      });
    } else if (sortBy === "modified") {
      const aTime = a.modified ?? 0;
      const bTime = b.modified ?? 0;
      comparison = aTime - bTime;
    }

    return sortDirection === "desc" ? -comparison : comparison;
  });

  // Recursively sort children
  return sorted.map((entry) => ({
    ...entry,
    children: entry.children
      ? sortFileEntries(entry.children, sortBy, sortDirection)
      : null,
  }));
}
