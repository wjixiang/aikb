# 使用 AccumulatedSummaries 替代 CompressedHistory 的方案

## 当前架构分析

### 当前的 Prompt 构成

```
Prompt = {
  systemPrompt: "...",
  workspaceContext: "
    === ACCUMULATED MEMORY SUMMARIES ===
    [Turn 1] 分析了代码库...
    [Turn 2] 发现性能瓶颈...

    === CURRENT WORKSPACE CONTEXT ===
    Files: [...]
    State: {...}
  ",
  memoryContext: [
    "<user>...</user>",      // 压缩后的对话历史
    "<assistant>...</assistant>",
    "<user>...</user>",
    ...
  ]
}
```

### 问题分析

1. **信息重复**
   - `accumulatedSummaries` 已经包含了历史脉络
   - `compressedHistory` 也包含了历史对话
   - 两者有信息重叠

2. **Token 浪费**
   - 压缩历史仍然占用较多 token
   - 摘要已经提供了足够的上下文

3. **复杂性**
   - 需要维护两套历史表示
   - 压缩策略增加了复杂度

## 改进方案

### 方案 A：完全使用摘要（激进）

**思路**：只使用 `accumulatedSummaries`，完全移除 `compressedHistory`

**优势**：
- ✅ 最大化 token 节省
- ✅ 架构最简单
- ✅ 摘要提供历史脉络

**劣势**：
- ❌ 丢失了最近几轮的详细对话
- ❌ LLM 无法看到工具调用的具体参数
- ❌ 可能影响上下文连续性

**适用场景**：
- 长期任务（10+ 轮对话）
- 摘要质量高
- 不需要精确的对话细节

---

### 方案 B：摘要 + 最近对话（推荐）⭐

**思路**：使用 `accumulatedSummaries` + 最近 N 轮的完整对话

```
Prompt = {
  systemPrompt: "...",
  workspaceContext: "
    === ACCUMULATED MEMORY SUMMARIES ===
    [Turn 1] 分析了代码库...
    [Turn 2] 发现性能瓶颈...
    [Turn 3-8] ...

    === CURRENT WORKSPACE CONTEXT ===
    Files: [...]
  ",
  memoryContext: [
    // 只保留最近 2-3 轮的完整对话
    "<user>最近的消息</user>",
    "<assistant>最近的响应</assistant>",
  ]
}
```

**优势**：
- ✅ 平衡了历史脉络和最近细节
- ✅ 大幅减少 token（只保留最近对话）
- ✅ 保持上下文连续性

**劣势**：
- ⚠️ 仍需要一定的压缩逻辑

**适用场景**：
- 大多数任务
- 需要平衡历史和细节

---

### 方案 C：摘要 + 回忆机制（最灵活）

**思路**：默认只使用摘要，LLM 需要时通过 `recall_context` 工具回忆详细对话

```
Prompt = {
  systemPrompt: "...",
  workspaceContext: "
    === ACCUMULATED MEMORY SUMMARIES ===
    [Turn 1] 分析了代码库...
    [Turn 2] 发现性能瓶颈...

    === CURRENT WORKSPACE CONTEXT ===
    Files: [...]
  ",
  memoryContext: []  // 空！LLM 需要时主动回忆
}

Tools: [
  recall_conversation({ turnNumbers: [1, 2] })  // 回忆特定轮次的对话
]
```

**优势**：
- ✅ 最大化 token 节省
- ✅ LLM 主动控制需要什么信息
- ✅ 灵活性最高

**劣势**：
- ❌ 增加了 LLM 的负担（需要主动回忆）
- ❌ 可能增加 API 调用次数
- ❌ 实现复杂度高

**适用场景**：
- 超长期任务（50+ 轮）
- Token 预算紧张
- LLM 能力强

---

## 推荐实现：方案 B

### 实现细节

```typescript
// MemoryModule 新增方法
getRecentConversation(count: number = 3): ApiMessage[] {
    // 只返回最近 N 轮的对话
    return this.conversationHistory.slice(-count * 2);  // 每轮包含 user + assistant
}

// Agent.attemptApiRequest 修改
async attemptApiRequest() {
    const systemPrompt = await this.getSystemPrompt();
    let workspaceContext = await this.workspace.render();

    // 注入累积摘要
    const accumulatedSummaries = this.memoryModule.getAccumulatedSummaries();
    if (accumulatedSummaries) {
        workspaceContext = `${accumulatedSummaries}\n\n=== CURRENT WORKSPACE CONTEXT ===\n${workspaceContext}`;
    }

    // 只使用最近 2-3 轮的对话（而不是压缩整个历史）
    const recentConversation = this.memoryModule.getRecentConversation(3);

    const prompt = new PromptBuilder()
        .setSystemPrompt(systemPrompt)
        .setWorkspaceContext(workspaceContext)
        .setConversationHistory(recentConversation)  // 只传最近对话
        .build();

    // ...
}
```

