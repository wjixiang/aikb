# Summary 生成改进：增加历史连续性

## 问题描述

### 修改前

`generateSummary` 方法在生成当前 Turn 的摘要时，**没有**参考既往 turns 的 summaries：

```typescript
private async generateSummary(
    workspaceContext: string,
    thinkingRounds: ThinkingRound[],
    toolResults?: any[]
): Promise<string> {
    const summaryPrompt = `
WORKSPACE CONTEXT:
${workspaceContext.substring(0, 1000)}...

THINKING ROUNDS:
${thinkingRounds.map(r => `Round ${r.roundNumber}: ${r.content.substring(0, 200)}`).join('\n')}

TOOL RESULTS:
${toolResults?.map(r => `${r.toolName}: ${r.success ? 'success' : 'failed'}`).join('\n') || 'None'}

Generate a concise summary (2-3 sentences) of what happened in this turn.`;

    // ...
}
```

### 导致的问题

生成的 summary **缺乏连续性**，无法体现 turns 之间的关联：

**示例场景**：

```
Turn 1:
  思考: "分析代码库结构，发现三个核心模块"
  Summary: "分析了代码库，发现 agent、memory、workspace 三个核心模块"

Turn 2:
  思考: "基于之前的分析，深入研究 memory 模块，发现性能瓶颈"
  Summary 生成时看不到 Turn 1 的 summary
  Summary: "分析了 memory 模块，发现历史检索存在性能问题"
  ❌ 问题: 没有体现这是基于 Turn 1 的延续
```

理想的 Turn 2 Summary 应该是：
```
"基于之前对代码库的整体分析，深入研究了 memory 模块，
发现历史检索算法复杂度为 O(n²)，存在性能瓶颈"
```

## 解决方案

### 修改后

在 `generateSummary` 中添加既往 summaries 作为上下文：

```typescript
private async generateSummary(
    workspaceContext: string,
    thinkingRounds: ThinkingRound[],
    toolResults?: any[]
): Promise<string> {
    // ✅ 获取既往 summaries
    const previousSummaries = this.getAccumulatedSummaries();

    const summaryPrompt = `Summarize the following workspace context and thinking process into a concise summary (2-3 sentences).

${previousSummaries}  // ✅ 注入既往 summaries

WORKSPACE CONTEXT:
${workspaceContext.substring(0, 1000)}...

THINKING ROUNDS:
${thinkingRounds.map(r => `Round ${r.roundNumber}: ${r.content.substring(0, 200)}`).join('\n')}

TOOL RESULTS:
${toolResults?.map(r => `${r.toolName}: ${r.success ? 'success' : 'failed'}`).join('\n') || 'None'}

Generate a concise summary (2-3 sentences) of what happened in this turn. If this turn builds upon previous turns, mention the connection briefly.`;

    // ✅ 更新 system prompt
    const response = await this.apiClient.makeRequest(
        'You are a summarization assistant. Generate concise summaries that maintain narrative continuity.',
        summaryPrompt,
        // ...
    );
}
```

### 注入的内容格式

```
=== ACCUMULATED MEMORY SUMMARIES ===
[Turn 1] 分析了代码库，发现 agent、memory、workspace 三个核心模块
Insights: 发现三个核心模块; agent 负责执行; memory 负责存储

[Turn 2] 深入研究了 memory 模块，发现历史检索算法复杂度为 O(n²)
Insights: memory 模块性能瓶颈; 算法复杂度 O(n²); 需要优化

WORKSPACE CONTEXT:
[当前工作空间上下文]

THINKING ROUNDS:
[当前 Turn 的思考内容]

TOOL RESULTS:
[当前 Turn 的工具结果]
```

## 改进效果

### 1. 增强连续性

**修改前**：
```
Turn 1 Summary: "分析了代码库结构"
Turn 2 Summary: "优化了性能"
Turn 3 Summary: "添加了测试"
```
❌ 每个 summary 都是孤立的

**修改后**：
```
Turn 1 Summary: "分析了代码库结构，发现三个核心模块"
Turn 2 Summary: "基于之前的结构分析，优化了 memory 模块的性能瓶颈"
Turn 3 Summary: "为优化后的 memory 模块添加了性能测试，验证了 10x 提升"
```
✅ 形成连贯的叙事

### 2. 更好的上下文理解

LLM 在生成 summary 时可以：
- 了解之前做了什么
- 理解当前 Turn 在整个任务中的位置
- 识别因果关系和依赖关系
- 避免重复描述已经总结过的内容

### 3. 更有价值的历史记录

当后续 Turn 回顾历史时，可以看到：
```
=== ACCUMULATED MEMORY SUMMARIES ===
[Turn 1] 分析了代码库结构，发现三个核心模块
[Turn 2] 基于结构分析，优化了 memory 模块性能
[Turn 3] 为优化添加了测试，验证了效果
```

这形成了一个**连贯的故事线**，而不是孤立的事件列表。

## 成本分析

### Token 增加

每次生成 summary 时，额外的 token 消耗：

```
既往 summaries 数量 × (summary 长度 + insights 长度)
```

**示例计算**：
- 假设有 5 个既往 turns
- 每个 summary: 50 tokens
- 每个 insights: 30 tokens
- 额外成本: 5 × (50 + 30) = 400 tokens

