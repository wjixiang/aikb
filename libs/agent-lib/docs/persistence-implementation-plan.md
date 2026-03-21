# Agent 持久化模块实施计划

## 概述

本文档详细说明了为 agent-lib 添加完整持久化功能的实施计划。持久化模块将支持以下功能：

1. **Agent 实例元数据持久化** - 保存 Agent 的状态、配置和统计信息
2. **Memory 持久化** - 保存对话历史和 workspace 上下文
3. **Component 状态持久化** - 保存各 ToolComponent 的状态

### 设计目标

- ✅ 支持会话恢复（Agent 暂停后可继续执行）
- ✅ 支持跨实例共享状态（分布式部署）
- ✅ 支持审计和回放（完整的执行历史）
- ✅ 使用 PostgreSQL 作为存储后端
- ✅ 集中式状态管理（通过统一的 `state` 属性）

### 废弃说明

**Expert 系统已废弃**，所有相关代码将被移除：

- `ExpertInstance` 数据模型
- `AgentExpertIdentity` 接口
- `IExpertExecutor` 接口
- `taskModule` 相关代码

Agent 实例将使用创建时分配的 `taskId` (UUID) 作为唯一标识。

---

## Phase 1: Agent 实例元数据持久化

### 1.1 Prisma Schema 更新

**文件**: `libs/agent-lib/prisma/schema.prisma`

#### 修改内容

```prisma
// 移除 ExpertInstance 模型
// model ExpertInstance { ... }

// 新增 AgentSession 模型
model AgentSession {
  id              String   @id @default(uuid())
  taskId          String   @unique  // Agent 创建时分配的 UUID

  // 状态信息
  status          String   @default("idle")  // idle/running/completed/aborted
  abortReason     String?
  abortSource     String?  // user/system/error/timeout/manual

  // 配置 (JSON)
  config          Json?    // AgentConfig 序列化

  // 统计信息
  totalTokensIn   Int      @default(0)
  totalTokensOut  Int      @default(0)
  totalCost       Float    @default(0)

  // 工具使用统计
  toolUsage       Json?    // Record<string, { attempts: number; failures: number }>

  // 错误追踪
  consecutiveMistakeCount Int @default(0)
  collectedErrors Json?    // string[]

  // 时间戳
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  completedAt     DateTime?

  @@index([status])
  @@index([createdAt])
}
```

#### 执行命令

```bash
cd libs/agent-lib
pnpm prisma:generate
pnpm db:push
```

### 1.2 持久化服务接口定义

**新建文件**: `libs/agent-lib/src/core/persistence/types.ts`

```typescript
/**
 * Agent 持久化类型定义
 */

import type { AgentConfig } from '../agent/agent.js';
import type { AgentStatus } from '../common/types.js';
import type { AbortSource } from '../agent/agent.js';

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
}
```

### 1.3 PostgreSQL 持久化服务实现

**新建文件**: `libs/agent-lib/src/core/persistence/PostgresPersistenceService.ts`

