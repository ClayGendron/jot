import { useState, useEffect, useCallback, useMemo } from "react";
import type { Heading } from "@/lib/markdown/parser";
import { generateHeadingId } from "@/lib/markdown/parser";

/**
 * Extract headings from HTML content (TipTap editor output)
 */
export function extractHeadingsFromHtml(html: string): Heading[] {
  if (!html) return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const headings: Heading[] = [];

  // Find all heading elements (h1-h6)
  const headingElements = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");

  headingElements.forEach((element) => {
    const level = parseInt(element.tagName.charAt(1), 10) as 1 | 2 | 3 | 4 | 5 | 6;
    const text = element.textContent?.trim() || "";

    if (text) {
      headings.push({
        level,
        text,
        id: generateHeadingId(text),
      });
    }
  });

  return headings;
}

interface UseDocumentOutlineOptions {
  /** HTML content from the editor */
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
 * Extracts headings from HTML content and tracks the active heading
 * based on scroll position.
 */
export function useDocumentOutline({
  content,
  scrollContainerRef,
  scrollDebounce = 100,
}: UseDocumentOutlineOptions): UseDocumentOutlineResult {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);

  // Extract headings from content
  const headings = useMemo(() => extractHeadingsFromHtml(content), [content]);

  // Track active heading based on scroll position
  useEffect(() => {
    const container = scrollContainerRef?.current || document.querySelector(".main-content");
    if (!container || headings.length === 0) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const updateActiveHeading = () => {
      // Find all heading elements in the editor
      const editorElement = container.querySelector(".tiptap-editor");
      if (!editorElement) return;

      const headingElements = editorElement.querySelectorAll("h1, h2, h3, h4, h5, h6");
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
  }, [headings, scrollContainerRef, scrollDebounce]);

  // Scroll to a specific heading
  const scrollToHeading = useCallback(
    (id: string) => {
      const container = scrollContainerRef?.current || document.querySelector(".main-content");
      if (!container) return;

      const editorElement = container.querySelector(".tiptap-editor");
      if (!editorElement) return;

      // Find the heading element with matching text
      const headingElements = editorElement.querySelectorAll("h1, h2, h3, h4, h5, h6");

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
    [scrollContainerRef]
  );

  return {
    headings,
    activeHeadingId,
    scrollToHeading,
  };
}

export default useDocumentOutline;
