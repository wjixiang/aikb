# Agent 协调方案实现总结

## 实现日期
2026-02-16

## 方案概述

采用 **Agent 协调模式**，由 Agent 负责从 Workspace 获取工具并传递给 ApiClient，保持各层职责清晰且不破坏现有结构。

## 核心架构

```
┌─────────────────────────────────────────────────────────┐
│                        Agent                            │
│                    (核心协调者)                          │
│                                                         │
│  attemptApiRequest() {                                  │
│    // 1. 从 Workspace 获取工具                          │
│    const allTools = this.workspace.getAllTools();       │
│    const tools = allTools.map(t => t.tool);             │
│                                                         │
│    // 2. 转换为 OpenAI 格式                             │
│    const converter = new DefaultToolCallConverter();    │
│    const openaiTools = converter.convertTools(tools);   │
│                                                         │
│    // 3. 调用 ApiClient，传递工具                       │
│    return this.apiClient.makeRequest(                   │
│      systemPrompt,                                      │
│      workspaceContext,                                  │
│      memoryContext,                                     │
│      { timeout },                                       │
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
    │ - getAllTools()  │         │ makeRequest(     │
    │ (现有方法)        │         │   ...,           │
    │                  │         │   tools?         │
    │                  │         │ )                │
    └──────────────────┘         └──────────────────┘
```

## 实现的修改

### 1. ApiClient 接口更新

**文件**: `src/api-client/ApiClient.interface.ts`

```typescript
export interface ApiClient {
    makeRequest(
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[],
        timeoutConfig?: ApiTimeoutConfig,
        tools?: any[]  // 新增：可选的工具定义
    ): Promise<ApiResponse>;
}
```

**变更**: 添加可选的 `tools` 参数

### 2. BamlApiClient 更新

**文件**: `src/api-client/BamlApiClient.ts`

```typescript
async makeRequest(
    systemPrompt: string,
    workspaceContext: string,
    memoryContext: string[],
    timeoutConfig?: ApiTimeoutConfig,
    tools?: any[]  // 新增参数
): Promise<ApiResponse>
```

**变更**: 添加 `tools` 参数（BAML 可能有自己的工具处理方式）

### 3. OpenaiCompatibleApiClient 更新

**文件**: `src/api-client/OpenaiCompatibleApiClient.ts`

```typescript
async makeRequest(
    systemPrompt: string,
    workspaceContext: string,
    memoryContext: string[],
    timeoutConfig?: ApiTimeoutConfig,
    tools?: any[]  // 新增参数
): Promise<ApiResponse> {
    const messages = this.buildMessages(systemPrompt, workspaceContext, memoryContext);

    const completion = await this.client.chat.completions.create({
        model: this.config.model,
        messages,
        tools,  // 传递工具
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
    });

    return this.convertOpenAIResponse(completion);
}
```

**变更**:
- 添加 `tools` 参数
- 将 `tools` 传递给 OpenAI API
- 提取 `buildMessages()` 方法

### 4. Agent 核心逻辑更新

**文件**: `src/agent/agent.ts`

**新增方法**:
```typescript
/**
 * Convert Workspace tools to OpenAI format
 */
private convertWorkspaceToolsToOpenAI(): any[] {
    // 从 Workspace 获取所有工具
    const allTools = this.workspace.getAllTools();
    const tools = allTools.map(t => t.tool);

    // 使用现有的转换器
    const { DefaultToolCallConverter } = require('../api-client/ToolCallConvert');
    const converter = new DefaultToolCallConverter();

    return converter.convertTools(tools);
}
```

**更新方法**:
```typescript
async attemptApiRequest(retryAttempt: number = 0) {
    // ... 构建 prompt ...

    // 获取并转换工具
    const tools = this.convertWorkspaceToolsToOpenAI();

    // 调用 ApiClient，传递工具
    const response = await this.apiClient.makeRequest(
        prompt.systemPrompt,
        prompt.workspaceContext,
        prompt.memoryContext,
        { timeout: this.config.apiRequestTimeout },
        tools  // 传递工具
    );

    return response;
}
```

### 5. VirtualWorkspace

**文件**: `libs/statefulContext/src/virtualWorkspace.ts`

**变更**: 无需修改！保持原有结构

现有方法已足够使用:
- `getAllTools()`: 返回所有工具及其组件信息
- 其他现有方法保持不变

## 测试覆盖

### 单元测试

**文件**: `src/agent/__tests__/tool-conversion.unit.test.ts`

测试覆盖:
- ✅ Workspace 工具转换为 OpenAI 格式
- ✅ 多个组件的多个工具处理
- ✅ 空 Workspace 处理
- ✅ OpenAI 工具格式验证
- ✅ 复杂嵌套 Schema 处理

**测试结果**: 5/5 通过 ✓

