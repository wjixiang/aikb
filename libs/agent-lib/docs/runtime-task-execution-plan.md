# Runtime Task System - 执行计划

## 概述

将 Mail 系统简化为 Runtime Task 系统，移除外部 HTTP 服务依赖，使用内存队列 + 事件驱动。

## 目标

- 移除对 `agent-mailbox` HTTP 服务的依赖
- 简化类型定义（~60 行 vs 1000+ 行）
- 事件驱动替代轮询
- 支持跨 Expert 通信
- 预留持久化接口

---

## 并行执行架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PARALLEL EXECUTION                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  TRACK A (基础层)          TRACK B (组件层)           TRACK C (集成层)        │
│  ─────────────────         ─────────────────         ─────────────────       │
│  A1: types.ts              B1: schemas.ts            C1: ExpertInstance      │
│       ↓                         ↓                         ↓                   │
│  A2: storage.ts            B2: component.ts           C2: ExpertExecutor     │
│       ↓                         ↓                         ↓                   │
│  A3: storage.test.ts       B3: component.test.ts      C3: types.ts 更新      │
│                                                                               │
│  TRACK D (导出层)          TRACK E (文档层)                                  │
│  ─────────────────         ─────────────────                                  │
│  D1: index.ts              E1: prompt 更新                                    │
│  D2: components/index.ts   E2: CLAUDE.md 更新                                 │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘

依赖关系:
  A1 → A2 → A3  (串行)
  A1 → B1 → B2 → B3  (A1 完成后 B 可开始)
  A2 + B2 → D1, D2  (A2 和 B2 都完成后 D 可开始)
  B2 → C1, C2, C3  (B2 完成后 C 可开始)
  全部 → E1, E2  (最后文档更新)
```

---

## Phase 1: 基础层 (TRACK A + B 并行)

### Track A: 类型与存储 [~2h]

| Step | File                        | Description              | Dependencies |
| ---- | --------------------------- | ------------------------ | ------------ |
| A1   | `types.ts`                  | 类型定义                 | 无           |
| A2   | `storage.ts`                | 存储接口 + InMemory 实现 | A1           |
| A3   | `__tests__/storage.test.ts` | 存储单元测试             | A2           |

### Track B: 组件核心 [~2h]

| Step | File                          | Description        | Dependencies |
| ---- | ----------------------------- | ------------------ | ------------ |
| B1   | `schemas.ts`                  | Tool schemas (Zod) | A1           |
| B2   | `runtimeTaskComponent.ts`     | 核心组件实现       | A1, B1       |
| B3   | `__tests__/component.test.ts` | 组件单元测试       | B2           |

---

## Phase 2: 导出与集成 (TRACK C + D 并行)

### Track C: Expert 集成 [~1.5h]

| Step | File                | Description           | Dependencies |
| ---- | ------------------- | --------------------- | ------------ |
| C1   | `ExpertInstance.ts` | 事件驱动模式          | B2           |
| C2   | `ExpertExecutor.ts` | 注册 TaskComponent    | B2           |
| C3   | `expert/types.ts`   | 新增 ExpertTaskConfig | 无           |

### Track D: 模块导出 [~0.5h]

| Step | File                    | Description | Dependencies |
| ---- | ----------------------- | ----------- | ------------ |
| D1   | `runtime-task/index.ts` | 模块入口    | A2, B2       |
| D2   | `components/index.ts`   | 添加导出    | D1           |

---

## Phase 3: Prompt 与文档 (TRACK E)

### Track E: 文档更新 [~0.5h]

| Step | File                                     | Description   | Dependencies |
| ---- | ---------------------------------------- | ------------- | ------------ |
| E1   | `prompts/sections/runtimeTaskGuide.ts`   | 新 Prompt     | B2           |
| E2   | 删除 `prompts/sections/mailTaskGuide.ts` | 移除旧 Prompt | E1           |
| E3   | `CLAUDE.md` 更新                         | 文档更新      | 全部完成     |

---

## 详细任务清单

### A1: types.ts

**File**: `libs/agent-lib/src/components/runtime-task/types.ts`

```typescript
// 需要定义的类型:
// - TaskPriority
// - TaskStatus
// - RuntimeTask
// - RuntimeTaskResult
// - TaskQueueStats
// - TaskListener
// - TaskQueryFilter
```

### A2: storage.ts

**File**: `libs/agent-lib/src/components/runtime-task/storage.ts`

```typescript
// 需要实现:
// - ITaskStorage 接口
// - InMemoryTaskStorage 类
//
// 方法:
// - add, get, update, delete
// - query, getPending
// - saveResult, getResult
```

### B1: schemas.ts

**File**: `libs/agent-lib/src/components/runtime-task/schemas.ts`

```typescript
// Tool schemas:
// - getPendingTasks
// - getTaskById
// - reportTaskResult
// - sendTaskToExpert
```

### B2: runtimeTaskComponent.ts

**File**: `libs/agent-lib/src/components/runtime-task/runtimeTaskComponent.ts`

```typescript
// 核心组件:
// - 继承 ToolComponent
// - 实现 toolSet
// - 实现 handleToolCall
// - 公开 API: submitTask, getTaskResult, onNewTask, sendToExpert
// - render() 方法
```

### C1: ExpertInstance.ts 更新

**File**: `libs/agent-lib/src/core/expert/ExpertInstance.ts`

```diff
+ import { RuntimeTaskComponent } from '../../components/runtime-task/index.js';

+ private _taskUnsubscribe?: () => void;

  async start(): Promise<void> {
+   const taskComponent = this.workspace.getComponent('runtime-task') as RuntimeTaskComponent;
+   if (taskComponent) {
+     this._taskUnsubscribe = taskComponent.onNewTask((task) => {
+       this.agent.wakeUpForTask(task);
+     });
+   }
  }

  stop(): void {
+   this._taskUnsubscribe?.();
  }
```

### C3: expert/types.ts 更新

**File**: `libs/agent-lib/src/core/expert/types.ts`

```diff
+ export interface ExpertTaskConfig {
+   enabled?: boolean;
+ }

  export interface ExpertConfig {
    // ... existing
-   mailConfig?: ExpertMailConfig;
+   taskConfig?: ExpertTaskConfig;
  }
```

---

## 验证清单

- [ ] `pnpm build` - 编译通过
- [ ] `pnpm test` - 单元测试通过
- [ ] `RuntimeTaskComponent` 可独立使用
- [ ] `ExpertInstance` 事件驱动正常工作
- [ ] 跨 Expert 通信测试通过

---

## 回滚计划

如果出现问题:

1. 保留 `mail/` 目录不删除
2. 新增 `runtime-task/` 目录可独立移除
3. `ExpertConfig` 同时支持 `mailConfig` 和 `taskConfig`

---

## 时间估算

| Phase    | Tracks | 并行度 | 预计时间   |
| -------- | ------ | ------ | ---------- |
| Phase 1  | A + B  | 2 并行 | 2 小时     |
| Phase 2  | C + D  | 2 并行 | 1.5 小时   |
| Phase 3  | E      | 1      | 0.5 小时   |
| **总计** |        |        | **4 小时** |

---

## 执行进度

- [ ] Phase 1 完成
- [ ] Phase 2 完成
- [ ] Phase 3 完成
- [ ] 验证通过
