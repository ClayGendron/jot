import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import { List, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Heading } from "@/lib/markdown/parser";

interface OutlineItemProps {
  heading: Heading;
  isActive: boolean;
  onClick: (id: string) => void;
}

function OutlineItem({ heading, isActive, onClick }: OutlineItemProps) {
  const handleClick = useCallback(() => {
    onClick(heading.id);
  }, [heading.id, onClick]);

  // Calculate indentation based on heading level
  // H1 = 0px, H2 = 16px, H3 = 32px, etc.
  const indent = (heading.level - 1) * 16;

  return (
    <button
      type="button"
      className={cn(
        "relative flex items-center gap-2 w-[calc(100%-0.5rem)] mx-1 p-2 pr-3 border-none rounded bg-transparent font-sans text-[0.8125rem] text-left text-[var(--color-ink-light)] cursor-pointer transition-all duration-150",
        "hover:bg-[var(--color-border)] hover:text-[var(--color-ink)]",
        isActive && "bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
      )}
      style={{ paddingLeft: `${indent + 12}px` }}
      onClick={handleClick}
      data-testid={`outline-item-${heading.id}`}
      data-level={heading.level}
      data-active={isActive}
    >
      {/* Depth indicator line */}
      {heading.level > 1 && (
        <span
          className={cn(
            "absolute top-0 bottom-0 w-px bg-[var(--color-border)]",
            (isActive) && "bg-[var(--color-accent)] opacity-50"
          )}
          style={{ left: `${(heading.level - 2) * 16 + 8}px` }}
        />
      )}

      {/* Level indicator pill */}
      <span
        className={cn(
          "flex-shrink-0 px-1.5 py-0.5 bg-[var(--color-border)] rounded font-mono text-[0.5625rem] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide",
          (isActive || heading.level === 1) && "bg-[var(--color-accent)] text-white"
        )}
      >
        H{heading.level}
      </span>

      {/* Heading text */}
      <span
        className={cn(
          "flex-1 overflow-hidden text-ellipsis whitespace-nowrap leading-tight",
          heading.level === 1 && "font-serif text-sm font-semibold"
        )}
      >
        {heading.text}
      </span>

      {/* Active indicator */}
      {isActive && (
        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
      )}
    </button>
  );
}

interface DocumentOutlineProps {
  headings: Heading[];
  activeHeadingId: string | null;
  onHeadingClick: (id: string) => void;
}

export function DocumentOutline({
  headings,
  activeHeadingId,
  onHeadingClick,
}: DocumentOutlineProps) {
  const [filter, setFilter] = useState("");
  const [isFilterFocused, setIsFilterFocused] = useState(false);
  const filterInputRef = useRef<HTMLInputElement>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);

  // Filter headings based on search term
  const filteredHeadings = useMemo(() => {
    if (!filter.trim()) return headings;

    const searchTerm = filter.toLowerCase();
    return headings.filter((h) =>
      h.text.toLowerCase().includes(searchTerm)
    );
  }, [headings, filter]);

  // Keyboard shortcut to focus filter (/)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // "/" to focus filter when not already in an input
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        !document.activeElement?.closest(".tiptap-editor")
      ) {
        e.preventDefault();
        filterInputRef.current?.focus();
      }

      // Escape to blur and clear filter
      if (e.key === "Escape" && document.activeElement === filterInputRef.current) {
        setFilter("");
        filterInputRef.current?.blur();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Scroll active item into view when it changes
  useEffect(() => {
    if (activeHeadingId && activeItemRef.current) {
      const activeElement = activeItemRef.current.querySelector(
        `[data-testid="outline-item-${activeHeadingId}"]`
      );
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [activeHeadingId]);

  const handleFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilter(e.target.value);
    },
    []
  );

  const handleClearFilter = useCallback(() => {
    setFilter("");
    filterInputRef.current?.focus();
  }, []);

  if (headings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="text-[var(--color-border-strong)] mb-4 opacity-60">
          <List className="h-8 w-8" />
        </div>
        <p className="m-0 mb-1 font-sans text-sm font-medium text-[var(--color-ink-light)]">No headings</p>
        <p className="m-0 font-sans text-xs text-[var(--color-ink-muted)] italic">
          Add headings to your document to see an outline here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" data-testid="document-outline">
      {/* Filter input */}
      <div
        className={cn(
          "flex items-center gap-2 m-3 px-3 py-2 bg-[var(--color-paper)] border border-[var(--color-border)] rounded-md transition-all duration-150",
          isFilterFocused && "border-[var(--color-accent)] shadow-[0_0_0_3px_var(--color-accent-soft)]"
        )}
      >
        <Search className="h-4 w-4 flex-shrink-0 text-[var(--color-ink-muted)]" />
        <input
          ref={filterInputRef}
          type="text"
          placeholder="Filter headings..."
          value={filter}
          onChange={handleFilterChange}
          onFocus={() => setIsFilterFocused(true)}
          onBlur={() => setIsFilterFocused(false)}
          className="flex-1 border-none bg-transparent font-sans text-[0.8125rem] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-muted)] placeholder:italic"
          data-testid="outline-filter"
        />
        {filter && (
          <button
            type="button"
            className="flex items-center justify-center w-5 h-5 p-0 border-none rounded-full bg-[var(--color-border)] text-[var(--color-ink-muted)] cursor-pointer transition-all duration-150 hover:bg-[var(--color-border-strong)] hover:text-[var(--color-ink)]"
            onClick={handleClearFilter}
            aria-label="Clear filter"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        {!filter && !isFilterFocused && (
          <kbd className="px-1.5 py-0.5 bg-[var(--color-border)] border-none rounded font-mono text-[0.625rem] text-[var(--color-ink-muted)]">/</kbd>
        )}
      </div>

      {/* Headings list */}
      <div className="flex-1 overflow-y-auto py-1" ref={activeItemRef}>
        {filteredHeadings.length > 0 ? (
          filteredHeadings.map((heading, index) => (
            <OutlineItem
              key={`${heading.id}-${heading.level}-${index}`}
              heading={heading}
              isActive={activeHeadingId === heading.id}
              onClick={onHeadingClick}
            />
          ))
        ) : (
          <div className="py-6 px-4 text-center text-[var(--color-ink-muted)] font-sans text-[0.8125rem] italic">
            <p>No matching headings</p>
          </div>
        )}
      </div>

      {/* Stats footer */}
      <div className="px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-paper-warm)]">
        <span className="font-sans text-[0.6875rem] text-[var(--color-ink-muted)] tracking-wide">
          {filteredHeadings.length === headings.length
            ? `${headings.length} heading${headings.length === 1 ? "" : "s"}`
            : `${filteredHeadings.length} of ${headings.length}`}
        </span>
      </div>
    </div>
  );
}

export default DocumentOutline;
