# API Client 解耦架构

## 概述

本文档说明了 Agent 模块如何通过 ApiClient 接口与具体的 LLM 实现解耦。

## 问题

在重构之前，[`agent.ts`](../libs/agent-lib/src/agent/agent.ts) 直接依赖 BAML 生成的类型：

```typescript
import { AttemptCompletion, ToolCall } from '../baml_client/types.js'
```

这导致了以下问题：
- **紧耦合**：Agent 类与 BAML 实现紧密绑定
- **难以测试**：无法轻松模拟 API 响应
- **难以替换**：切换到其他 LLM 提供商需要大量修改
- **依赖方向错误**：高层模块（Agent）依赖低层模块（BAML）

## 解决方案

### 架构设计

采用依赖倒置原则（Dependency Inversion Principle），通过抽象接口解耦：

```
┌─────────────────────────────────────────────────────────────┐
│                        Agent                                │
│  - 依赖 ApiClient 接口                                      │
│  - 不关心具体实现（BAML、OpenAI、Claude 等）                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   ApiClient 接口                            │
│  - makeRequest(): Promise<ApiResponse>                      │
│  - ApiResponse = AttemptCompletion | ToolCall               │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
┌───────────────────┐               ┌─────────────────────┐
│  BamlApiClient    │               │  其他实现（未来）    │
│  - BAML 实现      │               │  - OpenAI Client    │
│  - 返回 ApiResponse│              │  - Claude Client    │
└───────────────────┘               │  - 自定义实现       │
                                    └─────────────────────┘
```

### 实现细节

#### 1. ApiClient 接口

定义在 [`libs/agent-lib/src/api-client/ApiClient.interface.ts`](../libs/agent-lib/src/api-client/ApiClient.interface.ts)：

```typescript
export interface ApiClient {
    makeRequest(
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[],
        timeoutConfig?: ApiTimeoutConfig
    ): Promise<ApiResponse>;
}

export type ApiResponse = AttemptCompletion | ToolCall;
```

#### 2. 类型定义

通用的响应类型，独立于任何具体实现：

```typescript
export interface AttemptCompletion {
    toolName: "attempt_completion"
    toolParams: string
}

export interface ToolCall {
    toolName: string
    toolParams: string
}
```

#### 3. BAML 实现

[`BamlApiClient`](../libs/agent-lib/src/api-client/BamlApiClient.ts) 实现 ApiClient 接口：

```typescript
export class BamlApiClient implements ApiClient {
    async makeRequest(
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[],
        timeoutConfig?: ApiTimeoutConfig
    ): Promise<ApiResponse> {
        // BAML 具体实现
        const bamlResponse = await b.ApiRequest(
            systemPrompt, 
            workspaceContext, 
            memoryContext
        );
        return bamlResponse;
    }
}
```

#### 4. Agent 使用

[`Agent`](../libs/agent-lib/src/agent/agent.ts) 类现在依赖抽象接口：

```typescript
import type { ApiResponse, AttemptCompletion, ToolCall } from '../api-client/index.js';
import type { ApiClient } from '../api-client/index.js';

export class Agent {
    private apiClient: ApiClient;

    constructor(
        // ... 其他参数
        apiClient?: ApiClient,
    ) {
        // 依赖注入
        this.apiClient = apiClient || ApiClientFactory.create(this.apiConfiguration);
    }

    async attemptApiRequest(retryAttempt: number = 0) {
        // 使用接口，不关心具体实现
        const response = await this.apiClient.makeRequest(
            prompt.systemPrompt,
            prompt.workspaceContext,
            prompt.memoryContext,
            { timeout: this.config.apiRequestTimeout }
        );
        return response;
    }
}
```

## 优势

### 1. 可测试性

可以轻松创建 Mock 客户端进行单元测试：

```typescript
const mockApiClient: ApiClient = {
    makeRequest: async () => ({
        toolName: 'attempt_completion',
        toolParams: '{"result": "test"}'
    })
};

const agent = new Agent(
    config,
    apiConfig,
    workspace,
    agentPrompt,
    taskId,
    mockApiClient  // 注入 mock 客户端
);
```

