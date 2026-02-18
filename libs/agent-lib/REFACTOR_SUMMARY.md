# ApiMessage 类型统一重构总结

## 重构目标

将 `ApiMessage.content` 从复合类型 `string | ContentBlockParam[] | ExtendedContentBlock[]` 统一为单一数组类型 `ExtendedContentBlock[]`，降低系统复杂度。

## 主要改动

### 1. 类型定义更新 (`task.type.ts`)

**之前:**
```typescript
export interface ApiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Anthropic.ContentBlockParam[] | ExtendedContentBlock[];
  ts?: number;
}

export interface ExtendedApiMessage {
  role: 'user' | 'assistant' | 'system';
  content: Array<Anthropic.ContentBlockParam | ThinkingBlock>;
  ts: number;
}
```

**之后:**
```typescript
export interface ApiMessage {
  role: 'user' | 'assistant' | 'system';
  content: ExtendedContentBlock[];
  ts?: number;
}

// ExtendedApiMessage 已移除，因为与 ApiMessage 现在一致
```

### 2. 新增 MessageBuilder 工具类

提供便捷的工厂方法创建消息：

```typescript
export class MessageBuilder {
  static text(role, text): ApiMessage
  static user(text): ApiMessage
  static assistant(text): ApiMessage
  static system(context): ApiMessage
  static custom(role, content): ApiMessage
}
```

### 3. 简化的代码文件

#### agent.ts
- 移除 `ExtendedApiMessage` 导入
- 添加 `MessageBuilder` 导入
- 简化 `addToConversationHistory` 方法（移除类型判断逻辑）
- 使用 `MessageBuilder` 创建消息

**改动前:**
```typescript
this._conversationHistory.push({
    role: 'user',
    content: `<task>${query}</task>`,
});
```

**改动后:**
```typescript
this._conversationHistory.push(
    MessageBuilder.user(`<task>${query}</task>`)
);
```

#### MessageFormatter.ts
- 移除 `typeof msg.content === 'string'` 判断
- 直接处理数组类型的 content
- 添加对 `thinking` 块的处理

**代码减少:** ~15 行

#### PromptBuilder.ts
- 移除 `typeof msg.content === 'string'` 判断
- 简化 `cleanConversationHistory` 方法

**代码减少:** ~10 行

#### TaskExecutor.ts
- 移除 `ExtendedApiMessage` 导入
- 添加 `MessageBuilder` 导入
- 简化 `addToConversationHistory` 方法
- 简化消息转换逻辑

**代码减少:** ~12 行

### 4. 导出更新 (`index.ts`)

添加 `MessageBuilder` 导出：
```typescript
export { MessageBuilder } from './task/task.type.js'
```

## 重构效果

### 代码复杂度降低
- **移除类型判断:** 消除了 5 处 `typeof content === 'string'` 判断
- **移除类型转换:** 消除了 4 处 `Array.isArray()` 判断和类型断言
- **移除冗余类型:** 删除了 `ExtendedApiMessage` 接口定义
- **总计减少代码:** 约 50 行类型判断和转换逻辑

### 类型安全提升
- 统一的数组类型，避免运行时类型检查
- 编译时类型错误更容易发现
- 更清晰的类型推导

### 可维护性提升
- 使用 `MessageBuilder` 创建消息，代码更简洁
- 消息创建逻辑集中管理
- 更容易理解和修改

## 测试验证

### 通过的测试
1. ✅ ObservableAgent.test.ts (15 个测试)
2. ✅ MessageBuilder.test.ts (10 个测试)

### TypeScript 编译
✅ 无编译错误

## 向后兼容性

**破坏性变更:**
- `ApiMessage.content` 不再接受 `string` 类型
- `ExtendedApiMessage` 接口已移除

**迁移指南:**
```typescript
// 旧代码
const msg: ApiMessage = {
  role: 'user',
  content: 'Hello'
};

// 新代码 - 方式 1: 使用 MessageBuilder
const msg = MessageBuilder.user('Hello');

// 新代码 - 方式 2: 手动构建
const msg: ApiMessage = {
  role: 'user',
  content: [{ type: 'text', text: 'Hello' }]
};
```

## 后续建议

1. **更新文档:** 更新 API 文档说明新的消息创建方式
2. **迁移指南:** 为外部使用者提供迁移指南
3. **版本号:** 考虑升级主版本号（breaking change）
4. **性能测试:** 验证重构对性能的影响（预期无影响或略有提升）

## 总结

此次重构成功将 `ApiMessage` 的 content 类型从复合类型统一为数组类型，显著降低了代码复杂度，提升了类型安全性和可维护性。通过引入 `MessageBuilder` 工具类，使消息创建更加便捷和一致。所有测试通过，TypeScript 编译无错误。