```typescript
/**
 * PostgreSQL 持久化服务实现
 */

import { injectable, inject } from 'inversify';
import type { PrismaClient } from '@prisma/client';
import type {
  IPersistenceService,
  AgentSessionData,
  PersistenceConfig,
} from './types.js';
import { TYPES } from '../di/types.js';
import pino from 'pino';

@injectable()
export class PostgresPersistenceService implements IPersistenceService {
  private config: PersistenceConfig;
  private logger: pino.Logger;

  constructor(
    @inject(TYPES.PrismaClient) private prisma: PrismaClient,
    @inject(TYPES.PersistenceConfig) config?: PersistenceConfig,
  ) {
    this.config = { enabled: true, autoCommit: true, ...config };
    this.logger = pino({ level: process.env['LOG_LEVEL'] || 'debug' });
    this.logger.info('[PersistenceService] Initialized', {
      config: this.config,
    });
  }

  async createSession(data: AgentSessionData): Promise<string> {
    const session = await this.prisma.agentSession.create({
      data: {
        taskId: data.taskId,
        status: data.status,
        abortReason: data.abortReason,
        abortSource: data.abortSource,
        config: data.config as any,
        totalTokensIn: data.totalTokensIn,
        totalTokensOut: data.totalTokensOut,
        totalCost: data.totalCost,
        toolUsage: data.toolUsage as any,
        consecutiveMistakeCount: data.consecutiveMistakeCount,
        collectedErrors: data.collectedErrors,
        completedAt: data.completedAt,
      },
    });

    this.logger.info('[PersistenceService] Session created', {
      taskId: data.taskId,
    });
    return session.id;
  }

  async getSession(taskId: string): Promise<AgentSessionData | null> {
    const session = await this.prisma.agentSession.findUnique({
      where: { taskId },
    });

    if (!session) {
      return null;
    }

    return {
      taskId: session.taskId,
      status: session.status as any,
      abortReason: session.abortReason ?? undefined,
      abortSource: session.abortSource ?? undefined,
      config: session.config as any,
      totalTokensIn: session.totalTokensIn,
      totalTokensOut: session.totalTokensOut,
      totalCost: session.totalCost,
      toolUsage: session.toolUsage as any,
      consecutiveMistakeCount: session.consecutiveMistakeCount,
      collectedErrors: session.collectedErrors as any,
      completedAt: session.completedAt ?? undefined,
    };
  }

  async updateSession(
    taskId: string,
    data: Partial<AgentSessionData>,
  ): Promise<void> {
    const updateData: any = {};

    if (data.status !== undefined) updateData.status = data.status;
    if (data.abortReason !== undefined)
      updateData.abortReason = data.abortReason;
    if (data.abortSource !== undefined)
      updateData.abortSource = data.abortSource;
    if (data.config !== undefined) updateData.config = data.config;
    if (data.totalTokensIn !== undefined)
      updateData.totalTokensIn = data.totalTokensIn;
    if (data.totalTokensOut !== undefined)
      updateData.totalTokensOut = data.totalTokensOut;
    if (data.totalCost !== undefined) updateData.totalCost = data.totalCost;
    if (data.toolUsage !== undefined) updateData.toolUsage = data.toolUsage;
    if (data.consecutiveMistakeCount !== undefined)
      updateData.consecutiveMistakeCount = data.consecutiveMistakeCount;
    if (data.collectedErrors !== undefined)
      updateData.collectedErrors = data.collectedErrors;

    // 自动设置 completedAt
    if (data.status === 'completed' || data.status === 'aborted') {
      updateData.completedAt = new Date();
    }

    await this.prisma.agentSession.update({
      where: { taskId },
      data: updateData,
    });

    this.logger.debug('[PersistenceService] Session updated', {
      taskId,
      data: Object.keys(updateData),
    });
  }

  async deleteSession(taskId: string): Promise<void> {
    await this.prisma.agentSession.delete({
      where: { taskId },
    });

    this.logger.info('[PersistenceService] Session deleted', { taskId });
  }

  async listSessions(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<AgentSessionData[]> {
    const sessions = await this.prisma.agentSession.findMany({
      where: options?.status ? { status: options.status } : undefined,
      take: options?.limit ?? 100,
      skip: options?.offset ?? 0,
      orderBy: { createdAt: 'desc' as const },
    });

    return sessions.map((s) => ({
      taskId: s.taskId,
      status: s.status as any,
      abortReason: s.abortReason ?? undefined,
      abortSource: s.abortSource ?? undefined,
      config: s.config as any,
      totalTokensIn: s.totalTokensIn,
      totalTokensOut: s.totalTokensOut,
      totalCost: s.totalCost,
      toolUsage: s.toolUsage as any,
      consecutiveMistakeCount: s.consecutiveMistakeCount,
      collectedErrors: s.collectedErrors as any,
      completedAt: s.completedAt ?? undefined,
    }));
  }

  async getStats(): Promise<{
    totalSessions: number;
    byStatus: Record<string, number>;
    totalCost: number;
  }> {
    const [total, statusGroups, costResult] = await Promise.all([
      this.prisma.agentSession.count(),
      this.prisma.agentSession.groupBy({
        by: ['status'],
      }),
      this.prisma.agentSession.aggregate({
        _sum: { totalCost: true },
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const group of statusGroups) {
      byStatus[group.status] = group._count.id;
    }

    return {
      totalSessions: total,
      byStatus,
      totalCost: costResult._sum.totalCost ?? 0,
    };
  }
}
```

