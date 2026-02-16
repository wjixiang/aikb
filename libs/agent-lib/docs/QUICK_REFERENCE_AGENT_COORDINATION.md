# Agent 协调方案 - 快速参考

## 核心思想

Agent 从 Workspace 获取工具，转换为 OpenAI 格式，传递给 ApiClient。

## 架构

```
Agent (协调者)
  ├── workspace.getAllTools() → 获取工具
  ├── convertWorkspaceToolsToOpenAI() → 转换格式
  └── apiClient.makeRequest(..., tools) → 传递工具
```

## 关键代码

### Agent 中的工具转换

```typescript
// src/agent/agent.ts

private convertWorkspaceToolsToOpenAI(): any[] {
    const allTools = this.workspace.getAllTools();
    const tools = allTools.map(t => t.tool);

    const { DefaultToolCallConverter } = require('../api-client/ToolCallConvert');
    const converter = new DefaultToolCallConverter();

    return converter.convertTools(tools);
}

async attemptApiRequest() {
    const tools = this.convertWorkspaceToolsToOpenAI();

    const response = await this.apiClient.makeRequest(
        systemPrompt,
        workspaceContext,
        memoryContext,
        { timeout },
        tools  // 传递工具
    );
}
```

### ApiClient 接口

```typescript
// src/api-client/ApiClient.interface.ts

export interface ApiClient {
    makeRequest(
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[],
        timeoutConfig?: ApiTimeoutConfig,
        tools?: any[]  // 可选工具参数
    ): Promise<ApiResponse>;
}
```

### OpenAI 客户端使用工具

```typescript
// src/api-client/OpenaiCompatibleApiClient.ts

async makeRequest(..., tools?: any[]) {
    const completion = await this.client.chat.completions.create({
        model: this.config.model,
        messages,
        tools,  // 传递给 OpenAI
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
    });
}
```

## 使用示例

```typescript
// 创建 Workspace
const workspace = new VirtualWorkspace({ id: 'ws', name: 'My Workspace' });
workspace.registerComponent({ key: 'search', component: searchComponent });

// 创建 Agent（自动处理工具）
const agent = new Agent(config, apiConfig, workspace, prompt);

// 启动（工具自动传递给 ApiClient）
await agent.start('Search for information');
```

## 优势

- ✅ VirtualWorkspace 不需要修改
- ✅ 保持包的独立性
- ✅ Agent 职责清晰
- ✅ 易于测试
- ✅ 向后兼容

## 测试

```bash
npm test -- src/agent/__tests__/tool-conversion.unit.test.ts --run
```

结果: 5/5 通过 ✓

## 文档

- `AGENT_COORDINATION_ARCHITECTURE.md` - 详细架构设计
- `AGENT_COORDINATION_IMPLEMENTATION.md` - 完整实现总结
- `QUICK_REFERENCE_AGENT_COORDINATION.md` - 本文档
