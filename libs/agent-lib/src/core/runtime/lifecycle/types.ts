/**
 * Lifecycle Types - Agent lifecycle management types
 */

import { AgentStatus } from '../../common/types.js';
export { AgentStatus };

export interface AgentMetadata {
  instanceId: string;
  status: AgentStatus;
  name: string;
  agentType: string;
  description?: string;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  parentInstanceId?: string;
  createdBy?: {
    instanceId: string;
    name: string;
    createdAt: Date;
  };
}

export interface AgentFilter {
  status?: AgentStatus;
  agentType?: string;
  name?: string;
}

export type RuntimeEventType =
  | 'agent:created'
  | 'agent:started'
  | 'agent:stopped'
  | 'agent:sleeping'
  | 'agent:destroyed'
  | 'agent:aborted';

export interface RuntimeEvent {
  id: string;
  type: RuntimeEventType;
  timestamp: number;
  payload: unknown;
}
