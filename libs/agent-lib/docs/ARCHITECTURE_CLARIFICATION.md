# Agent 历史Context管理架构说明

## 当前架构概览

Agent 的历史Context管理实际上是**分层的**，不是全部由 MemoryModule 管理：

```
┌─────────────────────────────────────────────────────────────┐
│                         Agent                                │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  _conversationHistory: ApiMessage[]                │    │
│  │  (对话历史 - Agent自己管理)                        │    │
│  │  - user messages                                    │    │
│  │  - assistant messages                               │    │
│  │  - tool results                                     │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  memoryModule?: MemoryModule (可选)                │    │
│  │  (增强记忆 - 仅在配置时启用)                       │    │
│  │                                                      │    │
│  │  ┌──────────────────────────────────────────────┐  │    │
│  │  │  ContextMemoryStore                          │  │    │
│  │  │  - 存储完整的 Workspace Context              │  │    │
│  │  │  - 存储 LLM 生成的摘要                       │  │    │
│  │  │  - 提供搜索和回忆功能                        │  │    │
│  │  └──────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 两层管理机制

### 第一层：Agent 自己的对话历史（始终存在）

**位置**：`Agent._conversationHistory`

**内容**：
```typescript
private _conversationHistory: ApiMessage[] = [];
```

**存储的是**：
- User 消息（用户输入）
- Assistant 消息（LLM 响应，包含 tool_use）
- Tool result 消息（工具执行结果）

**特点**：
- ✅ 始终存在，无论是否启用 MemoryModule
- ✅ 用于构建每次 API 请求的 prompt
- ✅ 会被 ThinkingProcessor 或 MemoryModule 压缩
- ❌ **不包含** 完整的 Workspace Context
- ❌ **不包含** 摘要信息

**示例**：
```typescript
[
  { role: 'user', content: [{ type: 'text', text: '<task>分析代码</task>' }] },
  { role: 'assistant', content: [{ type: 'tool_use', name: 'search', ... }] },
  { role: 'user', content: [{ type: 'tool_result', content: '...' }] },
  // ...
]
```

### 第二层：MemoryModule 的增强记忆（可选）

**位置**：`Agent.memoryModule?.memoryStore`

**内容**：
```typescript
class ContextMemoryStore {
  private contexts: Map<string, ContextSnapshot>;  // 完整的 Workspace Context
  private summaries: Map<string, MemorySummary>;   // LLM 生成的摘要
}
```

**存储的是**：
- 每一轮的**完整 Workspace Context**（文件内容、状态等）
- LLM 生成的**摘要和洞察**
- 上下文之间的**关联关系**

**特点**：
- ⚠️ 仅在配置 `config.memory` 时启用
- ✅ 存储完整的 Workspace Context（不在对话历史中）
- ✅ 提供搜索和回忆功能
- ✅ 支持持久化（导出/导入）
- ✅ 摘要会被注入到 prompt 中

**示例**：
```typescript
{
  contexts: {
    'ctx_1_xxx': {
      id: 'ctx_1_xxx',
      turnNumber: 1,
      fullContext: `
        Files: [main.ts, utils.ts]
        State: { initialized: true }
        Content: ...
      `,
      summary: '分析了代码库结构',
    }
  },
  summaries: {
    'sum_ctx_1_xxx': {
      summary: '分析了代码库结构，发现3个模块',
      insights: ['3个模块', 'main.ts是入口'],
    }
  }
}
```

## 数据流对比

### 标准模式（无 MemoryModule）

```
每轮循环：
1. 获取 workspace.render() → workspaceContext (临时)
2. ThinkingProcessor 压缩 _conversationHistory
3. 构建 prompt:
   - systemPrompt
   - workspaceContext (当前的，fresh)
   - _conversationHistory (压缩后)
4. 调用 LLM
5. 更新 _conversationHistory
6. workspaceContext 被丢弃 ❌
```

**问题**：
- ❌ 历史的 Workspace Context 丢失
- ❌ 无法回忆之前的完整上下文
- ❌ 每轮都要重新分析

### 启用 MemoryModule

```
每轮循环：
1. 获取 workspace.render() → workspaceContext
2. MemoryModule.performThinkingPhase():
   a. 存储 workspaceContext 到 ContextMemoryStore ✅
   b. 执行多轮思考
   c. 生成摘要并存储 ✅
   d. 获取累积摘要
3. 构建 prompt:
   - systemPrompt
   - 累积摘要 (所有历史摘要) ✅
   - workspaceContext (当前的)
   - _conversationHistory (压缩后)
