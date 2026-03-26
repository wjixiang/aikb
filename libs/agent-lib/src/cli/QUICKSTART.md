# Agent CLI - 快速开始指南

## 安装

```bash
# 安装依赖（如果还没有）
pnpm install

# 链接 CLI（开发模式）
pnpm link --global
```

## 基本用法

### 1. 查看帮助

```bash
agent-cli --help
```

### 2. 启动 Runtime

```bash
# 内存模式（默认）
agent-cli runtime start

# Redis 模式
agent-cli runtime start --message-bus redis --redis-url redis://localhost:6379

# 后台运行
agent-cli runtime start --detach

# 自定义配置
agent-cli runtime start \
  --max-agents 20 \
  --api-key YOUR_API_KEY \
  --api-model gpt-4
```

### 3. 查看状态

```bash
agent-cli runtime status
```

### 4. 创建 Agent

```bash
# 创建一个流行病学 Agent
agent-cli agent create epidemiology

# 创建并命名
agent-cli agent create diagnosis --name "Diagnosis Agent 1"

# 创建并自动启动
agent-cli agent create management --auto-start
```

### 5. 列出 Agent

```bash
agent-cli agent list
```

### 6. 运行测试

```bash
# 基础功能测试
agent-cli test basic --agent-count 3

# A2A 通信测试
agent-cli test a2a --task-count 5

# Redis 分布式测试
agent-cli test redis --runtime-count 2 --agent-per-runtime 2
```

### 7. 监控

```bash
# 监控 Runtime
agent-cli monitor runtime

# 监控 A2A 通信
agent-cli monitor a2a

# 查看日志
agent-cli monitor logs
```

### 8. A2A 通信

```bash
# 发送任务
agent-cli a2a send-task agent-abc123 "Search PubMed for LDH" \
  --input '{"query":"lumbar disc herniation","limit":10}' \
  --priority high

# 发送查询
agent-cli a2a send-query agent-abc123 "What is your status?"

# 发送事件
agent-cli a2a send-event agent-abc123 "user:connected" \
  --data '{"userId":"user-001"}'

# 查看会话
agent-cli a2a conversations
```

## 配置文件

创建 `.agent-clirc` 文件：

```yaml
# .agent-clirc
runtime:
  maxAgents: 10
  messageBus: memory
  # redis:
  #   url: redis://localhost:6379

api:
  provider: openai
  apiKey: ${OPENAI_API_KEY}
  baseUrl: https://api.openai.com/v1
  model: gpt-4

agent:
  defaultType: coordinator
  autoStart: false

monitor:
  refreshInterval: 1000
  compact: false

log:
  level: info
  format: pretty
```

## 使用 pnpm scripts

```bash
# 启动 runtime
pnpm agent:runtime:start

# 查看状态
pnpm agent:runtime:status

# 运行基础测试
pnpm agent:test:basic

# 运行 A2A 测试
pnpm agent:test:a2a

# 监控 runtime
pnpm agent:monitor:runtime
```

## 示例工作流

### 工作流 1: 单进程测试

```bash
# 1. 启动 Runtime
agent-cli runtime start

# 2. 创建多个 Agent
agent-cli agent create epidemiology --auto-start
agent-cli agent create diagnosis --auto-start
agent-cli agent create management --auto-start

# 3. 查看 Agent 状态
agent-cli agent list

# 4. 运行 A2A 测试
agent-cli test a2a --task-count 3

# 5. 监控 A2A 通信
agent-cli monitor a2a

# 6. 停止 Runtime
agent-cli runtime stop
```

### 工作流 2: 分布式测试 (Redis)

```bash
# 终端 1: 启动第一个 Runtime
agent-cli runtime start --message-bus redis --detach

# 终端 2: 启动第二个 Runtime
agent-cli runtime start --message-bus redis --detach

# 终端 3: 创建 Agents 并测试
agent-cli agent create epidemiology --auto-start
agent-cli agent create diagnosis --auto-start

agent-cli test redis --runtime-count 2

# 清理
agent-cli runtime stop
```

## 输出格式

所有命令支持不同的输出格式：

```bash
# 表格格式（默认，易读）
agent-cli agent list -o table

# JSON 格式（便于脚本解析）
agent-cli agent list -o json

# 紧凑格式（节省空间）
agent-cli agent list -o compact
```

## 退出码

| 码 | 含义 |
|----|------|
| 0 | 成功 |
| 1 | 一般错误 |
| 2 | 无效参数 |
| 3 | Runtime 未运行 |
| 4 | Agent 未找到 |
| 5 | 超时 |
| 6 | 测试失败 |

## 故障排查

### Runtime 无法启动

```bash
# 检查 PID 文件
ls -la .agent-runtime.pid

# 强制停止
agent-cli runtime stop --force

# 检查日志
agent-cli runtime status -v
```

### Agent 未响应

```bash
# 查看 Agent 日志
agent-cli agent logs <instance-id>

# 查看所有 Agent
agent-cli agent list -o json

# 检查 A2A 通信
agent-cli monitor a2a
```

### Redis 连接失败

```bash
# 检查 Redis 是否运行
redis-cli ping

# 测试连接
agent-cli test redis --redis-url redis://localhost:6379
```

## 下一步

- 阅读完整文档: `src/cli/README.md`
- 查看测试场景: `agent-cli test list`
- 自定义配置: 创建 `.agent-clirc` 文件
