/**
 * InternalLinkSuggestion Component
 *
 * Renders the autocomplete dropdown for internal link suggestions.
 * Handles keyboard navigation and selection.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
} from "react";
import { FileText, Hash, Search } from "lucide-react";
import type { SuggestionFile } from "@/stores/workspaceStore";

export interface FileSuggestionItem extends SuggestionFile {
  type: "file";
}

export interface HeadingSuggestionItem {
  type: "heading";
  name: string; // Heading text
  path: string; // File path
  displayPath: string; // Relative path for display
  headingId: string; // URL-safe heading ID
  headingLevel: 1 | 2 | 3 | 4 | 5 | 6;
}

export type SuggestionItem = FileSuggestionItem | HeadingSuggestionItem;

export interface InternalLinkSuggestionProps {
  items: SuggestionItem[];
  command: (item: SuggestionItem) => void;
}

export interface InternalLinkSuggestionRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const InternalLinkSuggestion = forwardRef<
  InternalLinkSuggestionRef,
  InternalLinkSuggestionProps
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = useCallback(
    (index: number) => {
      const item = props.items[index];
      if (item) {
        props.command(item);
      }
    },
    [props]
  );

  const upHandler = useCallback(() => {
    setSelectedIndex((prev) =>
      prev === 0 ? props.items.length - 1 : prev - 1
    );
  }, [props.items.length]);

  const downHandler = useCallback(() => {
    setSelectedIndex((prev) =>
      prev === props.items.length - 1 ? 0 : prev + 1
    );
  }, [props.items.length]);

  const enterHandler = useCallback(() => {
    selectItem(selectedIndex);
  }, [selectItem, selectedIndex]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        upHandler();
        return true;
      }

      if (event.key === "ArrowDown") {
        downHandler();
        return true;
      }

      if (event.key === "Enter") {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  if (props.items.length === 0) {
    return (
      <div className="internal-link-suggestions">
        <div className="suggestion-empty">
          <Search className="suggestion-empty-icon" size={16} />
          <span>No matching files</span>
        </div>
      </div>
    );
  }

  return (
    <div className="internal-link-suggestions">
      {props.items.map((item, index) => (
        <button
          key={item.type === "heading" ? `${item.path}#${item.headingId}` : item.path}
          className={`suggestion-item ${index === selectedIndex ? "active" : ""}`}
          onClick={() => selectItem(index)}
          onMouseEnter={() => setSelectedIndex(index)}
          type="button"
        >
          {item.type === "heading" ? (
            <Hash className="suggestion-item-icon" size={14} />
          ) : (
            <FileText className="suggestion-item-icon" size={14} />
          )}
          <div className="suggestion-item-content">
            <span className="suggestion-item-name">
              {item.type === "heading" ? item.name : item.name.replace(/\.md$/, "")}
            </span>
            {item.type === "heading" ? (
              <span className="suggestion-item-path">
                H{item.headingLevel} in {item.displayPath.replace(/\.md$/, "")}
              </span>
            ) : item.displayPath !== item.name && (
              <span className="suggestion-item-path">
                {item.displayPath.replace(/\/[^/]+$/, "/")}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
});

InternalLinkSuggestion.displayName = "InternalLinkSuggestion";

export default InternalLinkSuggestion;
