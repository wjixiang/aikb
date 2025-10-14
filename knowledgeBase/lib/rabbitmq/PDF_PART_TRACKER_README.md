# PDF部分状态跟踪器与合并触发机制

## 概述

本文档描述了为PDF处理系统实现的PDF部分状态跟踪器和合并触发机制。该机制用于跟踪大型PDF文件分割后的各个部分的转换状态，并在所有部分完成转换后自动触发合并操作。

系统现在支持两种存储后端：MongoDB和ElasticSearch，可以根据需求选择适合的存储方案。

## 组件架构

### 1. IPdfPartTracker 接口 (`pdf-part-tracker.ts`)

定义了PDF部分状态跟踪的核心接口，包括：
- 初始化PDF处理状态
- 更新部分状态
- 查询整体和部分状态
- 清理处理状态
- 重试失败部分

### 2. PdfPartTrackerImpl 实现 (`pdf-part-tracker-impl.ts`)

基于MongoDB的IPdfPartTracker接口实现，提供：
- 持久化状态存储
- 自动状态更新
- 错误处理和重试机制
- 性能优化的查询

### 3. PdfPartTrackerElasticsearchImpl 实现 (`pdf-part-tracker-impl-elasticsearch.ts`)

基于ElasticSearch的IPdfPartTracker接口实现，提供：
- 持久化状态存储
- 自动状态更新
- 错误处理和重试机制
- 高性能搜索和查询
- 自动索引管理

### 4. PdfPartTrackerFactory 工厂 (`pdf-part-tracker-factory.ts`)

提供单例模式的PDF部分状态跟踪器实例管理，支持：
- 单例实例获取
- 自定义实例注入（用于测试）
- 实例重置
- 多种存储后端支持
- 基于环境变量的自动选择

### 5. 增强的PdfConversionWorker (`pdf-conversion.worker.ts`)

更新了PDF转换工作器，集成状态跟踪器：
- 初始化PDF处理状态
- 实时更新部分转换状态
- 智能合并触发逻辑
- 失败部分重试机制

## 核心功能

### 1. 状态跟踪

系统跟踪每个PDF部分的以下状态：
- **PENDING**: 等待处理
- **PROCESSING**: 正在处理
- **COMPLETED**: 处理完成
- **FAILED**: 处理失败

### 2. 自动合并触发

当满足以下条件时，系统自动触发合并：
- 所有部分都已完成转换
- 生成PdfMergingRequestMessage并发送到RabbitMQ

### 3. 错误处理和重试

- 自动检测失败的部分
- 支持配置最大重试次数
- 智能重试机制，避免无限重试

### 4. 状态持久化

- 支持MongoDB和ElasticSearch两种存储后端
- 服务重启后状态不丢失
- 支持状态恢复和继续处理
- 可根据需求选择存储方案

## 使用方法

### 基本使用

```typescript
import { getPdfPartTracker } from './pdf-part-tracker-factory';

// 获取跟踪器实例（根据环境变量自动选择存储后端）
const tracker = getPdfPartTracker();

// 初始化PDF处理
await tracker.initializePdfProcessing('pdf-123', 5);

// 更新部分状态
await tracker.updatePartStatus('pdf-123', 0, PdfPartStatus.PROCESSING);
await tracker.updatePartStatus('pdf-123', 0, PdfPartStatus.COMPLETED);

// 检查是否所有部分都完成
const allCompleted = await tracker.areAllPartsCompleted('pdf-123');
```

### 指定存储后端

```typescript
import { getPdfPartTrackerWithStorage } from './pdf-part-tracker-factory';

// 使用MongoDB存储
const mongoTracker = getPdfPartTrackerWithStorage('mongodb');

// 使用ElasticSearch存储
const esTracker = getPdfPartTrackerWithStorage('elasticsearch');

// 使用自定义ElasticSearch URL
const customEsTracker = getPdfPartTrackerWithStorage('elasticsearch', 'http://custom-es:9200');
```

