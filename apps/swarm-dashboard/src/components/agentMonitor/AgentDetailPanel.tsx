import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AgentMemoryData, WorkspaceContextEntry } from '@/lib/api';
import {
  X,
  Play,
  Square,
  Trash2,
  GitBranch,
  Cpu,
  Info,
  Brain,
  MessageSquare,
  FileText,
  Monitor,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_BADGE } from './constants';
import { MessageItem } from './MemoryContent';
import type { AgentDetail } from '@/hooks/useAgentDetail';
import { api } from '@/lib/api';

interface AgentDetailPanelProps {
  detail: AgentDetail | null;
  detailLoading: boolean;
  memoryData: AgentMemoryData | null;
  memoryLoading: boolean;
  actionLoading: string | null;
  memoryTab: 'messages' | 'info' | 'workspace';
  onMemoryTabChange: (tab: 'messages' | 'info' | 'workspace') => void;
  onClose: () => void;
  onSelectChild: (instanceId: string) => void;
  onAction: (action: 'start' | 'stop' | 'destroy', instanceId: string) => void;
  workspaceContexts: WorkspaceContextEntry[];
  workspaceTotal: number;
  workspaceLoading: boolean;
  onRefresh: () => void;
}

export function AgentDetailPanel({
  detail,
  detailLoading,
  memoryData,
  memoryLoading,
  actionLoading,
  memoryTab,
  onMemoryTabChange,
  onClose,
  onSelectChild,
  onAction,
  workspaceContexts,
  workspaceTotal,
  workspaceLoading,
  onRefresh,
}: AgentDetailPanelProps) {
  const memoryScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = memoryScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [memoryData?.messages.length]);

  return (
    <Card className="w-96 shrink-0 border-2 flex flex-col">
      {detailLoading && detail == null ? (
        <DetailSkeleton />
      ) : detail != null ? (
        <>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 truncate">
                <Info className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {detail.alias ||
                    detail.name ||
                    detail.instanceId.slice(0, 12)}
                </span>
              </span>
              <span className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={onRefresh}
                  title="Refresh"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon-xs" onClick={onClose}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 min-h-0 flex flex-col gap-2 text-sm pb-0">
            {/* Status row */}
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

            {/* Tab bar */}
            <div className="flex border-b shrink-0">
              <button
                onClick={() => onMemoryTabChange('messages')}
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
                    ({memoryData.messages.length}/{memoryData.totalMessages})
                  </span>
                )}
              </button>
              <button
                onClick={() => onMemoryTabChange('workspace')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                  memoryTab === 'workspace'
                    ? 'border-b-2 border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Monitor className="h-3 w-3 inline mr-1" />
                Workspace
                {workspaceTotal > 0 && (
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    ({workspaceTotal})
                  </span>
                )}
              </button>
              <button
                onClick={() => onMemoryTabChange('info')}
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
                <MemoryTab
                  memoryData={memoryData}
                  memoryLoading={memoryLoading}
                  memoryScrollRef={memoryScrollRef}
                />
              ) : memoryTab === 'workspace' ? (
                <WorkspaceTab
                  contexts={workspaceContexts}
                  total={workspaceTotal}
                  loading={workspaceLoading}
                />
              ) : (
                <DetailsTab
                  detail={detail}
                  memoryData={memoryData}
                  onSelectChild={onSelectChild}
                />
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
                onClick={() => onAction('start', detail.instanceId)}
              >
                <Play className="h-3.5 w-3.5 mr-1" />
                Start
              </Button>
            )}
            {(detail.status === 'running' || detail.status === 'completed') && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={actionLoading === 'stop'}
                onClick={() => onAction('stop', detail.instanceId)}
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
              onClick={() => onAction('destroy', detail.instanceId)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Destroy
            </Button>
          </CardFooter>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2 py-12">
          <Cpu className="h-8 w-8 opacity-30" />
          <span className="text-sm">No agent selected</span>
          <span className="text-xs opacity-60">
            Click an agent to view details
          </span>
        </div>
      )}
    </Card>
  );
}

function MemoryTab({
  memoryData,
  memoryLoading,
  memoryScrollRef,
}: {
  memoryData: AgentMemoryData | null;
  memoryLoading: boolean;
  memoryScrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={memoryScrollRef}
      className="h-full overflow-y-auto space-y-2 pr-1"
    >
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
        </>
      )}
    </div>
  );
}

