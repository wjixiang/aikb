# Swarm - Fastify + AgentRuntime Server

一个 Fastify 服务器 = 一个 AgentRuntime

## 概述

Swarm 应用使用 Fastify 包装 AgentRuntime，将 Agent 运行时的能力暴露为 HTTP API。每个服务器实例运行一个 AgentRuntime，支持：

- **单机模式**: 使用内存 MessageBus
- **分布式模式**: 使用 Redis pub/sub MessageBus 进行跨服务器通信

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Fastify Server                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              AgentRuntime Plugin                       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │           AgentRuntime                          │  │  │
│  │  │  ┌────────┐  ┌────────┐  ┌──────────────────┐  │  │  │
│  │  │  │ Agent1 │  │ Agent2 │  │   MessageBus     │  │  │  │
│  │  │  └────────┘  └────────┘  │ (memory/redis)   │  │  │  │
│  │  │  ┌────────┐               └──────────────────┘  │  │  │
│  │  │  │ AgentN │                                   │  │  │
│  │  │  └────────┘                                   │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  HTTP API Routes:                                          │
│  - /api/runtime/*   - Runtime management                   │
│  - /api/agents/*    - Agent operations                     │
│  - /api/a2a/*       - A2A communication                   │
│  - /health/*        - Health checks                        │
└─────────────────────────────────────────────────────────────┘
```

## 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `SERVER_ID` | 服务器唯一 ID | `swarm-{timestamp}` |
| `HOST` | 监听地址 | `0.0.0.0` |
| `PORT` | 监听端口 | `9400` |
| `LOG_LEVEL` | 日志级别 | `info` |
| `MAX_AGENTS` | 最大 Agent 数量 | `50` |
| `OPENAI_API_KEY` | OpenAI API 密钥 | - |
| `GLM_API_KEY` | GLM API 密钥 | - |
| `API_PROVIDER` | API 提供商 | `openai` |
| `API_BASE_URL` | API 基础 URL | - |
| `API_MODEL_ID` | 模型 ID | - |
| `API_TIMEOUT` | API 超时 (ms) | `120000` |
| `A2A_MESSAGE_BUS_MODE` | MessageBus 模式 | `memory` |
| `A2A_REDIS_URL` | Redis 连接 URL | - |
| `A2A_REDIS_HOST` | Redis 主机 | `localhost` |
| `A2A_REDIS_PORT` | Redis 端口 | `6379` |
| `A2A_REDIS_PASSWORD` | Redis 密码 | - |
| `A2A_REDIS_DB` | Redis 数据库 | `0` |

## API 文档

### Runtime 管理

#### GET /api/runtime/stats
获取运行时统计信息

```bash
curl http://localhost:9400/api/runtime/stats
```

响应:
```json
{
  "success": true,
  "data": {
    "totalAgents": 5,
    "agentsByStatus": {
      "running": 3,
      "idle": 2,
      "stopped": 0,
      "error": 0
    }
  },
  "serverId": "swarm-xxx"
}
```

#### GET /api/runtime/agents
列出所有 Agent

```bash
curl http://localhost:9400/api/runtime/agents
```

查询参数:
- `status` - 过滤状态
- `type` - 过滤类型
- `name` - 过滤名称

#### POST /api/runtime/agents
创建 Agent

```bash
curl -X POST http://localhost:9400/api/runtime/agents \
  -H "Content-Type: application/json" \
  -d '{
    "agent": {
      "name": "My Agent",
      "type": "epidemiology",
      "description": "Epidemiology search agent"
    }
  }'
```

#### DELETE /api/runtime/agents/:instanceId
销毁 Agent

```bash
curl -X DELETE http://localhost:9400/api/runtime/agents/{instanceId}?cascade=true
```

### A2A 通信

#### POST /api/a2a/task
发送 A2A 任务

```bash
curl -X POST http://localhost:9400/api/a2a/task \
  -H "Content-Type: application/json" \
  -d '{
    "targetAgentId": "agent-xyz",
    "taskId": "task-001",
    "description": "Search for papers",
    "input": {
      "query": "lumbar disc herniation",
      "limit": 10
    },
    "priority": "high"
  }'
```

响应:
```json
{
  "success": true,
  "data": {
    "taskId": "task-001",
    "status": "completed",
    "output": { ... }
  }
}
```

#### POST /api/a2a/query
发送 A2A 查询

```bash
curl -X POST http://localhost:9400/api/a2a/query \
  -H "Content-Type: application/json" \
  -d '{
    "targetAgentId": "agent-xyz",
    "query": "What is your status?"
  }'
```

#### POST /api/a2a/event
发送 A2A 事件

```bash
curl -X POST http://localhost:9400/api/a2a/event \
  -H "Content-Type: application/json" \
  -d '{
    "targetAgentId": "agent-xyz",
    "eventType": "user:connected",
    "data": {
      "userId": "user-001",
      "timestamp": 1234567890
    }
  }'
```

### 健康检查

#### GET /health
基础健康检查

```bash
curl http://localhost:9400/health
```

#### GET /health/ready
就绪探针 (Kubernetes ready)

```bash
curl http://localhost:9400/health/ready
```

#### GET /health/live
存活探针 (Kubernetes liveness)

```bash
curl http://localhost:9400/health/live
```

#### GET /health/metrics
服务器指标

```bash
curl http://localhost:9400/health/metrics
```

## 开发

### 安装依赖

```bash
cd apps/swarm
pnpm install
```

### 运行开发服务器

```bash
pnpm dev
```

### 构建

```bash
pnpm build
```

### 运行生产服务器

```bash
pnpm start
```

## 部署

### 单机部署

```bash
# 单服务器，内存 MessageBus
PORT=9400 \
MAX_AGENTS=50 \
OPENAI_API_KEY=your-key \
pnpm start
```

### 分布式部署

启动多个服务器实例，使用 Redis 进行通信：

```bash
# 服务器 1
PORT=9400 \
SERVER_ID=swarm-server-1 \
A2A_MESSAGE_BUS_MODE=redis \
A2A_REDIS_URL=redis://localhost:6379 \
pnpm start

# 服务器 2
PORT=9401 \
SERVER_ID=swarm-server-2 \
A2A_MESSAGE_BUS_MODE=redis \
A2A_REDIS_URL=redis://localhost:6379 \
pnpm start
```

### Docker 部署

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm@10.7.0
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

EXPOSE 9400

CMD ["pnpm", "start"]
```

## 使用示例

### 创建 Agent

```bash
curl -X POST http://localhost:9400/api/runtime/agents \
  -H "Content-Type: application/json" \
  -d '{
    "agent": {
      "name": "PubMed Search",
      "type": "epidemiology",
      "sop": "你是一个医学文献检索专家..."
    },
    "components": [
      { "componentClass": "BibliographySearchComponent" },
      { "componentClass": "A2ATaskComponent" }
    ]
  }'
```

### 发送任务

```bash
curl -X POST http://localhost:9400/api/a2a/task \
  -H "Content-Type: application/json" \
  -d '{
    "targetAgentId": "agent-abc123",
    "taskId": "search-001",
    "description": "搜索椎间盘突出的流行病学文献",
    "input": {
      "query": "lumbar disc herniation epidemiology",
      "database": "pubmed",
      "limit": 20
    },
    "priority": "high"
  }'
```

### 查询状态

```bash
curl http://localhost:9400/api/runtime/stats
```

## 项目结构

```
apps/swarm/
├── src/
│   ├── server.ts              # 主入口
│   ├── config.ts              # 配置加载
│   ├── plugins/
│   │   └── agent-runtime.ts   # AgentRuntime Fastify 插件
│   └── routes/
│       ├── runtime.ts         # Runtime API 路由
│       ├── agent.ts           # Agent API 路由
│       ├── a2a.ts             # A2A API 路由
│       └── health.ts          # 健康检查路由
├── .env                       # 环境变量
├── package.json
└── tsconfig.json
```

## 设计原则

1. **一对一映射**: 一个 Fastify 服务器 = 一个 AgentRuntime
2. **RESTful API**: HTTP 端点映射到 RuntimeControlClient 方法
3. **状态管理**: Agent 状态由 AgentRuntime 管理，API 只做转发
4. **分布式支持**: 通过 Redis MessageBus 支持多服务器部署
5. **可观测性**: 提供健康检查和指标端点