4. 调用 LLM (可以使用 recall_context 工具回忆历史)
5. 更新 _conversationHistory
```

**优势**：
- ✅ 历史 Workspace Context 完整保存
- ✅ 可以精确回忆任何历史上下文
- ✅ 摘要累积提供历史脉络
- ✅ Token 效率高（摘要 << 完整上下文）

## 具体示例

### 场景：3轮对话

#### Turn 1: 分析代码

**Agent._conversationHistory**:
```typescript
[
  { role: 'user', content: '<task>分析代码</task>' },
  { role: 'assistant', content: [tool_use: search] },
  { role: 'user', content: [tool_result: '...'] },
]
```

**MemoryModule (如果启用)**:
```typescript
contexts: {
  'ctx_1': {
    fullContext: `
      Files: [main.ts, utils.ts, config.ts]
      Content of main.ts: ...
      Content of utils.ts: ...
      State: { initialized: true }
    `,
    summary: '分析了代码库结构'
  }
}
```

---

#### Turn 2: 发现问题

**Agent._conversationHistory**:
```typescript
[
  { role: 'user', content: '<task>分析代码</task>' },
  { role: 'assistant', content: [tool_use: search] },
  { role: 'user', content: [tool_result: '...'] },
  // Turn 2 新增
  { role: 'assistant', content: [tool_use: read] },
  { role: 'user', content: [tool_result: '...'] },
]
```

**MemoryModule (如果启用)**:
```typescript
contexts: {
  'ctx_1': { ... },  // Turn 1 的完整上下文
  'ctx_2': {         // Turn 2 的完整上下文
    fullContext: `
      Files: [main.ts, utils.ts, config.ts, benchmark.ts]
      Content of benchmark.ts: ...
      State: { initialized: true, benchmarked: true }
    `,
    summary: '发现性能瓶颈'
  }
}

// 累积摘要会注入到 prompt:
[Turn 1] 分析了代码库结构
[Turn 2] 发现性能瓶颈
```

---

#### Turn 3: 实施优化

**Agent._conversationHistory**:
```typescript
[
  // ... 前面的消息
  // Turn 3 新增
  { role: 'assistant', content: [tool_use: edit] },
  { role: 'user', content: [tool_result: '...'] },
]
```

**MemoryModule (如果启用)**:
```typescript
contexts: {
  'ctx_1': { ... },  // Turn 1
  'ctx_2': { ... },  // Turn 2
  'ctx_3': {         // Turn 3
    fullContext: `
      Files: [main.ts, utils.ts, config.ts, benchmark.ts]
      Content of utils.ts: ... (已优化)
      State: { initialized: true, benchmarked: true, optimized: true }
    `,
    summary: '实施了优化'
  }
}

// 累积摘要:
[Turn 1] 分析了代码库结构
[Turn 2] 发现性能瓶颈
[Turn 3] 实施了优化

// LLM 可以回忆:
recall_context({ turnNumbers: [2] })
→ 返回 ctx_2 的完整 Workspace Context
```

## 关键区别总结

| 特性 | Agent._conversationHistory | MemoryModule.memoryStore |
|-----|---------------------------|-------------------------|
| **存在条件** | 始终存在 | 仅在配置时启用 |
| **存储内容** | 对话消息（user/assistant/tool_result） | 完整 Workspace Context + 摘要 |
| **Workspace Context** | ❌ 不存储 | ✅ 完整存储 |
| **文件内容** | ❌ 不存储 | ✅ 存储 |
| **摘要** | ❌ 无 | ✅ LLM 生成 |
| **搜索功能** | ❌ 无 | ✅ 按关键词搜索 |
| **回忆功能** | ❌ 无 | ✅ 精确回忆 |
| **持久化** | ❌ 无 | ✅ 支持导出/导入 |
| **注入 Prompt** | ✅ 直接注入（压缩后） | ✅ 摘要注入 |
| **Token 消耗** | 中等（压缩后） | 低（仅摘要） |

## 为什么需要两层？

### Agent._conversationHistory 的作用
- 维护对话的**逻辑流程**
- 记录 LLM 的**决策过程**（使用了哪些工具）
- 提供**上下文连续性**

### MemoryModule 的作用
- 保存**完整的工作环境**（Workspace Context）
- 提供**长期记忆**能力
- 支持**精确回忆**特定时刻的状态
- 通过**摘要**提供高效的历史概览

## 实际使用建议

### 场景1：简单任务（1-3轮对话）
```typescript
// 不需要 MemoryModule
const config = {
  apiRequestTimeout: 40000,
  // 不配置 memory
};
```
**原因**：对话历史足够，不需要额外的记忆管理

### 场景2：复杂任务（5-10轮对话）
```typescript
// 启用 MemoryModule
const config = {
  apiRequestTimeout: 40000,
  memory: {
    enableReflectiveThinking: true,
    maxThinkingRounds: 5,
    // ...
  },
};
```
**原因**：需要回忆历史上下文，摘要提供高效的历史概览

### 场景3：长期任务（跨会话）
```typescript
// 启用 MemoryModule + 持久化
const config = {
  memory: { /* ... */ },
};

const agent = new Agent(config, ...);

// 导入之前的记忆
const memoryModule = agent.getMemoryModule();
memoryModule?.import(savedMemory);

// 执行任务
await agent.start('继续之前的工作');

// 导出记忆
const memory = memoryModule?.export();
await saveToDatabase(memory);
```
**原因**：需要跨会话保持记忆

## 总结

**回答你的问题**：

> 目前 agent模块的所有历史Context的管理全部都是透过 MemoryModule 实现的吗？

**答案**：❌ **不是的**

- **Agent._conversationHistory** 管理**对话历史**（始终存在）
- **MemoryModule** 管理**完整的 Workspace Context 和摘要**（可选启用）

两者是**互补**的，不是替代关系：
- 对话历史提供**逻辑流程**
- MemoryModule 提供**完整记忆**和**高效回忆**

这种设计既保持了向后兼容（不启用 MemoryModule 时完全正常工作），又提供了强大的增强功能（启用时获得完整记忆能力）。
