# API Client 架构优化方案

## 当前问题

需要在 API 调用时传递工具定义，有两个候选方案：
1. 在 `makeRequest` 添加 tools 参数
2. 让 Workspace 控制 ApiClient

## 推荐方案: ToolProvider 接口 + 配置注入

### 核心思想

- 创建 `ToolProvider` 接口，抽象工具提供能力
- `VirtualWorkspace` 实现 `ToolProvider`
- `ApiClient` 在构造时接收 `ToolProvider`（可选）
- Agent 负责协调，但不需要每次传递工具

### 架构图

```
┌─────────────────────────────────────────────────┐
│                    Agent                        │
│  - 协调 Workspace 和 ApiClient                  │
│  - 管理对话流程                                  │
└──────────────┬──────────────────┬───────────────┘
               │                  │
               │                  │
       ┌───────▼────────┐  ┌──────▼──────────┐
       │ VirtualWorkspace│  │   ApiClient     │
       │ (ToolProvider)  │  │ (可选依赖       │
       │                 │  │  ToolProvider)  │
       └─────────────────┘  └─────────────────┘
               │                  │
               │                  │
               └──────────────────┘
                  通过接口解耦
```

## 实现方案

### 1. 定义 ToolProvider 接口

```typescript
// src/api-client/ToolProvider.interface.ts

import { Tool } from 'stateful-context';

/**
 * Interface for providing tools to API clients
 * Allows decoupling between tool management and API calls
 */
export interface ToolProvider {
    /**
     * Get all available tools
     * @returns Array of tool definitions
     */
    getTools(): Tool[];

    /**
     * Get tools in OpenAI format
     * @returns Array of OpenAI-compatible tool definitions
     */
    getToolsForOpenAI(): any[];

    /**
     * Optional: Get tool by name for validation
     */
    getTool?(name: string): Tool | undefined;
}
```

### 2. VirtualWorkspace 实现 ToolProvider

```typescript
// libs/statefulContext/src/virtualWorkspace.ts

export class VirtualWorkspace implements ToolProvider {
    // ... existing code ...

    /**
     * Implement ToolProvider interface
     */
    getTools(): Tool[] {
        return Array.from(this.toolSet.values()).map(t => t.tool);
    }

    /**
     * Get tools in OpenAI format
     */
    getToolsForOpenAI(): any[] {
        const converter = new DefaultToolCallConverter();
        return converter.convertTools(this.getTools());
    }

    getTool(name: string): Tool | undefined {
        return this.toolSet.get(name)?.tool;
    }
}
```

### 3. 更新 ApiClient 接口（可选依赖）

```typescript
// src/api-client/ApiClient.interface.ts

export interface ApiClientConfig {
    /** Optional tool provider for automatic tool injection */
    toolProvider?: ToolProvider;
    /** Other config options */
    timeout?: number;
}

export interface ApiClient {
    /**
     * Make an API request
     * Tools are automatically injected from toolProvider if configured
     */
    makeRequest(
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[],
        timeoutConfig?: ApiTimeoutConfig
    ): Promise<ApiResponse>;

    /**
     * Optional: Update tool provider dynamically
     */
    setToolProvider?(provider: ToolProvider): void;
}
```

### 4. OpenaiCompatibleApiClient 实现

```typescript
// src/api-client/OpenaiCompatibleApiClient.ts

export interface OpenAICompatibleConfig {
    apiKey: string;
    baseURL?: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    toolProvider?: ToolProvider;  // 新增
}

export class OpenaiCompatibleApiClient implements ApiClient {
    private client: OpenAI;
    private config: OpenAICompatibleConfig;
    private toolProvider?: ToolProvider;

    constructor(config: OpenAICompatibleConfig) {
        this.config = config;
        this.toolProvider = config.toolProvider;
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseURL,
        });
    }

    setToolProvider(provider: ToolProvider): void {
        this.toolProvider = provider;
    }

    async makeRequest(
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[],
        timeoutConfig?: ApiTimeoutConfig
    ): Promise<ApiResponse> {
        // Build messages
        const messages = this.buildMessages(systemPrompt, workspaceContext, memoryContext);

        // Get tools from provider if available
        const tools = this.toolProvider?.getToolsForOpenAI();

        // Make API call
        const completion = await this.client.chat.completions.create({
            model: this.config.model,
            messages,
            tools,  // 自动注入
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens,
        });

        return this.convertOpenAIResponse(completion);
    }
}
```

### 5. Agent 使用方式

