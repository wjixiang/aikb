"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SearchResult } from "@/types/noteData.types";
import { Suspense } from "react";

// shadcn/ui 组件
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

// 图标
import { Search, AlertCircle, Loader2, Info, X } from "lucide-react";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 执行搜索的函数
  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/note/search?q=${encodeURIComponent(searchQuery)}`,
      );

      if (!response.ok) {
        throw new Error(`搜索请求失败: ${response.status}`);
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error("搜索出错:", error);
      setError(error instanceof Error ? error.message : "搜索过程中发生错误");
    } finally {
      setLoading(false);
    }
  };

  // 初始加载时执行搜索
  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  // 高亮匹配的文本
  const highlightMatch = (text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text;

    const regex = new RegExp(
      `(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi",
    );
    return text.replace(
      regex,
      '<mark class="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">$1</mark>',
    );
  };

  // 处理新的搜索，但不改变URL
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setQuery(searchInput);
      performSearch(searchInput);
    }
  };

  // 清除搜索
  const clearSearch = () => {
    setSearchInput("");
    setQuery("");
    setResults([]);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden p-1">
      <div className="flex-none py-2 space-y-2">
        <Suspense>
          {/* 搜索表单 */}
          <form
            onSubmit={handleSearch}
            className="flex w-full items-center space-x-1"
          >
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="搜索文章..."
                className="pl-7 h-9"
              />
              {searchInput && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-7 w-7 p-0"
                  onClick={clearSearch}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">清除</span>
                </Button>
              )}
            </div>
            <Button type="submit" size="sm">
              搜索
            </Button>
          </form>

          {query && (
            <div className="flex items-center">
              <span className="text-xs text-muted-foreground mr-1">搜索:</span>
              <Badge variant="secondary" className="text-xs">
                {query}
              </Badge>
            </div>
          )}
        </Suspense>
      </div>

      <Separator />

      {/* 滚动区域 */}
      <ScrollArea className="flex-1 w-full overflow-y-auto">
        <div className="px-2 pb-2">
          {/* 加载状态 */}
          {loading && (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span className="text-sm">搜索中...</span>
            </div>
          )}

          {/* 错误信息 */}
          {error && (
            <Alert variant="destructive" className="my-2 text-sm">
              <AlertCircle className="h-4 w-4 mr-1" />
              <AlertDescription className="flex flex-col">
                <span>{error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => performSearch(query)}
                  className="mt-1 self-start text-xs"
                >
                  重试
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* 搜索结果 */}
          {!loading && !error && (
            <>
              {results.length > 0 ? (
                <div className="space-y-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    找到 {results.length} 个结果
                  </p>

                  <div className="space-y-3">
                    {results.map((result) => (
                      <Card key={result.id} className="overflow-hidden">
                        <CardHeader className="p-2 pb-1">
                          <Link href={`/wiki/${result.title}`}>
                            <CardTitle
                              className="text-base hover:underline cursor-pointer"
                              dangerouslySetInnerHTML={{
                                __html: highlightMatch(result.title, query),
                              }}
                            />
                          </Link>
                        </CardHeader>
                        <CardContent className="p-3 pt-1">
                          <p
                            className="text-sm text-muted-foreground"
                            dangerouslySetInnerHTML={{
                              __html: highlightMatch(result.excerpt, query),
                            }}
                          />
                        </CardContent>
                        <CardFooter className="p-3 pt-0">
                          <p className="text-xs text-muted-foreground">
                            ID: {result.id}
                          </p>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>

                  {/* 搜索提示 */}
                  <Card className="bg-muted/40">
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-sm flex items-center">
                        <Info className="h-3 w-3 mr-1" />
                        搜索提示
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-1">
                      <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                        <li>使用引号搜索精确短语</li>
                        <li>使用减号排除某个词</li>
                        <li>尝试使用同义词获得更多结果</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                query && (
                  <div className="flex flex-col items-center justify-center py-6">
                    <div className="rounded-full bg-muted p-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <h3 className="mt-2 text-base font-medium">
                      没有找到匹配的结果
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground text-center">
                      尝试使用不同的关键词或检查拼写。
                    </p>
                    <Button
                      variant="outline"
                      onClick={clearSearch}
                      className="mt-3 text-xs"
                      size="sm"
                    >
                      清除搜索
                    </Button>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