**新建文件**: `libs/agent-lib/src/core/persistence/index.ts`

```typescript
export * from './types.js';
export * from './PostgresPersistenceService.js';
```

### 1.4 Agent 类集成持久化

**修改文件**: `libs/agent-lib/src/core/agent/agent.ts`

#### 1.4.1 移除 Expert 相关代码

```typescript
// 删除以下代码：
// - private _expertIdentity?: AgentExpertIdentity;
// - interface AgentExpertIdentity { ... }
// - setExpertIdentity()
// - get expertId()
// - get instanceId()
// - private taskModule?: RuntimeTaskComponent;
// - getTaskModule()
// - private initializeTaskModule()
// - onNewTask callback
```

#### 1.4.2 添加持久化依赖注入

```typescript
export class Agent {
  // ... 现有属性

  // 持久化服务
  private persistenceService?: IPersistenceService;

  constructor(
    @inject(TYPES.AgentConfig)
    @optional()
    public config: AgentConfig = defaultAgentConfig,
    @inject(TYPES.IVirtualWorkspace) workspace: IVirtualWorkspace,
    @inject(TYPES.AgentPrompt) agentSop: SOP,
    @inject(TYPES.IMemoryModule) memoryModule: IMemoryModule,
    @inject(TYPES.ApiClient) apiClient: ApiClient,
    @inject(TYPES.IToolManager) toolManager: IToolManager,
    @inject(TYPES.TaskId) @optional() taskId?: string,
    @inject(TYPES.IPersistenceService) @optional() persistenceService?: IPersistenceService,
  ) {
    // ... 现有初始化

    this.persistenceService = persistenceService;

    // 创建时持久化 Session
    if (this.persistenceService) {
      void this.persistenceService.createSession({
        taskId: this._taskId,
        status: 'idle',
        totalTokensIn: 0,
        totalTokensOut: 0,
        totalCost: 0,
        consecutiveMistakeCount: 0,
        collectedErrors: [],
      });
    }
  }
```

#### 1.4.3 状态变更时自动持久化

```typescript
export class Agent {
  // ... 其他代码

  // ==================== Lifecycle Methods (修改) ====================

  async start(): Promise<Agent> {
    this._status = 'running';
    await this.persistState(); // 持久化状态变更

    await this.requestLoop();
    return this;
  }

  complete(): void {
    this._status = 'completed';
    void this.persistState(); // 持久化状态变更
  }

  abort(
    abortReason: string,
    source: AbortSource = 'manual',
    details?: Record<string, unknown>,
  ): void {
    this._status = 'aborted';
    this._abortInfo = {
      reason: abortReason,
      timestamp: Date.now(),
      source,
      details,
    };
    void this.persistState(); // 持久化状态变更
  }

  // ==================== 持久化钩子 ====================

  /**
   * 持久化 Agent 当前状态
   */
  private async persistState(): Promise<void> {
    if (!this.persistenceService) {
      return;
    }

    try {
      await this.persistenceService.updateSession(this._taskId, {
        status: this._status,
        abortReason: this._abortInfo?.reason,
        abortSource: this._abortInfo?.source as string,
        totalTokensIn: this._tokenUsage.totalTokensIn,
        totalTokensOut: this._tokenUsage.totalTokensOut,
        totalCost: this._tokenUsage.totalCost,
        toolUsage: this._toolUsage,
        consecutiveMistakeCount: this._consecutiveMistakeCount,
        collectedErrors: this._collectedErrors,
      });
    } catch (error) {
      this.logger.error('[Agent] Failed to persist state', {
        error,
        taskId: this._taskId,
      });
    }
  }

  /**
   * 持久化工具调用结果
   */
  private async persistToolUsage(
    toolName: string,
    success: boolean,
  ): Promise<void> {
    if (!this.persistenceService) {
      return;
    }

    if (!this._toolUsage[toolName]) {
      this._toolUsage[toolName] = { attempts: 0, failures: 0 };
    }

    try {
      await this.persistenceService.updateSession(this._taskId, {
        toolUsage: this._toolUsage,
      });
    } catch (error) {
      this.logger.error('[Agent] Failed to persist tool usage', {
        error,
        toolName,
      });
    }
  }
}
```

