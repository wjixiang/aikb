# Action 环节 Summaries 注入分析

## 结论

✅ **Action 环节（工具调用环节）已经注入了每个 Turn 的 summaries**

## 代码分析

### 注入位置

**文件**: `agent.ts`
**方法**: `attemptApiRequest()` (line 699-708)

```typescript
async attemptApiRequest(retryAttempt: number = 0) {
    try {
        const systemPrompt = await this.getSystemPrompt();
        let workspaceContext = await this.workspace.render();

        // ✅ 注入累积的 summaries
        const accumulatedSummaries = this.memoryModule.getAccumulatedSummaries();
        if (accumulatedSummaries) {
            workspaceContext = `${accumulatedSummaries}\n\n=== CURRENT WORKSPACE CONTEXT ===\n${workspaceContext}`;
        }

        // Get conversation history for prompt
        const conversationHistory = this.memoryModule.getHistoryForPrompt();

        // Build prompt
        const prompt: FullPrompt = new PromptBuilder()
            .setSystemPrompt(systemPrompt)
            .setWorkspaceContext(workspaceContext)  // ← 包含 summaries
            .setConversationHistory(conversationHistory)
            .build();

        // Make API request
        const response = await this.apiClient.makeRequest(
            prompt.systemPrompt,
            prompt.workspaceContext,  // ← 传递给 LLM
            prompt.conversationHistory,
            // ...
        );
    }
}
```

### 注入方式

Summaries 被注入到 `workspaceContext` 的**开头**：

```
=== ACCUMULATED MEMORY SUMMARIES ===
[Turn 1] 分析了代码库结构，识别出三个核心模块
Insights: 发现三个核心模块; agent 负责执行; memory 负责存储

[Turn 2] 基于之前的结构分析，优化了 memory 模块性能
Insights: memory 模块性能瓶颈; 算法复杂度 O(n²); 需要优化

=== CURRENT WORKSPACE CONTEXT ===
[当前工作空间的实际内容]
```

## 完整的信息流

### Thinking 环节（思考阶段）

**调用**: `memoryModule.performThinkingPhase()`

**输入内容**:
```typescript
{
    systemPrompt: "You are in the THINKING phase...",

    context: `
        === TASK CONTEXT ===
        User's Goal: [用户的初始任务]

        === WORKSPACE CONTEXT ===
        [当前工作空间状态]

        === ACCUMULATED MEMORY SUMMARIES ===
        [Turn 1] [summary]
        [Turn 2] [summary]
        ...

        === PREVIOUS THINKING ROUNDS ===
        Round 1: [本次 Turn 的思考]
        Round 2: [本次 Turn 的思考]
    `,

    history: [
        "<user>...</user>",
        "<assistant>...</assistant>",
        ...
    ]
}
```

### Action 环节（工具调用阶段）

**调用**: `attemptApiRequest()`

**输入内容**:
```typescript
{
    systemPrompt: "[Agent 的 capability + direction]",

    workspaceContext: `
        === ACCUMULATED MEMORY SUMMARIES ===
        [Turn 1] [summary]
        [Turn 2] [summary]
        ...

        === CURRENT WORKSPACE CONTEXT ===
        [当前工作空间状态]
    `,

    conversationHistory: [
        // 默认为空（summary-only 模式）
        // 或者通过 recall 主动回忆的消息
    ]
}
```

## 对比分析

### Thinking 环节 vs Action 环节

| 维度 | Thinking 环节 | Action 环节 |
|------|--------------|------------|
| **Task Context** | ✅ 有（第一个 Turn） | ❌ 无 |
| **Accumulated Summaries** | ✅ 有 | ✅ 有 |
| **Workspace Context** | ✅ 有 | ✅ 有 |
| **Previous Thinking Rounds** | ✅ 有（当前 Turn） | ❌ 无 |
| **Conversation History** | ✅ 有（完整） | ⚠️ 默认无（summary-only） |
| **Tools** | 2 个（continue_thinking, recall_context） | N 个（workspace 提供的所有工具） |

### 关键差异

1. **Task Context**
   - Thinking: ✅ 有 - 让 LLM 知道整体目标
   - Action: ❌ 无 - **可能需要添加**

2. **Previous Thinking Rounds**
   - Thinking: ✅ 有 - 保持思考的连贯性
   - Action: ❌ 无 - 思考结果通过 system message 添加到 history

