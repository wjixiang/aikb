# 如何验证 Workers 是否正常启动

本文档提供了多种方法来验证 PDF 处理 Workers 是否正常启动和运行。

## 🚀 快速验证方法

### 方法 1: 使用状态检查脚本（推荐）

```bash
# 检查 workers 状态
pnpm check:workers
```

这个脚本会显示：
- ✅ 环境变量配置状态
- ✅ Worker 文件是否存在
- ✅ RabbitMQ 和 Elasticsearch 连接状态
- 🏃 运行中的 Worker 进程
- 📬 RabbitMQ 队列状态（如果可用）

### 方法 2: 查看 Worker 启动日志

启动 workers 时，观察控制台输出：

```bash
pnpm start:workers
```

成功的启动日志应该显示：
```
[WorkerStarter] ✅ PDF Analysis Worker started successfully
[WorkerStarter] ✅ PDF Processing Coordinator Worker started successfully
[WorkerStarter] ✅ PDF Conversion Worker started successfully
[WorkerStarter] ✅ Markdown Storage Worker started successfully
[WorkerStarter] 🎉 All workers started successfully!
```

### 方法 3: 检查进程列表

```bash
# 查看正在运行的 worker 进程
ps aux | grep -E "(tsx|node).*worker" | grep -v grep
```

你应该看到类似这样的输出：
```
user  1234  0.0  0.1 1234567 89012 ?  Sl  12:00   0:01 tsx pdf-analysis.worker.ts
user  1235  0.0  0.1 1234567 89013 ?  Sl  12:00   0:01 tsx pdf-processing-coordinator.worker.ts
user  1236  0.0  0.1 1234567 89014 ?  Sl  12:00   0:01 tsx pdf-conversion.worker.ts
user  1237  0.0  0.1 1234567 89015 ?  Sl  12:00   0:01 tsx markdown-storage.worker.ts
```

## 🔍 详细验证方法

### 1. RabbitMQ 队列状态检查

访问 RabbitMQ 管理界面：http://localhost:15672
- 用户名：guest
- 密码：guest

在 "Queues" 标签页中，你应该看到以下队列有消费者：
- `pdf-analysis-request`
- `pdf-analysis-completed`
- `pdf-conversion-request`
- `markdown-storage-request`

### 2. Elasticsearch 索引检查

```bash
# 检查 Elasticsearch 中的索引
curl -X GET "elasticsearch:9200/_cat/indices?v"
```

你应该看到 library 相关的索引。

### 3. 运行集成测试

```bash
# 运行 PDF 处理工作流测试
pnpm test knowledgeBase/knowledgeImport/__tests__/pdf-processing-workflow.test.ts
```

这个测试会：
1. 上传一个测试 PDF
2. 发送处理请求
3. 验证 workers 是否正确处理请求

## 📊 Worker 状态解读

### 状态报告示例

```
📊 WORKER STATUS REPORT
======================================================================

🔧 ENVIRONMENT STATUS:
  Environment Variables: ✅ Configured
  Worker Files: ✅ All files exist

🌐 SERVICE STATUS:
  RabbitMQ: ✅ Connected
  Elasticsearch: ✅ Connected

🏃 WORKER PROCESSES:
  ✅ PDF Analysis Worker
  ❌ PDF Processing Coordinator Worker
  ✅ PDF Conversion Worker
  ❌ Markdown Storage Worker

📋 SUMMARY:
  Workers Running: 2/4
  Environment: ✅ Ready
  Services: ✅ Ready
```

### 状态含义

- ✅ **正常运行**: Worker 进程正在运行
- ❌ **未运行**: Worker 进程未找到
- ⚠️ **警告**: Worker 存在但可能有问题

## 🛠️ 常见问题和解决方案

### 1. Workers 启动后立即退出

**症状**: 启动日志显示成功，但状态检查显示没有运行的进程

**可能原因**:
- Node.js 版本兼容性问题（特别是 Markdown Storage Worker）
- 环境变量配置错误
- 依赖服务未启动

**解决方案**:
```bash
# 检查 Node.js 版本
node --version

# 升级到 Node.js 20+ （推荐）
# 或者使用单独启动命令
pnpm tsx knowledgeBase/lib/rabbitmq/pdf-analysis.worker.ts
pnpm tsx knowledgeBase/lib/rabbitmq/pdf-processing-coordinator.worker.ts
pnpm tsx knowledgeBase/lib/rabbitmq/pdf-conversion.worker.ts
```

### 2. RabbitMQ 连接失败

**症状**: 状态检查显示 RabbitMQ 未连接

**解决方案**:
```bash
# 启动 RabbitMQ
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management

# 检查连接
curl -u guest:guest http://localhost:15672/api/overview
```

### 3. Elasticsearch 连接失败

**症状**: 状态检查显示 Elasticsearch 未连接

**解决方案**:
```bash
# 启动 Elasticsearch
docker run -d --name elasticsearch -p 9200:9200 -e "discovery.type=single-node" elasticsearch:8.8.0

# 检查连接
curl http://localhost:9200
```

### 4. 环境变量问题

**症状**: 环境变量检查失败

**解决方案**:
```bash
# 检查 .env 文件
cat .env

# 确保 .env 文件包含必要的变量
echo "RABBITMQ_URL=amqp://localhost:5672" >> .env
echo "ELASTICSEARCH_URL=http://localhost:9200" >> .env
```

## 🔄 实时监控

### 1. 持续监控 Worker 状态

```bash
# 每 30 秒检查一次状态
watch -n 30 "pnpm check:workers"
```

### 2. 监控 RabbitMQ 队列

```bash
# 监控队列消息数量
watch -n 5 "curl -s -u guest:guest http://localhost:15672/api/queues | jq '.[] | {name: .name, messages: .messages, consumers: .consumers}'"
```

### 3. 查看实时日志

```bash
# 启动 workers 并保持日志输出
pnpm start:workers

# 在另一个终端查看日志
tail -f /var/log/rabbitmq/rabbitmq.log
```

## 🧪 测试 Workers 功能

### 1. 发送测试消息

```bash
# 运行包含 PDF 上传的测试
pnpm test knowledgeBase/knowledgeImport/library.integrated.test.ts
```

### 2. 手动测试处理流程

1. 启动 workers
2. 运行测试脚本上传 PDF
3. 观察日志输出中的处理过程
4. 检查 Elasticsearch 中的处理结果

## 📝 验证清单

在确认 workers 正常工作之前，请检查：

- [ ] 所有必需的环境变量已配置
- [ ] RabbitMQ 服务正在运行且可访问
- [ ] Elasticsearch 服务正在运行且可访问
- [ ] Worker 进程在进程列表中可见
- [ ] RabbitMQ 队列有消费者连接
- [ ] 集成测试能够成功运行
- [ ] PDF 处理流程能够完成

如果以上所有项目都检查通过，那么你的 workers 应该已经正常启动并可以处理 PDF 处理请求了。