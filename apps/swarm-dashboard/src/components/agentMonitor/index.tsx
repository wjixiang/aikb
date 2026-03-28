import { useState } from 'react';
import { AgentTopology } from '../topology';
import { api } from '@/lib/api';
import { useAgentDetail } from '@/hooks/useAgentDetail';
import { useAgentMemory } from '@/hooks/useAgentMemory';
import { useAgentWorkspaceContexts } from '@/hooks/useAgentWorkspaceContexts';
import { AgentDetailPanel } from './AgentDetailPanel';

export function AgentMonitor() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [memoryTab, setMemoryTab] = useState<'messages' | 'info' | 'workspace'>(
    'messages',
  );

  const {
    detail,
    loading: detailLoading,
    refetch: refetchDetail,
  } = useAgentDetail(selectedId);
  const {
    memoryData,
    memoryLoading,
    refetch: refetchMemory,
  } = useAgentMemory(selectedId);
  const {
    contexts: workspaceContexts,
    totalEntries: workspaceTotal,
    loading: workspaceLoading,
  } = useAgentWorkspaceContexts(selectedId);

  const handleSelect = (instanceId: string) => {
    setSelectedId(instanceId === selectedId ? null : instanceId);
  };

  const handleClose = () => {
    setSelectedId(null);
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
        await Promise.all([refetchDetail(), refetchMemory()]);
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

      <AgentDetailPanel
        detail={detail}
        detailLoading={detailLoading}
        memoryData={memoryData}
        memoryLoading={memoryLoading}
        actionLoading={actionLoading}
        memoryTab={memoryTab}
        onMemoryTabChange={setMemoryTab}
        onClose={handleClose}
        onSelectChild={handleSelect}
        onAction={handleAction}
        workspaceContexts={workspaceContexts}
        workspaceTotal={workspaceTotal}
        workspaceLoading={workspaceLoading}
      />
    </div>
  );
}
