"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { DocumentTab as Tab } from "./types";

interface WorkSpaceContextType {
  tabs: Tab[];
  activeTabId: string | null;
  addTab: (tab: Tab) => void;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  reorderTabs: (startIndex: number, endIndex: number) => void;
}

const WorkSpaceContext = createContext<WorkSpaceContextType | undefined>(
  undefined,
);

interface WorkSpaceProviderProps {
  children: ReactNode;
  value: WorkSpaceContextType;
}

export function WorkSpaceProvider({ children, value }: WorkSpaceProviderProps) {
  return (
    <WorkSpaceContext.Provider value={value}>
      {children}
    </WorkSpaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkSpaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkSpaceProvider");
  }
  return context;
}
