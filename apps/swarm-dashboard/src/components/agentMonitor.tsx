import { useState, useEffect, useCallback, useRef } from 'react';
import { AgentTopology } from './topology';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  api,
  type AgentInfo,
  type AgentMemoryData,
  type MemoryMessage,
} from '@/lib/api';
import {
  X,
  Play,
  Square,
  Trash2,
  GitBranch,
  Cpu,
  Info,
  Brain,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentDetail {
  instanceId: string;
  alias: string;
  status: string;
  name: string;
  type: string;
  children: AgentInfo[];
}

const STATUS_BADGE: Record<string, string> = {
  idle: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  running: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  aborted: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  stopped: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const ROLE_COLORS: Record<string, string> = {
  user: 'text-blue-600 dark:text-blue-400',
  assistant: 'text-green-600 dark:text-green-400',
  system: 'text-muted-foreground',
};

const ROLE_BG: Record<string, string> = {
  user: 'bg-blue-50 dark:bg-blue-950/30',
  assistant: 'bg-green-50 dark:bg-green-950/30',
  system: 'bg-muted/50',
};

function extractText(block: MemoryMessage['content'][0]): string {
  if (block.type === 'text') return block.text ?? '';
  if (block.type === 'thinking')
    return `[thinking] ${block.thinking?.slice(0, 100) ?? ''}...`;
  if (block.type === 'tool_use')
    return `[tool_call] ${block.name ?? 'unknown'}()`;
  if (block.type === 'tool_result') {
    const c = block.content;
    if (typeof c === 'string')
      return c.length > 200 ? c.slice(0, 200) + '...' : c;
    if (typeof c === 'object' && c !== null) {
      const inner =
        (c as { text?: string; content?: string }).text ??
        (c as { content?: string }).content;
      if (typeof inner === 'string')
        return inner.length > 200 ? inner.slice(0, 200) + '...' : inner;
    }
    return '[tool result]';
  }
  return `[${block.type}]`;
}

function MessageItem({ msg, index }: { msg: MemoryMessage; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const fullText = msg.content.map(extractText).join('\n');
  const preview = fullText.slice(0, 150);
  const isLong = fullText.length > 150;
  const hasThinking = msg.content.some((b) => b.type === 'thinking');
  const hasToolUse = msg.content.some(
    (b) => b.type === 'tool_use' || b.type === 'tool_result',
  );
  const time = msg.ts ? new Date(msg.ts).toLocaleTimeString() : null;

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2 text-xs',
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
      <pre className="whitespace-pre-wrap break-words font-sans leading-relaxed">
        {isLong && !expanded ? preview + '...' : fullText}
      </pre>
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
              <ChevronRight className="h-2.5 w-2.5" /> Show more
            </>
          )}
        </button>
      )}
    </div>
  );
}