#### 1.4.4 在工具调用后触发持久化

```typescript
// 在 executeToolCalls 方法中，工具执行成功/失败后调用
private async executeToolCalls(
  toolCalls: ToolCall[],
): Promise<ToolExecutionResult[]> {
  const results: ToolExecutionResult[] = [];

  for (const toolCall of toolCalls) {
    try {
      // ... 工具执行逻辑

      // 成功后持久化工具使用
      this._toolUsage[toolCall.name].attempts++;
      void this.persistToolUsage(toolCall.name, true);

      // ...
    } catch (error) {
      // ...

      // 失败后持久化工具使用
      this._toolUsage[toolCall.name].failures++;
      void this.persistToolUsage(toolCall.name, false);

      // ...
    }
  }

  return results;
}
```

### 1.5 DI 容器集成

**修改文件**: `libs/agent-lib/src/core/di/types.ts`

```typescript
export const TYPES = {
  // ... 现有类型

  // ==================== 持久化服务 ====================

  /**
   * IPersistenceService - Agent 持久化服务
   * @scope Request - Shared within an agent creation request
   */
  IPersistenceService: Symbol('IPersistenceService'),

  /**
   * PrismaClient - Prisma ORM 客户端
   * @scope Singleton - Shared across all agents
   */
  PrismaClient: Symbol('PrismaClient'),

  /**
   * PersistenceConfig - 持久化服务配置
   * @scope Singleton - Shared across all agents
   */
  PersistenceConfig: Symbol('PersistenceConfig'),
};
```

**修改文件**: `libs/agent-lib/src/core/di/container.ts`

```typescript
import { PostgresPersistenceService } from '../persistence/PostgresPersistenceService.js';
import type { IPersistenceService } from '../persistence/types.js';

export class AgentContainer {
  private setupPersistence(options: AgentFactoryOptions): void {
    // 检查是否启用持久化
    if (options.persistence?.enabled === false) {
      this.logger.info('[AgentContainer] Persistence disabled');
      return;
    }

    try {
      // 创建 Prisma Client
      const databaseUrl =
        options.persistence?.databaseUrl || process.env['DATABASE_URL'];

      if (!databaseUrl) {
        this.logger.warn(
          '[AgentContainer] DATABASE_URL not set, persistence disabled',
        );
        return;
      }

      const prisma = new PrismaClient({
        datasources: { db: { url: databaseUrl } },
      });

      this.container.bind(TYPES.PrismaClient).toConstantValue(prisma);

      // 绑定配置
      this.container.bind(TYPES.PersistenceConfig).toConstantValue({
        enabled: options.persistence?.enabled ?? true,
        databaseUrl,
        autoCommit: options.persistence?.autoCommit ?? true,
      });

      // 绑定持久化服务
      this.container
        .bind(TYPES.IPersistenceService)
        .to(PostgresPersistenceService)
        .inRequestScope();

      this.logger.info('[AgentContainer] Persistence service initialized');
    } catch (error) {
      this.logger.error('[AgentContainer] Failed to initialize persistence', {
        error,
      });
    }
  }
}
```

**修改文件**: `libs/agent-lib/src/core/di/UnifiedAgentConfig.ts`

```typescript
export interface AgentFactoryOptions {
  // ... 现有选项

  // ==================== 持久化配置 ====================

  persistence?: {
    enabled?: boolean;
    databaseUrl?: string;
    autoCommit?: boolean;
  };
}
```

### 1.6 清理 Expert 相关代码

#### 删除文件

- `libs/agent-lib/src/core/expert/` (整个目录，如果存在)

#### 修改导入

