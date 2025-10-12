# Worker 守护进程指南

本指南详细说明了如何启动和管理 PDF 处理 workers 的守护进程。

## 🔧 问题背景

之前的启动脚本存在以下问题：
1. **进程自动退出**: 当主脚本退出时，子进程也被终止
2. **僵尸进程**: 即使使用 `detached: true` 和 `unref()`，进程仍然变成僵尸进程
3. **日志捕获问题**: 子进程的输出没有正确捕获到日志文件

## 🚀 推荐的解决方案

### 方案 1: 使用 PM2（推荐）

PM2 是一个专业的 Node.js 进程管理器，可以很好地处理守护进程。

```bash
# 安装 PM2
npm install -g pm2

# 启动所有 workers
pm2 start knowledgeBase/lib/rabbitmq/pdf-analysis.worker.ts --name "pdf-analysis-worker" --interpreter tsx
pm2 start knowledgeBase/lib/rabbitmq/pdf-processing-coordinator.worker.ts --name "pdf-processing-coordinator-worker" --interpreter tsx
pm2 start knowledgeBase/lib/rabbitmq/pdf-conversion.worker.ts --name "pdf-conversion-worker" --interpreter tsx
pm2 start knowledgeBase/lib/rabbitmq/markdown-storage.worker.ts --name "markdown-storage-worker" --interpreter tsx

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 停止所有 workers
pm2 stop all

# 重启所有 workers
pm2 restart all
```

### 方案 2: 使用 nohup（临时解决方案）

```bash
# 启动 PDF Conversion Worker
nohup pnpm tsx knowledgeBase/lib/rabbitmq/pdf-conversion.worker.ts > logs/pdf-conversion-worker.log 2>&1 &

# 启动 PDF Analysis Worker
nohup pnpm tsx knowledgeBase/lib/rabbitmq/pdf-analysis.worker.ts > logs/pdf-analysis-worker.log 2>&1 &

# 启动 PDF Processing Coordinator Worker
nohup pnpm tsx knowledgeBase/lib/rabbitmq/pdf-processing-coordinator.worker.ts > logs/pdf-processing-coordinator-worker.log 2>&1 &

# 启动 Markdown Storage Worker
nohup pnpm tsx knowledgeBase/lib/rabbitmq/markdown-storage.worker.ts > logs/markdown-storage-worker.log 2>&1 &
```

### 方案 3: 使用 screen 或 tmux

```bash
# 使用 screen
screen -S pdf-workers
pnpm tsx knowledgeBase/lib/rabbitmq/pdf-conversion.worker.ts &
pnpm tsx knowledgeBase/lib/rabbitmq/pdf-analysis.worker.ts &
pnpm tsx knowledgeBase/lib/rabbitmq/pdf-processing-coordinator.worker.ts &
pnpm tsx knowledgeBase/lib/rabbitmq/markdown-storage.worker.ts &
# 按 Ctrl+A 然后 D 分离会话

# 重新连接
screen -r pdf-workers
```

## 📋 创建便捷脚本

让我们为 PM2 创建便捷的 npm 脚本：

### 更新 package.json

```json
{
  "scripts": {
    "start:workers:pm2": "pm2 start ecosystem.config.js",
    "stop:workers:pm2": "pm2 stop all",
    "restart:workers:pm2": "pm2 restart all",
    "logs:workers:pm2": "pm2 logs",
    "status:workers:pm2": "pm2 status"
  }
}
```

### 创建 PM2 配置文件

创建 `ecosystem.config.js` 文件：