function WorkspaceTab({
  contexts,
  total,
  loading,
}: {
  contexts: WorkspaceContextEntry[];
  total: number;
  loading: boolean;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div className="h-full overflow-y-auto space-y-2 pr-1">
      {loading && contexts.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-xs">
          Loading workspace contexts...
        </div>
      ) : contexts.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-xs">
          No workspace contexts recorded
        </div>
      ) : (
        <>
          <div className="text-[10px] text-muted-foreground px-1">
            Showing {contexts.length} of {total} entries (newest last)
          </div>
          {contexts.map((ctx, i) => {
            const isExpanded = expandedIdx === i;
            const ts = new Date(ctx.ts).toLocaleTimeString();
            return (
              <div key={i} className="border rounded text-xs">
                <button
                  onClick={() => setExpandedIdx(isExpanded ? null : i)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                  <span className="font-mono text-[10px] text-muted-foreground">
                    #{ctx.iteration}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {ts}
                  </span>
                </button>
                {isExpanded && (
                  <div className="px-2 pb-2">
                    <pre className="bg-muted/50 rounded px-2 py-1.5 whitespace-pre-wrap break-words text-[11px] leading-relaxed max-h-64 overflow-y-auto">
                      {ctx.content}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function DetailsTab({
  detail,
  memoryData,
  onSelectChild,
}: {
  detail: AgentDetail;
  memoryData: AgentMemoryData | null;
  onSelectChild: (instanceId: string) => void;
}) {
  const [sop, setSop] = useState<string | null>(null);
  const [sopLoading, setSopLoading] = useState(false);

  const fetchSop = useCallback(async () => {
    if (!detail.instanceId) return;
    setSopLoading(true);
    try {
      const res = await api.runtime.agentPrompt(detail.instanceId);
      if (res.success) setSop(res.data.sop);
    } catch {
      setSop(null);
    } finally {
      setSopLoading(false);
    }
  }, [detail.instanceId]);

  useEffect(() => {
    setSop(null);
    fetchSop();
  }, [fetchSop]);

  return (
    <div className="h-full overflow-y-auto space-y-3 text-xs pr-1">
      {/* Instance ID */}
      <div>
        <div className="text-muted-foreground mb-0.5">Instance ID</div>
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

      {/* System Prompt */}
      <div className="border-t pt-2">
        <div className="text-muted-foreground mb-1 flex items-center gap-1">
          <FileText className="h-3 w-3" /> System Prompt
        </div>
        {sopLoading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : sop ? (
          <pre className="bg-muted/50 rounded px-2 py-1.5 whitespace-pre-wrap break-words max-h-48 overflow-y-auto text-[11px] leading-relaxed">
            {sop}
          </pre>
        ) : (
          <div className="text-muted-foreground">Not available</div>
        )}
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
              <span>{memoryData.config.maxContextMessages ?? '-'}</span>
            </div>
            <div className="flex justify-between">
              <span>Max workspace contexts</span>
              <span>{memoryData.config.maxWorkspaceContexts ?? '-'}</span>
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
              <span>{memoryData?.workspaceContextCount ?? 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Children */}
      <div className="border-t pt-2">
        <div className="text-muted-foreground mb-1 flex items-center gap-1">
          <GitBranch className="h-3 w-3" /> Children ({detail.children.length})
        </div>
        {detail.children.length === 0 ? (
          <div className="text-muted-foreground">No child agents</div>
        ) : (
          <div className="space-y-1">
            {detail.children.map((child) => (
              <button
                key={child.instanceId}
                onClick={() => onSelectChild(child.instanceId)}
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
                <span className="truncate">{child.alias || child.name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                  {child.agentType}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 truncate">
            <Info className="h-4 w-4 shrink-0 animate-pulse" />
            <span className="h-4 w-32 bg-muted rounded animate-pulse" />
          </span>
          <div className="h-6 w-6" />
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 flex flex-col gap-2 text-sm pb-0">
        {/* Status row */}
        <div className="flex items-center justify-between shrink-0">
          <span className="h-5 w-14 bg-muted rounded animate-pulse" />
          <span className="h-4 w-20 bg-muted rounded animate-pulse" />
        </div>

        {/* Tab bar */}
        <div className="flex border-b shrink-0">
          <span className="h-4 w-16 bg-muted rounded animate-pulse" />
          <span className="h-4 w-14 bg-muted rounded animate-pulse ml-3" />
        </div>

        {/* Content skeleton */}
        <div className="flex-1 space-y-3 pt-1">
          <div className="h-4 w-full bg-muted rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
          <div className="h-4 w-5/6 bg-muted rounded animate-pulse" />
          <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
          <div className="h-4 w-full bg-muted rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
        </div>
      </CardContent>

      <CardFooter className="gap-2 shrink-0">
        <span className="h-8 flex-1 bg-muted rounded animate-pulse" />
        <span className="h-8 flex-1 bg-muted rounded animate-pulse" />
      </CardFooter>
    </>
  );
}
