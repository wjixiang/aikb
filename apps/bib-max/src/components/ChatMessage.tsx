import { useState, useMemo } from 'react';
import type { ChatMessage } from '@/lib/api/chat';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { ChevronRight, ChevronDown, Wrench, CheckCircle2, XCircle, Loader2 } from "lucide-react";

// ============ JSON Syntax Highlighting ============

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function JsonSyntax({ value, depth = 0 }: { value: JsonValue; depth?: number }) {
  if (value === null) return <span className="text-rose-400">null</span>;
  if (typeof value === 'boolean') return <span className="text-amber-400">{String(value)}</span>;
  if (typeof value === 'number') return <span className="text-sky-400">{value}</span>;
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) {
      return (
        <span>
          <span className="text-green-400">"</span>
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline decoration-dotted underline-offset-2 hover:text-cyan-300 break-all">
            {value}
          </a>
          <span className="text-green-400">"</span>
        </span>
      );
    }
    return <span className="text-green-400">"{value}"</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">[]</span>;
    return (
      <span className="text-muted-foreground">
        [<JsonBlock value={value} depth={depth} />]
      </span>
    );
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return <span className="text-muted-foreground">{"{}"}</span>;
  return (
    <span className="text-muted-foreground">
      {"{"}<JsonBlock value={value} depth={depth} />{"}"}
    </span>
  );
}

function JsonBlock({ value, depth = 0 }: { value: JsonValue[] | { [key: string]: JsonValue }; depth?: number }) {
  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value);
  const isExpanded = entries.length <= 6 && depth < 3;

  if (!isExpanded) {
    return (
      <span>
        {Array.isArray(value) ? "" : "{"}
        {entries.map(([k, v], i) => (
          <span key={k}>
            {i > 0 && <span className="text-muted-foreground">, </span>}
            {!Array.isArray(value) && <><span className="text-violet-400">{k}</span><span className="text-muted-foreground">: </span></>}
            <JsonSyntaxInline value={v} />
          </span>
        ))}
        {Array.isArray(value) ? "" : "}"}
      </span>
    );
  }

  const indent = "  ".repeat(depth + 1);
  const closingIndent = "  ".repeat(depth);
  return (
    <>
      {"\n"}
      {entries.map(([key, val], i) => (
        <span key={key}>
          {indent}
          {!Array.isArray(value) && <><span className="text-violet-400">{key}</span><span className="text-muted-foreground">: </span></>}
          <JsonSyntax value={val} depth={depth + 1} />
          {i < entries.length - 1 && <span className="text-muted-foreground">,</span>}
          {"\n"}
        </span>
      ))}
      {closingIndent}
    </>
  );
}

function JsonSyntaxInline({ value }: { value: JsonValue }) {
  if (value === null) return <span className="text-rose-400">null</span>;
  if (typeof value === 'boolean') return <span className="text-amber-400">{String(value)}</span>;
  if (typeof value === 'number') return <span className="text-sky-400">{value}</span>;
  if (typeof value === 'string') return <span className="text-green-400">"{value.length > 40 ? value.slice(0, 40) + "…" : value}"</span>;
  if (Array.isArray(value)) return <span className="text-muted-foreground">[{value.length} items]</span>;
  return <span className="text-muted-foreground">{"{…}"}</span>;
}

function JsonHighlight({ raw }: { raw: string }) {
  const parsed = useMemo((): JsonValue | null => {
    try { return JSON.parse(raw) as JsonValue; } catch { return null; }
  }, [raw]);

  if (parsed === null) return <span>{raw}</span>;
  return <JsonSyntax value={parsed} />;
}

interface Props {
  message: ChatMessage;
  /** Tool names that are currently executing (shown with spinner) */
  pendingToolCalls?: Set<string>;
}

function extractText(blocks: Array<Record<string, unknown>>): string {
  return blocks
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('\n');
}

function extractToolUse(blocks: Array<Record<string, unknown>>): Array<{ name: string; input: string }> {
  return blocks
    .filter((b) => b.type === 'tool_use')
    .map((b) => ({
      name: (b as { name: string }).name,
      input: typeof b.input === 'string' ? b.input : JSON.stringify(b.input ?? {}),
    }));
}

function extractToolResult(blocks: Array<Record<string, unknown>>): Array<{ name?: string; content: string; isError?: boolean }> {
  return blocks
    .filter((b) => b.type === 'tool_result')
    .map((b) => {
      const raw = b as { toolName?: string; content: string | Array<Record<string, unknown>>; is_error?: boolean };
      const content = typeof raw.content === 'string' ? raw.content : JSON.stringify(raw.content);
      return { name: raw.toolName, content, isError: raw.is_error };
    });
}

export function ChatMessage({ message, pendingToolCalls }: Props) {
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  if (message.role === 'user') {
    const text = extractText(message.content);
    return (
      <div className="w-full rounded-lg bg-primary/10 px-3 py-2 text-sm text-foreground">
        {text}
      </div>
    );
  }

  if (message.role === 'system') {
    return null;
  }

  // assistant message
  const text = extractText(message.content);
  const toolUses = extractToolUse(message.content);
  const toolResults = extractToolResult(message.content);

  const toolCalls = toolUses.map((tu) => {
    const result = toolResults.find((tr) => tr.name === tu.name);
    return { ...tu, result };
  });

  return (
    <div className="flex flex-col gap-1">
      {/* Tool calls */}
      {toolCalls.map((tc, i) => {
        const key = `tool-${i}`;
        const isExpanded = expandedTool === key;
        const isPending = pendingToolCalls?.has(tc.name) ?? false;
        return (
          <div key={key} className="rounded-md border bg-muted/50">
            <button
              className="flex w-full items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setExpandedTool(isExpanded ? null : key)}
            >
              {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              <Wrench className="size-3" />
              <span className="font-medium">{tc.name}</span>
              {isPending ? (
                <Loader2 className="size-3 animate-spin text-blue-500" />
              ) : tc.result ? (
                tc.result.isError ? (
                  <XCircle className="size-3 text-destructive" />
                ) : (
                  <CheckCircle2 className="size-3 text-green-500" />
                )
              ) : null}
            </button>
            {isExpanded && (
              <div className="border-t px-2 py-1.5 max-w-[360px]">
                <div className="mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Input:</span>
                  <div className="mt-0.5 max-h-32 overflow-y-auto rounded bg-background p-1.5">
                    <pre className="text-xs font-mono leading-relaxed">
                      <JsonHighlight raw={tc.input} />
                    </pre>
                  </div>
                </div>
                {tc.result && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Result:</span>
                    <div className="mt-0.5 max-h-48 overflow-y-auto rounded bg-background p-1.5">
                      <pre className="text-xs font-mono leading-relaxed">
                        <JsonHighlight raw={tc.result.content} />
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Text response */}
      {text && (
        <div className="w-full rounded-lg bg-muted/50 px-3 py-2">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
          </div>
        </div>
      )}
    </div>
  );
}
