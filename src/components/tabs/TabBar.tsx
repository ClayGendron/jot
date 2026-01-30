import { useCallback, useState, useRef, DragEvent, MouseEvent } from "react";
import { Tab } from "./Tab";
import type { Tab as TabType } from "@/stores/tabsStore";

interface TabBarProps {
  tabs: TabType[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabReorder: (fromIndex: number, toIndex: number) => void;
  onTabContextMenu: (tabId: string, position: { x: number; y: number }) => void;
}

export function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabReorder,
  onTabContextMenu,
}: TabBarProps) {
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"left" | "right" | null>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback(
    (tabId: string) => (e: DragEvent) => {
      setDraggedTabId(tabId);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", tabId);

      // Create a subtle drag image
      const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
      dragImage.style.opacity = "0.8";
      dragImage.style.position = "absolute";
      dragImage.style.top = "-9999px";
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 20, 20);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    },
    []
  );

  const handleDragOver = useCallback(
    (tabId: string) => (e: DragEvent) => {
      e.preventDefault();
      if (draggedTabId === tabId) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      const position = e.clientX < midpoint ? "left" : "right";

      setDragOverTabId(tabId);
      setDragOverPosition(position);
    },
    [draggedTabId]
  );

  const handleDragLeave = useCallback(() => {
    setDragOverTabId(null);
    setDragOverPosition(null);
  }, []);

  const handleDrop = useCallback(
    (targetTabId: string) => (e: DragEvent) => {
      e.preventDefault();

      if (!draggedTabId || draggedTabId === targetTabId) {
        setDraggedTabId(null);
        setDragOverTabId(null);
        setDragOverPosition(null);
        return;
      }

      const fromIndex = tabs.findIndex((t) => t.id === draggedTabId);
      let toIndex = tabs.findIndex((t) => t.id === targetTabId);

      if (fromIndex === -1 || toIndex === -1) return;

      // Adjust target index based on drop position
      if (dragOverPosition === "right") {
        toIndex = toIndex + 1;
      }

      // Account for removal of dragged item
      if (fromIndex < toIndex) {
        toIndex = toIndex - 1;
      }

      onTabReorder(fromIndex, toIndex);

      setDraggedTabId(null);
      setDragOverTabId(null);
      setDragOverPosition(null);
    },
    [draggedTabId, dragOverPosition, tabs, onTabReorder]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedTabId(null);
    setDragOverTabId(null);
    setDragOverPosition(null);
  }, []);

  const handleContextMenu = useCallback(
    (tabId: string) => (e: MouseEvent) => {
      onTabContextMenu(tabId, { x: e.clientX, y: e.clientY });
    },
    [onTabContextMenu]
  );

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div
      className="tab-bar"
      ref={tabBarRef}
      onDragEnd={handleDragEnd}
      data-testid="tab-bar"
    >
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          onSelect={() => onTabSelect(tab.id)}
          onClose={() => onTabClose(tab.id)}
          onContextMenu={handleContextMenu(tab.id)}
          isDragging={tab.id === draggedTabId}
          dragOverPosition={tab.id === dragOverTabId ? dragOverPosition : null}
          onDragStart={handleDragStart(tab.id)}
          onDragOver={handleDragOver(tab.id)}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop(tab.id)}
        />
      ))}
    </div>
  );
}
