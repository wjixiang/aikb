import { useState } from 'react';
import type { ChatMessage } from '@/lib/api/chat";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronDown, Wrench, CheckCircle2, XCircle } from "lucide-react";

interface Props {
  message: ChatMessage;
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

export function ChatMessage({ message }: Props) {
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  if (message.role === 'user') {
    const text = extractText(message.content);
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-xl rounded-br-sm bg-primary text-primary-foreground px-3 py-2 text-sm">
          {text}
        </div>
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
        return (
          <div key={key} className="rounded-md border bg-muted/50">
            <button
              className="flex w-full items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setExpandedTool(isExpanded ? null : key)}
            >
              {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              <Wrench className="size-3" />
              <span className="font-medium">{tc.name}</span>
              {tc.result && (
                tc.result.isError ? (
                  <XCircle className="size-3 text-destructive" />
                ) : (
                  <CheckCircle2 className="size-3 text-green-500" />
                )
              )}
            </button>
            {isExpanded && (
              <div className="border-t px-2 py-1.5">
                <div className="mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Input:</span>
                  <pre className="mt-0.5 overflow-auto max-h-32 rounded bg-background p-1.5 text-xs font-mono">
                    {tc.input}
                  </pre>
                </div>
                {tc.result && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Result:</span>
                    <pre className="mt-0.5 overflow-auto max-h-48 rounded bg-background p-1.5 text-xs font-mono">
                      {tc.result.content}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Text response */}
      {text && (
        <div className="max-w-[85%] rounded-xl rounded-bl-sm bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  );
}
