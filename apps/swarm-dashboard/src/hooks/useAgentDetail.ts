import { useState, useEffect, useCallback } from 'react';
import { api, type AgentInfo } from '@/lib/api';

export interface AgentDetail {
  instanceId: string;
  alias: string;
  status: string;
  name: string;
  type: string;
  children: AgentInfo[];
}

export function useAgentDetail(instanceId: string | null) {
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!instanceId) return;
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
  }, [instanceId]);

  useEffect(() => {
    if (!instanceId) {
      setDetail(null);
      return;
    }
    fetch();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, [instanceId, fetch]);

  const refetch = useCallback(async () => {
    await fetch();
  }, [fetch]);

  return { detail, loading, refetch };
}
