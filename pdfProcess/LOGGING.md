# Python 统一日志系统

本文档描述了 PDF 处理模块的统一日志系统，该系统与 TypeScript 版本的日志系统保持一致，支持控制台、文件和 Elasticsearch 日志记录。

## 概述

统一日志系统提供以下功能：
- 控制台日志输出（带标签前缀）
- 结构化 JSON 文件日志
- Elasticsearch 日志集成（可选）
- 可配置的日志级别
- 统一的日志格式

## 配置

### 环境变量

在 `.env` 文件中设置以下环境变量来配置日志系统：

```bash
# 基本日志配置
LOG_LEVEL=INFO                    # 日志级别 (DEBUG, INFO, WARNING, ERROR)
SERVICE_NAME=pdf-splitting-worker # 服务名称
NODE_ENV=development              # 环境名称

# Elasticsearch 日志配置
ELASTICSEARCH_LOGGING_ENABLED=false    # 启用/禁用 Elasticsearch 日志
ELASTICSEARCH_LOG_LEVEL=info           # Elasticsearch 日志级别
ELASTICSEARCH_URL=http://localhost:9200 # Elasticsearch 服务器 URL
ELASTICSEARCH_USERNAME=elastic          # Elasticsearch 用户名
ELASTICSEARCH_PASSWORD=changeme        # Elasticsearch 密码
ELASTICSEARCH_API_KEY=                  # Elasticsearch API 密钥
ELASTICSEARCH_VERIFY_SSL=true           # SSL 验证
ELASTICSEARCH_LOG_INDEX=logs            # 日志索引名称
ELASTICSEARCH_LOG_INDEX_PATTERN=logs-YYYY.MM.DD # 日志索引模式
```

## 使用方法

### 基本使用

```python
from logger import create_logger_with_prefix

# 创建带前缀的日志器
logger = create_logger_with_prefix('MyService')

# 记录不同级别的日志
logger.debug('调试信息')
logger.info('普通信息')
logger.warning('警告信息')
logger.error('错误信息')

# 记录带元数据的日志
logger.info('处理完成', extra={'meta': {'item_id': '123', 'duration': 1000}})
```

### 在现有代码中使用

所有现有的 Python 文件都已更新为使用统一日志系统：

```python
# 旧的方式
import logging
logger = logging.getLogger('MyService')

# 新的方式
from logger import create_logger_with_prefix
logger = create_logger_with_prefix('MyService')
```

## 日志格式

### 控制台格式

```
[MyService] 这是一条日志消息
```

### 文件格式（JSON）

```json
{
  "timestamp": "2025-10-13T09:03:35.875331",
  "level": "info",
  "message": "这是一条日志消息",
  "label": "MyService",
  "meta": {
    "item_id": "123",
    "duration": 1000
  }
}
```

### Elasticsearch 格式

发送到 Elasticsearch 的日志包含以下字段：

- `timestamp`: 日志时间戳
- `level`: 日志级别 (debug, info, warning, error)
- `message`: 日志消息
- `label`: 日志前缀/服务名称
- `meta`: 额外的元数据
- `service`: 服务名称（来自 SERVICE_NAME 环境变量）
- `environment`: 环境名称（来自 NODE_ENV 环境变量）

## 文件结构

```
pdfProcess/
├── logger.py                    # 统一日志模块
├── config.py                    # 配置管理（包含 Elasticsearch 配置）
├── test_logger.py              # 日志测试脚本
├── LOGGING.md                  # 本文档
├── combined.log                # 日志文件（自动创建）
└── *.py                        # 其他 Python 文件（已更新使用统一日志）
```

## 测试

运行测试脚本验证日志系统：

```bash
cd pdfProcess
python3 test_logger.py
```

测试脚本将验证：
- 日志配置
- 控制台日志输出
- 文件日志记录
- Elasticsearch 日志集成（如果启用）

## 与 TypeScript 版本的兼容性

Python 日志系统与 TypeScript 版本完全兼容：

- 使用相同的环境变量名称
- 支持相同的日志级别
- 生成相同的日志格式
- 使用相同的 Elasticsearch 索引结构

## 故障排除

### 常见问题

1. **日志未出现在控制台**
   - 检查 `LOG_LEVEL` 环境变量设置
   - 确保日志级别设置正确

2. **日志文件未创建**
   - 检查文件写入权限
   - 确保目录存在且可写

3. **Elasticsearch 日志失败**
   - 检查 `ELASTICSEARCH_LOGGING_ENABLED` 是否设置为 `true`
   - 验证 Elasticsearch 服务器连接
   - 检查认证信息是否正确
   - 查看 Elasticsearch 依赖是否已安装

4. **依赖问题**
   - 安装必需的依赖：`pip install -r requirements.txt`
   - 确保 `elasticsearch` 包已安装

### 调试模式

启用详细日志输出：

```bash
export LOG_LEVEL=DEBUG
python3 your_script.py
```

## 性能考虑

- Elasticsearch 日志传输是异步的，不会阻塞应用程序
- 如果 Elasticsearch 不可用，日志将自动回退到其他传输器
- 建议在生产环境中适当调整日志级别以减少网络流量
- 文件日志使用轮转机制，单个文件最大 10MB，保留 5 个备份

## 示例配置

### 开发环境

```bash
LOG_LEVEL=DEBUG
ELASTICSEARCH_LOGGING_ENABLED=false
```

### 生产环境

```bash
LOG_LEVEL=INFO
ELASTICSEARCH_LOGGING_ENABLED=true
ELASTICSEARCH_URL=https://your-elasticsearch-cluster.com:9200
ELASTICSEARCH_USERNAME=your-username
ELASTICSEARCH_PASSWORD=your-password
ELASTICSEARCH_VERIFY_SSL=true