export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type RuntimeTaskStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface RuntimeTask {
  taskId: string;
  description: string;
  input?: Record<string, unknown>;
  priority: TaskPriority;
  status: RuntimeTaskStatus;
  createdAt: Date;

  sender?: string;
  receiver?: string;
  correlationId?: string;
  parentTaskId?: string;
}

export interface RuntimeTaskResult {
  taskId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  completedAt: Date;
}

export interface TaskQueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export type TaskListener = (task: RuntimeTask) => void | Promise<void>;

export interface TaskQueryFilter {
  status?: RuntimeTaskStatus;
  receiver?: string;
  sender?: string;
  limit?: number;
}
