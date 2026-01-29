/**
 * InternalLink Suggestion Render Function
 *
 * Creates and manages the suggestion popup for TipTap.
 * Uses tippy.js for positioning and React for rendering.
 */

import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import {
  InternalLinkSuggestion,
  type InternalLinkSuggestionRef,
  type SuggestionItem,
  type HeadingSuggestionItem,
} from "./InternalLinkSuggestion";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import type { SuggestionFile } from "@/stores/workspaceStore";
import { extractHeadings } from "@/lib/markdown/parser";

export interface CreateSuggestionRenderOptions {
  getFiles: () => SuggestionFile[];
  readFileContent?: (path: string) => Promise<string>;
  getCurrentFilePath?: () => string | null;
  getCurrentFileContent?: () => string;
}

// Cache for file headings to avoid repeated reads
const headingsCache = new Map<string, HeadingSuggestionItem[]>();

/**
 * Parse query to extract file part and heading part
 */
function parseQuery(query: string): { filePart: string; headingPart: string | null } {
  const hashIndex = query.indexOf("#");
  if (hashIndex === -1) {
    return { filePart: query, headingPart: null };
  }
  return {
    filePart: query.slice(0, hashIndex),
    headingPart: query.slice(hashIndex + 1),
  };
}

/**
 * Filter files based on search query
 */
function filterFiles(files: SuggestionFile[], query: string): SuggestionItem[] {
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) {
    // Return all files when no query
    return files.slice(0, 10).map((f) => ({ ...f, type: "file" as const }));
  }

  return files
    .filter((file) => {
      const nameWithoutExt = file.name.replace(/\.md$/, "").toLowerCase();
      const displayPathLower = file.displayPath.toLowerCase();

      return (
        nameWithoutExt.includes(normalizedQuery) ||
        displayPathLower.includes(normalizedQuery)
      );
    })
    .slice(0, 10)
    .map((f) => ({ ...f, type: "file" as const }));
}

/**
 * Filter headings based on search query
 */
function filterHeadings(headings: HeadingSuggestionItem[], query: string): HeadingSuggestionItem[] {
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) {
    // Return all headings when no query
    return headings.slice(0, 10);
  }

  return headings
    .filter((heading) => {
      return heading.name.toLowerCase().includes(normalizedQuery);
    })
    .slice(0, 10);
}

export function createSuggestionRender({ getFiles, readFileContent, getCurrentFilePath, getCurrentFileContent }: CreateSuggestionRenderOptions) {
  return () => {
    let reactRenderer: ReactRenderer<InternalLinkSuggestionRef> | null = null;
    let popup: TippyInstance[] | null = null;
    let currentHeadingsFile: string | null = null;

    const updateItems = async (props: SuggestionProps<SuggestionItem>) => {
      const files = getFiles();
      const { filePart, headingPart } = parseQuery(props.query);

      // If query contains #, we're looking for headings
      if (headingPart !== null) {
        // Same-file heading link: [[#heading]]
        if (!filePart && getCurrentFilePath && getCurrentFileContent) {
          const currentPath = getCurrentFilePath();
          if (currentPath) {
            const content = getCurrentFileContent();
            const headings = extractHeadings(content);
            const headingItems: HeadingSuggestionItem[] = headings.map((h) => ({
              type: "heading" as const,
              name: h.text,
              path: currentPath,
              displayPath: "", // Empty for same-file links
              headingId: h.id,
              headingLevel: h.level,
            }));
            return filterHeadings(headingItems, headingPart);
          }
        }

        // Cross-file heading link: [[file#heading]]
        if (readFileContent) {
          const normalizedFilePart = filePart.toLowerCase().trim();
          const matchedFile = files.find((f) => {
            const nameWithoutExt = f.name.replace(/\.md$/, "").toLowerCase();
            return nameWithoutExt === normalizedFilePart || f.displayPath.toLowerCase() === normalizedFilePart;
          });

          if (matchedFile) {
            // Get headings for this file (from cache or fetch)
            let headingItems = headingsCache.get(matchedFile.path);

            if (!headingItems || currentHeadingsFile !== matchedFile.path) {
              currentHeadingsFile = matchedFile.path;
              try {
                const content = await readFileContent(matchedFile.path);
                const headings = extractHeadings(content);
                headingItems = headings.map((h) => ({
                  type: "heading" as const,
                  name: h.text,
                  path: matchedFile.path,
                  displayPath: matchedFile.displayPath,
                  headingId: h.id,
                  headingLevel: h.level,
                }));
                headingsCache.set(matchedFile.path, headingItems);
              } catch {
                headingItems = [];
              }
            }

            // Filter headings by the heading query part
            const filteredHeadings = filterHeadings(headingItems, headingPart);
            return filteredHeadings;
          }
        }

        // No matching file yet, show files that match the file part
        return filterFiles(files, filePart);
      }

      // No # in query, show files
      return filterFiles(files, props.query);
    };

    return {
      onStart: async (props: SuggestionProps<SuggestionItem>) => {
        const items = await updateItems(props);

        reactRenderer = new ReactRenderer(InternalLinkSuggestion, {
          props: {
            ...props,
            items,
          },
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = tippy("body", {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: reactRenderer.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
          maxWidth: 320,
          offset: [0, 8],
          zIndex: 1000,
          theme: "internal-link",
        });
      },

      onUpdate: async (props: SuggestionProps<SuggestionItem>) => {
        const items = await updateItems(props);

        reactRenderer?.updateProps({
          ...props,
          items,
        });

        if (popup && props.clientRect) {
          popup[0]?.setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          });
        }
      },

      onKeyDown: (props: SuggestionKeyDownProps) => {
        if (props.event.key === "Escape") {
          popup?.[0]?.hide();
          return true;
        }

        return reactRenderer?.ref?.onKeyDown(props) ?? false;
      },

      onExit: () => {
        popup?.[0]?.destroy();
        reactRenderer?.destroy();
        currentHeadingsFile = null;
      },
    };
  };
}

export default createSuggestionRender;
