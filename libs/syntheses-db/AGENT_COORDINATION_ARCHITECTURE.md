# 优化方案：以 Agent 为核心的工具传递架构

## 当前架构分析

```
Agent (核心协调者)
  ├── VirtualWorkspace (工具管理)
  │   ├── ToolComponent[]
  │   └── toolSet: Map<string, Tool>
  └── ApiClient (API 调用)
      └── makeRequest()
```

## 问题

如何在 API 调用时传递工具定义？

## 优化方案：Agent 协调模式

### 核心原则

1. **VirtualWorkspace 保持不变** - 不添加任何新接口或依赖
2. **ApiClient 接收可选工具参数** - 支持但不强制
3. **Agent 负责协调** - 从 Workspace 获取工具，传递给 ApiClient

### 架构图

```
┌─────────────────────────────────────────────────────────┐
│                        Agent                            │
│                    (核心协调者)                          │
│                                                         │
│  attemptApiRequest() {                                  │
│    // 1. 从 Workspace 获取工具                          │
│    const tools = this.workspace.getTools();             │
│                                                         │
│    // 2. 转换为 OpenAI 格式                             │
│    const openaiTools = this.convertToOpenAIFormat(tools);│
│                                                         │
│    // 3. 调用 ApiClient，传递工具                       │
│    return this.apiClient.makeRequest(                   │
│      systemPrompt,                                      │
│      workspaceContext,                                  │
│      memoryContext,                                     │
│      openaiTools  // 传递工具                           │
│    );                                                   │
│  }                                                      │
└────────┬────────────────────────────────┬──────────────┘
         │                                │
         │                                │
    ┌────▼─────────────┐         ┌───────▼──────────┐
    │ VirtualWorkspace │         │   ApiClient      │
    │  (保持不变)       │         │  (接收可选工具)   │
    │                  │         │                  │
    │ - getTools()     │         │ makeRequest(     │
    │ - getAllTools()  │         │   ...,           │
    │ (现有方法)        │         │   tools?         │
    │                  │         │ )                │
    └──────────────────┘         └──────────────────┘
```

## 实现细节

### 1. 更新 ApiClient 接口（添加可选 tools 参数）

```typescript
// src/api-client/ApiClient.interface.ts

export interface ApiClient {
    makeRequest(
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[],
        timeoutConfig?: ApiTimeoutConfig,
        tools?: any[]  // 新增：可选的工具定义（OpenAI 格式）
    ): Promise<ApiResponse>;
}
```

### 2. VirtualWorkspace 保持不变

```typescript
// libs/statefulContext/src/virtualWorkspace.ts
// 不需要任何修改！已有的方法足够使用：

class VirtualWorkspace {
    // 现有方法，不需要修改
    getTools(): Tool[] { ... }
    getAllTools(): Array<{ componentKey: string; toolName: string; tool: Tool }> { ... }
}
```

### 3. Agent 添加工具转换和传递逻辑

```typescript
// src/agent/agent.ts

export class Agent {
    workspace: VirtualWorkspace;
    private apiClient: ApiClient;

    /**
     * 将 Workspace 的工具转换为 OpenAI 格式
     */
    private convertWorkspaceToolsToOpenAI(): any[] {
        const tools = this.workspace.getTools();

        // 使用现有的转换器
        const { DefaultToolCallConverter } = require('../api-client/ToolCallConvert');
        const converter = new DefaultToolCallConverter();

        return converter.convertTools(tools);
    }

    /**
     * 尝试 API 请求（更新版本）
     */
    async attemptApiRequest(retryAttempt: number = 0) {
        try {
            const systemPrompt = await this.getSystemPrompt();
            const workspaceContext = await this.workspace.render();

            // 构建 prompt
            const prompt: FullPrompt = new PromptBuilder()
                .setSystemPrompt(systemPrompt)
                .setWorkspaceContext(workspaceContext)
                .setConversationHistory(this._conversationHistory)
                .build();

            // 从 Workspace 获取并转换工具
            const tools = this.convertWorkspaceToolsToOpenAI();

            try {
                // 调用 ApiClient，传递工具
                const response = await this.apiClient.makeRequest(
                    prompt.systemPrompt,
                    prompt.workspaceContext,
                    prompt.memoryContext,
                    { timeout: this.config.apiRequestTimeout },
                    tools  // 传递工具定义
                );

                return response;
            } catch (error) {
                throw error;
            }
        } catch (error) {
            throw error;
        }
    }
}
```

### 4. 更新 OpenaiCompatibleApiClient

