/**
 * Session-related type definitions
 */

import type { AgentStatus } from '../common/types.js';
import type { MessageTokenUsage, ToolUsage } from '../types/index.js';

export interface AbortInfo {
  reason: string;
  timestamp: number;
  source: 'user' | 'system' | 'error' | 'timeout' | 'manual';
  details?: Record<string, unknown>;
}

export interface SessionState {
  instanceId: string;
  status: AgentStatus;
  tokenUsage: MessageTokenUsage;
  toolUsage: ToolUsage;
  consecutiveMistakeCount: number;
  collectedErrors: string[];
  abortInfo: AbortInfo | null;
}
