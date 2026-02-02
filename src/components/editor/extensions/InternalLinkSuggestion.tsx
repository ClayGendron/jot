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
import { cn } from "@/lib/utils";
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
      <div className="bg-[var(--color-paper)] border border-[var(--color-border)] rounded-lg shadow-lg overflow-hidden min-w-[200px] max-w-[320px]">
        <div className="flex items-center justify-center gap-2 p-4 text-[var(--color-ink-muted)] font-sans text-[0.8125rem] italic">
          <Search className="text-[var(--color-ink-muted)] opacity-50" size={16} />
          <span>No matching files</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-paper)] border border-[var(--color-border)] rounded-lg shadow-lg overflow-hidden min-w-[200px] max-w-[320px]">
      {props.items.map((item, index) => (
        <button
          key={item.type === "heading" ? `${item.path}#${item.headingId}` : item.path}
          className={cn(
            "flex items-center gap-2.5 w-full px-3.5 py-2.5 border-none bg-transparent text-left cursor-pointer transition-colors duration-150",
            "hover:bg-[var(--color-paper-warm)]",
            index === selectedIndex && "bg-[var(--color-paper-warm)]"
          )}
          onClick={() => selectItem(index)}
          onMouseEnter={() => setSelectedIndex(index)}
          type="button"
        >
          {item.type === "heading" ? (
            <Hash
              className={cn(
                "flex-shrink-0 text-[var(--color-ink-muted)]",
                index === selectedIndex && "text-[var(--color-accent)]"
              )}
              size={14}
            />
          ) : (
            <FileText
              className={cn(
                "flex-shrink-0 text-[var(--color-ink-muted)]",
                index === selectedIndex && "text-[var(--color-accent)]"
              )}
              size={14}
            />
          )}
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <span className="font-sans text-sm font-medium text-[var(--color-ink)] whitespace-nowrap overflow-hidden text-ellipsis">
              {item.type === "heading" ? item.name : item.name.replace(/\.md$/, "")}
            </span>
            {item.type === "heading" ? (
              <span className="font-mono text-[0.6875rem] text-[var(--color-ink-muted)] whitespace-nowrap overflow-hidden text-ellipsis">
                H{item.headingLevel} in {item.displayPath.replace(/\.md$/, "")}
              </span>
            ) : item.displayPath !== item.name && (
              <span className="font-mono text-[0.6875rem] text-[var(--color-ink-muted)] whitespace-nowrap overflow-hidden text-ellipsis">
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
