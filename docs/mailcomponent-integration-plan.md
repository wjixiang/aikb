# MailComponent 集成计划

## 概述

在 ExpertExecutor 中固定注入 MailComponent，使所有 Expert 都具备邮件通信能力。

## 改动清单

### 阶段 1: 类型定义 (types.ts)

**文件**: `libs/agent-lib/src/core/expert/types.ts`

新增 `ExpertMailConfig` 接口：

```typescript
/**
 * 邮件驱动配置
 */
export interface ExpertMailConfig {
    /** 是否启用邮件驱动模式 */
    enabled?: boolean;
    /** 轮询间隔 (ms)，默认 30000 */
    pollInterval?: number;
    /** agent-mailbox 服务地址 */
    baseUrl?: string;
    /** API 密钥 */
    apiKey?: string;
}
```

在 `ExpertConfig` 中添加可选字段：

```typescript
export interface ExpertConfig {
    // ... existing fields ...
    mailConfig?: ExpertMailConfig;
}
```

### 阶段 2: ExpertExecutor 改造

**文件**: `libs/agent-lib/src/core/expert/ExpertExecutor.ts`

**改动 2.1**: 添加 import

```typescript
import { createMailComponent } from 'component-hub';
import type { MailComponentConfig } from 'component-hub';
```

**改动 2.2**: 构造函数接收全局 mailConfig

```typescript
interface ExpertExecutorOptions {
    mailConfig?: {
        baseUrl: string;
        apiKey?: string;
        defaultPollInterval?: number;
    };
}

constructor(
    registry: ExpertRegistry,
    container?: Container,
    private options?: ExpertExecutorOptions,
) {
    // ...
}
```

**改动 2.3**: createExpert 方法中注入 MailComponent

在 `await this.registerExpertComponents(agent, config.components);` 之后添加：

```typescript
// 注册内置 MailComponent
await this.registerMailComponent(agent, config);
```

新增私有方法 `registerMailComponent`：

```typescript
private async registerMailComponent(
    agent: Agent,
    config: ExpertConfig
): Promise<void> {
    const workspace = (agent as any).workspace as VirtualWorkspace;

    // 检查是否已注册 mail 组件
    if (workspace.componentRegistry.has('mail')) {
        console.log('[ExpertExecutor] MailComponent already registered');
        return;
    }

    // 优先使用 Expert 自己的 mailConfig，否则使用全局配置
    const mailBaseUrl = config.mailConfig?.baseUrl
        || this.options?.mailConfig?.baseUrl
        || 'http://localhost:3000';

    const mailApiKey = config.mailConfig?.apiKey
        || this.options?.mailConfig?.apiKey;

    const mailComponent = createMailComponent({
        baseUrl: mailBaseUrl,
        defaultAddress: `${config.expertId}@expert`,
        apiKey: mailApiKey,
        timeout: 30000,
    });

    // 注册为内置组件，优先级 -1 (最高)
    workspace.registerComponent('mail', mailComponent, -1);
    console.log(`[ExpertExecutor] Registered MailComponent for ${config.expertId}`);
}
```

### 阶段 3: ExpertInstance 改造 (后续任务)

**文件**: `libs/agent-lib/src/core/expert/ExpertInstance.ts`

添加 `run()` 方法和 `stop()` 方法（见架构设计文档）。

### 阶段 4: config.json 支持 (可选)

**文件**: `apps/ebm-agent/experts/*/config.json`

支持在 Expert 配置文件中配置邮件：

```json
{
  "id": "pubmed-retrieve",
  "mail": {
    "enabled": true,
    "pollInterval": 30000
  }
}
```

需要同步修改 `ExpertFactory.ts` 解析该配置。

---

## 文件改动清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `libs/agent-lib/src/core/expert/types.ts` | 修改 | 添加 ExpertMailConfig 类型 |
| `libs/agent-lib/src/core/expert/ExpertExecutor.ts` | 修改 | 添加 MailComponent 注入逻辑 |
| `libs/agent-lib/src/core/expert/ExpertInstance.ts` | 修改 | 添加 run() 方法 |
| `libs/agent-lib/src/core/expert/ExpertFactory.ts` | 修改 | 解析 config.json 中的 mail 配置 |

---

## 实现顺序

```
1. types.ts          - 新增类型定义
2. ExpertExecutor    - 注入 MailComponent
3. ExpertInstance    - 添加 run() 方法
4. ExpertFactory     - 支持 config.json mail 配置
5. 测试              - 验证集成
```

---

## 注意事项

1. **依赖**: 确保 `component-hub` 已构建，agent-lib 依赖它
2. **向后兼容**: 不启用 mailConfig 时，行为不变
3. **错误处理**: MailComponent 创建失败不应影响 Expert 创建
4. **优先级**: MailComponent 使用 -1 优先级确保最先注册