3. **Conversation History**
   - Thinking: ✅ 完整历史
   - Action: ⚠️ Summary-only 模式（默认不注入，需要主动 recall）

## 潜在问题

### 问题 1：Action 环节缺少 Task Context

**当前情况**:
```typescript
// Action 环节的输入
workspaceContext: `
    === ACCUMULATED MEMORY SUMMARIES ===
    [Turn 1] ...
    [Turn 2] ...

    === CURRENT WORKSPACE CONTEXT ===
    [workspace state]
`
```

**问题**:
- LLM 在 action 环节看不到用户的初始任务目标
- 可能导致工具调用偏离任务目标

**示例场景**:
```
用户任务: "搜索 SGLT2 抑制剂对心血管结局的影响"

Turn 1 Thinking: 看到 task context，理解要搜索什么
Turn 1 Action: 看不到 task context，只能依赖 summaries

如果 summary 不够详细，LLM 可能不清楚具体要搜索什么
```

### 问题 2：思考结果的传递方式

**当前实现**:
```typescript
// 思考完成后，添加 system message
if (memoryResult.rounds.length > 0) {
    const thinkingSummary = this.formatMemoryThinkingSummary(memoryResult);
    this.memoryModule.addSystemMessage(thinkingSummary);
}
```

这个 system message 会被添加到 conversation history，在 action 环节可以看到。

## 改进建议

### 建议 1：在 Action 环节也注入 Task Context

**修改位置**: `agent.ts` - `attemptApiRequest()`

```typescript
async attemptApiRequest(retryAttempt: number = 0) {
    try {
        const systemPrompt = await this.getSystemPrompt();
        let workspaceContext = await this.workspace.render();

        // Inject accumulated summaries
        const accumulatedSummaries = this.memoryModule.getAccumulatedSummaries();

        // ✅ 新增：注入 task context
        const currentTurn = this.memoryModule.getCurrentTurn();
        const taskContext = currentTurn?.taskContext
            ? `=== TASK CONTEXT ===\nUser's Goal: ${currentTurn.taskContext}\n\n`
            : '';

        if (accumulatedSummaries || taskContext) {
            workspaceContext = `${taskContext}${accumulatedSummaries}\n\n=== CURRENT WORKSPACE CONTEXT ===\n${workspaceContext}`;
        }

        // ... rest of the code
    }
}
```

**效果**:
```
=== TASK CONTEXT ===
User's Goal: 搜索关于 SGLT2 抑制剂对 2 型糖尿病患者心血管结局影响的文献

=== ACCUMULATED MEMORY SUMMARIES ===
[Turn 1] ...

=== CURRENT WORKSPACE CONTEXT ===
[workspace state]
```

### 建议 2：在 System Prompt 中强调任务目标

**修改位置**: `agent.ts` - `getSystemPrompt()`

```typescript
async getSystemPrompt(): Promise<string> {
    const currentTurn = this.memoryModule.getCurrentTurn();
    const taskReminder = currentTurn?.taskContext
        ? `\n\nREMINDER: The user's overall goal is: "${currentTurn.taskContext}"\nEnsure all actions align with this goal.`
        : '';

    return `${this.prompt.capability}

${this.prompt.direction}${taskReminder}`;
}
```

## 总结

### 当前状态

✅ **Action 环节已经注入 summaries**
- 通过 `getAccumulatedSummaries()` 获取
- 注入到 `workspaceContext` 的开头
- LLM 可以看到所有既往 turns 的摘要

### 信息完整性

| 信息类型 | Thinking 环节 | Action 环节 | 建议 |
|---------|--------------|------------|------|
| Task Context | ✅ | ❌ | 建议添加 |
| Accumulated Summaries | ✅ | ✅ | 已有 |
| Workspace Context | ✅ | ✅ | 已有 |
| Thinking Rounds | ✅ | ⚠️ (via system msg) | 当前方式可行 |
| Conversation History | ✅ | ⚠️ (summary-only) | 当前设计合理 |

### 推荐改进

**优先级 1**: 在 Action 环节注入 Task Context
- 成本：可忽略（~50-100 tokens）
- 收益：确保工具调用对齐任务目标

**优先级 2**: 在 System Prompt 中强调任务目标
- 成本：可忽略
- 收益：提醒 LLM 始终关注整体目标

这两个改进可以进一步提升 Agent 的任务执行准确性和连贯性。
