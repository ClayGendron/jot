/**
 * Internal Link Autocomplete for CodeMirror 6
 *
 * Phase 4: Provides [[...]] style autocomplete for internal links.
 *
 * Key behaviors:
 * - Triggers on [[ sequence
 * - Provides file and heading suggestions
 * - Filters suggestions as user types
 * - Inserts markdown link syntax [text](path.md)
 * - Integrates with workspace file tree
 */

import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
  type CompletionSource,
} from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import type { SuggestionFile } from "@/stores/workspaceStore";

/**
 * Heading suggestion item
 */
export interface HeadingSuggestion {
  type: "heading";
  name: string;
  path: string;
  displayPath: string;
  headingId: string;
  headingLevel: 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * File suggestion item
 */
export interface FileSuggestion extends SuggestionFile {
  type: "file";
}

export type InternalLinkSuggestion = FileSuggestion | HeadingSuggestion;

/**
 * Options for configuring internal link completion
 */
export interface InternalLinkCompletionOptions {
  /** Get file suggestions for autocomplete */
  getFileSuggestions: () => SuggestionFile[];
  /** Get heading suggestions for a file (optional, for same-file heading links) */
  getHeadingSuggestions?: (query: string) => HeadingSuggestion[];
}

/**
 * Check if cursor is inside a code block
 */
function isInsideCode(context: CompletionContext): boolean {
  const tree = syntaxTree(context.state);
  const codeNodes = new Set([
    "CodeBlock",
    "FencedCode",
    "InlineCode",
    "CodeText",
  ]);

  let node = tree.resolveInner(context.pos, -1);
  while (node) {
    if (codeNodes.has(node.name)) {
      return true;
    }
    node = node.parent!;
  }

  return false;
}

/**
 * Find the [[ trigger in the text before cursor
 */
function findTrigger(context: CompletionContext): { from: number; query: string } | null {
  const line = context.state.doc.lineAt(context.pos);
  const textBefore = context.state.sliceDoc(line.from, context.pos);

  // Look for [[ that isn't escaped and hasn't been closed
  const triggerIndex = textBefore.lastIndexOf("[[");
  if (triggerIndex === -1) {
    return null;
  }

  // Check it's not escaped (preceded by \)
  if (triggerIndex > 0 && textBefore[triggerIndex - 1] === "\\") {
    return null;
  }

  // Check there's no ]] between [[ and cursor
  const afterTrigger = textBefore.slice(triggerIndex + 2);
  if (afterTrigger.includes("]]")) {
    return null;
  }

  // Query is everything after [[
  const query = afterTrigger;
  const from = line.from + triggerIndex;

  return { from, query };
}

/**
 * Filter suggestions by query using fuzzy matching
 */
function filterSuggestions(
  files: SuggestionFile[],
  query: string
): FileSuggestion[] {
  const lowerQuery = query.toLowerCase();

  return files
    .filter((file) => {
      // Match against filename (without .md) or display path
      const nameWithoutExt = file.name.replace(/\.md$/i, "").toLowerCase();
      const displayLower = file.displayPath.toLowerCase();

      return nameWithoutExt.includes(lowerQuery) || displayLower.includes(lowerQuery);
    })
    .map((file) => ({
      ...file,
      type: "file" as const,
    }))
    .slice(0, 10); // Limit to 10 results
}

/**
 * Create a completion source for internal links
 */
export function createInternalLinkCompletionSource(
  options: InternalLinkCompletionOptions
): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    // Don't trigger in code blocks
    if (isInsideCode(context)) {
      return null;
    }

    // Find [[ trigger
    const trigger = findTrigger(context);
    if (!trigger) {
      return null;
    }

    // Get and filter suggestions
    const files = options.getFileSuggestions();
    const filtered = filterSuggestions(files, trigger.query);

    // Also include heading suggestions if provided
    let headings: HeadingSuggestion[] = [];
    if (options.getHeadingSuggestions) {
      headings = options.getHeadingSuggestions(trigger.query);
    }

    // Convert to CM6 completion format
    const completions: Completion[] = [
      // File completions
      ...filtered.map((file): Completion => ({
        label: file.name.replace(/\.md$/i, ""),
        detail: file.displayPath !== file.name
          ? file.displayPath.replace(/\/[^/]+$/, "/")
          : undefined,
        type: "file",
        boost: 1,
        apply: (view) => {
          // Generate markdown link: [display name](relative-path.md)
          const displayName = file.name.replace(/\.md$/i, "");
          const linkText = `[${displayName}](${file.displayPath})`;

          view.dispatch({
            changes: { from: trigger.from, to: context.pos, insert: linkText },
            selection: { anchor: trigger.from + linkText.length },
          });
        },
      })),
      // Heading completions
      ...headings.map((heading): Completion => ({
        label: heading.name,
        detail: `H${heading.headingLevel} in ${heading.displayPath.replace(/\.md$/i, "")}`,
        type: "heading",
        boost: 0,
        apply: (view) => {
          // Generate markdown link with anchor: [heading](path.md#heading-id)
          let href: string;
          if (heading.displayPath) {
            href = `${heading.displayPath}#${heading.headingId}`;
          } else {
            // Same-file heading link
            href = `#${heading.headingId}`;
          }

          const linkText = `[${heading.name}](${href})`;

          view.dispatch({
            changes: { from: trigger.from, to: context.pos, insert: linkText },
            selection: { anchor: trigger.from + linkText.length },
          });
        },
      })),
    ];

    if (completions.length === 0) {
      return null;
    }

    return {
      from: trigger.from,
      options: completions,
      // Don't filter further since we already filtered
      filter: false,
    };
  };
}

/**
 * Create the internal link completion extension
 *
 * @param options - Configuration options including file suggestion source
 * @returns CodeMirror extension for internal link completion
 *
 * @example
 * ```typescript
 * const ext = createInternalLinkCompletion({
 *   getFileSuggestions: () => useWorkspaceStore.getState().selectAllFilesForSuggestion(),
 * });
 * ```
 */
export function createInternalLinkCompletion(
  options: InternalLinkCompletionOptions
) {
  return autocompletion({
    override: [createInternalLinkCompletionSource(options)],
    defaultKeymap: true,
    closeOnBlur: true,
    activateOnTyping: true,
    icons: true,
  });
}

/**
 * Default empty completion source (used when no workspace is loaded)
 */
export const emptyInternalLinkCompletion = autocompletion({
  override: [() => null],
});
