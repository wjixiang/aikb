# Turn-Based Memory: 历史会话获取指南

## 快速参考

### 1. 获取所有历史消息（最常用）

```typescript
// 获取所有 Turn 的所有消息，按时间顺序展平
const allMessages = memoryModule.getAllMessages();
// 返回: ApiMessage[]
```

**使用场景**: 需要完整的对话历史时

---

### 2. 获取特定 Turn 的完整信息

```typescript
// 按 Turn 编号获取
const turn = memoryModule.getTurnStore().getTurnByNumber(2);

// Turn 对象包含:
turn.messages           // 该 Turn 的所有消息
turn.workspaceContext   // { before: string, after?: string }
turn.toolCalls          // 工具调用记录
turn.summary            // LLM 生成的摘要
turn.insights           // 提取的洞察
turn.thinkingPhase      // 思考阶段数据
turn.status             // Turn 状态
turn.tokenUsage         // Token 使用统计
```

**使用场景**: 需要某个特定回合的完整上下文时

---

### 3. 获取最近 N 个 Turn 的消息

```typescript
// 获取最近 3 个 Turn 的所有消息
const recentMessages = memoryModule.getTurnStore().getRecentMessages(3);
// 返回: ApiMessage[]
```

**使用场景**: 只需要最近几轮对话时（节省内存）

---

### 4. 获取所有 Turn 对象

```typescript
// 获取所有 Turn（包含完整信息）
const allTurns = memoryModule.getTurnStore().getAllTurns();
// 返回: Turn[]

// 遍历处理
allTurns.forEach(turn => {
    console.log(`Turn ${turn.turnNumber}:`, turn.messages.length, 'messages');
});
```

**使用场景**: 需要分析每个 Turn 的详细信息时

---

### 5. 回忆特定 Turn（用于 Prompt 注入）

```typescript
// 回忆 Turn 1, 3, 5 的消息
const recalled = memoryModule.recallTurns([1, 3, 5]);

// 这些消息会被临时存储，用于下次 API 请求
const historyForPrompt = memoryModule.getHistoryForPrompt();
```

**使用场景**:
- LLM 需要回忆特定历史上下文
- 实现 RAG（检索增强生成）
- 长对话中选择性注入历史

---

### 6. 搜索包含关键词的 Turn

```typescript
// 在摘要和洞察中搜索
const turns = memoryModule.getTurnStore().searchTurns('authentication');
// 返回: Turn[]
```

**使用场景**: 需要找到讨论特定主题的历史回合

---

### 7. 获取累积摘要

```typescript
// 获取所有 Turn 的摘要（格式化字符串）
const summaries = memoryModule.getAccumulatedSummaries();
// 返回格式化的摘要文本
```

**使用场景**: 需要快速了解整个对话的概要

---

### 8. 获取最近 N 个 Turn 对象

```typescript
// 获取最近 2 个 Turn（完整对象）
const recentTurns = memoryModule.getTurnStore().getRecentTurns(2);
// 返回: Turn[]
```

**使用场景**: 需要最近几个 Turn 的完整信息（不仅是消息）

---

## 对比：旧 vs 新

### 旧架构（ContextMemoryStore）
```typescript
// 只能获取展平的消息
const history = memoryModule.getConversationHistory();

// 无法直接获取某个回合的完整信息
// 无法知道消息属于哪个 Turn
```

### 新架构（Turn-based）
```typescript
// 可以获取展平的消息（向后兼容）
const history = memoryModule.getAllMessages();

// 也可以按 Turn 获取
const turn = memoryModule.getTurnStore().getTurnByNumber(2);
console.log(turn.messages);           // 该 Turn 的消息
console.log(turn.workspaceContext);   // 该 Turn 的上下文
console.log(turn.toolCalls);          // 该 Turn 的工具调用

// 清晰的对应关系！
```

---

## 常见使用模式

### 模式 1: 显示对话历史（UI）
```typescript
const allMessages = memoryModule.getAllMessages();
allMessages.forEach(msg => {
    console.log(`[${msg.role}] ${extractText(msg.content)}`);
});
```

### 模式 2: 分析每个回合的效果
```typescript
const allTurns = memoryModule.getTurnStore().getAllTurns();
allTurns.forEach(turn => {
    console.log(`Turn ${turn.turnNumber}:`);
    console.log(`  Input: ${turn.workspaceContext.before}`);
    console.log(`  Output: ${turn.workspaceContext.after}`);
    console.log(`  Tools used: ${turn.toolCalls.map(t => t.toolName).join(', ')}`);
});
```

### 模式 3: 实现滑动窗口（只保留最近 N 轮）
```typescript
// 获取最近 5 个 Turn 的消息用于 prompt
const recentMessages = memoryModule.getTurnStore().getRecentMessages(5);
```

### 模式 4: 导出/导入会话
```typescript
// 导出
const exported = memoryModule.export();
localStorage.setItem('session', JSON.stringify(exported));

// 导入
const data = JSON.parse(localStorage.getItem('session'));
memoryModule.import(data);
```

---

## API 速查表

| 方法 | 返回类型 | 说明 |
|------|---------|------|
| `getAllMessages()` | `ApiMessage[]` | 所有消息（展平） |
| `getTurnStore().getTurnByNumber(n)` | `Turn \| undefined` | 获取第 N 个 Turn |
| `getTurnStore().getAllTurns()` | `Turn[]` | 所有 Turn 对象 |
| `getTurnStore().getRecentTurns(n)` | `Turn[]` | 最近 N 个 Turn |
| `getTurnStore().getRecentMessages(n)` | `ApiMessage[]` | 最近 N 个 Turn 的消息 |
| `recallTurns([1,3,5])` | `ApiMessage[]` | 回忆特定 Turn |
| `getTurnStore().searchTurns(keyword)` | `Turn[]` | 搜索 Turn |
| `getAccumulatedSummaries()` | `string` | 格式化的摘要 |
| `export()` | `TurnMemoryExport` | 导出所有数据 |
| `import(data)` | `void` | 导入数据 |

---

## 总结

新的 Turn-based 架构提供了：
- ✅ **更清晰的结构**: 每个 Turn 包含完整信息
- ✅ **更灵活的检索**: 可以按 Turn 或展平获取
- ✅ **更好的追溯**: 知道每条消息属于哪个 Turn
- ✅ **向后兼容**: 旧的 API 仍然可用
- ✅ **更丰富的上下文**: 包含工作空间上下文、工具调用等

推荐使用 Turn-based API 来充分利用新架构的优势！
