import React, { useState, useEffect, useCallback, useRef } from "react";
import DocumentDisplay from "@/components/wiki/DocumentDisplay";
import { LeafProps } from "./types";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export const Leaf: React.FC<LeafProps> = ({
  documentPath,
  onContentChange,
  onTitleChange,
  readOnly = false,
  onOpenDocument,
}) => {
  const [content, setContent] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [references, setReferences] = useState<any[]>([]);
  const currentPathRef = useRef<string>("");

  const onTitleChangeRef = useRef(onTitleChange);

  // 更新ref当onTitleChange变化时
  useEffect(() => {
    onTitleChangeRef.current = onTitleChange;
  }, [onTitleChange]);

  const fetchDocument = useCallback(async (path: string) => {
    if (!path) {
      setError("未提供文档路径");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 使用新的knowledge API
      const response = await fetch(
        `/api/knowledge/text?key=${encodeURIComponent(path)}`,
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`文档不存在: ${path}`);
        }
        throw new Error(
          `获取文档失败: ${response.status} ${response.statusText}`,
        );
      }

      const document = await response.json();

      if (!document) {
        throw new Error("文档内容为空");
      }

      const newTitle = document.title || path.split("/").pop() || "未命名文档";

      setContent(document.content || "");
      setTitle(newTitle);

      // 使用ref来调用onTitleChange，避免依赖问题
      if (onTitleChangeRef.current) {
        onTitleChangeRef.current(newTitle);
      }

      // 处理引用（如果有）
      if (document.references && Array.isArray(document.references)) {
        setReferences(document.references);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "未知错误";
      setError(errorMessage);
      console.error("加载文档失败:", err);
    } finally {
      setLoading(false);
    }
  }, []); // 空依赖数组，因为使用了ref

  useEffect(() => {
    // 只有当路径真正改变时才重新获取文档
    if (documentPath !== currentPathRef.current) {
      currentPathRef.current = documentPath;
      fetchDocument(documentPath);
    }
  }, [documentPath, fetchDocument]);

  const handleContentUpdate = (newContent: string) => {
    setContent(newContent);
    if (onContentChange) {
      onContentChange(newContent);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col p-6 space-y-4 overflow-y-auto">
        {/* Title skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>

        {/* Content skeleton */}
        <div className="space-y-3 flex-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>

        {/* References skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-6 w-24" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <h3 className="text-lg font-semibold text-foreground">加载失败</h3>
          <p className="text-muted-foreground max-w-md">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col", readOnly && "read-only")}>
      <div className="flex-1 overflow-y-auto">
        <DocumentDisplay
          content={content}
          basePath="/wiki"
          references={references}
          className="h-full"
          useWorkspace={true}
          onOpenDocument={onOpenDocument}
        />
      </div>
    </div>
  );
};
