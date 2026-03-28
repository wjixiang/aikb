import { useState, useEffect, useCallback } from 'react';
import { api, type AgentMemoryData } from '@/lib/api';

export function useAgentMemory(instanceId: string | null) {
  const [memoryData, setMemoryData] = useState<AgentMemoryData | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!instanceId) return;
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
  }, [instanceId]);

  useEffect(() => {
    if (!instanceId) {
      setMemoryData(null);
      return;
    }
    fetch();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, [instanceId, fetch]);

  const refetch = useCallback(async () => {
    await fetch();
  }, [fetch]);

  return { memoryData, memoryLoading, refetch };
}
