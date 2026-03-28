import { useEffect, useRef } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AgentMemoryData } from '@/lib/api';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_BADGE } from './constants';
import { MessageItem } from './MemoryContent';
import type { AgentDetail } from '@/hooks/useAgentDetail';

interface AgentDetailPanelProps {
  detail: AgentDetail;
  memoryData: AgentMemoryData | null;
  memoryLoading: boolean;
  actionLoading: string | null;
  memoryTab: 'messages' | 'info';
  onMemoryTabChange: (tab: 'messages' | 'info') => void;
  onClose: () => void;
  onSelectChild: (instanceId: string) => void;
  onAction: (action: 'start' | 'stop' | 'destroy', instanceId: string) => void;
}

export function AgentDetailPanel({
  detail,
  memoryData,
  memoryLoading,
  actionLoading,
  memoryTab,
  onMemoryTabChange,
  onClose,
  onSelectChild,
  onAction,
}: AgentDetailPanelProps) {
  const memoryEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    memoryEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [memoryData?.messages.length]);

  return (
    <Card className="w-96 shrink-0 border-2 flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 truncate">
            <Info className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {detail.alias || detail.name || detail.instanceId.slice(0, 12)}
            </span>
          </span>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
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
              memoryEndRef={memoryEndRef}
            />
          ) : (
            <DetailsTab detail={detail} memoryData={memoryData} onSelectChild={onSelectChild} />
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
    </Card>
  );
}

function MemoryTab({
  memoryData,
  memoryLoading,
  memoryEndRef,
}: {
  memoryData: AgentMemoryData | null;
  memoryLoading: boolean;
  memoryEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
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