**总成本**（Turn 6 生成 summary）：
- 修改前: ~450 tokens
- 修改后: ~850 tokens
- 增加: ~400 tokens (约 89% 增长)

### 成本权衡

| 维度 | 修改前 | 修改后 |
|------|--------|--------|
| **Token 成本** | 低 | 中等（随 Turn 数增长） |
| **Summary 质量** | 中等 | 高 |
| **连续性** | 无 | 强 |
| **可读性** | 中等 | 高 |

### 优化建议

如果成本是问题，可以考虑：

1. **限制历史数量**：
```typescript
const previousSummaries = this.getRecentSummaries(3); // 只取最近 3 个
```

2. **压缩 insights**：
```typescript
// 不包含 insights，只包含 summary
const summaryText = summaries
    .map(s => `[Turn ${s.turnNumber}] ${s.summary}`)
    .join('\n');
```

3. **条件性包含**：
```typescript
// 只在 Turn 数量 > 1 时才包含历史
if (this.turnStore.getCurrentTurnNumber() > 1) {
    previousSummaries = this.getAccumulatedSummaries();
}
```

## 对比：思考环节 vs Summary 生成

### 思考环节（已有历史）

```typescript
buildThinkingPrompt() {
    const accumulatedSummaries = this.getAccumulatedSummaries();

    const context = `
        === WORKSPACE CONTEXT ===
        ${workspaceContext}

        ${accumulatedSummaries}  // ✅ 已包含

        === PREVIOUS THINKING ROUNDS ===
        ${previousRounds}
    `;
}
```

### Summary 生成（现已添加）

```typescript
generateSummary() {
    const previousSummaries = this.getAccumulatedSummaries();  // ✅ 新增

    const summaryPrompt = `
        ${previousSummaries}  // ✅ 新增

        WORKSPACE CONTEXT:
        ${workspaceContext}

        THINKING ROUNDS:
        ${thinkingRounds}
    `;
}
```

现在两者都包含历史 summaries，保持了一致性。

## 实际效果示例

### 场景：多 Turn 代码优化任务

**Turn 1**:
```
思考: 分析代码库，识别模块结构
Summary: "分析了代码库结构，识别出 agent、memory、workspace 三个核心模块，
         其中 memory 模块负责对话历史管理"
```

**Turn 2**:
```
输入 Summary 生成时的上下文:
  [Turn 1] 分析了代码库结构，识别出三个核心模块...

思考: 深入分析 memory 模块，发现性能问题
Summary: "基于之前的模块分析，深入研究了 memory 模块的实现，
         发现历史检索算法复杂度为 O(n²)，在大量对话时存在性能瓶颈"
         ✅ 明确提到"基于之前的模块分析"
```

**Turn 3**:
```
输入 Summary 生成时的上下文:
  [Turn 1] 分析了代码库结构...
  [Turn 2] 基于之前的模块分析，深入研究了 memory 模块...

思考: 设计优化方案
Summary: "针对 Turn 2 发现的 O(n²) 性能瓶颈，设计了基于索引的优化方案，
         将检索复杂度降低到 O(log n)，预计可提升 10 倍性能"
         ✅ 明确提到"针对 Turn 2 发现的瓶颈"
```

**Turn 4**:
```
输入 Summary 生成时的上下文:
  [Turn 1] 分析了代码库结构...
  [Turn 2] 基于之前的模块分析，深入研究了 memory 模块...
  [Turn 3] 针对 Turn 2 发现的瓶颈，设计了优化方案...

思考: 实现优化并测试
Summary: "实现了 Turn 3 设计的索引优化方案，运行性能测试验证了 10 倍提升，
         所有单元测试和集成测试通过"
         ✅ 明确提到"Turn 3 设计的方案"
```

### 最终的历史记录

```
=== ACCUMULATED MEMORY SUMMARIES ===
[Turn 1] 分析了代码库结构，识别出 agent、memory、workspace 三个核心模块

[Turn 2] 基于之前的模块分析，深入研究了 memory 模块的实现，
         发现历史检索算法复杂度为 O(n²)

[Turn 3] 针对 Turn 2 发现的 O(n²) 性能瓶颈，设计了基于索引的优化方案

[Turn 4] 实现了 Turn 3 设计的索引优化方案，验证了 10 倍性能提升
```

✅ 形成了完整、连贯的任务执行故事

## 总结

### 修改内容
- ✅ 在 `generateSummary` 中添加 `getAccumulatedSummaries()` 调用
- ✅ 将既往 summaries 注入到 prompt 中
- ✅ 更新 system prompt，强调"保持叙事连续性"
- ✅ 在 prompt 中提示"如果基于之前的 Turn，简要提及连接"

### 优势
- ✅ Summary 之间形成连贯的叙事
- ✅ 更好地体现因果关系和依赖关系
- ✅ 避免重复描述已总结的内容
- ✅ 提供更有价值的历史记录

### 成本
- ⚠️ 每次生成 summary 增加约 400 tokens（5 个既往 turns）
- ⚠️ 成本随 Turn 数量线性增长

### 测试结果
- ✅ 所有测试通过
- ✅ 向后兼容（第一个 Turn 没有既往 summaries，返回空字符串）
