"use client";

import React, { useState, useEffect } from "react";
import { Search } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandList,
} from "@/components/ui/command";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

interface SearchResult {
  path: string;
  title: string;
  content?: string;
  type: "document" | "note";
}

interface DocumentSearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectResult: (result: SearchResult) => void;
}

export function DocumentSearchCommand({
  open,
  onOpenChange,
  onSelectResult,
}: DocumentSearchCommandProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery || trimmedQuery.length < 2) {
      setResults([]);
      return;
    }

    const search = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/knowledge/search?query=${encodeURIComponent(trimmedQuery)}`,
        );
        if (response.ok) {
          const data = await response.json();
          setResults(data.results || []);
        } else {
          setResults([]);
        }
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(search, 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    onSelectResult(result);
    onOpenChange(false);
    setQuery("");
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="搜索文档和笔记..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {loading
              ? "搜索中..."
              : query.trim().length === 0
                ? "请输入搜索关键词"
                : query.trim().length === 1
                  ? "请至少输入2个字符开始搜索"
                  : results.length === 0
                    ? "未找到结果"
                    : ""}
          </CommandEmpty>

          {results.length > 0 && (
            <div className="p-2">
              <div className="text-sm font-medium text-muted-foreground mb-2">
                搜索结果 ({results.length})
              </div>
              <Accordion type="single" collapsible className="w-full">
                {results.map((result, index) => (
                  <AccordionItem
                    key={`${result.path}-${index}`}
                    value={result.path}
                  >
                    <div className="flex items-center hover:bg-accent/50 rounded-md">
                      <div
                        className="flex-1 cursor-pointer px-2 py-2"
                        onClick={() => handleSelect(result)}
                      >
                        <div className="flex items-center">
                          <Search className="mr-2 h-4 w-4 flex-shrink-0" />
                          <span className="font-medium text-left flex-1">
                            {result.title}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {result.type === "note" ? "笔记" : "文档"}
                          </span>
                        </div>
                      </div>
                      {result.content && (
                        <AccordionTrigger className="px-2 py-2 shrink-0" />
                      )}
                    </div>
                    {result.content && (
                      <AccordionContent>
                        <div className="px-2 py-2 text-sm text-muted-foreground">
                          {result.content.length > 150
                            ? `${result.content.substring(0, 150)}...`
                            : result.content}
                        </div>
                      </AccordionContent>
                    )}
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}