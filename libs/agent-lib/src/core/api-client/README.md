# ToolCallConvert - Tool to OpenAI Function Calling Converter

## 概述

`ToolCallConvert` 模块提供了将 `stateful-context` 的 Tool 接口转换为标准 OpenAI Function Calling 参数的功能。

## 架构设计

### 统一的 Tool 接口

项目使用 `stateful-context` 包中的 Tool 接口作为唯一的工具定义标准：

```typescript
interface Tool {
  toolName: string;
  paramsSchema: z.ZodType<any>;
  desc: string;
}
```

### 转换流程

```
stateful-context Tool (Zod Schema)
         ↓
  ToolCallConverter
         ↓
OpenAI ChatCompletionTool (JSON Schema)
```

## 使用方法

### 1. 定义工具

使用 Zod schema 定义工具参数：

```typescript
import { z } from 'zod';
import { Tool } from 'stateful-context';

const searchTool: Tool = {
  toolName: 'search',
  desc: 'Search for information in the knowledge base',
  paramsSchema: z.object({
    query: z.string().describe('The search query'),
    limit: z.number().optional().describe('Maximum number of results'),
    filters: z.object({
      category: z.enum(['article', 'paper', 'book']).optional(),
      dateFrom: z.string().optional(),
    }).optional(),
  }),
};
```

### 2. 转换为 OpenAI 格式

#### 方式一：使用 Converter 类

```typescript
import { DefaultToolCallConverter } from './api-client/ToolCallConvert';

const converter = new DefaultToolCallConverter();
const openaiTool = converter.convertTool(searchTool);

// 转换多个工具
const openaiTools = converter.convertTools([searchTool, anotherTool]);
```

#### 方式二：使用辅助函数

```typescript
import { createOpenAIFunctionCallingParams } from './api-client/ToolCallConvert';

const params = createOpenAIFunctionCallingParams(
  [searchTool, anotherTool],
  messages,
  'gpt-4',
  {
    temperature: 0.7,
    tool_choice: 'auto',
  }
);

// 直接用于 OpenAI API 调用
const response = await openai.chat.completions.create(params);
```

### 3. 完整示例

```typescript
import { z } from 'zod';
import { Tool } from 'stateful-context';
import { createOpenAIFunctionCallingParams } from './api-client/ToolCallConvert';
import OpenAI from 'openai';

// 定义工具
const tools: Tool[] = [
  {
    toolName: 'get_weather',
    desc: 'Get current weather for a location',
    paramsSchema: z.object({
      location: z.string().describe('City name or coordinates'),
      units: z.enum(['celsius', 'fahrenheit']).default('celsius'),
    }),
  },
  {
    toolName: 'search_database',
    desc: 'Search the medical literature database',
    paramsSchema: z.object({
      query: z.string(),
      filters: z.object({
        year: z.number().optional(),
        journal: z.string().optional(),
      }).optional(),
    }),
  },
];

// 准备消息
const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'What is the weather in Beijing?' },
];

// 创建 OpenAI 请求参数
const params = createOpenAIFunctionCallingParams(
  tools,
  messages,
  'gpt-4',
  {
    temperature: 0.7,
    max_tokens: 1000,
    tool_choice: 'auto',
  }
);

// 调用 OpenAI API
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const response = await openai.chat.completions.create(params);
```

## 支持的 Zod Schema 类型

转换器支持以下 Zod schema 类型：

- ✅ `z.string()` - 字符串
- ✅ `z.number()` - 数字
- ✅ `z.boolean()` - 布尔值
- ✅ `z.object()` - 对象（支持嵌套）
- ✅ `z.array()` - 数组
- ✅ `z.enum()` - 枚举
- ✅ `z.union()` - 联合类型
- ✅ `z.optional()` - 可选参数
- ✅ `z.default()` - 默认值
- ✅ `.describe()` - 参数描述

## API 参考

### ToolCallConverter 接口

```typescript
interface ToolCallConverter {
  convertTool(tool: Tool): OpenAI.Chat.ChatCompletionTool;
  convertTools(tools: Tool[]): OpenAI.Chat.ChatCompletionTool[];
}
```

### DefaultToolCallConverter 类

默认实现，使用 `zod-to-json-schema` 进行转换。

### createOpenAIFunctionCallingParams 函数

```typescript
function createOpenAIFunctionCallingParams(
  tools: Tool[],
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  model: string,
  options?: {
    tool_choice?: OpenAI.Chat.ChatCompletionToolChoiceOption;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    stream?: boolean;
  }
): OpenAIFunctionCallingParams
```

## 测试

运行测试：

```bash
npm test -- src/api-client/__tests__/ToolCallConvert.test.ts
```

测试覆盖：
- ✅ 基本类型转换
- ✅ 复杂嵌套对象
- ✅ 可选参数处理
- ✅ 枚举类型
- ✅ 联合类型
- ✅ 数组和对象数组
- ✅ 多工具转换
- ✅ OpenAI 参数生成

## 注意事项

1. **Schema 验证**：确保 Zod schema 定义完整，包含必要的描述信息
2. **类型安全**：使用 TypeScript 确保类型安全
3. **性能**：转换过程是同步的，适合在请求前一次性转换
4. **兼容性**：生成的 JSON Schema 符合 OpenAPI 3.0 规范

## 未来扩展

- [ ] 支持更多 Zod schema 类型（如 `z.record()`, `z.tuple()` 等）
- [ ] 添加 schema 验证和错误处理
- [ ] 支持自定义转换规则
- [ ] 添加缓存机制优化性能