```typescript
// agent.ts 中移除以下导入：
// import { RuntimeTaskComponent, createRuntimeTaskComponent } from '../../components/index.js';
```

#### 清理 Prisma 生成文件

```bash
cd libs/agent-lib
pnpm prisma:generate
```

这将自动移除 `ExpertInstance` 相关类型。

---

## Phase 2: Memory 持久化

### 2.1 扩展 Prisma Schema

**修改文件**: `libs/agent-lib/prisma/schema.prisma`

```prisma
model AgentMemory {
  id              String   @id @default(uuid())
  sessionId       String   @unique
  session         AgentSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  messages        Json     // ApiMessage[]
  workspaceContexts Json?  // WorkspaceContextEntry[]
  config          Json?    // MemoryModuleConfig

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// AgentSession 添加关联
model AgentSession {
  // ... 现有字段

  memory         AgentMemory?   // 新增
}
```

### 2.2 MemoryModule 集成持久化

**修改文件**: `libs/agent-lib/src/core/memory/MemoryModule.ts`

```typescript
@injectable()
export class MemoryModule implements IMemoryModule {
  // ... 现有属性

  // 持久化服务
  private persistenceService?: IPersistenceService;
  private taskId?: string;

  constructor(
    @inject(TYPES.Logger) private logger: Logger,
    @inject(TYPES.MemoryModuleConfig)
    @optional()
    config: Partial<MemoryModuleConfig> = {},
    @inject(TYPES.ApiClient) @optional() apiClient: ApiClient | null = null,
    @inject(TYPES.IPersistenceService)
    @optional()
    persistenceService?: IPersistenceService,
    @inject(TYPES.TaskId) @optional() taskId?: string,
  ) {
    // ... 现有初始化
    this.persistenceService = persistenceService;
    this.taskId = taskId;
  }

  // ==================== 持久化方法 ====================

  /**
   * 保存 Memory 快照
   */
  async saveSnapshot(): Promise<void> {
    if (!this.persistenceService || !this.taskId) {
      return;
    }

    const snapshot = {
      messages: this.messages,
      workspaceContexts: this.workspaceContexts,
      config: this.config,
    };

    await this.persistenceService.saveMemory(this.taskId, snapshot);
    this.logger.debug('[MemoryModule] Snapshot saved', { taskId: this.taskId });
  }

  /**
   * 加载 Memory 快照
   */
  async loadSnapshot(): Promise<boolean> {
    if (!this.persistenceService || !this.taskId) {
      return false;
    }

    const snapshot = await this.persistenceService.loadMemory(this.taskId);
    if (!snapshot) {
      return false;
    }

    this.messages = snapshot.messages;
    this.workspaceContexts = snapshot.workspaceContexts;
    this.config = snapshot.config;
    this._cachedTokenCount = null;

    this.logger.debug('[MemoryModule] Snapshot loaded', {
      taskId: this.taskId,
    });
    return true;
  }
}
```

### 2.3 IPersistenceService 扩展

**修改文件**: `libs/agent-lib/src/core/persistence/types.ts`

```typescript
export interface IPersistenceService {
  // ... 现有方法

  // ==================== Memory 持久化 ====================

  saveMemory(
    sessionId: string,
    memory: {
      messages: any[];
      workspaceContexts: any[];
      config: any;
    },
  ): Promise<void>;

  loadMemory(sessionId: string): Promise<{
    messages: any[];
    workspaceContexts: any[];
    config: any;
  } | null>;
}
```

---

## Phase 3: Component 状态持久化

### 3.1 ToolComponent 状态重构

**修改文件**: `libs/agent-lib/src/components/core/toolComponent.ts`

