import { useState, useEffect, useCallback, useMemo } from "react";
import type { Heading } from "@/lib/markdown/parser";
import { generateHeadingId, extractHeadings } from "@/lib/markdown/parser";
import { extractHeadingsFromHtml } from "@/lib/links/linkService";
import { useEditorStore } from "@/stores/editorStore";

// Re-export for backward compatibility
export { extractHeadingsFromHtml };

interface UseDocumentOutlineOptions {
  /** Content from the editor (HTML for TipTap, Markdown for CodeMirror) */
  content: string;
  /** Ref to the scrollable container */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  /** Debounce delay for scroll tracking in ms */
  scrollDebounce?: number;
}

interface UseDocumentOutlineResult {
  /** List of headings extracted from content */
  headings: Heading[];
  /** ID of the currently active (visible) heading */
  activeHeadingId: string | null;
  /** Scroll to a specific heading by ID */
  scrollToHeading: (id: string) => void;
}

/**
 * Hook for document outline functionality
 *
 * Extracts headings from content and tracks the active heading
 * based on scroll position. Supports both TipTap (HTML) and
 * CodeMirror (Markdown) editors.
 */
export function useDocumentOutline({
  content,
  scrollContainerRef,
  scrollDebounce = 100,
}: UseDocumentOutlineOptions): UseDocumentOutlineResult {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const useMarkdownEditor = useEditorStore((state) => state.useMarkdownEditor);

  // Extract headings from content (HTML or Markdown depending on editor mode)
  const headings = useMemo(() => {
    if (useMarkdownEditor) {
      // CodeMirror mode: content is Markdown
      return extractHeadings(content);
    }
    // TipTap mode: content is HTML
    return extractHeadingsFromHtml(content);
  }, [content, useMarkdownEditor]);

  // Track active heading based on scroll position
  useEffect(() => {
    const container = scrollContainerRef?.current || document.querySelector(".main-content");
    if (!container || headings.length === 0) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const updateActiveHeading = () => {
      // Find the editor element based on editor mode
      const editorSelector = useMarkdownEditor ? ".cm-editor" : ".tiptap-editor";
      const editorElement = container.querySelector(editorSelector);
      if (!editorElement) return;

      // For CodeMirror, we look for lines with heading classes
      // For TipTap, we look for h1-h6 elements
      let headingElements: NodeListOf<Element>;

      if (useMarkdownEditor) {
        // CodeMirror: look for lines with heading decoration classes
        headingElements = editorElement.querySelectorAll(
          ".cm-heading-1, .cm-heading-2, .cm-heading-3, .cm-heading-4, .cm-heading-5, .cm-heading-6"
        );
      } else {
        headingElements = editorElement.querySelectorAll("h1, h2, h3, h4, h5, h6");
      }

      if (headingElements.length === 0) return;

      const containerRect = container.getBoundingClientRect();
      // Consider a heading "active" when it's in the top 30% of the viewport
      const activationThreshold = containerRect.top + containerRect.height * 0.3;

      let activeHeading: Element | null = null;

      headingElements.forEach((element) => {
        const rect = element.getBoundingClientRect();
        // If the heading is above the activation threshold, it might be active
        if (rect.top <= activationThreshold) {
          activeHeading = element;
        }
      });

      if (activeHeading) {
        const text = (activeHeading as HTMLElement).textContent?.trim() || "";
        const id = generateHeadingId(text);
        setActiveHeadingId(id);
      } else if (headingElements.length > 0) {
        // If no heading is above threshold, the first one is active
        const firstHeading = headingElements[0] as HTMLElement;
        const text = firstHeading.textContent?.trim() || "";
        const id = generateHeadingId(text);
        setActiveHeadingId(id);
      }
    };

    const handleScroll = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(updateActiveHeading, scrollDebounce);
    };

    // Initial update
    updateActiveHeading();

    // Listen for scroll events
    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [headings, scrollContainerRef, scrollDebounce, useMarkdownEditor]);

  // Scroll to a specific heading
  const scrollToHeading = useCallback(
    (id: string) => {
      const container = scrollContainerRef?.current || document.querySelector(".main-content");
      if (!container) return;

      const editorSelector = useMarkdownEditor ? ".cm-editor" : ".tiptap-editor";
      const editorElement = container.querySelector(editorSelector);
      if (!editorElement) return;

      // Find the heading element with matching text
      let headingElements: NodeListOf<Element>;

      if (useMarkdownEditor) {
        headingElements = editorElement.querySelectorAll(
          ".cm-heading-1, .cm-heading-2, .cm-heading-3, .cm-heading-4, .cm-heading-5, .cm-heading-6"
        );
      } else {
        headingElements = editorElement.querySelectorAll("h1, h2, h3, h4, h5, h6");
      }

      for (const element of headingElements) {
        const text = element.textContent?.trim() || "";
        const elementId = generateHeadingId(text);

        if (elementId === id) {
          // Scroll the heading into view with some offset
          const elementRect = element.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const offsetTop = elementRect.top - containerRect.top + container.scrollTop;

          container.scrollTo({
            top: offsetTop - 80, // 80px offset from top for toolbar
            behavior: "smooth",
          });

          // Update active heading immediately
          setActiveHeadingId(id);
          break;
        }
      }
    },
    [scrollContainerRef, useMarkdownEditor]
  );

  return {
    headings,
    activeHeadingId,
    scrollToHeading,
  };
}

export default useDocumentOutline;