```javascript
module.exports = {
  apps: [
    {
      name: 'pdf-analysis-worker',
      script: 'knowledgeBase/lib/rabbitmq/pdf-analysis.worker.ts',
      interpreter: 'tsx',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      log_file: 'logs/pm2-combined.log',
      out_file: 'logs/pm2-out.log',
      error_file: 'logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'pdf-processing-coordinator-worker',
      script: 'knowledgeBase/lib/rabbitmq/pdf-processing-coordinator.worker.ts',
      interpreter: 'tsx',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      log_file: 'logs/pm2-combined.log',
      out_file: 'logs/pm2-out.log',
      error_file: 'logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'pdf-conversion-worker',
      script: 'knowledgeBase/lib/rabbitmq/pdf-conversion.worker.ts',
      interpreter: 'tsx',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      log_file: 'logs/pm2-combined.log',
      out_file: 'logs/pm2-out.log',
      error_file: 'logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'markdown-storage-worker',
      script: 'knowledgeBase/lib/rabbitmq/markdown-storage.worker.ts',
      interpreter: 'tsx',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      log_file: 'logs/pm2-combined.log',
      out_file: 'logs/pm2-out.log',
      error_file: 'logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
```

## 🔍 验证 Workers 状态

### 使用 PM2

```bash
# 查看所有进程状态
pm2 status

# 查看详细信息
pm2 show pdf-analysis-worker

# 实时监控
pm2 monit

# 查看日志
pm2 logs pdf-analysis-worker
```

### 手动验证

```bash
# 检查进程
ps aux | grep -E "(tsx|node).*worker" | grep -v grep

# 检查 RabbitMQ 队列
curl -u guest:guest http://localhost:15672/api/queues | jq '.[] | {name: .name, consumers: .consumers, messages: .messages}'

# 运行状态检查脚本
pnpm check:workers
```

## 🛠️ 故障排除

### Worker 启动后立即退出

1. **检查日志文件**:
   ```bash
   tail -f logs/pm2-error.log
   ```

2. **检查环境变量**:
   ```bash
   pm2 env 0
   ```

3. **手动测试单个 worker**:
   ```bash
   pnpm tsx knowledgeBase/lib/rabbitmq/pdf-conversion.worker.ts
   ```

### Worker 无法连接到 RabbitMQ

1. **检查 RabbitMQ 状态**:
   ```bash
   docker ps | grep rabbitmq
   curl -u guest:guest http://localhost:15672/api/overview
   ```

2. **检查网络连接**:
   ```bash
   telnet localhost 5672
   ```

### 内存泄漏

1. **监控内存使用**:
   ```bash
   pm2 monit
   ```

2. **设置内存限制**:
   在 `ecosystem.config.js` 中设置 `max_memory_restart`

## 📊 监控和日志

### PM2 监控

```bash
# 启动 Web 监控界面
pm2 plus

# 查看实时日志
pm2 logs --lines 100

# 查看特定时间范围的日志
pm2 logs --timestamp --lines 1000
```

### 系统监控

```bash
# 监控系统资源
htop

# 监控磁盘使用
df -h

# 监控 RabbitMQ 队列
watch -n 5 "curl -s -u guest:guest http://localhost:15672/api/queues | jq '.[] | {name: .name, messages: .messages}'"
```

## 🔄 自动重启配置

PM2 提供了多种自动重启选项：

1. **自动重启**: `autorestart: true`
2. **内存限制重启**: `max_memory_restart: '1G'`
3. **文件变化重启**: `watch: true`（开发环境）
4. **异常重启**: 默认行为

## 🚨 生产环境建议

1. **使用 PM2 集群模式**: 对于高负载环境
2. **配置日志轮转**: 防止日志文件过大
3. **设置监控告警**: 使用 PM2 Plus 或其他监控工具
4. **定期备份**: 备份配置和重要数据
5. **健康检查**: 定期检查 worker 状态

## 📝 总结

- **推荐使用 PM2** 作为生产环境的进程管理器
- **避免使用自定义守护进程脚本**，因为它们容易出现僵尸进程问题
- **确保正确的日志配置**，便于故障排除
- **设置适当的监控和告警**，确保系统稳定运行

如果遇到问题，请优先查看日志文件，这通常是解决问题的关键。