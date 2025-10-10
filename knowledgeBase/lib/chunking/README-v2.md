# 统一文本切片工具 (Unified Text Chunking Tool)

这是文本切片工具，提供了统一的策略接口，方便实现和管理不同的chunking策略。

## 主要特性

- **统一策略接口**：所有chunking策略都实现相同的接口
- **策略管理器**：自动注册和管理所有可用的chunking策略
- **自动策略选择**：根据文本内容自动选择最适合的策略
- **灵活配置**：每个策略都有自己的配置选项
- **向后兼容**：保持与原有API的兼容性
- **可扩展性**：易于添加新的chunking策略

## 架构设计

### 核心组件

1. **ChunkingStrategy接口**：定义了所有chunking策略必须实现的标准接口
2. **BaseChunkingStrategy抽象类**：提供了通用的配置验证逻辑
3. **ChunkingManager**：负责注册、管理和选择合适的chunking策略
4. **具体策略实现**：H1ChunkingStrategy、ParagraphChunkingStrategy等

### 文件结构

```
knowledgeBase/lib/chunking/
├── chunkingStrategy.ts          # 策略接口和基类
├── chunkingManager.ts           # 策略管理器
├── chunkingTool.ts              # 统一的chunking工具（向后兼容）
├── strategies/
│   ├── h1ChunkingStrategy.ts    # H1标题切片策略
│   └── paragraphChunkingStrategy.ts # 段落切片策略
├── advancedExample.ts           # 高级使用示例
├── chunkingTool.test.ts         # 测试文件
└── README-v2.md                 # 本文档
```

## API 参考

### 基本使用

```typescript
import {
  chunkTextAdvanced,
  getAvailableStrategies,
  autoSelectStrategy
} from './chunkingTool';

// 自动选择策略进行切片
const chunks = chunkTextAdvanced(text);

// 指定策略进行切片
const h1Chunks = chunkTextAdvanced(text, 'h1');
const paragraphChunks = chunkTextAdvanced(text, 'paragraph');

// 使用自定义配置
const customConfig = {
  maxChunkSize: 500,
  minChunkSize: 50,
  overlap: 25
};
const customChunks = chunkTextAdvanced(text, 'paragraph', customConfig);
```

### 策略管理

```typescript
import { chunkingManager } from './chunkingTool';

// 获取所有可用策略
const strategies = chunkingManager.getAvailableStrategies();

// 自动选择策略
const strategy = chunkingManager.autoSelectStrategy(text);

// 获取策略默认配置
const config = chunkingManager.getStrategyDefaultConfig('h1');

// 验证配置
const validation = chunkingManager.validateStrategyConfig('h1', config);

// 检查策略是否可以处理文本
const canHandle = chunkingManager.canStrategyHandle('h1', text);
```

### 高级功能

```typescript
// 获取可以处理特定文本的所有策略
const availableStrategies = chunkingManager.getStrategiesForText(text);

// 注册自定义策略
chunkingManager.registerStrategy(customStrategy);

// 设置默认策略
chunkingManager.setDefaultStrategy('paragraph');
```

## 内置策略

### H1ChunkingStrategy

基于H1标题的markdown文本切片策略。

**特点**：
- 按照`# 标题`格式进行切片
- 每个块包含标题和其后的内容
- 支持大块内容的自动分割

**适用场景**：
- 结构化的markdown文档
- 技术文档、教程
- 学术论文

**默认配置**：
```typescript
{
  maxChunkSize: 1000,
  minChunkSize: 100,
  overlap: 50
}
```

### ParagraphChunkingStrategy

基于段落的文本切片策略。

**特点**：
- 按段落进行切片
- 智能合并短段落
- 支持长段落的自动分割

**适用场景**：
- 普通文本内容
- 新闻文章
- 非结构化文档

**默认配置**：
```typescript
{
  maxChunkSize: 500,
  minChunkSize: 50,
  overlap: 25
}
```

## 自定义策略

要创建自定义的chunking策略，需要实现ChunkingStrategy接口：

```typescript
import { BaseChunkingStrategy, ChunkingConfig, ChunkResult } from '../chunkingStrategy';

class CustomChunkingStrategy extends BaseChunkingStrategy {
  readonly name = 'custom';
  readonly description = '自定义切片策略';
  readonly version = '1.0.0';

  canHandle(text: string): boolean {
    // 判断是否可以处理此文本
    return true;
  }

  chunk(text: string, config?: ChunkingConfig): ChunkResult[] {
    // 实现具体的切片逻辑
    return [
      {
        content: '切片内容',
        index: 0
      }
    ];
  }

  // 可选：重写默认配置
  getDefaultConfig(): ChunkingConfig {
    return {
      maxChunkSize: 800,
      minChunkSize: 100,
      overlap: 30
    };
  }
}

// 注册策略
chunkingManager.registerStrategy(new CustomChunkingStrategy());
```

## 与Library系统的集成

新的chunking接口已经集成到Library系统中：

```typescript
// 使用LibraryItem的高级chunking方法
const item = await library.getBook(itemId);
const chunks = await item.chunkEmbedAdvanced('h1', true, {
  maxChunkSize: 600,
  minChunkSize: 80
});

// 获取可用的chunking策略
const strategies = item.getAvailableChunkingStrategies();

// 获取策略的默认配置
const config = item.getChunkingStrategyDefaultConfig('paragraph');
```

## 性能考虑

1. **批量处理**：对于大量文本，建议使用批量处理
2. **配置优化**：根据文本类型调整配置参数
3. **策略选择**：使用自动策略选择功能可以获得最佳效果

## 迁移指南

### 迁移指南

如果你之前使用的是旧版本的chunking工具，可以按照以下步骤迁移：

1. **更新导入**：
   ```typescript
   // 旧版本
   import { h1Chunking, paragraphChunking } from './chunkingToolV2';
   
   // 新版本（向后兼容）
   import { h1Chunking, paragraphChunking } from './chunkingTool';
   ```

2. **使用新API**：
   ```typescript
   // 旧版本
   const chunks = h1Chunking(text);
   
   // 新版本（推荐）
   const chunks = chunkTextAdvanced(text, 'h1');
   ```

3. **利用新功能**：
   ```typescript
   // 自动策略选择
   const chunks = chunkTextAdvanced(text);
   
   // 自定义配置
   const chunks = chunkTextAdvanced(text, 'h1', {
     maxChunkSize: 800,
     overlap: 100
   });
   ```

## 测试

运行测试以验证功能：

```bash
# 运行测试
npx tsx knowledgeBase/lib/chunking/chunkingTool.test.ts

# 运行示例
npx tsx knowledgeBase/lib/chunking/advancedExample.ts
```

## 最佳实践

1. **策略选择**：对于结构化文档使用H1策略，对于普通文本使用段落策略
2. **配置调优**：根据文档大小和内容调整配置参数
3. **性能监控**：监控处理时间，特别是对于大型文档
4. **错误处理**：始终包含适当的错误处理逻辑
5. **测试验证**：对自定义策略进行充分测试

## 未来扩展

- 添加更多内置策略（语义切分、递归切分等）
- 支持多语言文本处理
- 添加性能监控和优化
- 支持并行处理
- 添加可视化工具