### 2. 可替换性

可以轻松切换到不同的 LLM 实现：

```typescript
// 使用 BAML
const bamlClient = new BamlApiClient();

// 使用 OpenAI（未来实现）
const openaiClient = new OpenAiApiClient();

// 使用 Claude（未来实现）
const claudeClient = new ClaudeApiClient();

// Agent 代码无需修改
const agent = new Agent(config, apiConfig, workspace, prompt, taskId, bamlClient);
```

### 3. 清晰的依赖方向

遵循依赖倒置原则：
- 高层模块（Agent）定义接口
- 低层模块（BAML）实现接口
- 两者都依赖抽象（ApiClient 接口）

### 4. 易于扩展

添加新的 LLM 提供商只需：
1. 实现 `ApiClient` 接口
2. 返回符合 `ApiResponse` 类型的响应
3. 无需修改 Agent 代码

## 迁移指南

### 从 BAML 直接依赖迁移到接口

**之前**：
```typescript
import { AttemptCompletion, ToolCall } from '../baml_client/types.js'
```

**之后**：
```typescript
import type { ApiResponse, AttemptCompletion, ToolCall } from '../api-client/index.js';
```

### 类型兼容性

BAML 生成的类型与 ApiClient 接口定义的类型结构完全相同：

```typescript
// BAML 类型（libs/agent-lib/src/baml_client/types.ts）
export interface AttemptCompletion {
  toolName: "attempt_completion"
  toolParams: string
}

export interface ToolCall {
  toolName: string
  toolParams: string
}

// ApiClient 接口类型（libs/agent-lib/src/api-client/ApiClient.interface.ts）
export interface AttemptCompletion {
    toolName: "attempt_completion"
    toolParams: string
}

export interface ToolCall {
    toolName: string
    toolParams: string
}
```

因此，`BamlApiClient` 可以直接返回 BAML 的响应，无需类型转换。

## 未来扩展

### 支持其他 LLM 提供商

可以创建新的 ApiClient 实现：

```typescript
// OpenAI 实现
export class OpenAiApiClient implements ApiClient {
    async makeRequest(...): Promise<ApiResponse> {
        // OpenAI API 调用
        // 转换为 ApiResponse 格式
    }
}

// Claude 实现
export class ClaudeApiClient implements ApiClient {
    async makeRequest(...): Promise<ApiResponse> {
        // Claude API 调用
        // 转换为 ApiResponse 格式
    }
}
```

### 支持流式响应

可以扩展接口以支持流式响应：

```typescript
export interface StreamingApiClient extends ApiClient {
    makeStreamingRequest(
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[],
        timeoutConfig?: ApiTimeoutConfig
    ): AsyncIterable<PartialApiResponse>;
}
```

## 相关文件

- [`libs/agent-lib/src/api-client/ApiClient.interface.ts`](../libs/agent-lib/src/api-client/ApiClient.interface.ts) - ApiClient 接口定义
- [`libs/agent-lib/src/api-client/BamlApiClient.ts`](../libs/agent-lib/src/api-client/BamlApiClient.ts) - BAML 实现
- [`libs/agent-lib/src/api-client/ApiClientFactory.ts`](../libs/agent-lib/src/api-client/ApiClientFactory.ts) - 客户端工厂
- [`libs/agent-lib/src/agent/agent.ts`](../libs/agent-lib/src/agent/agent.ts) - Agent 类（使用 ApiClient）

## 总结

通过引入 ApiClient 接口，我们成功地：
- ✅ 解耦了 Agent 与 BAML 的直接依赖
- ✅ 提高了代码的可测试性
- ✅ 使得切换 LLM 提供商变得简单
- ✅ 遵循了 SOLID 原则中的依赖倒置原则
- ✅ 为未来的扩展奠定了良好的基础
