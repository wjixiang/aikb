/**
 * Agent 持久化类型定义
 */

import type { AgentConfig } from '../agent/agent.js';
import type { Message, WorkspaceContextEntry } from '../memory/types.js';
import { AgentStatus } from '../common/types.js';

export { AgentStatus };

/**
 * Agent Instance 元数据结构
 */
export interface InstanceMetadata {
  instanceId: string;
  status: AgentStatus;
  config?: unknown; // UnifiedAgentConfig
  name?: string; // Agent 友好名称
  agentType?: string; // Agent 类型标识
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/**
 * Agent Session 数据结构
 */
export interface AgentSessionData {
  instanceId: string;
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
  // enabled: boolean;
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
   * 根据 instanceId 获取 Session
   */
  getSession(instanceId: string): Promise<AgentSessionData | null>;

  /**
   * 更新 Session 数据（支持部分更新）
   */
  updateSession(
    instanceId: string,
    data: Partial<AgentSessionData>,
  ): Promise<void>;

  /**
   * 删除 Session
   */
  deleteSession(instanceId: string): Promise<void>;

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
  saveMemory(
    instanceId: string,
    memory: {
      messages: Message[];
      workspaceContexts: WorkspaceContextEntry[];
      config: unknown;
    },
  ): Promise<void>;

  /**
   * 加载 Memory 快照
   */
  loadMemory(instanceId: string): Promise<{
    messages: Message[];
    workspaceContexts: WorkspaceContextEntry[];
    config: unknown;
  } | null>;

  // ==================== AgentInstance 生命周期 ====================

  /**
   * 保存实例元数据（新建）
   */
  saveInstanceMetadata(
    instanceId: string,
    data: Omit<InstanceMetadata, 'instanceId' | 'createdAt' | 'updatedAt'>,
  ): Promise<void>;

  /**
   * 获取实例元数据
   */
  getInstanceMetadata(instanceId: string): Promise<InstanceMetadata | null>;

  /**
   * 更新实例元数据（支持部分更新）
   */
  updateInstanceMetadata(
    instanceId: string,
    data: Partial<
      Omit<InstanceMetadata, 'instanceId' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<void>;

  // ==================== ComponentState 持久化 (Phase 3) ====================

  /**
   * 保存组件状态（upsert）
   */
  saveComponentState(
    instanceId: string,
    componentId: string,
    stateData: unknown,
  ): Promise<void>;

  /**
   * 获取单个组件状态
   */
  getComponentState(
    instanceId: string,
    componentId: string,
  ): Promise<unknown | null>;

  /**
   * 获取所有组件状态
   */
  getAllComponentStates(instanceId: string): Promise<Record<string, unknown>>;

  /**
   * 删除组件状态
   */
  deleteComponentState(instanceId: string, componentId: string): Promise<void>;

  // ==================== Result Export 持久化 (Phase 4) ====================

  /**
   * 保存导出结果到 Session
   */
  saveExportResult(
    instanceId: string,
    exportResult: Record<string, unknown>,
  ): Promise<void>;
}
