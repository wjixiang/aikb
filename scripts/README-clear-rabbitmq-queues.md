# RabbitMQ 队列清除脚本

这个脚本用于清除 RabbitMQ 中的所有队列消息，适用于开发环境中的测试和调试。

## 功能特性

- 清除所有配置的 RabbitMQ 队列中的消息
- 支持清除指定的队列
- 提供详细的日志输出
- 自动处理连接错误和队列不存在的情况
- 支持环境变量配置

## 使用方法

### 1. 清除所有队列

```bash
# 使用 npm script
npm run clear:rabbitmq

# 或直接运行
npx tsx scripts/clear-rabbitmq-queues.ts
```

### 2. 清除指定的队列

```bash
# 清除特定队列
npx tsx scripts/clear-rabbitmq-queues.ts queue1 queue2 queue3

# 例如：只清除 PDF 转换相关的队列
npx tsx scripts/clear-rabbitmq-queues.ts pdf-conversion-request pdf-conversion-completed
```

## 环境变量配置

脚本使用以下环境变量来连接 RabbitMQ：

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `RABBITMQ_HOSTNAME` | `rabbitmq` | RabbitMQ 服务器地址 |
| `RABBITMQ_PORT` | `5672` | RabbitMQ 端口 |
| `RABBITMQ_USERNAME` | `admin` | 用户名 |
| `RABBITMQ_PASSWORD` | `admin123` | 密码 |
| `RABBITMQ_VHOST` | `my_vhost` | 虚拟主机 |

## 配置的队列

脚本会自动清除以下配置的队列：

### PDF 处理相关
- `pdf-conversion-request` - PDF 转换请求
- `pdf-conversion-progress` - PDF 转换进度
- `pdf-conversion-completed` - PDF 转换完成
- `pdf-conversion-failed` - PDF 转换失败
- `pdf-analysis-request` - PDF 分析请求
- `pdf-analysis-completed` - PDF 分析完成
- `pdf-analysis-failed` - PDF 分析失败
- `pdf-part-conversion-request` - PDF 部分转换请求
- `pdf-part-conversion-completed` - PDF 部分转换完成
- `pdf-part-conversion-failed` - PDF 部分转换失败
- `pdf-merging-request` - PDF 合并请求
- `pdf-merging-progress` - PDF 合并进度

### Markdown 存储相关
- `markdown-storage-request` - Markdown 存储请求
- `markdown-storage-completed` - Markdown 存储完成
- `markdown-storage-failed` - Markdown 存储失败
- `markdown-part-storage-request` - Markdown 部分存储请求
- `markdown-part-storage-progress` - Markdown 部分存储进度
- `markdown-part-storage-completed` - Markdown 部分存储完成
- `markdown-part-storage-failed` - Markdown 部分存储失败

### 嵌入和分块相关
- `chunking-embedding-request` - 分块嵌入请求
- `chunking-embedding-progress` - 分块嵌入进度
- `chunking-embedding-completed` - 分块嵌入完成
- `chunking-embedding-failed` - 分块嵌入失败

### 系统相关
- `pdf-conversion-dlq` - 死信队列
- `health-check` - 健康检查队列

## 安全注意事项

⚠️ **警告**: 此脚本会永久删除队列中的所有消息，请谨慎使用！

1. **仅限开发环境**: 此脚本设计用于开发环境，不应在生产环境中使用
2. **数据丢失**: 清除操作不可逆，所有消息将被永久删除
3. **服务影响**: 清除队列可能会影响正在运行的服务
4. **备份建议**: 在清除重要数据前，请确保已做好备份

## 示例输出

```
🧹 开始清除 RabbitMQ 中的所有队列...
连接配置: {
  hostname: "rabbitmq",
  port: 5672,
  username: "admin",
  vhost: "my_vhost"
}
正在连接到 RabbitMQ...
✅ 连接成功！
发现 25 个配置的队列
正在清除队列 'pdf-conversion-request' (15 条消息)...
✅ 已清除队列 'pdf-conversion-request' 的 15 条消息
队列 'pdf-conversion-progress' 已经是空的
...

=== 清除完成 ===
✅ 总共清除了 127 条消息
🎉 所有队列清除操作已完成！
```

## 故障排除

### 连接失败
- 检查 RabbitMQ 服务是否运行
- 验证环境变量配置是否正确
- 确认网络连接和防火墙设置

### 权限错误
- 确认用户名和密码正确
- 检查用户是否有足够的权限清除队列

### 队列不存在
- 脚本会自动跳过不存在的队列
- 这不是错误，可以安全忽略

## 相关脚本

- `scripts/verify-rabbitmq-connection.ts` - 验证 RabbitMQ 连接
- `scripts/fix-rabbitmq-queues-complete.js` - 修复 RabbitMQ 队列配置