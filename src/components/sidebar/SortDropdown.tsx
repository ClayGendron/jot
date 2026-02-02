import { ArrowUpDown, ChevronDown } from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { SortBy, SortDirection } from "@/lib/files/sortFiles";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

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

export function SortDropdown() {
  const sortBy = useWorkspaceStore((s) => s.sortBy);
  const sortDirection = useWorkspaceStore((s) => s.sortDirection);
  const setSortBy = useWorkspaceStore((s) => s.setSortBy);
  const setSortDirection = useWorkspaceStore((s) => s.setSortDirection);

  const currentOption = SORT_OPTIONS.find(
    (opt) => opt.sortBy === sortBy && opt.sortDirection === sortDirection
  );

  const currentValue = `${sortBy}-${sortDirection}`;

  const handleValueChange = (value: string) => {
    const opt = SORT_OPTIONS.find(
      (o) => `${o.sortBy}-${o.sortDirection}` === value
    );
    if (opt) {
      setSortBy(opt.sortBy);
      setSortDirection(opt.sortDirection);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            title="Sort files"
            className="text-muted-foreground hover:text-foreground"
          />
        }
      >
        <ArrowUpDown className="size-4" />
        <span className="text-xs whitespace-nowrap">
          {currentOption?.label ?? "Sort"}
        </span>
        <ChevronDown className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        <DropdownMenuRadioGroup
          value={currentValue}
          onValueChange={handleValueChange}
        >
          {SORT_OPTIONS.map((opt) => (
            <DropdownMenuRadioItem
              key={`${opt.sortBy}-${opt.sortDirection}`}
              value={`${opt.sortBy}-${opt.sortDirection}`}
            >
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
