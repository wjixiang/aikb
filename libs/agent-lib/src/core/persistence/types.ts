/**
 * Agent 持久化类型定义
 */

import type { AgentConfig } from '../agent/agent.js';
import type { AgentStatus } from '../common/types.js';

/**
 * Agent Session 数据结构
 */
export interface AgentSessionData {
  taskId: string;
  status: AgentStatus;
  abortReason?: string;
  abortSource?: string;
  config?: AgentConfig;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
  toolUsage?: Record<string, { attempts: number; failures: number }>;
  consecutiveMistakeCount: number;
  collectedErrors: string[];
  completedAt?: Date;
}

/**
 * 持久化服务配置
 */
export interface PersistenceConfig {
  enabled: boolean;
  databaseUrl?: string;
  autoCommit?: boolean; // 自动提交变更
}

/**
 * 持久化服务接口
 */
export interface IPersistenceService {
  // ==================== Session 生命周期 ====================

  /**
   * 创建新的 Agent Session
   */
  createSession(data: AgentSessionData): Promise<string>;

  /**
   * 根据 taskId 获取 Session
   */
  getSession(taskId: string): Promise<AgentSessionData | null>;

  /**
   * 更新 Session 数据（支持部分更新）
   */
  updateSession(taskId: string, data: Partial<AgentSessionData>): Promise<void>;

  /**
   * 删除 Session
   */
  deleteSession(taskId: string): Promise<void>;

  /**
   * 列出所有 Sessions（分页）
   */
  listSessions(options?: {
    status?: AgentStatus;
    limit?: number;
    offset?: number;
  }): Promise<AgentSessionData[]>;

  // ==================== 统计查询 ====================

  /**
   * 获取统计数据
   */
  getStats(): Promise<{
    totalSessions: number;
    byStatus: Record<string, number>;
    totalCost: number;
  }>;

  // ==================== Memory 持久化 (Phase 2) ====================

  /**
   * 保存 Memory 快照
   */
  saveMemory?(
    sessionId: string,
    memory: {
      messages: unknown[];
      workspaceContexts: unknown[];
      config: unknown;
    },
  ): Promise<void>;

  /**
   * 加载 Memory 快照
   */
  loadMemory?(
    sessionId: string,
  ): Promise<{
    messages: unknown[];
    workspaceContexts: unknown[];
    config: unknown;
  } | null>;
}
