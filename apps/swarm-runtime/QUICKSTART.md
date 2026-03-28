# Swarm 应用 - 快速开始指南

## 概述

Swarm 应用将 AgentRuntime 包装为 Fastify HTTP 服务器，实现：

- **一个服务器 = 一个 AgentRuntime**
- **HTTP API = AgentRuntime 方法调用**
- **分布式支持 = Redis pub/sub MessageBus**

## 快速开始

### 1. 安装依赖

```bash
cd apps/swarm
pnpm install
```

### 2. 配置环境变量

编辑 `.env` 文件或设置环境变量：

```bash
# 必需：API 密钥
export OPENAI_API_KEY=your-api-key

# 可选：服务器配置
export PORT=9400
export MAX_AGENTS=50

# 可选：Redis 分布式模式
export A2A_MESSAGE_BUS_MODE=redis
export A2A_REDIS_URL=redis://localhost:6379
```

### 3. 启动服务器

```bash
# 开发模式（自动重载）
pnpm dev

# 生产模式
pnpm build
pnpm start
```

## API 使用示例

### 创建 Agent

```bash
curl -X POST http://localhost:9400/api/runtime/agents \
  -H "Content-Type: application/json" \
  -d '{
    "agent": {
      "name": "PubMed Agent",
      "type": "epidemiology",
      "description": "Search PubMed for literature"
    }
  }'
```

响应：

```json
{
  "success": true,
  "data": {
    "instanceId": "agent-xxx-xxx-xxx",
    "serverId": "swarm-xxx"
  }
}
```

### 发送 A2A 任务

```bash
curl -X POST http://localhost:9400/api/a2a/task \
  -H "Content-Type: application/json" \
  -d '{
    "targetAgentId": "agent-xxx-xxx-xxx",
    "taskId": "task-001",
    "description": "搜索癌症治疗相关文献",
    "input": {
      "query": "cancer treatment",
      "database": "pubmed",
      "limit": 20
    },
    "priority": "high"
  }'
```

### 查询状态

```bash
# 获取运行时统计
curl http://localhost:9400/api/runtime/stats

# 列出所有 Agent
curl http://localhost:9400/api/runtime/agents

# 获取服务器指标
curl http://localhost:9400/health/metrics
```

## 分布式部署

### 使用 Docker Compose

```bash
# 启动 Redis + 3 个 Swarm 服务器
docker-compose up -d

# 查看日志
docker-compose logs -f swarm-1

# 停止所有服务
docker-compose down
```

### 手动启动多服务器

```bash
# 终端 1: 服务器 1
PORT=9400 \
SERVER_ID=swarm-1 \
A2A_MESSAGE_BUS_MODE=redis \
A2A_REDIS_URL=redis://localhost:6379 \
pnpm dev

# 终端 2: 服务器 2
PORT=9401 \
SERVER_ID=swarm-2 \
A2A_MESSAGE_BUS_MODE=redis \
A2A_REDIS_URL=redis://localhost:6379 \
pnpm dev

# 终端 3: 服务器 3
PORT=9402 \
SERVER_ID=swarm-3 \
A2A_MESSAGE_BUS_MODE=redis \
A2A_REDIS_URL=redis://localhost:6379 \
pnpm dev
```

## API 端点总览

### Runtime 管理

| 方法   | 路径                          | 描述         |
| ------ | ----------------------------- | ------------ |
| GET    | `/api/runtime/stats`          | 获取统计信息 |
| GET    | `/api/runtime/agents`         | 列出 Agent   |
| POST   | `/api/runtime/agents`         | 创建 Agent   |
| DELETE | `/api/runtime/agents/:id`     | 销毁 Agent   |
| GET    | `/api/runtime/topology`       | 获取拓扑图   |
| GET    | `/api/runtime/topology/stats` | 获取拓扑统计 |

### Agent 操作

| 方法   | 路径                       | 描述            |
| ------ | -------------------------- | --------------- |
| GET    | `/api/agents/:id`          | 获取 Agent 详情 |
| POST   | `/api/agents/:id/start`    | 启动 Agent      |
| POST   | `/api/agents/:id/stop`     | 停止 Agent      |
| DELETE | `/api/agents/:id`          | 销毁 Agent      |
| GET    | `/api/agents/:id/children` | 列出子 Agent    |
| GET    | `/api/agents/:id/logs`     | 获取日志        |

### A2A 通信

| 方法 | 路径                     | 描述     |
| ---- | ------------------------ | -------- |
| POST | `/api/a2a/task`          | 发送任务 |
| POST | `/api/a2a/query`         | 发送查询 |
| POST | `/api/a2a/event`         | 发送事件 |
| POST | `/api/a2a/cancel`        | 发送取消 |
| GET  | `/api/a2a/conversations` | 列出会话 |

### 健康检查

| 方法 | 路径              | 描述         |
| ---- | ----------------- | ------------ |
| GET  | `/health`         | 基础健康检查 |
| GET  | `/health/ready`   | 就绪探针     |
| GET  | `/health/live`    | 存活探针     |
| GET  | `/health/metrics` | 服务器指标   |

## 测试脚本

### 运行 API 测试

```bash
# 确保 API 术语测试依赖已安装
pnpm add -D @types/node

# 运行测试脚本
chmod +x test-api.sh
./test-api.sh
```

### 运行客户端示例

```bash
# 设置服务器地址
export SWARM_SERVER_URL=http://localhost:9400

# 运行客户端示例
pnpm tsx src/examples/client-example.ts
```

## 可用的 Agent 类型

| 类型                  | 描述             |
| --------------------- | ---------------- |
| `epidemiology`        | 流行病学文献检索 |
| `pathophysiology`     | 病理机制文献检索 |
| `diagnosis`           | 诊断文献检索     |
| `management`          | 治疗管理文献检索 |
| `quality-of-life`     | 生活质量文献检索 |
| `emerging-treatments` | 新兴疗法文献检索 |
| `router`              | 路由 Agent       |
| `bib-retrieve`        | 综合检索 Agent   |

## 故障排查

### 无法启动服务器

1. 检查端口占用：`lsof -i :9400`
2. 检查 API 密钥：确保 `OPENAI_API_KEY` 已设置
3. 查看日志：检查控制台输出

### Agent 创建失败

1. 检查 API 密钥是否有效
2. 检查 Agent 类型是否正确
3. 查看服务器日志获取详细错误

### A2A 通信失败

1. 确保目标 Agent 存在且正在运行
2. 检查 Redis 连接（分布式模式）
3. 查看服务器日志

## 下一步

- 查看 [README.md](README.md) 获取完整文档
- 查看 [src/examples/agent-souls.ts](src/examples/agent-souls.ts) 了解 Agent 配置
- 使用 [test-api.sh](test-api.sh) 测试所有 API
