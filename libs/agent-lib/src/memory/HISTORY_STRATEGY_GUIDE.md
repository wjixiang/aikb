# 历史策略使用指南

## 概述

MemoryModule 现在支持三种历史策略，用于控制如何将对话历史注入到 prompt 中：

1. **recent-only** (推荐，默认) - 摘要 + 最近对话
2. **compressed** - 压缩的完整历史
3. **summary-only** - 仅使用摘要

## 策略对比

### 1. recent-only（推荐）⭐

**描述**: 使用累积摘要 + 最近 N 轮的完整对话

**Prompt 结构**:
```
=== ACCUMULATED MEMORY SUMMARIES ===
[Turn 1] 分析了代码库结构，发现3个模块
[Turn 2] 识别了性能瓶颈在 utils.ts
[Turn 3-7] ...

=== CURRENT WORKSPACE CONTEXT ===
Files: [...]

=== CONVERSATION HISTORY ===
<user>最近的用户消息</user>
<assistant>最近的助手响应</assistant>
<user>最新的用户消息</user>
```

**Token 使用** (10轮对话):
- 摘要: ~500 tokens
- 最近3轮对话: ~400 tokens
- **总计: ~900 tokens**

**优势**:
- ✅ 大幅减少 token（比压缩历史节省 ~64%）
- ✅ 保留历史脉络（通过摘要）
- ✅ 保持最近对话的连续性
- ✅ 平衡效率和质量

**适用场景**:
- 大多数任务（5-20 轮对话）
- Token 预算有限
- 需要历史上下文

**配置**:
```typescript
memory: {
    historyStrategy: 'recent-only',
    recentConversationRounds: 3,  // 保留最近3轮
}
```

---

### 2. compressed

**描述**: 压缩整个对话历史（保留第一条 + 最近 N 条消息）

**Prompt 结构**:
```
=== ACCUMULATED MEMORY SUMMARIES ===
[Turn 1-10] ...

=== CURRENT WORKSPACE CONTEXT ===
Files: [...]

=== CONVERSATION HISTORY ===
<user>第一条消息（任务）</user>
<assistant>...</assistant>
...
<user>最近的消息</user>
<assistant>最近的响应</assistant>
```

**Token 使用** (10轮对话):
- 摘要: ~500 tokens
- 压缩历史: ~2000 tokens
- **总计: ~2500 tokens**

**优势**:
- ✅ 保留完整的对话流程
- ✅ 向后兼容旧行为

**劣势**:
- ❌ Token 消耗较高
- ❌ 仍有信息重复

**适用场景**:
- 需要完整对话历史的任务
- 向后兼容

**配置**:
```typescript
memory: {
    historyStrategy: 'compressed',
    compressionStrategy: 'sliding-window',
    compressionThreshold: 8000,
}
```

---

### 3. summary-only

**描述**: 仅使用累积摘要，不包含对话历史

**Prompt 结构**:
```
=== ACCUMULATED MEMORY SUMMARIES ===
[Turn 1] 分析了代码库结构，发现3个模块
[Turn 2] 识别了性能瓶颈在 utils.ts
[Turn 3-10] ...

=== CURRENT WORKSPACE CONTEXT ===
Files: [...]

=== CONVERSATION HISTORY ===
(空)
```

**Token 使用** (10轮对话):
- 摘要: ~500 tokens
- 对话历史: 0 tokens
- **总计: ~500 tokens**

**优势**:
- ✅ 最大化 token 节省
- ✅ 适合超长对话

**劣势**:
- ❌ 丢失最近对话细节
- ❌ 可能影响上下文连续性
- ❌ 依赖摘要质量

**适用场景**:
- 超长任务（50+ 轮）
- Token 预算极度紧张
- 摘要质量高

**配置**:
```typescript
memory: {
    historyStrategy: 'summary-only',
    enableSummarization: true,  // 必须启用
}
```

## 使用示例

### 示例 1: 默认配置（推荐）

```typescript
import { Agent, AgentConfig } from './agent';

const config: AgentConfig = {
    apiRequestTimeout: 40000,
    maxRetryAttempts: 3,
    consecutiveMistakeLimit: 3,

    // 使用默认配置（recent-only）
    memory: {
        enableSummarization: true,
        // historyStrategy: 'recent-only',  // 默认值
        // recentConversationRounds: 3,     // 默认值
    },
};

const agent = new Agent(config, workspace, prompt, apiClient);
```

