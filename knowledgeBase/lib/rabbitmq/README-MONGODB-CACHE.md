# MongoDB Markdown Part Cache

本文档介绍了 MongoDB 版本的 MarkdownPartCache 实现，用于存储和管理 PDF 的 markdown 部分内容。

## 概述

`MongoDBMarkdownPartCache` 是 `MarkdownPartCache` 抽象类的 MongoDB 实现，提供了以下功能：

- 存储和检索 PDF 的 markdown 部分内容
- 跟踪每个部分的处理状态
- 合并所有部分为完整的 markdown 文档
- 管理项目元数据和整体状态

## 数据结构

### pdf_markdown_parts 集合

存储每个部分的 markdown 内容和状态：

```typescript
{
  _id: ObjectId,
  itemId: string,           // 项目ID
  partIndex: number,        // 部分索引
  content: string,          // markdown内容
  status: string,           // 'pending', 'processing', 'completed', 'failed'
  createdAt: Date,          // 创建时间
  updatedAt: Date,          // 更新时间
  errorMessage?: string     // 错误信息（可选）
}
```

### pdf_markdown_metadata 集合

存储整个 PDF 的元数据和状态：

```typescript
{
  _id: ObjectId,
  itemId: string,           // 项目ID
  totalParts: number,       // 总部分数
  completedParts: number[], // 已完成的部分索引数组
  failedParts: number[],    // 失败的部分索引数组
  status: string,           // 'pending', 'processing', 'completed', 'failed'
  createdAt: Date,          // 创建时间
  updatedAt: Date           // 更新时间
}
```

## 索引

为了提高查询性能，创建了以下索引：

1. **pdf_markdown_parts 集合**：
   - 复合索引：`{itemId: 1, partIndex: 1}`（唯一）

2. **pdf_markdown_metadata 集合**：
   - 唯一索引：`{itemId: 1}`

## 使用方法

### 基本用法

```typescript
import { MongoDBMarkdownPartCache } from './markdown-part-cache-mongodb';

// 创建缓存实例
const cache = new MongoDBMarkdownPartCache();

// 初始化缓存
await cache.initialize();

// 存储部分内容
await cache.storePartMarkdown('pdf-123', 0, '# 第一章\n\n内容...');

// 获取部分内容
const content = await cache.getPartMarkdown('pdf-123', 0);

// 获取所有部分
const allParts = await cache.getAllParts('pdf-123');

// 合并所有部分
const mergedContent = await cache.mergeAllParts('pdf-123');

// 更新部分状态
await cache.updatePartStatus('pdf-123', 0, 'completed');

// 获取部分状态
const status = await cache.getPartStatus('pdf-123', 0);

// 清理项目缓存
await cache.cleanup('pdf-123');

// 关闭连接
await cache.close();
```

### 完整示例

参考 `markdown-part-cache-mongodb.example.ts` 文件查看完整的使用示例。

## API 参考

### 初始化

```typescript
async initialize(): Promise<void>
```

初始化数据库连接和创建必要的索引。

### 存储和检索

```typescript
async storePartMarkdown(itemId: string, partIndex: number, markdownContent: string): Promise<void>
```

存储指定部分的 markdown 内容。

```typescript
async getPartMarkdown(itemId: string, partIndex: number): Promise<string | null>
```

获取指定部分的 markdown 内容。

```typescript
async getAllParts(itemId: string): Promise<Array<{partIndex: number, content: string}>>
```

获取项目的所有部分。

```typescript
async mergeAllParts(itemId: string): Promise<string>
```

合并所有部分为完整的 markdown 文档。

### 状态管理

```typescript
async updatePartStatus(itemId: string, partIndex: number, status: string): Promise<void>
```

更新指定部分的状态。

```typescript
async getPartStatus(itemId: string, partIndex: number): Promise<string | null>
```

获取指定部分的状态。

### 元数据管理

```typescript
async getMetadata(itemId: string): Promise<any | null>
```

获取项目的元数据。

### 清理

```typescript
async cleanup(itemId: string): Promise<void>
```

清理指定项目的所有缓存数据。

```typescript
async close(): Promise<void>
```

关闭数据库连接。

## 错误处理

所有方法都可能抛出 `MarkdownPartCacheError` 异常，包含以下信息：

- `message`: 错误描述
- `code`: 错误代码
- `details`: 错误详细信息

常见错误代码：

- `INITIALIZATION_FAILED`: 初始化失败
- `CACHE_NOT_INITIALIZED`: 缓存未初始化
- `INVALID_ITEM_ID`: 无效的项目ID
- `INVALID_PART_INDEX`: 无效的部分索引
- `INVALID_CONTENT_TYPE`: 无效的内容类型
- `INVALID_STATUS`: 无效的状态
- `STORE_PART_FAILED`: 存储部分失败
- `GET_PART_FAILED`: 获取部分失败
- `GET_ALL_PARTS_FAILED`: 获取所有部分失败
- `UPDATE_STATUS_FAILED`: 更新状态失败
- `GET_STATUS_FAILED`: 获取状态失败
- `CLEANUP_FAILED`: 清理失败
- `CLOSE_FAILED`: 关闭连接失败

## 环境要求

- Node.js
- MongoDB 数据库
- 环境变量 `MONGODB_URI` 设置为 MongoDB 连接字符串
- 可选：环境变量 `DB_NAME` 设置数据库名称（默认为 'aikb'）

## 注意事项

1. 使用前必须调用 `initialize()` 方法初始化缓存
2. 应用程序关闭时建议调用 `close()` 方法释放资源
3. 由于使用了连接池，`close()` 方法不会实际关闭数据库连接，以避免影响其他使用同一连接的代码
4. 所有操作都包含详细的日志记录，便于调试和监控

## 测试

运行测试：

```bash
pnpm test knowledgeBase/lib/rabbitmq/__tests__/markdown-part-cache-mongodb.test.ts