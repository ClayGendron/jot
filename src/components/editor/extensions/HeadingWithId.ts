/**
 * HeadingWithId TipTap Extension
 *
 * Extends the default Heading extension to automatically generate and maintain
 * heading IDs for internal link navigation.
 */

import Heading from "@tiptap/extension-heading";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { generateHeadingId } from "@/lib/markdown/parser";

export interface HeadingWithIdOptions {
  levels: (1 | 2 | 3 | 4 | 5 | 6)[];
}

/**
 * Plugin key for heading ID management
 */
export const HeadingIdPluginKey = new PluginKey("heading-id");

/**
 * Extended Heading extension that automatically generates IDs
 */
export const HeadingWithId = Heading.extend<HeadingWithIdOptions>({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("id"),
        renderHTML: (attributes) => {
          if (!attributes.id) {
            return {};
          }
          return { id: attributes.id };
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: HeadingIdPluginKey,

        appendTransaction(transactions, _oldState, newState) {
          // Only process if there were changes
          const hasChanges = transactions.some((tr) => tr.docChanged);
          if (!hasChanges) return null;

          const { tr } = newState;
          let modified = false;

          newState.doc.descendants((node, pos) => {
            // Only process heading nodes
            if (node.type.name !== "heading") return;

            // Get the text content of the heading
            const text = node.textContent;
            if (!text) return;

            // Generate the expected ID
            const expectedId = generateHeadingId(text);

            // Update if ID doesn't match
            if (node.attrs.id !== expectedId) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                id: expectedId,
              });
              modified = true;
            }
          });

          return modified ? tr : null;
        },
      }),
    ];
  },
});

export default HeadingWithId;
