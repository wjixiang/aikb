/**
 * Lifecycle Types - Agent lifecycle management types
 */

import { AgentStatus } from '../../common/types.js';
export { AgentStatus };

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'aborted';

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

export interface RuntimeTask {
  taskId: string;
  instanceId?: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  input?: unknown;
  submittedAt: Date;
  assignedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  result?: unknown;
  error?: string;
}

export interface TaskSubmission {
  description: string;
  priority?: TaskPriority;
  targetInstanceId?: string;
  input?: unknown;
}

export interface RuntimeTaskResult {
  taskId: string;
  instanceId: string;
  results: unknown;
}

export interface RuntimeStats {
  totalAgents: number;
  agentsByStatus: Record<AgentStatus, number>;
  totalPendingTasks?: number;
  totalProcessingTasks?: number;
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
  | 'agent:aborted'
  | 'task:submitted'
  | 'task:assigned'
  | 'task:processing'
  | 'task:completed'
  | 'task:failed'
  | 'task:aborted';

export interface RuntimeEvent {
  id: string;
  type: RuntimeEventType;
  timestamp: number;
  payload: unknown;
}
