import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface MarkdownViewerProps {
  url: string;
  fileName: string;
}

export function MarkdownViewer({ url, fileName }: MarkdownViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setError(null);

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load markdown");
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-1 border-b bg-muted/50 px-2 py-1">
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {fileName}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => window.open(url, "_blank")}
          title="Download"
        >
          <Download className="size-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-auto p-6">
        {content === null ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="mx-auto max-w-4xl">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <Markdown remarkPlugins={[remarkGfm]}>
                {content}
              </Markdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
