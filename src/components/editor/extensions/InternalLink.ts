/**
 * InternalLink TipTap Extension
 *
 * Provides wiki-style internal link functionality with [[filename]] syntax.
 * Uses the TipTap Suggestion plugin for autocomplete.
 */

import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";

export interface InternalLinkOptions {
  suggestion: Omit<SuggestionOptions, "editor">;
}

export const InternalLinkPluginKey = new PluginKey("internal-link");

export const InternalLink = Extension.create<InternalLinkOptions>({
  name: "internalLink",

  addOptions() {
    return {
      suggestion: {
        char: "[[",
        pluginKey: InternalLinkPluginKey,
        allowSpaces: true,
        // These will be overridden by the component
        command: ({ editor, range, props }) => {
          // Handle both file and heading items
          const itemType = props.type;

          let href: string;
          let linkText: string;

          if (itemType === "heading") {
            // Heading item: include anchor in href
            // If displayPath is empty, it's a same-file heading link
            if (props.displayPath) {
              href = `${props.displayPath}#${props.headingId}`;
            } else {
              href = `#${props.headingId}`;
            }
            linkText = props.name;
          } else {
            // File item: just the path
            href = props.displayPath;
            linkText = props.name.replace(/\.md$/, "");
          }

          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent(`<a href="${href}" class="internal-link" data-internal-link="true">${linkText}</a>`)
            .run();
        },
        allow: ({ editor, range }) => {
          // Don't trigger in code blocks
          const $from = editor.state.doc.resolve(range.from);
          const node = $from.node();
          if (node && node.type.name === "codeBlock") {
            return false;
          }
          return true;
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export default InternalLink;
