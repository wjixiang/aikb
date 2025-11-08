import React, { useState, useRef, useEffect } from "react";
import { X, Search, FileText, Circle } from "lucide-react";
import { DocumentTab } from "./types";
import { cn } from "@/lib/utils";

interface PageTabsProps {
  tabs: DocumentTab[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabReorder: (tabId: string, newIndex: number) => void;
  onSearchClick: () => void;
}

export const PageTabs: React.FC<PageTabsProps> = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onTabReorder,
  onSearchClick,
}) => {
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    setDraggedTabId(tabId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedTabId) {
      onTabReorder(draggedTabId, dropIndex);
    }
    setDraggedTabId(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedTabId(null);
    setDragOverIndex(null);
  };

  const handleWheelScroll = (e: React.WheelEvent) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    onTabClose(tabId);
  };

  const scrollToTab = (tabId: string) => {
    if (scrollContainerRef.current) {
      const tabElement = scrollContainerRef.current.querySelector(
        `[data-tab-id="${tabId}"]`,
      );
      if (tabElement) {
        tabElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  };

  useEffect(() => {
    if (activeTabId) {
      scrollToTab(activeTabId);
    }
  }, [activeTabId]);

  return (
    <div className="flex items-center bg-secondary border-b border-border">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto scrollbar-thin"
        onWheel={handleWheelScroll}
      >
        <div ref={tabsRef} className="flex items-center min-w-0">
          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              draggable
              onDragStart={(e) => handleDragStart(e, tab.id)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                "group relative flex items-center gap-2 px-3 py-2 min-w-[120px] max-w-[200px] border-r border-border cursor-pointer select-none transition-all duration-200 text-sm font-medium",
                {
                  "bg-background border-b-2 border-primary text-primary":
                    tab.id === activeTabId,
                  "bg-secondary text-muted-foreground hover:bg-accent hover:text-accent-foreground":
                    tab.id !== activeTabId,
                  "opacity-50": draggedTabId === tab.id,
                  "border-l-2 border-l-primary": dragOverIndex === index,
                },
              )}
              onClick={() => onTabClick(tab.id)}
            >
              <FileText size={14} className="flex-shrink-0" />

              <span className="flex-1 truncate">{tab.title}</span>

              {tab.isDirty && (
                <Circle
                  size={8}
                  className="flex-shrink-0 text-orange-500 fill-current"
                />
              )}

              <button
                onClick={(e) => handleCloseTab(e, tab.id)}
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted rounded p-0.5"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onSearchClick}
        className="flex items-center justify-center w-10 h-10 hover:bg-accent transition-colors"
        title="搜索文档 (⌘K)"
      >
        <Search size={16} />
      </button>
    </div>
  );
};