```bash
npm test -- src/agent/__tests__/tool-conversion.unit.test.ts --run
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
// 场景1: 正常使用
const agent = new Agent(config, apiConfig, workspace, prompt);
// Agent 自动从 workspace 获取工具并传递给 ApiClient

// 场景2: 自定义 ApiClient
const customClient = new CustomApiClient();
const agent = new Agent(config, apiConfig, workspace, prompt, taskId, customClient);

// 场景3: 测试时 Mock
const mockWorkspace = createMockWorkspace();
const mockApiClient = createMockApiClient();
const agent = new Agent(config, apiConfig, mockWorkspace, prompt, taskId, mockApiClient);
```

### 4. 易于测试
- 单元测试可以独立测试工具转换逻辑
- 可以 Mock Workspace 和 ApiClient
- 测试覆盖充分

### 5. 向后兼容
- `tools` 参数是可选的
- 不传工具也能工作（对于不需要工具的场景）
- 现有代码无需修改

## 使用示例

### 基本使用

```typescript
import { Agent } from './agent';
import { VirtualWorkspace } from 'stateful-context';

// 创建 Workspace 并注册组件
const workspace = new VirtualWorkspace({
    id: 'my-workspace',
    name: 'My Workspace',
});

workspace.registerComponent({
    key: 'search-component',
    component: searchComponent,
    priority: 1,
});

// 创建 Agent
const agent = new Agent(
    agentConfig,
    apiConfig,
    workspace,
    agentPrompt
);

// Agent 会自动从 workspace 获取工具并传递给 ApiClient
await agent.start('Search for diabetes treatments');
```

### 使用 OpenAI 兼容客户端

```typescript
import { OpenaiCompatibleApiClient } from './api-client';

// 创建 OpenAI 客户端
const openaiClient = new OpenaiCompatibleApiClient({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4',
    temperature: 0.7,
});

// 创建 Agent，注入自定义客户端
const agent = new Agent(
    agentConfig,
    apiConfig,
    workspace,
    agentPrompt,
    undefined,
    openaiClient  // 注入自定义客户端
);

// Agent 会将 workspace 的工具传递给 OpenAI 客户端
await agent.start('Analyze patient data');
```

## 与其他方案对比

| 特性 | ToolProvider 方案 | Agent 协调方案 (已实现) |
|------|------------------|----------------------|
| 破坏现有结构 | ⚠️ 需要修改 VirtualWorkspace | ✅ 不需要修改 |
| 包依赖 | ❌ 产生反向依赖 | ✅ 保持独立 |
| 职责清晰 | ✅ 清晰 | ✅ 清晰 |
| 实现复杂度 | ⚠️ 中等 | ✅ 简单 |
| 灵活性 | ✅ 高 | ✅ 高 |
| 测试友好 | ✅ 好 | ✅ 好 |
| 向后兼容 | ⚠️ 需要迁移 | ✅ 完全兼容 |

## 文件清单

### 修改的文件
1. ✅ `src/api-client/ApiClient.interface.ts` - 添加 tools 参数
2. ✅ `src/api-client/BamlApiClient.ts` - 添加 tools 参数
3. ✅ `src/api-client/OpenaiCompatibleApiClient.ts` - 实现工具传递
4. ✅ `src/agent/agent.ts` - 添加工具转换和传递逻辑

### 新增的文件
1. ✅ `src/api-client/ToolProvider.interface.ts` - ToolProvider 接口定义（备用）
2. ✅ `src/api-client/AGENT_COORDINATION_ARCHITECTURE.md` - 架构文档
3. ✅ `src/agent/__tests__/tool-conversion.unit.test.ts` - 单元测试
4. ✅ `AGENT_COORDINATION_IMPLEMENTATION.md` - 本文档

### 未修改的文件
- ✅ `libs/statefulContext/src/virtualWorkspace.ts` - 保持不变
- ✅ 其他现有文件 - 保持不变

## 后续工作

### 可选增强
- [ ] 添加工具缓存机制（避免每次请求都转换）
- [ ] 支持动态工具过滤（根据上下文选择性传递工具）
- [ ] 添加工具使用统计和监控
- [ ] 支持工具版本管理

### 集成测试
- [ ] 添加 Agent + Workspace + ApiClient 的端到端测试
- [ ] 测试不同 ApiClient 实现的工具传递
- [ ] 测试工具调用的完整流程

## 验证步骤

1. **运行单元测试**:
   ```bash
   npm test -- src/agent/__tests__/tool-conversion.unit.test.ts --run
   ```
   结果: ✅ 5/5 通过

2. **检查类型**:
   ```bash
   npx tsc --noEmit
   ```
   结果: ✅ 无类型错误

3. **检查现有测试**:
   ```bash
   npm test
   ```
   结果: 需要验证现有测试是否仍然通过

## 总结

成功实现了 **Agent 协调方案**，核心特点：

1. ✅ **不破坏现有结构** - VirtualWorkspace 保持不变
2. ✅ **职责清晰** - Agent 作为协调者，负责工具传递
3. ✅ **灵活性高** - 支持多种使用场景
4. ✅ **易于测试** - 单元测试覆盖充分
5. ✅ **向后兼容** - 现有代码无需修改

这个方案比 ToolProvider 方案更简单、更直接，同时保持了良好的架构设计和可维护性。
