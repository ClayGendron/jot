import { useState, useRef, useEffect } from "react";
import { ArrowUpDown } from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { SortBy, SortDirection } from "@/lib/files/sortFiles";

interface SortOption {
  sortBy: SortBy;
  sortDirection: SortDirection;
  label: string;
}

const SORT_OPTIONS: SortOption[] = [
  { sortBy: "name", sortDirection: "asc", label: "Name (A-Z)" },
  { sortBy: "name", sortDirection: "desc", label: "Name (Z-A)" },
  { sortBy: "modified", sortDirection: "desc", label: "Date (Newest)" },
  { sortBy: "modified", sortDirection: "asc", label: "Date (Oldest)" },
];

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.15s ease",
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function SortDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const sortBy = useWorkspaceStore((s) => s.sortBy);
  const sortDirection = useWorkspaceStore((s) => s.sortDirection);
  const setSortBy = useWorkspaceStore((s) => s.setSortBy);
  const setSortDirection = useWorkspaceStore((s) => s.setSortDirection);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const currentOption = SORT_OPTIONS.find(
    (opt) => opt.sortBy === sortBy && opt.sortDirection === sortDirection
  );

  const handleOptionClick = (opt: SortOption) => {
    setSortBy(opt.sortBy);
    setSortDirection(opt.sortDirection);
    setIsOpen(false);
  };

  return (
    <div className="sort-dropdown" ref={dropdownRef}>
      <button
        className="sort-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title="Sort files"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <ArrowUpDown className="h-4 w-4" />
        <span className="sort-label">{currentOption?.label ?? "Sort"}</span>
        <ChevronIcon isOpen={isOpen} />
      </button>
      {isOpen && (
        <div className="sort-dropdown-menu" role="listbox">
          {SORT_OPTIONS.map((opt) => {
            const isActive =
              sortBy === opt.sortBy && sortDirection === opt.sortDirection;
            return (
              <button
                key={`${opt.sortBy}-${opt.sortDirection}`}
                className={`sort-option ${isActive ? "active" : ""}`}
                onClick={() => handleOptionClick(opt)}
                role="option"
                aria-selected={isActive}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
