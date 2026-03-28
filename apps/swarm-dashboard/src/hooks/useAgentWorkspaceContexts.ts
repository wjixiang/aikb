import { useState, useEffect, useCallback } from 'react';
import { api, type WorkspaceContextEntry } from '@/lib/api';

export function useAgentWorkspaceContexts(instanceId: string | null) {
  const [contexts, setContexts] = useState<WorkspaceContextEntry[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!instanceId) return;
    setLoading(true);
    try {
      const res = await api.runtime.agentWorkspaceContexts(instanceId);
      if (res.success) {
        setContexts(res.data.contexts);
        setTotalEntries(res.data.totalEntries);
      }
    } catch {
      setContexts([]);
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    if (!instanceId) {
      setContexts([]);
      setTotalEntries(0);
      return;
    }
    fetch();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, [instanceId, fetch]);

  const refetch = useCallback(async () => {
    await fetch();
  }, [fetch]);

  return { contexts, totalEntries, loading, refetch };
}
