# PDF Processing Workers - Quick Start Guide

快速启动 PDF 处理 Workers 的简单指南。

## 🚀 一键启动

```bash
# 启动所有 workers（推荐，用于开发）
pnpm start:workers

# 启动所有 workers（后台运行，推荐用于生产）
pnpm start:workers:nohup
```

## 📋 前置条件

在运行 workers 之前，确保以下服务正在运行：

### 1. RabbitMQ
```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

### 2. Elasticsearch
```bash
docker run -d --name elasticsearch -p 9200:9200 -e "discovery.type=single-node" elasticsearch:8.8.0
```

### 3. MinerU API（可选，用于 PDF 转换）
```bash
pnpm start:mineru
```

## 🔧 环境配置

确保 `.env` 文件包含以下配置：

```env
# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200

# S3 配置
S3_BUCKET=aikb-pdf
S3_REGION=oss-cn-beijing
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
S3_ENDPOINT=https://aikb-pdf.oss-cn-beijing.aliyuncs.com

# MinerU API
MINERU_API_URL=http://localhost:8000
```

## 🏃 Workers 概述

启动的 workers 包括：

1. **PDF Analysis Worker** - 分析 PDF 文件
2. **PDF Processing Coordinator Worker** - 协调处理流程
3. **PDF Conversion Worker** - 转换 PDF 为 Markdown
4. **Markdown Storage Worker** - 存储和处理 Markdown 内容

## ✅ 验证 Workers 是否正常启动

启动 workers 后，使用以下命令验证状态：

```bash
# 检查 workers 状态（推荐）
pnpm check:workers
```

你应该看到类似这样的输出：
```
📊 WORKER STATUS REPORT
======================================================================
🏃 WORKER PROCESSES:
  ✅ PDF Analysis Worker
  ✅ PDF Processing Coordinator Worker
  ✅ PDF Conversion Worker
  ✅ Markdown Storage Worker

📋 SUMMARY:
  Workers Running: 4/4
  Environment: ✅ Ready
  Services: ✅ Ready

🎯 OVERALL STATUS:
  🎉 All systems operational!
```

### 其他验证方法

1. **查看启动日志** - 确认所有 workers 显示 "started successfully"
2. **检查进程** - `ps aux | grep worker` 应该显示 4 个进程
3. **访问 RabbitMQ** - http://localhost:15672 查看队列状态

## � 监控

Workers 启动后会显示：
- 启动状态信息
- 每 30 秒的心跳信息
- 每 5 分钟的详细状态报告

## 🛑 停止 Workers

### 前台运行的 Workers
使用 `Ctrl+C` 优雅停止所有 workers。

### 后台运行的 Workers
```bash
# 停止使用 nohup 启动的 workers
pnpm stop:workers:nohup
```

## ❗ 常见问题

### Node.js 版本兼容性问题
如果遇到 `ReferenceError: File is not defined` 错误：
- 这是 Node.js 18.x 的已知问题
- 升级到 Node.js 20.x 可以解决
- 或者使用 `pnpm start:workers` 跳过有问题的 workers

### Workers 无法连接到服务
1. 检查 RabbitMQ 和 Elasticsearch 是否正在运行
2. 验证 `.env` 文件中的配置
3. 检查防火墙设置

### PDF 处理失败
1. 确保 MinerU API 正在运行
2. 检查 S3 访问权限
3. 查看 worker 日志获取详细错误信息

## 🔍 验证 Workers 是否正常工作

1. 启动 workers
2. 运行测试：
   ```bash
   pnpm test knowledgeBase/knowledgeImport/__tests__/pdf-processing-workflow.test.ts
   ```
3. 检查 RabbitMQ 管理界面：http://localhost:15672

## 📚 更多信息

- 详细文档：[README.md](./README.md)
- 测试示例：`knowledgeBase/knowledgeImport/__tests__/pdf-processing-workflow.test.ts`
- Worker 源码：`knowledgeBase/lib/rabbitmq/`

## 🆘 获取帮助

如果遇到问题：
1. 查看控制台日志输出
2. 检查 [README.md](./README.md) 中的故障排除部分
3. 运行单个 worker 进行调试：
   ```bash
   pnpm tsx knowledgeBase/lib/rabbitmq/pdf-conversion.worker.ts