```typescript
/**
 * 组件状态基类
 */
export interface ComponentStateBase {
  version: number;
  updatedAt: number;
}

@injectable()
export abstract class ToolComponent {
  // ... 现有属性

  // 新增：集中式状态管理
  protected _state: ComponentStateBase = {
    version: 1,
    updatedAt: Date.now(),
  };

  /**
   * 获取状态（只读）
   */
  get state(): ComponentStateBase {
    return { ...this._state };
  }

  /**
   * 更新状态
   */
  protected updateState(partial: Partial<ComponentStateBase>): void {
    this._state = {
      ...this._state,
      ...partial,
      updatedAt: Date.now(),
    };
    this.onStateChange?.(this._state);
  }

  /**
   * 状态变更回调
   */
  onStateChange?: (newState: ComponentStateBase) => void;

  /**
   * 从持久化恢复状态（子类重写）
   */
  restoreState(state: ComponentStateBase): void {
    this._state = { ...state };
  }

  /**
   * 导出完整状态（子类实现具体逻辑）
   */
  abstract exportState(): ComponentStateBase;
}
```

### 3.2 ComponentState 持久化

**修改文件**: `libs/agent-lib/prisma/schema.prisma`

```prisma
model ComponentState {
  id              String   @id @default(uuid())
  sessionId       String
  session         AgentSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  componentId     String
  stateData       Json     // 组件特定状态

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([sessionId, componentId])
}

// AgentSession 添加关联
model AgentSession {
  // ... 现有字段

  componentStates ComponentState[]   // 新增
}
```

### 3.3 VirtualWorkspace 状态导出/导入

**修改文件**: `libs/agent-lib/src/core/statefulContext/virtualWorkspace.ts`

```typescript
@injectable()
export class VirtualWorkspace implements IVirtualWorkspace {
  // ... 现有属性

  /**
   * 导出所有组件状态
   */
  exportComponentStates(): Map<string, ComponentStateBase> {
    const states = new Map<string, ComponentStateBase>();

    const registrations = this.componentRegistry.getAllRegistrations();
    for (const registration of registrations) {
      if (registration.component.exportState) {
        states.set(registration.id, registration.component.exportState());
      }
    }

    return states;
  }

  /**
   * 导入组件状态
   */
  importComponentStates(states: Map<string, ComponentStateBase>): void {
    for (const [componentId, state] of states) {
      const component = this.componentRegistry.get(componentId);
      if (component && component.restoreState) {
        component.restoreState(state);
      }
    }
  }
}
```

---

## 测试计划

### 单元测试

**文件**: `libs/agent-lib/src/core/persistence/__tests__/PostgresPersistenceService.test.ts`

```typescript
describe('PostgresPersistenceService', () => {
  let service: PostgresPersistenceService;
  let prisma: PrismaClient;

  beforeEach(async () => {
    prisma = new PrismaClient();
    service = new PostgresPersistenceService(prisma);
  });

  afterEach(async () => {
    await prisma.agentSession.deleteMany({});
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const sessionId = await service.createSession({
        taskId: 'test-task-1',
        status: 'idle',
        totalTokensIn: 0,
        totalTokensOut: 0,
        totalCost: 0,
        consecutiveMistakeCount: 0,
        collectedErrors: [],
      });

      expect(sessionId).toBeDefined();

      const session = await service.getSession('test-task-1');
      expect(session).toBeDefined();
      expect(session?.taskId).toBe('test-task-1');
    });
  });

  // ... 更多测试
});
```

### 集成测试

**文件**: `libs/agent-lib/src/core/agent/__tests__/agentPersistence.test.ts`

```typescript
describe('Agent with Persistence', () => {
  let agent: Agent;
  let container: AgentContainer;

  beforeEach(() => {
    container = AgentFactory.create({
      agent: { sop: 'Test SOP' },
      persistence: { enabled: true },
    });
    agent = container.getAgent();
  });

  it('should persist session on creation', async () => {
    const service = container.get<IPersistenceService>(
      TYPES.IPersistenceService,
    );
    const session = await service.getSession(agent.getTaskId);

    expect(session).toBeDefined();
    expect(session?.status).toBe('idle');
  });

  it('should update status on start', async () => {
    await agent.start();

    const service = container.get<IPersistenceService>(
      TYPES.IPersistenceService,
    );
    const session = await service.getSession(agent.getTaskId);

    expect(session?.status).toBe('running');
  });

  // ... 更多测试
});
```

---

## 使用示例

### 基本使用

