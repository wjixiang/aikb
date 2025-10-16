# Elasticsearch 日志集成

本文档描述了如何配置和使用 Elasticsearch 日志集成功能。

## 概述

项目现已支持将日志重定向到 Elasticsearch，这允许您：
- 集中管理日志
- 使用 Kibana 进行日志分析和可视化
- 设置日志告警和监控
- 执行高级日志查询

## 配置

### 环境变量

在 `.env` 文件中设置以下环境变量来启用 Elasticsearch 日志：

```bash
# 启用/禁用 Elasticsearch 日志记录
ELASTICSEARCH_LOGGING_ENABLED=true

# Elasticsearch 日志级别 (debug, info, warn, error)
ELASTICSEARCH_LOG_LEVEL=info

# Elasticsearch 服务器 URL
ELASTICSEARCH_URL=http://elasticsearch:9200

# Elasticsearch 认证信息
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=changeme
ELASTICSEARCH_API_KEY=

# SSL 验证
ELASTICSEARCH_VERIFY_SSL=true

# 日志索引配置
ELASTICSEARCH_LOG_INDEX=logs
ELASTICSEARCH_LOG_INDEX_PATTERN=logs-YYYY.MM.DD
```

### 必需配置

最基本的配置只需要启用 Elasticsearch 日志记录：

```bash
ELASTICSEARCH_LOGGING_ENABLED=true
ELASTICSEARCH_URL=http://elasticsearch:9200
```

## 使用方法

### 基本使用

日志系统已完全集成到现有的 `createLoggerWithPrefix` 函数中。无需更改现有代码，只需配置环境变量即可。

```typescript
import createLoggerWithPrefix from './lib/logger';

const logger = createLoggerWithPrefix('MyService');

// 这些日志将同时发送到控制台、文件和 Elasticsearch（如果启用）
logger.info('Application started');
logger.error('An error occurred', { error: errorDetails });
logger.debug('Debug information');
```

### 日志格式

发送到 Elasticsearch 的日志包含以下字段：

- `timestamp`: 日志时间戳
- `level`: 日志级别 (debug, info, warn, error)
- `message`: 日志消息
- `label`: 日志前缀/服务名称
- `meta`: 额外的元数据
- `service`: 服务名称（来自 SERVICE_NAME 环境变量）
- `environment`: 环境名称（来自 NODE_ENV 环境变量）

## 索引管理

### 索引模式

默认情况下，日志将存储在按日期命名的索引中：`logs-YYYY.MM.DD`

您可以通过设置 `ELASTICSEARCH_LOG_INDEX_PATTERN` 来自定义索引模式。

### 索引映射

日志索引使用以下映射：

```json
{
  "properties": {
    "timestamp": { "type": "date" },
    "level": { "type": "keyword" },
    "message": { "type": "text", "analyzer": "standard" },
    "label": { "type": "keyword" },
    "meta": { "type": "object" },
    "service": { "type": "keyword" },
    "environment": { "type": "keyword" }
  }
}
```

## 故障排除

### 常见问题

1. **日志未出现在 Elasticsearch 中**
   - 检查 `ELASTICSEARCH_LOGGING_ENABLED` 是否设置为 `true`
   - 验证 Elasticsearch 服务器连接
   - 检查认证信息是否正确

2. **连接错误**
   - 确保 Elasticsearch 服务器正在运行
   - 检查网络连接和防火墙设置
   - 验证 URL 格式是否正确

3. **认证失败**
   - 检查用户名和密码
   - 验证 API 密钥是否有效
   - 确认用户具有适当的权限

### 调试

如果遇到问题，可以通过控制台输出查看错误信息。Elasticsearch 传输器被设计为在出现错误时不会中断应用程序运行，而是将错误记录到控制台。

**注意**：索引已存在错误是正常的，系统会自动处理这种情况。当多个实例同时尝试创建相同的日期索引时，可能会出现 `resource_already_exists_exception` 错误，这不会影响日志记录功能。

## 性能考虑

- Elasticsearch 日志传输是异步的，不会阻塞应用程序
- 如果 Elasticsearch 不可用，日志将自动回退到其他传输器
- 建议在生产环境中适当调整日志级别以减少网络流量

## 示例配置

### 开发环境

```bash
ELASTICSEARCH_LOGGING_ENABLED=false
SYSTEM_LOG_LEVEL=debug
```

### 生产环境

```bash
ELASTICSEARCH_LOGGING_ENABLED=true
ELASTICSEARCH_LOG_LEVEL=info
ELASTICSEARCH_URL=https://your-elasticsearch-cluster.com:9200
ELASTICSEARCH_USERNAME=your-username
ELASTICSEARCH_PASSWORD=your-password
ELASTICSEARCH_VERIFY_SSL=true
```

## 测试

运行测试以验证 Elasticsearch 日志功能：

```bash
pnpm test knowledgeBase/lib/__tests__/elasticsearch-logger.test.ts