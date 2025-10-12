# PDF Processing Workers

这个目录包含了用于处理 PDF 文档的 RabbitMQ workers。这些 workers 通过消息队列协同工作，将 PDF 文件转换为 Markdown 格式并进行存储和索引。

## Workers 概述

### 1. PDF Analysis Worker (`pdf-analysis.worker.ts`)
- **功能**: 分析 PDF 文件，确定页数和是否需要分割
- **监听队列**: `pdf-analysis-request`
- **发布消息**: `pdf-analysis-completed`, `pdf-analysis-failed`

### 2. PDF Processing Coordinator Worker (`pdf-processing-coordinator.worker.ts`)
- **功能**: 协调整个 PDF 处理工作流
- **监听队列**: `pdf-analysis-completed`
- **发布消息**: `pdf-conversion-request`, `pdf-splitting-request`

### 3. PDF Conversion Worker (`pdf-conversion.worker.ts`)
- **功能**: 将 PDF 转换为 Markdown 格式
- **监听队列**: `pdf-conversion-request`, `pdf-part-conversion-request`
- **发布消息**: `pdf-conversion-completed`, `markdown-storage-request`

### 4. Markdown Storage Worker (`markdown-storage.worker.ts`)
- **功能**: 存储 Markdown 内容并处理分块和嵌入
- **监听队列**: `markdown-storage-request`
- **发布消息**: `markdown-storage-completed`, `markdown-storage-failed`

## 启动 Workers

### 方法 1: 使用 npm 脚本（推荐）

```bash
# 使用简化的启动脚本（推荐）
pnpm start:workers

# 或使用 shell 脚本（包含服务检查）
pnpm start:workers:sh

# 或使用 TypeScript 版本（可能有兼容性问题）
pnpm start:workers:ts
```

### 方法 2: 直接运行

```bash
# 使用简化的启动脚本
node knowledgeBase/lib/rabbitmq/simple-start-workers.js

# 或使用 shell 脚本
chmod +x knowledgeBase/lib/rabbitmq/start-workers.sh
./knowledgeBase/lib/rabbitmq/start-workers.sh
```

## 验证 Workers 是否正常启动

### 快速检查

```bash
# 检查 workers 状态
pnpm check:workers
```

### 其他验证方法

1. **查看启动日志** - 启动时应该看到所有 workers 成功启动的消息
2. **检查进程列表** - 使用 `ps aux | grep worker` 查看运行的进程
3. **访问 RabbitMQ 管理界面** - http://localhost:15672 查看队列状态
4. **运行集成测试** - 验证完整的 PDF 处理流程

📖 **详细验证指南**: 查看 [HOW_TO_VERIFY_WORKERS.md](./HOW_TO_VERIFY_WORKERS.md)

## 环境要求

在启动 workers 之前，请确保以下服务正在运行：

### 1. RabbitMQ
```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

### 2. Elasticsearch
```bash
docker run -d --name elasticsearch -p 9200:9200 -e "discovery.type=single-node" elasticsearch:8.8.0
```

### 3. MongoDB（可选）
```bash
docker run -d --name mongodb -p 27017:27017 mongo:6.0
```

## 环境变量

确保 `.env` 文件包含以下必要配置：

```env
# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=guest
RABBITMQ_PASSWORD=guest

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200

# MongoDB（如果使用）
MONGODB_URL=mongodb://localhost:27017/aikb

# S3 配置
S3_BUCKET=aikb-pdf
S3_REGION=oss-cn-beijing
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
S3_ENDPOINT=https://aikb-pdf.oss-cn-beijing.aliyuncs.com

# MinerU API
MINERU_API_URL=http://localhost:8000
```

## PDF 处理流程

```
1. PDF 上传 → storePdf() 方法
2. 发送 PDF_ANALYSIS_REQUEST 消息
3. PDF Analysis Worker 分析 PDF
4. 发布 PDF_ANALYSIS_COMPLETED 消息
5. PDF Processing Coordinator 协调下一步
   - 如果需要分割: 发送 PDF_SPLITTING_REQUEST
   - 如果不需要分割: 发送 PDF_CONVERSION_REQUEST
6. PDF Conversion Worker 转换 PDF 为 Markdown
7. 发送 MARKDOWN_STORAGE_REQUEST 消息
8. Markdown Storage Worker 存储内容并处理分块
9. 发布 MARKDOWN_STORAGE_COMPLETED 消息
10. 处理完成
```

## 监控和日志

Workers 运行时会：
- 每 30 秒输出心跳信息
- 每 5 分钟输出详细的 worker 状态
- 自动处理优雅关闭（SIGINT, SIGTERM）

## 故障排除

### 1. Workers 无法启动
- 检查环境变量是否正确配置
- 确保所有依赖服务（RabbitMQ, Elasticsearch）正在运行
- 查看日志输出以获取具体错误信息

### 2. Node.js 版本兼容性问题
如果遇到 `ReferenceError: File is not defined` 错误，这是 Node.js 18.x 版本的兼容性问题：
- **解决方案 1**: 升级到 Node.js 20.x 或更高版本
- **解决方案 2**: 使用简化的启动脚本 `pnpm start:workers`，它会跳过有问题的 workers
- **解决方案 3**: 单独启动有问题的 workers

### 3. PDF 处理失败
- 检查 MinerU API 是否正在运行
- 确认 S3 访问权限配置正确
- 查看 worker 日志以获取详细错误信息

### 4. 消息队列问题
- 使用 RabbitMQ 管理界面 (http://localhost:15672) 查看队列状态
- 检查消息是否正确路由到相应队列

### 5. 单个 Worker 管理
如果需要单独启动特定的 workers：

```bash
# 只启动 PDF Analysis Worker
pnpm tsx knowledgeBase/lib/rabbitmq/pdf-analysis.worker.ts

# 只启动 PDF Conversion Worker
pnpm tsx knowledgeBase/lib/rabbitmq/pdf-conversion.worker.ts

# 只启动 PDF Processing Coordinator Worker
pnpm tsx knowledgeBase/lib/rabbitmq/pdf-processing-coordinator.worker.ts
```

## 开发和测试

### 运行测试
```bash
# 运行集成测试
pnpm test:integrated

# 运行特定的 PDF 处理测试
pnpm test knowledgeBase/knowledgeImport/__tests__/pdf-processing-workflow.test.ts
```

### 开发模式
```bash
# 启动 workers 并监听文件变化
pnpm start:workers
```

## 单个 Worker 管理

如果需要单独管理某个 worker，可以：

```typescript
import { WorkerManager } from './start-all-workers';

const manager = new WorkerManager();
await manager.startAll();

// 获取 worker 状态
await manager.getWorkerStats();

// 停止所有 workers
await manager.stopAll();