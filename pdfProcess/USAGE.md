# Python PDF Splitting Worker 使用指南

## 概述

这是一个完整的Python PDF切分worker，与现有的TypeScript分布式系统完全兼容。它可以处理PDF切分请求，通过RabbitMQ接收消息，并将切分后的PDF部分上传到S3存储。

## 功能特性

- ✅ PDF切分：使用PyPDF2将大PDF文件切分为小部分
- ✅ RabbitMQ集成：与现有TypeScript系统使用相同的消息队列
- ✅ S3/OSS存储：支持上传切分后的PDF部分到对象存储
- ✅ 错误处理：完整的异常捕获和重试机制
- ✅ 环境变量兼容：与现有项目配置完全兼容
- ✅ 日志记录：详细的日志输出和进度跟踪

## 快速开始

### 1. 运行Python worker

```bash
# 使用推荐的启动脚本（自动加载环境变量）
uv run python pdfProcess/run_worker.py

# 或者使用原始启动脚本
uv run python pdfProcess/start_pdf_splitting_worker.py
```

### 2. 运行测试

```bash
# 测试RabbitMQ连接
uv run python pdfProcess/test_rabbitmq_connection.py

# 测试PDF切分功能
uv run python pdfProcess/test_pdf_functionality.py

# 运行完整的集成测试
./test-python-pdf-splitting.sh
```

## 环境变量配置

Python worker使用以下环境变量：

### RabbitMQ配置
```bash
PYTHON_RABBITMQ_URL=amqp://admin:admin123@rabbitmq:5672/my_vhost
RABBITMQ_HOSTNAME=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=admin
RABBITMQ_PASSWORD=admin123
RABBITMQ_VHOST=my_vhost
```

### S3/OSS配置
```bash
PDF_OSS_BUCKET_NAME=aikb-pdf
OSS_REGION=oss-cn-beijing
OSS_ACCESS_KEY_ID=your_access_key
OSS_SECRET_ACCESS_KEY=your_secret_key
S3_ENDPOINT=aliyuncs.com
```

### 其他配置
```bash
WORKER_ID=pdf-splitting-worker-1
SYSTEM_LOG_LEVEL=INFO
MAX_RETRIES=3
TEMP_DIR=/tmp/pdf-processing
```

## 消息格式

Python worker处理以下RabbitMQ消息：

### PDF切分请求
```json
{
  "messageId": "uuid",
  "timestamp": 1234567890,
  "eventType": "PDF_SPLITTING_REQUEST",
  "itemId": "item-id",
  "s3Url": "https://s3.amazonaws.com/bucket/file.pdf",
  "fileName": "document.pdf",
  "pageCount": 100,
  "splitSize": 25,
  "priority": "normal",
  "retryCount": 0,
  "maxRetries": 3
}
```

### PDF切分进度
```json
{
  "messageId": "uuid",
  "timestamp": 1234567890,
  "eventType": "PDF_SPLITTING_PROGRESS",
  "itemId": "item-id",
  "progress": 50,
  "message": "Splitting PDF into parts"
}
```

### PDF切分完成
```json
{
  "messageId": "uuid",
  "timestamp": 1234567890,
  "eventType": "PDF_SPLITTING_COMPLETED",
  "itemId": "item-id",
  "totalParts": 4,
  "processingTime": 5000
}
```

## 架构兼容性

Python worker与现有TypeScript系统完全兼容：

- 使用相同的队列名称：`pdf-splitting-request`
- 使用相同的交换机和路由键
- 使用相同的消息格式和结构
- 支持相同的错误处理和重试逻辑
- 使用相同的状态更新机制

## 故障排除

### 常见问题

1. **RabbitMQ连接失败**
   - 检查环境变量是否正确设置
   - 确认RabbitMQ服务正在运行
   - 验证虚拟主机和认证信息

2. **PDF切分失败**
   - 确认PDF文件格式正确
   - 检查临时目录权限
   - 验证PyPDF2依赖是否安装

3. **S3上传失败**
   - 检查S3/OSS认证信息
   - 确认存储桶权限
   - 验证网络连接

### 调试模式

启用详细日志输出：
```bash
export SYSTEM_LOG_LEVEL=DEBUG
uv run python pdfProcess/run_worker.py
```

## 性能优化

- 并发处理：支持多个worker实例并行运行
- 内存管理：自动清理临时文件和内存
- 错误恢复：自动重试失败的请求
- 监控支持：详细的性能指标和日志

## 部署建议

### Docker部署
```bash
cd pdfProcess
docker-compose up -d
```

### 生产环境
1. 使用进程管理器（如systemd或supervisor）
2. 配置日志轮转
3. 设置监控和告警
4. 配置自动重启策略

## 与TypeScript worker的比较

| 特性 | Python worker | TypeScript worker |
|------|---------------|-------------------|
| PDF处理库 | PyPDF2 | pdf-lib |
| 语言特性 | 动态类型 | 静态类型 |
| 依赖管理 | uv/pip | npm/yarn |
| 性能 | 略低 | 略高 |
| 开发速度 | 快 | 中等 |
| 维护性 | 高 | 高 |

## 贡献指南

1. Fork项目
2. 创建功能分支
3. 编写测试
4. 提交Pull Request

## 许可证

本项目使用与主项目相同的许可证。