```typescript
import { AgentFactory } from './core/agent/AgentFactory.js';

// 创建带持久化的 Agent
const container = AgentFactory.create({
  agent: {
    sop: readFileSync('./sop.md').toString(),
  },
  persistence: {
    enabled: true,
    autoCommit: true,
  },
});

const agent = container.getAgent();
await agent.start();

// Agent 状态会自动持久化
```

### 禁用持久化

```typescript
const container = AgentFactory.create({
  agent: { sop: 'Test SOP' },
  persistence: { enabled: false }, // 纯内存运行
});

const agent = container.getAgent();
await agent.start();
```

### 查询历史 Sessions

```typescript
const service = container.get<IPersistenceService>(TYPES.IPersistenceService);

// 列出所有运行中的 Sessions
const runningSessions = await service.listSessions({ status: 'running' });

// 获取统计数据
const stats = await service.getStats();
console.log(`Total sessions: ${stats.totalSessions}`);
console.log(`Total cost: $${stats.totalCost}`);
```

---

## 迁移指南

### 从 Expert 系统迁移

如果现有代码使用了 Expert 相关功能，需要按以下步骤迁移：

1. **移除 `setExpertIdentity()` 调用**

   ```typescript
   // 旧代码
   agent.setExpertIdentity({ expertId: 'my-expert', instanceId: '123' });

   // 新代码 - 不需要，使用 taskId 标识
   ```

2. **移除 `taskModule` 依赖**

   ```typescript
   // 旧代码
   const taskModule = agent.getTaskModule();

   // 新代码 - 如需任务队列，自行注册组件
   ```

3. **更新 Prisma Schema**

   ```bash
   # 运行迁移
   pnpm prisma:push
   ```

4. **更新引用类型**

   ```typescript
   // 移除
   import { IExpertExecutor } from './expert/index.js';

   // 使用持久化服务
   import { IPersistenceService } from './persistence/index.js';
   ```

---

## 性能优化建议

### 批量写入

对于高频更新的场景（如 token 使用统计），建议使用批量写入：

```typescript
class Agent {
  private _pendingPersistCalls: Array<() => Promise<void>> = [];
  private _persistTimer?: NodeJS.Timeout;

  private queuePersist(call: () => Promise<void>): void {
    this._pendingPersistCalls.push(call);

    if (this._persistTimer) {
      clearTimeout(this._persistTimer);
    }

    this._persistTimer = setTimeout(() => {
      void this.flushPersistQueue();
    }, 1000); // 1秒后批量写入
  }

  private async flushPersistQueue(): Promise<void> {
    const calls = this._pendingPersistCalls;
    this._pendingPersistCalls = [];

    await Promise.all(calls.map((call) => call()));
  }
}
```

### 异步持久化

所有持久化操作都应异步执行，不阻塞主流程：

```typescript
void this.persistState(); // 不等待
```

---

## 故障排查

### 数据库连接失败

```
Error: Can't reach database server
```

**解决方案**：

1. 检查 `DATABASE_URL` 环境变量
2. 确认数据库服务运行状态
3. 验证网络连接

### 持久化冲突

```
Error: Unique constraint failed on the constraint: AgentSession_taskId_key
```

**解决方案**：

- 确认 taskId 唯一性
- 使用 `crypto.randomUUID()` 生成 taskId

---

## TODO

### Phase 1 后续任务

- [ ] 添加 Session 恢复功能（从 DB 加载完整状态）
- [ ] 实现 Session 导出/导入（JSON 格式）
- [ ] 添加 Session 搜索功能（按时间、状态、配置等）

### Phase 2 后续任务

- [ ] 实现 Memory 增量持久化（只保存增量变化）
- [ ] 添加 Memory 压缩（自动归档旧消息）

### Phase 3 后续任务

- [ ] 实现组件状态版本迁移
- [ ] 添加状态回滚功能
- [ ] 实现跨 Agent 组件状态共享

---

## 参考资料

- [Prisma 文档](https://www.prisma.io/docs)
- [InversifyJS 文档](https://inversify.io/)
- [Agent API 参考](../core/agent/agent.ts)
