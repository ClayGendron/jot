/**
 * InternalLinkMark TipTap Extension
 *
 * Extends the default Link extension to support custom attributes
 * for internal links (class, data-internal-link).
 * This allows proper mark-based link insertion instead of raw HTML.
 */

import Link from "@tiptap/extension-link";

export interface InternalLinkMarkOptions {
  openOnClick?: boolean;
  linkOnPaste?: boolean;
  autolink?: boolean;
  protocols?: string[];
  HTMLAttributes?: Record<string, string>;
}

/**
 * Extended Link extension with internal link support
 */
export const InternalLinkMark = Link.extend<InternalLinkMarkOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      openOnClick: false, // We handle clicks manually for navigation
    };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: null,
        parseHTML: (element) => element.getAttribute("class"),
        renderHTML: (attributes) => {
          if (!attributes.class) return {};
          return { class: attributes.class };
        },
      },
      "data-internal-link": {
        default: null,
        parseHTML: (element) => element.getAttribute("data-internal-link"),
        renderHTML: (attributes) => {
          const value = attributes["data-internal-link"];
          if (!value) return {};
          return { "data-internal-link": value };
        },
      },
    };
  },
});

export default InternalLinkMark;
