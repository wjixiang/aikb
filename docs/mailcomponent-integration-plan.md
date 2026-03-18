# MailComponent 集成计划

## 概述

在 ExpertExecutor 中固定注入 MailComponent，使所有 Expert 都具备邮件通信能力。

## 实现状态：✅ 已完成

### 已完成的改动

#### 1. types.ts - 类型定义

**文件**: `libs/agent-lib/src/core/expert/types.ts`

已添加以下类型：

```typescript
/**
 * MailComponent 工厂函数类型
 * 由使用方（ebm-agent）提供，避免循环依赖
 */
export type MailComponentFactory = (config: {
    baseUrl: string;
    defaultAddress: string;
    apiKey?: string;
    timeout?: number;
}) => ToolComponent;

/**
 * Expert 邮件驱动配置
 */
export interface ExpertMailConfig {
    enabled?: boolean;
    pollInterval?: number;
    baseUrl?: string;
    apiKey?: string;
}

/**
 * ExpertExecutor 构造函数选项
 */
export interface ExpertExecutorOptions {
    mailConfig?: ExpertMailConfig;
    mailComponentFactory?: MailComponentFactory;
}
```

并在 `ExpertConfig` 中添加了 `mailConfig` 字段。

#### 2. ExpertExecutor.ts - 核心实现

**文件**: `libs/agent-lib/src/core/expert/ExpertExecutor.ts`

已实现以下功能：

1. **构造函数接收 options 参数**
2. **registerMailComponent 方法** - 核心注入逻辑：

```typescript
private async registerMailComponent(
    agent: Agent,
    config: ExpertConfig
): Promise<void> {
    // 1. 检查是否提供了工厂函数
    if (!this.options.mailComponentFactory) {
        return;
    }

    // 2. 获取 workspace
    const workspace = (agent as any).workspace as VirtualWorkspace;

    // 3. 检查是否已注册
    if (workspace.getComponentRegistry().has('mail')) {
        return;
    }

    // 4. 优先使用 Expert 自己的配置
    const baseUrl = config.mailConfig?.baseUrl
        || this.options.mailConfig?.baseUrl
        || 'http://localhost:30000';

    // 5. 使用工厂函数创建 MailComponent
    const mailComponent = this.options.mailComponentFactory({
        baseUrl,
        defaultAddress: `${config.expertId}@expert`,
        apiKey,
        timeout: 30000,
    });

    // 6. 注册到 workspace，优先级 -1（最高）
    workspace.registerComponent('mail', mailComponent, -1);
}
```

---

## 使用方式

在 ebm-agent 中使用：

```typescript
// demo-expert.ts
import { ExpertExecutor, ExpertRegistry, createMailComponent } from 'agent-lib';

const executor = new ExpertExecutor(registry, undefined, {
    mailConfig: {
        baseUrl: process.env.MAILBOX_URL || 'http://localhost:30000',
    },
    mailComponentFactory: (config) => createMailComponent(config),
});
```

---

## 配置优先级

MailComponent 配置的优先级顺序：

1. **ExpertConfig.mailConfig** - Expert 自己的配置
2. **ExpertExecutorOptions.mailConfig** - 全局配置
3. **默认值** - `http://localhost:30000`

---

## 向后兼容性

- 不传入 `mailComponentFactory` 时，行为不变
- 不设置 `mailConfig` 时，不注册 MailComponent

---

## 文件改动清单

| 文件 | 状态 | 说明 |
|------|------|------|
| `libs/agent-lib/src/core/expert/types.ts` | ✅ | 新增类型定义 |
| `libs/agent-lib/src/core/expert/ExpertExecutor.ts` | ✅ | 添加 MailComponent 注入逻辑 |

---

## 后续任务

- ExpertInstance 添加 run() 方法（任务 #2）
- 更新 demo-expert.ts 示例（任务 #6）
- 编写测试用例（任务 #7）
