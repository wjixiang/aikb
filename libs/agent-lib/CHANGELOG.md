# API Response Interface 重构 - 变更清单

## 日期
2026-02-16

## 目标
1. ✅ 统一 `AttemptCompletion` 和 `ToolCall` 为单一接口
2. ✅ 支持返回多个 `ToolCall` 数组
3. ✅ 兼容 OpenAI Tool Call 格式,避免直接依赖 OpenAI SDK

## 修改的文件

### 核心接口
- ✅ `src/api-client/ApiClient.interface.ts`
  - 移除 `AttemptCompletion` 接口
  - 更新 `ToolCall` 接口为 OpenAI 兼容格式
  - 修改 `ApiResponse` 类型为 `ToolCall[]`

### API 客户端实现
- ✅ `src/api-client/BamlApiClient.ts`
  - 添加 `convertBamlResponse()` 方法
  - 添加 `convertLegacyToolCall()` 方法
  - 添加 `normalizeToolCall()` 方法
  - 实现向后兼容的格式转换

- ✅ `src/api-client/OpenaiCompatibleApiClient.ts`
  - 完整实现 OpenAI 兼容客户端
  - 添加 `OpenAICompatibleConfig` 接口
  - 实现 `convertOpenAIResponse()` 方法

- ✅ `src/api-client/index.ts`
  - 移除 `AttemptCompletion` 导出
  - 添加 `OpenaiCompatibleApiClient` 和 `OpenAICompatibleConfig` 导出

### Agent 核心逻辑
- ✅ `src/agent/agent.ts`
  - 移除 `convertBamlResponseToAssistantMessage()` 方法
  - 添加 `convertApiResponseToAssistantMessage()` 方法
  - 重构 `executeToolCalls()` 方法支持多工具调用
  - 更新导入语句移除 `AttemptCompletion`

### BAML 模式
- ✅ `baml_src/apiRequest.baml`
  - 移除 `AttemptCompletion` 类
  - 更新 `ToolCall` 类为新格式
  - 修改 `ApiRequest` 函数返回类型为 `ToolCall[]`

## 新增的文件

### 测试
- ✅ `src/api-client/__tests__/ApiClient.refactor.test.ts`
  - 6 个测试用例,全部通过
  - 覆盖接口结构、多工具调用、向后兼容等

### 文档
- ✅ `src/api-client/REFACTORING.md`
  - 详细的重构指南
  - 迁移说明和代码示例
  - 向后兼容性说明

- ✅ `src/api-client/examples.ts`
  - 9 个实用示例
  - 涵盖单/多工具调用、错误处理等场景

- ✅ `REFACTORING_SUMMARY.md`
  - 完整的重构总结
  - 中文说明文档

- ✅ `CHANGELOG.md` (本文件)
  - 变更清单

## 测试结果

```bash
npm test -- src/api-client/__tests__/ApiClient.refactor.test.ts --run
```

结果: ✅ 6/6 测试通过

测试覆盖:
- ✅ ToolCall 接口结构验证
- ✅ 多工具调用支持
- ✅ BamlApiClient 实例化
- ✅ OpenaiCompatibleApiClient 配置
- ✅ 向后兼容性
- ✅ attempt_completion 作为普通工具

## 向后兼容性

### 自动转换
BamlApiClient 自动处理:
- 旧格式 `{ toolName, toolParams }` → 新格式 `ToolCall`
- 单个对象 → 数组包装
- 自动生成缺失的 `id` 和 `call_id`

### 特殊处理
- `attempt_completion` 现在是普通工具调用
- 通过 `toolCall.name === 'attempt_completion'` 判断完成

## 破坏性变更

### API 响应类型
```typescript
// 旧
type ApiResponse = AttemptCompletion | ToolCall;

// 新
type ApiResponse = ToolCall[];
```

### 工具调用字段
```typescript
// 旧
interface ToolCall {
    toolName: string;
    toolParams: string;
}

// 新
interface ToolCall {
    id: string;
    call_id: string;
    type: "function_call";
    name: string;
    arguments: string;
}
```

## 迁移指南

### 对于 API 客户端实现者
1. 返回 `ToolCall[]` 而不是单个对象
2. 使用 `name` 和 `arguments` 字段
3. 生成唯一的 `id` 和 `call_id`

### 对于 Agent 使用者
1. 遍历 `response` 数组处理多个工具调用
2. 使用 `toolCall.name` 而不是 `toolCall.toolName`
3. 解析 `toolCall.arguments` JSON 字符串

## 后续工作

建议的增强:
- [ ] 实现工具调用流式支持
- [ ] 添加并行工具执行
- [ ] 实现工具调用批处理
- [ ] 添加重试逻辑
- [ ] 添加监控指标

## 相关文档

- `src/api-client/REFACTORING.md` - 详细重构指南
- `src/api-client/examples.ts` - 代码示例
- `REFACTORING_SUMMARY.md` - 中文总结
- `src/api-client/__tests__/ApiClient.refactor.test.ts` - 测试用例

## 审查清单

- ✅ 所有接口更新完成
- ✅ 向后兼容性保证
- ✅ 测试覆盖充分
- ✅ 文档完整
- ✅ 代码示例清晰
- ✅ 无类型错误
- ✅ 所有测试通过

## 签名

重构完成者: Claude Sonnet 4.5
日期: 2026-02-16
状态: ✅ 完成并验证