### 环境变量配置

```bash
# 使用MongoDB存储（默认）
PDF_PART_TRACKER_STORAGE=mongodb

# 使用ElasticSearch存储
PDF_PART_TRACKER_STORAGE=elasticsearch

# ElasticSearch连接URL（可选，默认为http://elasticsearch:9200）
ELASTICSEARCH_URL=http://elasticsearch:9200

# ElasticSearch API密钥（可选）
ELASTICSEARCH_URL_API_KEY=your-api-key
```

### 在PdfConversionWorker中使用

PdfConversionWorker已经集成了状态跟踪器，无需额外配置。当处理PDF部分时，会自动：

1. 初始化PDF处理状态（如果尚未初始化）
2. 更新部分状态为PROCESSING
3. 处理完成后更新为COMPLETED或FAILED
4. 调用checkAndTriggerMerging检查是否需要合并

### 自定义配置

```typescript
import { PdfPartTrackerImpl } from './pdf-part-tracker-impl';
import { PdfPartTrackerElasticsearchImpl } from './pdf-part-tracker-impl-elasticsearch';
import { PdfPartTrackerFactory } from './pdf-part-tracker-factory';

// 使用自定义MongoDB实现
const customMongoTracker = new PdfPartTrackerImpl();
PdfPartTrackerFactory.setInstance(customMongoTracker);

// 使用自定义ElasticSearch实现
const customEsTracker = new PdfPartTrackerElasticsearchImpl('http://custom-es:9200');
PdfPartTrackerFactory.setInstance(customEsTracker);

// 在PdfConversionWorker中使用自定义跟踪器
const worker = new PdfConversionWorker(pdfConvertor, customTracker);
```

## 数据模型

### PdfProcessingStatusInfo

```typescript
interface PdfProcessingStatusInfo {
  itemId: string;
  totalParts: number;
  completedParts: number[];
  failedParts: number[];
  processingParts: number[];
  pendingParts: number[];
  startTime: number;
  endTime?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}
```

### PdfPartStatusInfo

```typescript
interface PdfPartStatusInfo {
  itemId: string;
  partIndex: number;
  totalParts: number;
  status: PdfPartStatus;
  startTime?: number;
  endTime?: number;
  error?: string;
  retryCount?: number;
  maxRetries?: number;
}
```

## 存储后端

### MongoDB存储

系统在MongoDB中创建以下集合：

1. **pdf_processing_status**: 存储PDF整体处理状态
2. **pdf_part_status**: 存储每个部分的详细状态

#### 索引

为提高查询性能，系统自动创建以下索引：
- `{ itemId: 1 }` 在pdf_processing_status集合上（唯一）
- `{ itemId: 1, partIndex: 1 }` 在pdf_part_status集合上（唯一）
- `{ itemId: 1, status: 1 }` 在pdf_part_status集合上

### ElasticSearch存储

系统在ElasticSearch中创建以下索引：

1. **pdf_processing_status**: 存储PDF整体处理状态
2. **pdf_part_status**: 存储每个部分的详细状态

#### 索引映射

系统自动创建适当的字段映射和索引：
- itemId: keyword类型，用于精确匹配
- partIndex: integer类型，用于部分索引
- status: keyword类型，用于状态过滤
- 其他字段根据数据类型自动映射

#### 性能优化

- 自动创建索引以提高查询性能
- 支持复杂查询和聚合操作
- 适合大规模数据处理和实时查询

## 错误处理

### 常见错误和解决方案

1. **MongoDB连接失败**
   - 检查MONGODB_URI环境变量
   - 确保MongoDB服务正在运行

2. **ElasticSearch连接失败**
   - 检查ELASTICSEARCH_URL环境变量
   - 确保ElasticSearch服务正在运行
   - 验证API密钥配置（如果使用）

3. **状态更新失败**
   - 检查itemId是否存在
   - 确保partIndex在有效范围内

