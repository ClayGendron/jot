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
} from "./InternalLinkSuggestion";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import type { SuggestionFile } from "@/stores/workspaceStore";

export interface CreateSuggestionRenderOptions {
  getFiles: () => SuggestionFile[];
}

export function createSuggestionRender({ getFiles }: CreateSuggestionRenderOptions) {
  return () => {
    let reactRenderer: ReactRenderer<InternalLinkSuggestionRef> | null = null;
    let popup: TippyInstance[] | null = null;

    return {
      onStart: (props: SuggestionProps<SuggestionItem>) => {
        const files = getFiles();
        const items = filterFiles(files, props.query);

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

      onUpdate: (props: SuggestionProps<SuggestionItem>) => {
        const files = getFiles();
        const items = filterFiles(files, props.query);

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
      },
    };
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

export default createSuggestionRender;
