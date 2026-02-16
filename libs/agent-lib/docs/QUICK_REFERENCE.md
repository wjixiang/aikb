# 快速参考: 新 ToolCall 接口

## 接口定义

```typescript
interface ToolCall {
    id: string;           // "fc_12345xyz"
    call_id: string;      // "call_12345xyz"
    type: "function_call";
    name: string;         // 工具名称
    arguments: string;    // JSON 字符串
}

type ApiResponse = ToolCall[];
```

## 使用示例

### 创建 ToolCall
```typescript
const toolCall: ToolCall = {
    id: 'fc_abc123',
    call_id: 'call_abc123',
    type: 'function_call',
    name: 'search_database',
    arguments: JSON.stringify({ query: 'diabetes' })
};
```

### 处理响应
```typescript
const response: ApiResponse = await apiClient.makeRequest(...);

for (const toolCall of response) {
    const args = JSON.parse(toolCall.arguments);

    if (toolCall.name === 'attempt_completion') {
        console.log('完成:', args.result);
        break;
    }

    // 执行工具
    await executeToolCall(toolCall.name, args);
}
```

### 使用 BamlApiClient
```typescript
const client = new BamlApiClient();
const response = await client.makeRequest(
    systemPrompt,
    workspaceContext,
    memoryContext,
    { timeout: 40000 }
);
```

### 使用 OpenaiCompatibleApiClient
```typescript
const client = new OpenaiCompatibleApiClient({
    apiKey: 'your-key',
    model: 'gpt-4',
    baseURL: 'https://api.openai.com/v1'
});
const response = await client.makeRequest(...);
```

## 关键变更

| 旧接口 | 新接口 |
|--------|--------|
| `toolName` | `name` |
| `toolParams` | `arguments` |
| `AttemptCompletion \| ToolCall` | `ToolCall[]` |
| 单个工具调用 | 多个工具调用 |

## 向后兼容

BamlApiClient 自动转换旧格式:
```typescript
// 旧格式
{ toolName: "search", toolParams: "{...}" }

// 自动转换为
[{
    id: "fc_generated",
    call_id: "call_generated",
    type: "function_call",
    name: "search",
    arguments: "{...}"
}]
```

## 测试

```bash
npm test -- src/api-client/__tests__/ApiClient.refactor.test.ts --run
```

## 文档

- `REFACTORING_SUMMARY.md` - 完整总结
- `src/api-client/REFACTORING.md` - 详细指南
- `src/api-client/examples.ts` - 代码示例
