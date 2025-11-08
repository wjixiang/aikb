export interface DocumentTab {
  id: string;
  title: string;
  path: string;
  content?: string;
  isActive: boolean;
  isDirty?: boolean;
  lastModified?: Date;
}

export interface WorkspaceState {
  tabs: DocumentTab[];
  activeTabId: string | null;
  sidebarOpen: boolean;
  searchQuery: string;
}

export interface LeafProps {
  documentPath: string;
  onContentChange?: (content: string) => void;
  onTitleChange?: (title: string) => void;
  readOnly?: boolean;
  onOpenDocument?: (path: string) => void;
}

export interface PageTabsProps {
  tabs: DocumentTab[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabReorder: (tabId: string, newIndex: number) => void;
  onNewTab: () => void;
}

export interface WorkSpaceProps {
  initialPath?: string;
  basePath?: string;
  onDocumentOpen?: (path: string) => void;
  onDocumentClose?: (path: string) => void;
  className?: string;
}

export interface DocumentCache {
  [path: string]: {
    content: string;
    lastModified: Date;
    title: string;
  };
}
