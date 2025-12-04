import React, { useState, useCallback, useEffect } from 'react';
import { PageTabs } from './PageTabs';
import { Leaf } from './Leaf';
import { SearchCommand } from './SearchCommand';
import { LinkGraph } from './LinkGraph';
import {
  WorkSpaceProps,
  DocumentTab,
  WorkspaceState,
  DocumentCache,
} from './types';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';

export const WorkSpace: React.FC<WorkSpaceProps> = ({
  initialPath,
  basePath = '/wiki',
  onDocumentOpen,
  onDocumentClose,
  className,
}) => {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>({
    tabs: [],
    activeTabId: null,
    sidebarOpen: false,
    searchQuery: '',
  });
  const [searchOpen, setSearchOpen] = useState(false);

  const [documentCache, setDocumentCache] = useState<DocumentCache>({});
  const [isInitialized, setIsInitialized] = useState(false);

  // 监听文档打开事件
  useEffect(() => {
    const handleOpenDocument = (event: CustomEvent) => {
      const { path, title } = event.detail;
      openDocument(path);
    };

    window.addEventListener(
      'openDocument',
      handleOpenDocument as EventListener,
    );

    return () => {
      window.removeEventListener(
        'openDocument',
        handleOpenDocument as EventListener,
      );
    };
  }, [workspaceState.tabs]);

  // 初始化工作区
  useEffect(() => {
    if (!isInitialized && initialPath) {
      openDocument(initialPath);
      setIsInitialized(true);
    } else if (!isInitialized) {
      // 如果没有初始路径，创建一个欢迎页
      const welcomeTab: DocumentTab = {
        id: uuidv4(),
        title: '欢迎使用',
        path: 'welcome',
        content:
          '# 欢迎使用文档工作区\n\n这是一个基于 Markdown 的文档浏览和编辑工作区。\n\n## 功能特性\n\n- 📄 多标签页浏览\n- 🔍 快速搜索\n- 📂 文件树导航\n- 📝 Markdown 渲染\n- 🔗 内部链接支持\n- 📊 引用和注释\n- 🕸️ 链接关系图\n\n## 开始使用\n\n1. 点击右上角 "+" 按钮打开新文档\n2. 拖拽标签页重新排序\n3. 点击标签页上的 "×" 关闭文档\n4. 右侧查看当前文档的链接关系图\n\n开始探索吧！',
        isActive: true,
      };

      setWorkspaceState({
        tabs: [welcomeTab],
        activeTabId: welcomeTab.id,
        sidebarOpen: false,
        searchQuery: '',
      });

      setIsInitialized(true);
    }
  }, [initialPath, isInitialized]);

  // 打开文档
  const openDocument = useCallback(
    async (path: string) => {
      // 检查是否已打开
      const existingTab = workspaceState.tabs.find((tab) => tab.path === path);
      if (existingTab) {
        setWorkspaceState((prev) => ({
          ...prev,
          activeTabId: existingTab.id,
        }));
        return;
      }

      try {
        // 获取文档信息
        const response = await fetch(
          `/api/knowledge/text?key=${encodeURIComponent(path)}`,
        );
        if (!response.ok) {
          throw new Error(`获取文档失败: ${response.status}`);
        }

        const document = await response.json();

        if (!document) {
          throw new Error('文档不存在');
        }

        const newTab: DocumentTab = {
          id: uuidv4(),
          title: document.title || path.split('/').pop() || '未命名文档',
          path,
          content: document.content || '',
          isActive: true,
          lastModified: new Date(),
        };

        setWorkspaceState((prev) => ({
          ...prev,
          tabs: [
            ...prev.tabs.map((tab) => ({ ...tab, isActive: false })),
            newTab,
          ],
          activeTabId: newTab.id,
        }));

        // 缓存文档
        setDocumentCache((prev) => ({
          ...prev,
          [path]: {
            content: document.content || '',
            lastModified: new Date(),
            title: document.title || path.split('/').pop() || '未命名文档',
          },
        }));

        if (onDocumentOpen) {
          onDocumentOpen(path);
        }
      } catch (error) {
        console.error('打开文档失败:', error);
      }
    },
    [workspaceState.tabs, onDocumentOpen],
  );

  // 关闭文档
  const closeDocument = useCallback(
    (tabId: string) => {
      setWorkspaceState((prev) => {
        const tabToClose = prev.tabs.find((tab) => tab.id === tabId);
        if (!tabToClose) return prev;

        const newTabs = prev.tabs.filter((tab) => tab.id !== tabId);
        let newActiveTabId = prev.activeTabId;

        if (prev.activeTabId === tabId) {
          const closingIndex = prev.tabs.findIndex((tab) => tab.id === tabId);
          if (newTabs.length > 0) {
            newActiveTabId =
              newTabs[Math.min(closingIndex, newTabs.length - 1)].id;
          } else {
            newActiveTabId = null;
          }
        }

        const updatedTabs = newTabs.map((tab) => ({
          ...tab,
          isActive: tab.id === newActiveTabId,
        }));

        if (onDocumentClose && tabToClose.path) {
          onDocumentClose(tabToClose.path);
        }

        return {
          ...prev,
          tabs: updatedTabs,
          activeTabId: newActiveTabId,
        };
      });
    },
    [onDocumentClose],
  );

  // 切换标签页
  const switchTab = useCallback((tabId: string) => {
    setWorkspaceState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((tab) => ({
        ...tab,
        isActive: tab.id === tabId,
      })),
      activeTabId: tabId,
    }));
  }, []);

  // 重新排序标签页
  const reorderTabs = useCallback((tabId: string, newIndex: number) => {
    setWorkspaceState((prev) => {
      const tabIndex = prev.tabs.findIndex((tab) => tab.id === tabId);
      if (tabIndex === -1) return prev;

      const newTabs = [...prev.tabs];
      const [movedTab] = newTabs.splice(tabIndex, 1);
      newTabs.splice(newIndex, 0, movedTab);

      return {
        ...prev,
        tabs: newTabs,
      };
    });
  }, []);

  // 创建新标签页
  const createNewTab = useCallback(() => {
    const newTab: DocumentTab = {
      id: uuidv4(),
      title: '新文档',
      path: `new-${Date.now()}`,
      content: '# 新文档\n\n开始编写您的内容...',
      isActive: true,
    };

    setWorkspaceState((prev) => ({
      ...prev,
      tabs: [...prev.tabs.map((tab) => ({ ...tab, isActive: false })), newTab],
      activeTabId: newTab.id,
    }));
  }, []);

  // 更新文档内容
  const updateDocumentContent = useCallback((path: string, content: string) => {
    setWorkspaceState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((tab) =>
        tab.path === path ? { ...tab, content, isDirty: true } : tab,
      ),
    }));

    setDocumentCache((prev) => ({
      ...prev,
      [path]: {
        ...prev[path],
        content,
        lastModified: new Date(),
      },
    }));
  }, []);

  // 更新文档标题
  const updateDocumentTitle = useCallback((path: string, title: string) => {
    setWorkspaceState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((tab) =>
        tab.path === path ? { ...tab, title } : tab,
      ),
    }));

    setDocumentCache((prev) => ({
      ...prev,
      [path]: {
        ...prev[path],
        title,
        lastModified: new Date(),
      },
    }));
  }, []);

  const activeTab = workspaceState.tabs.find(
    (tab) => tab.id === workspaceState.activeTabId,
  );

  return (
    <div
      className={cn(
        'flex flex-col h-[80vh] bg-background text-foreground',
        className,
      )}
    >
      <PageTabs
        tabs={workspaceState.tabs}
        activeTabId={workspaceState.activeTabId}
        onTabClick={switchTab}
        onTabClose={closeDocument}
        onTabReorder={reorderTabs}
        onSearchClick={() => setSearchOpen(true)}
      />

      <SearchCommand
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelectResult={(result) => {
          openDocument(result.path);
        }}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-3">
          {activeTab ? (
            <Leaf
              documentPath={activeTab.path}
              onContentChange={(content) =>
                updateDocumentContent(activeTab.path, content)
              }
              onTitleChange={(title) =>
                updateDocumentTitle(activeTab.path, title)
              }
              readOnly={false}
              onOpenDocument={openDocument}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-background">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-foreground mb-2">
                  没有打开的文档
                </h2>
                <p className="text-muted-foreground">
                  按 ⌘K 或点击右上角搜索按钮打开文档
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="w-80 border-l flex-shrink-0">
          <LinkGraph activeTab={activeTab || null} />
        </div>
      </div>
    </div>
  );
};