```typescript
// src/api-client/OpenaiCompatibleApiClient.ts

export class OpenaiCompatibleApiClient implements ApiClient {
    async makeRequest(
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[],
        timeoutConfig?: ApiTimeoutConfig,
        tools?: any[]  // 接收工具参数
    ): Promise<ApiResponse> {
        const timeout = timeoutConfig?.timeout ?? 40000;

        // 构建消息
        const messages = this.buildMessages(systemPrompt, workspaceContext, memoryContext);

        // 创建超时 Promise
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`API request timed out after ${timeout}ms`));
            }, timeout);
        });

        try {
            // 发起 API 请求
            const completion = await Promise.race([
                this.client.chat.completions.create({
                    model: this.config.model,
                    messages,
                    tools,  // 传递工具（如果提供）
                    temperature: this.config.temperature,
                    max_tokens: this.config.maxTokens,
                }),
                timeoutPromise,
            ]);

            return this.convertOpenAIResponse(completion);
        } catch (error) {
            console.error('OpenAI-compatible API request failed:', error);
            throw error;
        }
    }

    private buildMessages(
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[]
    ): OpenAI.Chat.ChatCompletionMessageParam[] {
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            {
                role: 'system',
                content: systemPrompt,
            },
            {
                role: 'system',
                content: `--- WORKSPACE CONTEXT ---\n${workspaceContext}\n--- END WORKSPACE CONTEXT ---`,
            },
        ];

        for (const historyItem of memoryContext) {
            messages.push({
                role: 'user',
                content: historyItem,
            });
        }

        return messages;
    }
}
```

### 5. 更新 BamlApiClient（如果需要）

```typescript
// src/api-client/BamlApiClient.ts

export class BamlApiClient implements ApiClient {
    async makeRequest(
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[],
        timeoutConfig?: ApiTimeoutConfig,
        tools?: any[]  // 接收但可能不使用（BAML 有自己的工具定义方式）
    ): Promise<ApiResponse> {
        const timeout = timeoutConfig?.timeout ?? BamlApiClient.DEFAULT_TIMEOUT;

        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`API request timed out after ${timeout}ms`));
            }, timeout);
        });

        try {
            // BAML 可能有自己的工具处理方式
            // 这里可以选择使用或忽略 tools 参数
            const bamlResponse = await Promise.race([
                b.ApiRequest(systemPrompt, workspaceContext, memoryContext),
                timeoutPromise,
            ]);

            return this.convertBamlResponse(bamlResponse);
        } catch (error) {
            console.error('BAML API request failed:', error);
            throw error;
        }
    }
}
```

## 方案优势

### 1. 不破坏现有结构
- ✅ VirtualWorkspace 完全不需要修改
- ✅ 保持包的独立性（statefulContext 不依赖 agent-lib）
- ✅ 现有代码继续工作

### 2. 职责清晰
- **VirtualWorkspace**: 管理工具和组件
- **ApiClient**: 负责 API 调用
- **Agent**: 协调两者，负责工具的获取和传递

### 3. 灵活性高
```typescript
// 场景1: 使用 Workspace 的工具
const agent = new Agent(config, apiConfig, workspace, prompt);
// Agent 自动从 workspace 获取工具

// 场景2: 自定义 ApiClient（可以不传工具）
const customClient = new CustomApiClient();
const agent = new Agent(config, apiConfig, workspace, prompt, taskId, customClient);

// 场景3: 测试时 Mock
const mockWorkspace = {
    getTools: () => [mockTool1, mockTool2],
    // ... other methods
};
```

### 4. 易于测试
```typescript
// 测试 Agent 的工具转换
const agent = new Agent(config, apiConfig, mockWorkspace, prompt);
const tools = agent['convertWorkspaceToolsToOpenAI']();
expect(tools).toHaveLength(2);

// 测试 ApiClient 接收工具
const client = new OpenaiCompatibleApiClient(config);
const response = await client.makeRequest(
    systemPrompt,
    workspaceContext,
    memoryContext,
    { timeout: 5000 },
    mockTools
);
```

### 5. 向后兼容
```typescript
// tools 参数是可选的
// 不传工具也能工作（对于不需要工具的场景）
const response = await apiClient.makeRequest(
    systemPrompt,
    workspaceContext,
    memoryContext,
    { timeout: 5000 }
    // 不传 tools
);
```

## 实现步骤

1. ✅ 更新 `ApiClient.interface.ts` - 添加可选 tools 参数
2. ✅ 更新 `OpenaiCompatibleApiClient.ts` - 实现工具传递
3. ✅ 更新 `BamlApiClient.ts` - 添加 tools 参数（可选使用）
4. ✅ 在 `Agent.ts` 添加 `convertWorkspaceToolsToOpenAI()` 方法
5. ✅ 更新 `Agent.attemptApiRequest()` - 传递工具
6. ✅ 添加测试用例
7. ✅ 更新文档

## 对比其他方案

| 特性 | ToolProvider 方案 | Agent 协调方案 |
|------|------------------|---------------|
| 破坏现有结构 | ⚠️ 需要修改 VirtualWorkspace | ✅ 不需要修改 |
| 包依赖 | ❌ 产生反向依赖 | ✅ 保持独立 |
| 职责清晰 | ✅ 清晰 | ✅ 清晰 |
| 实现复杂度 | ⚠️ 中等 | ✅ 简单 |
| 灵活性 | ✅ 高 | ✅ 高 |
| 测试友好 | ✅ 好 | ✅ 好 |

## 结论

**推荐使用 Agent 协调方案**，因为：
1. 不破坏现有结构
2. 保持包的独立性
3. Agent 作为核心协调者，职责自然
4. 实现简单，易于理解
5. 完全向后兼容