### 示例 2: 调整最近对话轮数

```typescript
const config: AgentConfig = {
    apiRequestTimeout: 40000,
    maxRetryAttempts: 3,
    consecutiveMistakeLimit: 3,

    memory: {
        historyStrategy: 'recent-only',
        recentConversationRounds: 5,  // 保留最近5轮（更多上下文）
    },
};
```

### 示例 3: 使用压缩历史（向后兼容）

```typescript
const config: AgentConfig = {
    apiRequestTimeout: 40000,
    maxRetryAttempts: 3,
    consecutiveMistakeLimit: 3,

    memory: {
        historyStrategy: 'compressed',
        compressionStrategy: 'token-budget',
        compressionThreshold: 8000,
    },
};
```

### 示例 4: 仅使用摘要（激进）

```typescript
const config: AgentConfig = {
    apiRequestTimeout: 40000,
    maxRetryAttempts: 3,
    consecutiveMistakeLimit: 3,

    memory: {
        historyStrategy: 'summary-only',
        enableSummarization: true,
        enableReflectiveThinking: true,  // 提高摘要质量
    },
};
```

## Token 效率对比

### 场景：10 轮对话

| 策略 | 摘要 | 对话历史 | 总计 | 节省 |
|-----|------|---------|------|------|
| compressed | 500 | 2000 | 2500 | 0% (基准) |
| recent-only | 500 | 400 | 900 | 64% ✅ |
| summary-only | 500 | 0 | 500 | 80% |

### 场景：50 轮对话

| 策略 | 摘要 | 对话历史 | 总计 | 节省 |
|-----|------|---------|------|------|
| compressed | 2500 | 2000 | 4500 | 0% (基准) |
| recent-only | 2500 | 400 | 2900 | 36% ✅ |
| summary-only | 2500 | 0 | 2500 | 44% |

### 场景：100 轮对话

| 策略 | 摘要 | 对话历史 | 总计 | 节省 |
|-----|------|---------|------|------|
| compressed | 5000 | 2000 | 7000 | 0% (基准) |
| recent-only | 5000 | 400 | 5400 | 23% ✅ |
| summary-only | 5000 | 0 | 5000 | 29% |

## 选择建议

### 根据对话轮数

- **5-20 轮**: `recent-only` (默认)
- **20-50 轮**: `recent-only` with `recentConversationRounds: 2`
- **50+ 轮**: `summary-only`

### 根据任务类型

- **代码分析**: `recent-only` (需要最近的工具调用细节)
- **长期规划**: `summary-only` (历史脉络更重要)
- **调试任务**: `compressed` (需要完整的对话流程)

### 根据 Token 预算

- **充足**: `compressed`
- **中等**: `recent-only` (推荐)
- **紧张**: `summary-only`

## 动态调整

可以在运行时调整策略：

```typescript
const agent = new Agent(config, workspace, prompt, apiClient);
const memoryModule = agent.getMemoryModule();

// 开始时使用 recent-only
memoryModule.updateConfig({
    historyStrategy: 'recent-only',
    recentConversationRounds: 3,
});

// 对话变长后切换到 summary-only
if (memoryModule.getMemoryStore().getCurrentTurn() > 50) {
    memoryModule.updateConfig({
        historyStrategy: 'summary-only',
    });
}
```

## 最佳实践

1. **默认使用 recent-only**
   - 适合大多数场景
   - 平衡效率和质量

2. **启用摘要**
   - 无论使用哪种策略，都应启用摘要
   - 摘要是历史脉络的关键

3. **监控 Token 使用**
   - 根据实际 token 消耗调整策略
   - 长对话考虑切换到 summary-only

4. **测试摘要质量**
   - summary-only 依赖摘要质量
   - 确保摘要准确反映历史

5. **考虑任务特点**
   - 需要精确对话细节：recent-only 或 compressed
   - 只需历史脉络：summary-only

## 总结

**推荐配置**:
```typescript
memory: {
    historyStrategy: 'recent-only',      // 默认策略
    recentConversationRounds: 3,         // 保留3轮
    enableSummarization: true,           // 启用摘要
    enableReflectiveThinking: false,     // 可选
}
```

这个配置在大多数场景下提供了最佳的 token 效率和上下文质量平衡！
