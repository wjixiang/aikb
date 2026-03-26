export interface RuntimeControlRESTConfig {
  restBaseUrl?: string;
  apiKey?: string;
}

export class SwarmAPIClient {
  constructor(
    private baseUrl: string,
    private apiKey?: string,
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const data: any = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'API request failed');
    }
    return data.data;
  }

  getStats() {
    return this.request<any>('GET', '/api/runtime/stats');
  }

  listAgents(filter?: Record<string, string>) {
    const params = new URLSearchParams(filter).toString();
    return this.request<any>(
      'GET',
      `/api/runtime/agents${params ? `?${params}` : ''}`,
    );
  }

  getAgent(id: string) {
    return this.request<any>('GET', `/api/runtime/agents/${id}`);
  }

  createAgent(agent: Record<string, unknown>) {
    return this.request<any>('POST', '/api/runtime/agents', { agent });
  }

  destroyAgent(id: string, cascade?: boolean) {
    return this.request<any>(
      'DELETE',
      `/api/runtime/agents/${id}?cascade=${cascade ?? true}`,
    );
  }

  stopAgent(id: string) {
    return this.request<any>('POST', `/api/runtime/agents/${id}/stop`);
  }

  startAgent(id: string) {
    return this.request<any>('POST', `/api/runtime/agents/${id}/start`);
  }

  getTopology() {
    return this.request<any>('GET', '/api/runtime/topology');
  }

  getTopologyStats() {
    return this.request<any>('GET', '/api/runtime/topology/stats');
  }

  listAgentSouls() {
    return this.request<any>('GET', '/api/runtime/agent-souls');
  }

  createAgentBySoul(token: string, alias?: string, api?: unknown) {
    return this.request<any>('POST', '/api/runtime/agent-souls', {
      token,
      alias,
      api,
    });
  }

  registerInTopology(
    agentId: string,
    nodeType?: string,
    capabilities?: string[],
  ) {
    return this.request<any>('POST', '/api/runtime/topology/nodes', {
      agentId,
      nodeType,
      capabilities,
    });
  }

  unregisterFromTopology(agentId: string) {
    return this.request<any>(
      'DELETE',
      `/api/runtime/topology/nodes/${agentId}`,
    );
  }

  connectAgents(from: string, to: string, edgeType?: string) {
    return this.request<any>('POST', '/api/runtime/topology/edges', {
      from,
      to,
      edgeType,
    });
  }

  disconnectAgents(from: string, to: string) {
    return this.request<any>(
      'DELETE',
      `/api/runtime/topology/edges?from=${from}&to=${to}`,
    );
  }

  getNeighbors(agentId: string) {
    return this.request<any>(
      'GET',
      `/api/runtime/topology/nodes/${agentId}/neighbors`,
    );
  }
}
