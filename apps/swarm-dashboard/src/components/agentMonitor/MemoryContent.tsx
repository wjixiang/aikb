import { useState } from 'react';
import type { MemoryMessage } from '@/lib/api';
import { ROLE_BG, ROLE_COLORS } from './constants';
import { cn } from '@/lib/utils';
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Wrench,
} from 'lucide-react';

function extractToolResultText(block: MemoryMessage['content'][0]): string {
  const c = block.content;
  if (typeof c === 'string') return c;
  if (typeof c === 'object' && c !== null) {
    const inner =
      (c as { text?: string; content?: string }).text ??
      (c as { content?: string }).content;
    if (typeof inner === 'string') return inner;
  }
  return '';
}

function tryFormatJson(str: string): string | null {
  try {
    const parsed = JSON.parse(str);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return null;
  }
}

export function ContentBlock({ block }: { block: MemoryMessage['content'][0] }) {
  if (block.type === 'text') {
    return (
      <div className="text-left whitespace-pre-wrap break-words leading-relaxed">
        {block.text ?? ''}
      </div>
    );
  }

  if (block.type === 'thinking') {
    return (
      <div className="text-left text-[11px] italic border-l-2 border-purple-300 dark:border-purple-700 pl-2 py-0.5 text-purple-600/70 dark:text-purple-400/70">
        {block.thinking?.slice(0, 300) ?? ''}
        {(block.thinking?.length ?? 0) > 300 ? '...' : ''}
      </div>
    );
  }

  if (block.type === 'tool_use') {
    return (
      <div className="flex items-center gap-1.5 text-[11px] font-mono py-0.5">
        <Wrench className="h-3 w-3 text-orange-500 shrink-0" />
        <span className="text-orange-600 dark:text-orange-400 font-medium">
          {block.name ?? 'unknown'}
        </span>
        <span className="text-muted-foreground">()</span>
      </div>
    );
  }

  if (block.type === 'tool_result') {
    const raw = extractToolResultText(block);
    if (!raw) return null;

    const formatted = tryFormatJson(raw);

    return (
      <div>
        {block.toolName && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono mb-0.5">
            <Wrench className="h-3 w-3 text-orange-500 shrink-0" />
            <span className="text-orange-600 dark:text-orange-400 font-medium">
              {block.toolName}
            </span>
            {block.is_error && (
              <span className="text-red-500 dark:text-red-400 text-[10px]">
                failed
              </span>
            )}
          </div>
        )}
        {formatted ? (
          <pre className="text-left whitespace-pre-wrap break-words font-mono text-[11px] bg-muted/50 dark:bg-muted/30 rounded px-2 py-1.5 my-0.5 overflow-x-auto overflow-y-auto leading-relaxed max-h-60">
            {formatted}
          </pre>
        ) : (
          <div className="text-left whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground">
            {raw.length > 500 ? raw.slice(0, 500) + '...' : raw}
          </div>
        )}
      </div>
    );
  }

  return null;
}

export function MessageItem({ msg }: { msg: MemoryMessage; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const blockCount = msg.content.length;
  const isLong = blockCount > 4;
  const visibleBlocks =
    isLong && !expanded ? msg.content.slice(0, 3) : msg.content;
  const hasThinking = msg.content.some((b) => b.type === 'thinking');
  const hasToolUse = msg.content.some(
    (b) => b.type === 'tool_use' || b.type === 'tool_result',
  );
  const time = msg.ts ? new Date(msg.ts).toLocaleTimeString() : null;

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2 text-xs text-left',
        ROLE_BG[msg.role] ?? 'bg-muted/30',
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={cn(
            'font-medium uppercase text-[10px]',
            ROLE_COLORS[msg.role],
          )}
        >
          {msg.role}
        </span>
        {hasThinking && (
          <span className="text-[10px] text-purple-500 dark:text-purple-400 flex items-center gap-0.5">
            <Brain className="h-2.5 w-2.5" /> thinking
          </span>
        )}
        {hasToolUse && (
          <span className="text-[10px] text-orange-500 dark:text-orange-400 flex items-center gap-0.5">
            <Wrench className="h-2.5 w-2.5" /> tool
          </span>
        )}
        {time && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            {time}
          </span>
        )}
      </div>
      <div className="space-y-1">
        {visibleBlocks.map((block, i) => (
          <ContentBlock key={i} block={block} />
        ))}
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 cursor-pointer"
        >
          {expanded ? (
            <>
              <ChevronDown className="h-2.5 w-2.5" /> Show less
            </>
          ) : (
            <>
              <ChevronRight className="h-2.5 w-2.5" /> Show more ({blockCount}{' '}
              blocks)
            </>
          )}
        </button>
      )}
    </div>
  );
}
