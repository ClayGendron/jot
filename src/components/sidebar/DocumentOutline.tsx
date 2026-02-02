import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import { List, Search, X } from "lucide-react";
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
      className={`outline-item ${isActive ? "active" : ""}`}
      style={{ paddingLeft: `${indent + 12}px` }}
      onClick={handleClick}
      data-testid={`outline-item-${heading.id}`}
      data-level={heading.level}
    >
      {/* Depth indicator line */}
      {heading.level > 1 && (
        <span
          className="outline-depth-line"
          style={{ left: `${(heading.level - 2) * 16 + 8}px` }}
        />
      )}

      {/* Level indicator pill */}
      <span className="outline-level">H{heading.level}</span>

      {/* Heading text */}
      <span className="outline-text">{heading.text}</span>

      {/* Active indicator */}
      {isActive && <span className="outline-active-marker" />}
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
      <div className="outline-empty-state">
        <div className="outline-empty-icon">
          <List className="h-8 w-8" />
        </div>
        <p className="outline-empty-title">No headings</p>
        <p className="outline-empty-hint">
          Add headings to your document to see an outline here
        </p>
      </div>
    );
  }

  return (
    <div className="document-outline" data-testid="document-outline">
      {/* Filter input */}
      <div className={`outline-filter ${isFilterFocused ? "focused" : ""}`}>
        <Search className="h-4 w-4" />
        <input
          ref={filterInputRef}
          type="text"
          placeholder="Filter headings..."
          value={filter}
          onChange={handleFilterChange}
          onFocus={() => setIsFilterFocused(true)}
          onBlur={() => setIsFilterFocused(false)}
          className="outline-filter-input"
          data-testid="outline-filter"
        />
        {filter && (
          <button
            type="button"
            className="outline-filter-clear"
            onClick={handleClearFilter}
            aria-label="Clear filter"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        {!filter && !isFilterFocused && (
          <kbd className="outline-filter-hint">/</kbd>
        )}
      </div>

      {/* Headings list */}
      <div className="outline-list" ref={activeItemRef}>
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
          <div className="outline-no-results">
            <p>No matching headings</p>
          </div>
        )}
      </div>

      {/* Stats footer */}
      <div className="outline-footer">
        <span className="outline-stats">
          {filteredHeadings.length === headings.length
            ? `${headings.length} heading${headings.length === 1 ? "" : "s"}`
            : `${filteredHeadings.length} of ${headings.length}`}
        </span>
      </div>
    </div>
  );
}

export default DocumentOutline;
