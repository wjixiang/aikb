# Deprecated 接口清理完成

## 清理内容

### 从 MemoryModule 中删除的 deprecated 方法

1. **`addToConversationHistory(message: ApiMessage)`**
   - 替代方法: `addUserMessage()`, `addAssistantMessage()`, `addSystemMessage()`
   - 原因: 新的 API 更明确，类型安全

2. **`getConversationHistory()`**
   - 替代方法: `getAllMessages()`
   - 原因: 名称更准确，反映 Turn-based 架构

3. **`setConversationHistory(history: ApiMessage[])`**
   - 替代方法: 无（不支持）
   - 原因: 与 Turn-based 架构不兼容

4. **`clearConversationHistory()`**
   - 替代方法: `clear()`
   - 原因: 统一的清理方法

5. **`recallConversation(options)`**
   - 替代方法: `recallTurns(turnNumbers: number[])`
   - 原因: 更简洁，专注于 Turn-based 回忆

6. **`getMemoryStore()`**
   - 替代方法: `getTurnStore()`
   - 原因: 名称更准确，反映新的存储结构

7. **`storeContext(workspaceContext, toolCalls)`**
   - 替代方法: 无（自动处理）
   - 原因: Context 现在在 `startTurn()` 时自动存储

### 从 Agent 中删除的 deprecated 方法

1. **`addToConversationHistory(message, reasoning)`**
   - 替代方法: 直接使用 `memoryModule.addUserMessage()` 等
   - 原因: 减少中间层，直接使用 MemoryModule API

2. **`getConversationHistory()`**
   - 替代方法: 使用 `conversationHistory` getter
   - 原因: 统一访问方式

### Agent 中更新的调用

1. **requestLoop 中的用户消息添加**
   ```typescript
   // 之前
   this.memoryModule.addToConversationHistory(
       MessageBuilder.custom('user', currentUserContent)
   );

   // 之后
   if (currentUserContent.length === 1 && currentUserContent[0].type === 'text') {
       this.memoryModule.addUserMessage((currentUserContent[0] as any).text);
   } else {
       this.memoryModule.addUserMessage(currentUserContent);
   }
   ```

2. **工具结果消息添加**
   ```typescript
   // 之前
   this.memoryModule.addToConversationHistory(
       MessageBuilder.custom('user', this.messageState.userMessageContent)
   );

   // 之后
   this.memoryModule.addUserMessage(this.messageState.userMessageContent);
   ```

3. **助手消息添加**
   ```typescript
   // 之前
   this.memoryModule.addToConversationHistory(message);

   // 之后
   this.memoryModule.addAssistantMessage(message.content);
   ```

4. **回忆功能**
   ```typescript
   // 之前
   const recalled = this.memoryModule.recallConversation({
       turnNumbers: recallParams.turn_numbers,
       messageIndices: recallParams.message_indices,
       lastN: recallParams.last_n,
   });

   // 之后
   let recalled: ApiMessage[] = [];
   if (recallParams.turn_numbers && recallParams.turn_numbers.length > 0) {
       recalled = this.memoryModule.recallTurns(recallParams.turn_numbers);
   } else if (recallParams.last_n) {
       recalled = this.memoryModule.getTurnStore().getRecentMessages(recallParams.last_n);
   }
   ```

5. **conversationHistory setter**
   ```typescript
   // 之前
   public set conversationHistory(history: ApiMessage[]) {
       this.memoryModule.setConversationHistory(history);
   }

   // 之后
   public set conversationHistory(history: ApiMessage[]) {
       console.warn('Setting conversation history is not supported in Turn-based architecture');
       // For backward compatibility, do nothing
   }
   ```

## 新的 API 使用指南

### 添加消息

```typescript
// 添加用户消息
memoryModule.addUserMessage('Hello');
memoryModule.addUserMessage([{ type: 'text', text: 'Hello' }]);

// 添加助手消息
memoryModule.addAssistantMessage([{ type: 'text', text: 'Hi there' }]);

// 添加系统消息
memoryModule.addSystemMessage('System notification');
```

### 获取历史

```typescript
// 获取所有消息
const allMessages = memoryModule.getAllMessages();

// 获取特定 Turn
const turn = memoryModule.getTurnStore().getTurnByNumber(2);

// 获取最近 N 个 Turn 的消息
const recentMessages = memoryModule.getTurnStore().getRecentMessages(3);
```

### 回忆功能

```typescript
// 回忆特定 Turn
const recalled = memoryModule.recallTurns([1, 3, 5]);

// 获取最近 N 个 Turn 的消息
const recent = memoryModule.getTurnStore().getRecentMessages(5);
```

### 清理

```typescript
// 清空所有 memory
memoryModule.clear();
```

## 测试结果

所有 memory 相关测试通过：
- ✅ TurnMemoryStore: 20个测试
- ✅ Turn Integration: 5个测试
- ✅ MemoryModule: 1个测试

总计: **26个测试全部通过** ✅

## 优势

1. **更清晰的 API**: 方法名称更准确，反映 Turn-based 架构
2. **类型安全**: 使用专门的方法而不是通用的 `addToConversationHistory`
3. **减少混淆**: 移除了与 Turn-based 架构不兼容的方法
4. **更好的维护性**: 代码更简洁，没有 deprecated 警告
5. **向前兼容**: 为未来的改进留出空间

## 迁移指南

如果你的代码还在使用旧的 API，请按以下方式迁移：

| 旧 API | 新 API |
|--------|--------|
| `addToConversationHistory(msg)` | `addUserMessage()` / `addAssistantMessage()` / `addSystemMessage()` |
| `getConversationHistory()` | `getAllMessages()` |
| `setConversationHistory(history)` | 不支持（使用 import/export） |
| `clearConversationHistory()` | `clear()` |
| `recallConversation(options)` | `recallTurns(turnNumbers)` |
| `getMemoryStore()` | `getTurnStore()` |
| `storeContext(context, tools)` | 自动处理（在 `startTurn()` 时） |

清理完成！代码现在更加简洁、清晰，完全拥抱 Turn-based 架构。