4. **合并触发失败**
   - 检查RabbitMQ连接
   - 确认PdfMergingRequestMessage格式正确

### 日志记录

系统使用结构化日志记录，包括：
- 状态初始化和更新
- 合并触发逻辑
- 错误和重试信息
- 性能指标

## 测试

运行单元测试：

```bash
# 运行MongoDB实现测试
pnpm test knowledgeBase/lib/rabbitmq/__tests__/pdf-part-tracker.test.ts

# 运行ElasticSearch实现测试（需要ElasticSearch服务）
pnpm test knowledgeBase/lib/rabbitmq/__tests__/pdf-part-tracker-elasticsearch.test.ts
```

测试覆盖：
- 状态初始化和更新
- 合并触发逻辑
- 错误处理和重试
- 工厂模式
- 多种存储后端支持

## 性能考虑

1. **批量操作**: 对于大量部分，考虑使用批量更新
2. **索引优化**: 根据查询模式调整索引
3. **状态清理**: 定期清理已完成的状态数据
4. **连接池**: 使用MongoDB连接池或ElasticSearch连接池提高性能
5. **存储选择**: 
   - MongoDB适合事务性操作和复杂查询
   - ElasticSearch适合大规模数据处理和实时搜索
6. **查询优化**: 利用各存储后端的特性优化查询性能

## 扩展性

该机制设计为可扩展的：

1. **多存储后端**: 已支持MongoDB和ElasticSearch，可轻松添加其他存储系统
2. **自定义存储**: 可以实现基于其他存储系统的跟踪器
3. **状态扩展**: 可以添加更多状态类型
4. **回调机制**: 可以添加状态变更回调
5. **监控集成**: 可以集成监控系统
6. **存储迁移**: 支持在不同存储后端之间迁移数据

## 示例工作流

1. PDF分析阶段确定需要分割为5个部分
2. 系统初始化PDF处理状态，创建5个PENDING状态的部分
3. 并发处理各个部分，状态更新为PROCESSING
4. 部分完成后更新为COMPLETED，失败则更新为FAILED
5. 每次状态更新后检查是否所有部分都完成
6. 所有部分完成后，自动触发合并请求
7. 合并工作器处理合并请求，生成最终结果

## 故障恢复

1. **服务重启**: 状态持久化在所选存储后端中，重启后自动恢复
2. **部分失败**: 自动重试机制处理临时失败
3. **完全失败**: 记录错误状态，支持手动干预
4. **存储故障**: 支持切换到备用存储后端（需要手动配置）

## 监控指标

建议监控以下指标：
- PDF处理总数
- 各部分状态分布
- 平均处理时间
- 失败率和重试次数
- 合并触发频率
- 存储后端性能指标（查询时间、索引大小等）
- 存储后端连接状态和错误率

## 存储后端选择指南

### MongoDB存储

**适合场景：**
- 需要强事务一致性
- 复杂的关联查询
- 中小规模数据处理
- 已有MongoDB基础设施

**优势：**
- 强一致性保证
- 丰富的查询功能
- 成熟的生态系统

**限制：**
- 大规模数据查询性能可能下降
- 水平扩展相对复杂

### ElasticSearch存储

**适合场景：**
- 大规模数据处理
- 实时查询和分析
- 需要高性能搜索
- 分布式环境

**优势：**
- 优秀的查询性能
- 天然支持分布式
- 强大的搜索和分析能力

**限制：**
- 最终一致性（非强一致性）
- 复杂事务支持有限

### 迁移指南

从MongoDB迁移到ElasticSearch：

1. 设置ElasticSearch环境
2. 配置环境变量使用ElasticSearch
3. 运行数据迁移脚本（如需要）
4. 验证数据完整性
5. 切换生产环境

从ElasticSearch迁移到MongoDB：

1. 设置MongoDB环境
2. 配置环境变量使用MongoDB
3. 运行数据迁移脚本（如需要）
4. 验证数据完整性
5. 切换生产环境