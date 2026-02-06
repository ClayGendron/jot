/**
 * Store Adapter
 *
 * Bridges CodeMirror (markdown) ↔ editorStore (HTML).
 * During migration, the store continues holding HTML for compatibility.
 * This adapter handles conversion at the boundary.
 *
 * Post-migration: Remove this adapter and change store to markdown-native.
 */

import { htmlToMarkdown } from "@/lib/markdown/htmlToMarkdown";
import { markdownToHtml } from "@/lib/markdown/markdownToHtml";
import { useEditorStore } from "@/stores/editorStore";

/**
 * Convert store HTML content to markdown for CodeMirror
 */
export function getMarkdownFromStore(): string {
  const html = useEditorStore.getState().content;
  if (!html || html === "<p></p>") return "";
  return htmlToMarkdown(html);
}

/**
 * Convert markdown to HTML and update store
 */
export function setMarkdownToStore(markdown: string): void {
  const html = markdownToHtml(markdown);
  useEditorStore.getState().setContent(html);
}

/**
 * Create a store adapter for use in React components
 */
export function createStoreAdapter() {
  return {
    /**
     * Get initial markdown content from store
     */
    getInitialMarkdown(): string {
      return getMarkdownFromStore();
    },

    /**
     * Update store with markdown content (converts to HTML)
     */
    setContent(markdown: string): void {
      setMarkdownToStore(markdown);
    },

    /**
     * Subscribe to store content changes
     * Returns unsubscribe function
     */
    subscribe(callback: (markdown: string) => void): () => void {
      return useEditorStore.subscribe((state, prevState) => {
        if (state.content !== prevState.content) {
          callback(htmlToMarkdown(state.content));
        }
      });
    },
  };
}

/**
 * Hook-style adapter for React components
 */
export function useStoreAdapter() {
  return createStoreAdapter();
}
