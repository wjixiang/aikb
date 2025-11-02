"use client";

import React, { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchIcon, FileTextIcon, FolderIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DocumentItem {
  path: string;
  title: string;
  type: "file" | "folder";
  children?: DocumentItem[];
}

interface DocumentSelectorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectDocument: (path: string, title: string) => void;
}

export function DocumentSelectorDrawer({
  open,
  onOpenChange,
  onSelectDocument,
}: DocumentSelectorDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // 获取文档列表
  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/knowledge/list");
      if (!response.ok) {
        throw new Error("获取文档列表失败");
      }
      const data = await response.json();
      setDocuments(data.documents || []);
      setFilteredDocuments(data.documents || []);
    } catch (error) {
      console.error("获取文档列表失败:", error);
    } finally {
      setLoading(false);
    }
  };

  // 当抽屉打开时获取文档列表
  useEffect(() => {
    if (open) {
      fetchDocuments();
    }
  }, [open]);

  // 根据搜索查询过滤文档
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredDocuments(documents);
      return;
    }

    const filterDocuments = (items: DocumentItem[]): DocumentItem[] => {
      return items
        .map(item => {
          // 如果是文件夹，递归过滤子项
          if (item.type === "folder" && item.children) {
            const filteredChildren = filterDocuments(item.children);
            if (filteredChildren.length > 0) {
              return { ...item, children: filteredChildren };
            }
          }
          // 如果是文件且匹配搜索查询
          else if (item.type === "file" && 
                   (item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.path.toLowerCase().includes(searchQuery.toLowerCase()))) {
            return item;
          }
          return null;
        })
        .filter(Boolean) as DocumentItem[];
    };

    setFilteredDocuments(filterDocuments(documents));
  }, [searchQuery, documents]);

  // 切换文件夹展开状态
  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  // 渲染文档树
  const renderDocumentTree = (items: DocumentItem[], level = 0) => {
    return (
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.path}>
            <div
              className={`flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer ${
                level > 0 ? "ml-4" : ""
              }`}
              onClick={() => {
                if (item.type === "folder") {
                  toggleFolder(item.path);
                } else {
                  onSelectDocument(item.path, item.title);
                  onOpenChange(false);
                }
              }}
            >
              {item.type === "folder" ? (
                <FolderIcon className="h-4 w-4 text-blue-500" />
              ) : (
                <FileTextIcon className="h-4 w-4 text-green-500" />
              )}
              <span className="text-sm truncate">{item.title}</span>
              {item.type === "folder" && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {expandedFolders.has(item.path) ? "−" : "+"}
                </span>
              )}
            </div>
            
            {item.type === "folder" && 
             item.children && 
             expandedFolders.has(item.path) && (
              <div className="mt-1">
                {renderDocumentTree(item.children, level + 1)}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[80vh]">
        <DrawerHeader>
          <DrawerTitle>选择文档</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 pb-0">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索文档..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex-1 overflow-hidden p-4">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 p-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">没有找到匹配的文档</p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              {renderDocumentTree(filteredDocuments)}
            </ScrollArea>
          )}
        </div>
        <div className="p-4 pt-0 border-t">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            取消
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}