### Token 对比

**当前方案（压缩历史）**：
```
Turn 1-10 压缩后: ~2000 tokens
摘要: ~500 tokens
总计: ~2500 tokens
```

**方案 B（摘要 + 最近对话）**：
```
Turn 1-10 摘要: ~500 tokens
Turn 9-10 完整对话: ~400 tokens
总计: ~900 tokens
```

**节省**: 约 64% token！

---

## 配置选项

```typescript
export interface MemoryModuleConfig {
    // ... 现有配置

    // 新增：历史策略
    historyStrategy: 'compressed' | 'recent-only' | 'summary-only';

    // 新增：保留最近对话的轮数
    recentConversationRounds: number;  // 默认 3
}
```

### 使用示例

```typescript
// 策略 1: 压缩历史（当前方案）
memory: {
    historyStrategy: 'compressed',
    compressionStrategy: 'sliding-window',
}

// 策略 2: 摘要 + 最近对话（推荐）
memory: {
    historyStrategy: 'recent-only',
    recentConversationRounds: 3,
}

// 策略 3: 仅摘要（激进）
memory: {
    historyStrategy: 'summary-only',
}
```

---

## 实现步骤

### Step 1: MemoryModule 新增方法

```typescript
/**
 * Get recent conversation (last N rounds)
 */
getRecentConversation(rounds: number = 3): ApiMessage[] {
    if (this.conversationHistory.length === 0) {
        return [];
    }

    // 每轮通常包含 user + assistant 消息
    // 保守估计：每轮 2-3 条消息
    const messagesToKeep = rounds * 3;

    return this.conversationHistory.slice(-messagesToKeep);
}
```

### Step 2: 修改 Agent.attemptApiRequest

```typescript
async attemptApiRequest() {
    // ...

    // 根据配置选择历史策略
    let conversationHistory: ApiMessage[];

    const strategy = this.memoryModule.getConfig().historyStrategy || 'recent-only';

    switch (strategy) {
        case 'compressed':
            conversationHistory = this.memoryModule.getCompressedHistory();
            break;
        case 'recent-only':
            const rounds = this.memoryModule.getConfig().recentConversationRounds || 3;
            conversationHistory = this.memoryModule.getRecentConversation(rounds);
            break;
        case 'summary-only':
            conversationHistory = [];  // 只用摘要
            break;
        default:
            conversationHistory = this.memoryModule.getRecentConversation(3);
    }

    const prompt = new PromptBuilder()
        .setSystemPrompt(systemPrompt)
        .setWorkspaceContext(workspaceContext)
        .setConversationHistory(conversationHistory)
        .build();

    // ...
}
```

### Step 3: 更新默认配置

```typescript
export const defaultMemoryConfig: MemoryModuleConfig = {
    // ... 现有配置

    // 新增
    historyStrategy: 'recent-only',  // 默认使用方案 B
    recentConversationRounds: 3,     // 保留最近 3 轮
};
```

---

## 优势总结

### Token 效率

| 方案 | 10轮对话 | 50轮对话 | 100轮对话 |
|-----|---------|---------|----------|
| 当前（压缩） | ~2500 | ~3000 | ~3500 |
| 方案 B（推荐） | ~900 | ~1500 | ~2000 |
| 方案 A（激进） | ~500 | ~2500 | ~5000 |

### 架构简化

- ✅ 减少了压缩逻辑的复杂度
- ✅ 摘要成为主要的历史表示
- ✅ 最近对话提供必要的细节

### 灵活性

- ✅ 可配置的历史策略
- ✅ 可调整的最近对话轮数
- ✅ 支持不同场景的需求

---

## 建议

**推荐使用方案 B**：
1. 默认使用 `historyStrategy: 'recent-only'`
2. 保留最近 3 轮完整对话
3. 其余历史通过摘要提供

**理由**：
- 平衡了 token 效率和上下文质量
- 大幅减少 token 消耗（~64%）
- 保持了最近对话的连续性
- 实现复杂度适中

**适用场景**：
- ✅ 大多数任务（5-20 轮对话）
- ✅ 需要历史脉络的任务
- ✅ Token 预算有限的场景