export function AgentMonitor() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [memoryData, setMemoryData] = useState<AgentMemoryData | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryTab, setMemoryTab] = useState<'messages' | 'info'>('messages');
  const memoryEndRef = useRef<HTMLDivElement>(null);

  const fetchDetail = useCallback(async (instanceId: string) => {
    setLoading(true);
    try {
      const [agentRes, childrenRes] = await Promise.all([
        api.runtime.agent(instanceId).catch(() => null),
        api.runtime
          .agentChildren(instanceId)
          .catch(() => ({ success: false, data: [], count: 0 })),
      ]);

      if (agentRes?.success) {
        const d = agentRes.data;
        setDetail({
          instanceId: d.instanceId,
          alias: d.alias,
          status: d.status,
          name: d.name,
          type: d.type,
          children: childrenRes.success ? childrenRes.data : [],
        });
      }
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMemory = useCallback(async (instanceId: string) => {
    setMemoryLoading(true);
    try {
      const res = await api.runtime.agentMemory(instanceId);
      if (res.success) {
        setMemoryData(res.data);
      }
    } catch {
      setMemoryData(null);
    } finally {
      setMemoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setMemoryData(null);
      return;
    }
    fetchDetail(selectedId);
    fetchMemory(selectedId);
    const detailInterval = setInterval(() => fetchDetail(selectedId), 10000);
    const memoryInterval = setInterval(() => fetchMemory(selectedId), 10000);
    return () => {
      clearInterval(detailInterval);
      clearInterval(memoryInterval);
    };
  }, [selectedId, fetchDetail, fetchMemory]);

  useEffect(() => {
    memoryEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [memoryData?.messages.length]);

  const handleSelect = (instanceId: string) => {
    setSelectedId(instanceId === selectedId ? null : instanceId);
  };

  const handleClose = () => {
    setSelectedId(null);
    setDetail(null);
    setMemoryData(null);
  };

  const handleAction = async (
    action: 'start' | 'stop' | 'destroy',
    instanceId: string,
  ) => {
    setActionLoading(action);
    try {
      if (action === 'start') await api.runtime.startAgent(instanceId);
      else if (action === 'stop') await api.runtime.stopAgent(instanceId);
      else await api.runtime.destroyAgent(instanceId);

      if (action === 'destroy') {
        handleClose();
      } else {
        await Promise.all([fetchDetail(instanceId), fetchMemory(instanceId)]);
      }
    } catch {
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="h-full w-full flex gap-2">
      <div className="flex-1 min-w-0">
        <AgentTopology onSelectAgent={handleSelect} />
      </div>
      {selectedId && (
        <Card className="w-96 shrink-0 border-2 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 truncate">
                <Info className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {detail?.alias || detail?.name || selectedId.slice(0, 12)}
                </span>
              </span>
              <Button variant="ghost" size="icon-xs" onClick={handleClose}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </CardTitle>
          </CardHeader>

          {loading && !detail ? (
            <CardContent>
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                Loading...
              </div>
            </CardContent>
          ) : detail ? (
            <>
              <CardContent className="flex-1 min-h-0 flex flex-col gap-2 text-sm pb-0">
                {/* Info row */}
                <div className="flex items-center justify-between shrink-0">
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_BADGE[detail.status] ?? STATUS_BADGE.stopped}`}
                  >
                    {detail.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {detail.type || '-'}
                  </span>
                </div>

                {/* Memory tab bar */}
                <div className="flex border-b shrink-0">
                  <button
                    onClick={() => setMemoryTab('messages')}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                      memoryTab === 'messages'
                        ? 'border-b-2 border-primary text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <MessageSquare className="h-3 w-3 inline mr-1" />
                    Memory
                    {memoryData && (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        ({memoryData.messages.length}/{memoryData.totalMessages}
                        )
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setMemoryTab('info')}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                      memoryTab === 'info'
                        ? 'border-b-2 border-primary text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Details
                  </button>
                </div>

                {/* Tab content */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  {memoryTab === 'messages' ? (
                    <div className="h-full overflow-y-auto space-y-2 pr-1">
                      {memoryLoading && !memoryData ? (
                        <div className="flex items-center justify-center h-32 text-muted-foreground text-xs">
                          Loading memory...
                        </div>
                      ) : !memoryData ? (
                        <div className="flex items-center justify-center h-32 text-muted-foreground text-xs">
                          No memory data
                        </div>
                      ) : memoryData.messages.length === 0 ? (
                        <div className="flex items-center justify-center h-32 text-muted-foreground text-xs">
                          Empty conversation
                        </div>
                      ) : (
                        <>
                          {memoryData.messages.map((msg, i) => (
                            <MessageItem key={i} msg={msg} index={i} />
                          ))}
                          <div ref={memoryEndRef} />
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="h-full overflow-y-auto space-y-3 text-xs pr-1">
                      {/* Instance ID */}
                      <div>
                        <div className="text-muted-foreground mb-0.5">
                          Instance ID
                        </div>
                        <div className="font-mono bg-muted/50 rounded px-2 py-1 break-all">
                          {detail.instanceId}
                        </div>
                      </div>

                      {/* Name */}
                      {detail.name && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Name</span>
                          <span className="truncate ml-2">{detail.name}</span>
                        </div>
                      )}

                      {/* Agent Type */}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Cpu className="h-3 w-3" /> Type
                        </span>
                        <span>{detail.type || '-'}</span>
                      </div>

                      {/* Memory Config */}
                      {memoryData?.config && (
                        <div className="border-t pt-2">
                          <div className="text-muted-foreground mb-1 flex items-center gap-1">
                            <Brain className="h-3 w-3" /> Memory Config
                          </div>
                          <div className="space-y-1 text-muted-foreground">
                            <div className="flex justify-between">
                              <span>Max context messages</span>
                              <span>
                                {memoryData.config.maxContextMessages ?? '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Max workspace contexts</span>
                              <span>
                                {memoryData.config.maxWorkspaceContexts ?? '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Workspace context</span>
                              <span>
                                {memoryData.config.enableWorkspaceContext
                                  ? 'enabled'
                                  : 'disabled'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Workspace context entries</span>
                              <span>
                                {memoryData?.workspaceContextCount ?? 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Children */}
                      <div className="border-t pt-2">
                        <div className="text-muted-foreground mb-1 flex items-center gap-1">
                          <GitBranch className="h-3 w-3" /> Children (
                          {detail.children.length})
                        </div>
                        {detail.children.length === 0 ? (
                          <div className="text-muted-foreground">
                            No child agents
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {detail.children.map((child) => (
                              <button
                                key={child.instanceId}
                                onClick={() => handleSelect(child.instanceId)}
                                className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/80 transition-colors cursor-pointer"
                              >
                                <span
                                  className={cn(
                                    'inline-block w-2 h-2 rounded-full shrink-0',
                                    child.status === 'running'
                                      ? 'bg-green-500'
                                      : child.status === 'idle'
                                        ? 'bg-yellow-500'
                                        : 'bg-red-500',
                                  )}
                                />
                                <span className="truncate">
                                  {child.alias || child.name}
                                </span>
                                <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                                  {child.agentType}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>

              <CardFooter className="gap-2 shrink-0">
                {detail.status === 'idle' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={actionLoading === 'start'}
                    onClick={() => handleAction('start', detail.instanceId)}
                  >
                    <Play className="h-3.5 w-3.5 mr-1" />
                    Start
                  </Button>
                )}
                {(detail.status === 'running' ||
                  detail.status === 'completed') && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={actionLoading === 'stop'}
                    onClick={() => handleAction('stop', detail.instanceId)}
                  >
                    <Square className="h-3.5 w-3.5 mr-1" />
                    Stop
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  disabled={actionLoading === 'destroy'}
                  onClick={() => handleAction('destroy', detail.instanceId)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Destroy
                </Button>
              </CardFooter>
            </>
          ) : (
            <CardContent>
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                Agent not found
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