```typescript
// src/agent/agent.ts

export class Agent {
    private apiClient: ApiClient;
    private workspace: VirtualWorkspace;

    constructor(
        config: AgentConfig,
        apiConfiguration: ProviderSettings,
        workspace: VirtualWorkspace,
        agentPrompt: AgentPrompt,
        taskId?: string,
        apiClient?: ApiClient,
    ) {
        this.workspace = workspace;

        // 方式1: 创建时注入 ToolProvider
        if (!apiClient) {
            this.apiClient = ApiClientFactory.create(
                apiConfiguration,
                workspace  // 作为 ToolProvider 传入
            );
        } else {
            this.apiClient = apiClient;
            // 如果 apiClient 支持，设置 toolProvider
            if (this.apiClient.setToolProvider) {
                this.apiClient.setToolProvider(workspace);
            }
        }
    }

    async attemptApiRequest(retryAttempt: number = 0) {
        // 不需要传递工具，ApiClient 会自动从 toolProvider 获取
        const response = await this.apiClient.makeRequest(
            systemPrompt,
            workspaceContext,
            memoryContext,
            { timeout: this.config.apiRequestTimeout }
        );

        return response;
    }
}
```

### 6. ApiClientFactory 更新

```typescript
// src/api-client/ApiClientFactory.ts

export class ApiClientFactory {
    static create(
        config: ProviderSettings,
        toolProvider?: ToolProvider
    ): ApiClient {
        const provider = config.apiProvider || 'zai';

        switch (provider) {
            case 'openai':
                return new OpenaiCompatibleApiClient({
                    apiKey: config.apiKey!,
                    model: config.apiModelId!,
                    toolProvider,  // 注入
                });
            case 'zai':
            case 'anthropic':
            default:
                return new BamlApiClient();
        }
    }
}
```

## 方案优势

### 1. 职责清晰
- **ToolProvider**: 提供工具定义的抽象
- **VirtualWorkspace**: 管理工具和组件
- **ApiClient**: 负责 API 调用
- **Agent**: 协调各组件

### 2. 灵活性高
```typescript
// 场景1: 使用 Workspace 作为 ToolProvider
const workspace = new VirtualWorkspace(config);
const client = new OpenaiCompatibleApiClient({
    apiKey: 'key',
    model: 'gpt-4',
    toolProvider: workspace
});

// 场景2: 使用自定义 ToolProvider
class CustomToolProvider implements ToolProvider {
    getTools() { return [...]; }
    getToolsForOpenAI() { return [...]; }
}
const customProvider = new CustomToolProvider();
const client = new OpenaiCompatibleApiClient({
    apiKey: 'key',
    model: 'gpt-4',
    toolProvider: customProvider
});

// 场景3: 不使用工具
const client = new OpenaiCompatibleApiClient({
    apiKey: 'key',
    model: 'gpt-4'
    // 不传 toolProvider
});

// 场景4: 动态更新工具
client.setToolProvider(newProvider);
```

### 3. 易于测试
```typescript
// Mock ToolProvider for testing
class MockToolProvider implements ToolProvider {
    getTools() { return [mockTool1, mockTool2]; }
    getToolsForOpenAI() { return [mockOpenAITool]; }
}

const mockProvider = new MockToolProvider();
const client = new OpenaiCompatibleApiClient({
    apiKey: 'test-key',
    model: 'gpt-4',
    toolProvider: mockProvider
});
```

### 4. 向后兼容
- 现有代码不需要大改
- ToolProvider 是可选的
- 可以逐步迁移

### 5. 扩展性强
```typescript
// 可以实现不同的 ToolProvider
class DatabaseToolProvider implements ToolProvider {
    // 从数据库加载工具
}

class RemoteToolProvider implements ToolProvider {
    // 从远程服务获取工具
}

class CompositeToolProvider implements ToolProvider {
    // 组合多个 ToolProvider
}
```

## 实现步骤

1. ✅ 定义 `ToolProvider` 接口
2. ✅ 更新 `VirtualWorkspace` 实现接口
3. ✅ 更新 `ApiClient` 接口支持可选 `ToolProvider`
4. ✅ 更新 `OpenaiCompatibleApiClient` 实现
5. ✅ 更新 `ApiClientFactory`
6. ✅ 更新 `Agent` 构造函数
7. ✅ 添加测试用例
8. ✅ 更新文档

## 对比总结

| 特性 | 方案1 (参数传递) | 方案2 (Workspace控制) | 推荐方案 (ToolProvider) |
|------|-----------------|---------------------|----------------------|
| 职责分离 | ✅ 好 | ❌ 差 | ✅ 优秀 |
| 灵活性 | ⚠️ 中等 | ❌ 差 | ✅ 优秀 |
| 可测试性 | ✅ 好 | ❌ 差 | ✅ 优秀 |
| 代码复杂度 | ⚠️ 中等 | ⚠️ 中等 | ✅ 低 |
| 扩展性 | ⚠️ 中等 | ❌ 差 | ✅ 优秀 |
| 向后兼容 | ✅ 好 | ❌ 差 | ✅ 优秀 |

## 结论

**推荐使用 ToolProvider 接口方案**，因为它：
1. 保持了各层职责清晰
2. 提供了最大的灵活性
3. 易于测试和扩展
4. 向后兼容
5. 符合 SOLID 原则
