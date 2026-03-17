# Agent Mailbox - 设计方案

## 1. 系统概述

基于 Fastify 的类邮箱消息系统，为多 Agent 交流提供基础设施服务。

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        agent-mailbox 服务                                │
│                                                                          │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│   │ Expert A    │    │ Expert B    │    │    MC       │              │
│   │ (HTTP/WS)   │    │ (HTTP/WS)   │    │  (HTTP/WS)  │              │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘              │
│          │                   │                   │                      │
│          └───────────────────┼───────────────────┘                      │
│                              │                                          │
│                    ┌─────────┴─────────┐                              │
│                    │   Fastify Server  │                              │
│                    │                   │                              │
│                    │  ┌─────────────┐  │                              │
│                    │  │ MessageBus  │  │  ← 核心消息逻辑              │
│                    │  │  (in-memory)│  │                              │
│                    │  └─────────────┘  │                              │
│                    └───────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2. 核心功能

| 功能 | 描述 | API |
|-----|------|-----|
| 发送邮件 | 类似 SMTP，发送邮件到目标地址 | `POST /mail/send` |
| 收取邮件 | 获取收件箱邮件列表 | `GET /mail/inbox/:address` |
| 未读计数 | 获取未读邮件数量 | `GET /mail/inbox/:address/unread` |
| 标记已读 | 标记邮件为已读 | `POST /mail/:messageId/read` |
| 星标 | 星标/取消星标邮件 | `POST /mail/:messageId/star` |
| 删除 | 删除邮件 | `DELETE /mail/:messageId` |
| 搜索 | 搜索邮件 | `POST /mail/search` |
| 回复 | 回复邮件 | `POST /mail/:messageId/reply` |
| 线程 | 获取邮件线程 | `GET /mail/:messageId/thread` |
| 批量操作 | 批量标记/删除邮件 | `POST /mail/batch` |
| 订阅 | WebSocket 实时接收新邮件 | `WS /ws/subscribe/:address` |

## 3. API 设计

### 3.1 发送邮件

```http
POST /api/v1/mail/send
Content-Type: application/json

{
  "from": "pubmed@expert",
  "to": "analysis@expert",
  "subject": "搜索结果",
  "body": "找到 50 篇相关论文",
  "attachments": ["s3://bucket/results.json"],
  "priority": "high",
  "payload": {
    "query": "cancer treatment",
    "count": 50
  }
}
```

响应：
```json
{
  "success": true,
  "messageId": "mail_1234567890_abc",
  "sentAt": "2026-03-17T10:00:00Z"
}
```

### 3.2 获取收件箱

```http
GET /api/v1/mail/inbox/analysis@expert?limit=20&offset=0&unreadOnly=false
```

响应：
```json
{
  "address": "analysis@expert",
  "messages": [
    {
      "messageId": "mail_1234567890_abc",
      "subject": "搜索结果",
      "body": "找到 50 篇相关论文",
      "from": "pubmed@expert",
      "to": "analysis@expert",
      "sentAt": "2026-03-17T10:00:00Z",
      "receivedAt": "2026-03-17T10:00:01Z",
      "updatedAt": "2026-03-17T10:00:01Z",
      "status": {
        "read": false,
        "starred": false,
        "deleted": false
      },
      "priority": "high"
    }
  ],
  "total": 1,
  "unread": 1,
  "starred": 0
}
```

### 3.3 回复邮件

```http
POST /api/v1/mail/mail_1234567890_abc/reply
Content-Type: application/json

{
  "body": "收到，开始分析...",
  "attachments": [],
  "payload": {
    "action": "start_analysis"
  }
}
```

响应：
```json
{
  "success": true,
  "messageId": "mail_1234567891_def",
  "sentAt": "2026-03-17T10:05:00Z"
}
```

### 3.4 获取邮件线程

```http
GET /api/v1/mail/mail_1234567890_abc/thread
```

响应：
```json
{
  "rootMessage": {
    "messageId": "mail_1234567890_abc",
    "subject": "搜索结果",
    ...
  },
  "messages": [
    { "messageId": "mail_1234567890_abc", ... },
    { "messageId": "mail_1234567891_def", ... }
  ],
  "total": 2
}
```

### 3.5 批量操作

```http
POST /api/v1/mail/batch
Content-Type: application/json

{
  "operation": "markAsRead",
  "messageIds": ["mail_123", "mail_124", "mail_125"]
}
```

响应：
```json
{
  "success": true,
  "succeeded": 3,
  "failed": 0
}
```

### 3.6 WebSocket 订阅

```http
WS /api/v1/ws/subscribe/analysis@expert
```

服务器推送：
```json
{
  "type": "new_mail",
  "mail": {
    "messageId": "mail_1234567890_xyz",
    "subject": "新任务",
    "from": "mc@system",
    "to": "analysis@expert",
    "sentAt": "2026-03-17T10:10:00Z",
    "priority": "high"
  },
  "timestamp": "2026-03-17T10:10:00Z"
}
```

客户端心跳：
```json
// Client sends
{ "type": "ping" }

// Server responds
{ "type": "pong", "timestamp": "2026-03-17T10:10:30Z" }
```

### 3.7 注册地址

```http
POST /api/v1/mail/register
Content-Type: application/json

{
  "address": "pubmed@expert"
}
```

响应：
```json
{
  "success": true
}
```

## 4. WebSocket 详细说明

### 4.1 连接流程

```
┌──────────┐                           ┌──────────────┐
│  Client  │                           │  Server      │
└────┬─────┘                           └──────┬───────┘
     │                                        │
     │  1. WebSocket Handshake                │
     │ ─────────────────────────────────────>│
     │                                        │
     │  2. Connection Established             │
     │ <─────────────────────────────────────│
     │                                        │
     │  3. Subscribe to Address               │
     │ ─────────────────────────────────────>│
     │                                        │
     │  4. Subscription Confirmation          │
     │ <─────────────────────────────────────│
     │    { "type": "subscribed", ... }       │
     │                                        │
     │  5. New Mail Notification              │
     │ <─────────────────────────────────────│
     │    { "type": "new_mail", ... }         │
     │                                        │
     │  6. Ping (keep-alive)                  │
     │ ─────────────────────────────────────>│
     │                                        │
     │  7. Pong Response                      │
     │ <─────────────────────────────────────│
     │    { "type": "pong", ... }             │
```

### 4.2 消息类型

| 类型 | 方向 | 描述 |
|------|------|------|
| `subscribed` | Server → Client | 订阅成功确认 |
| `new_mail` | Server → Client | 新邮件通知 |
| `ping` | Client → Server | 心跳请求 |
| `pong` | Server → Client | 心跳响应 |
| `error` | Server → Client | 错误通知 |

### 4.3 订阅管理

订阅管理器维护两个索引：
- `subscriptions`: Map<WebSocket, Subscription> - 按 socket 查找订阅
- `addressIndex`: Map<Address, Set<WebSocket>> - 按地址查找订阅者

当新邮件到达时，服务器通过 `addressIndex` 快速找到所有订阅该地址的 WebSocket 连接，并广播通知。

### 4.4 多订阅者支持

同一地址可以有多个 WebSocket 连接（多设备登录），所有订阅者都会收到新邮件通知。

```
                    ┌─────────────┐
                    │  New Mail   │
                    │   to: A     │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌─────────┐  ┌─────────┐  ┌─────────┐
        │ Client 1│  │ Client 2│  │ Client 3│
        │ (Web)   │  │ (Mobile)│  │ (Desktop)
        └─────────┘  └─────────┘  └─────────┘
        All subscribed to address A
```

## 5. 技术架构

### 5.1 项目结构

```
apps/agent-mailbox/
├── src/
│   ├── index.ts              # 入口
│   ├── config.ts             # 配置管理
│   ├── router/
│   │   ├── mail.router.ts   # 邮件 REST API
│   │   └── websocket.router.ts  # WebSocket 路由
│   ├── lib/
│   │   ├── storage/
│   │   │   ├── type.ts      # 存储类型定义
│   │   │   ├── index.ts     # 存储模块导出
│   │   │   └── postgreMailStorage.ts  # PostgreSQL 实现
│   │   ├── websocket/
│   │   │   ├── index.ts     # WebSocket 导出
│   │   │   └── subscriptionManager.ts # 订阅管理
│   │   └── utils/
│   │       ├── date.ts      # 日期工具
│   │       ├── pagination.ts # 分页工具
│   │       ├── response.ts  # 响应格式化
│   │       ├── errors.ts    # 错误类
│   │       └── index.ts     # 工具导出
│   └── generated/
│       └── prisma/          # Prisma 生成文件
├── prisma/
│   ├── schema.prisma        # 数据库模型
│   └── migrations/          # 数据库迁移
├── package.json
├── tsconfig.json
└── DESIGN.md
```

### 5.2 依赖

```json
{
  "dependencies": {
    "fastify": "^5.8.2",
    "@fastify/websocket": "^11.2.0",
    "@fastify/swagger": "^9.7.0",
    "@fastify/swagger-ui": "^5.2.5",
    "@prisma/client": "^5.22.0",
    "prisma": "^5.22.0",
    "dotenv": "^17.3.1",
    "ws": "^8.18.3"
  }
}
```

### 5.3 数据流

```
┌─────────────┐     HTTP/WS      ┌─────────────────┐
│   Client    │◄───────────────►│  Fastify Server │
└─────────────┘                  └────────┬────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                    ▼                     ▼                     ▼
           ┌─────────────┐       ┌──────────────┐      ┌──────────────┐
           │Mail Router  │       │WebSocket     │      │Subscription  │
           │(REST API)   │       │Router        │      │Manager       │
           └──────┬──────┘       └──────┬───────┘      └──────┬───────┘
                  │                     │                     │
                  ▼                     ▼                     │
           ┌─────────────┐       ┌──────────────┐             │
           │PostgreMail  │◄─────►│Prisma Client │             │
           │Storage      │       │              │             │
           └──────┬──────┘       └──────┬───────┘             │
                  │                     │                     │
                  ▼                     ▼                     ▼
           ┌─────────────────────────────────────────────────────┐
           │              PostgreSQL Database                    │
           │  ┌─────────────┐  ┌─────────────────────────────┐  │
           │  │MailMessage  │  │RegisteredAddress            │  │
           │  │             │  │                             │  │
           │  │- messageId  │  │- address                    │  │
           │  │- from       │  │- user                       │  │
           │  │- to         │  │- domain                     │  │
           │  │- subject    │  │- totalSent/totalReceived    │  │
           │  │- body       │  │- active                     │  │
           │  │- status     │  │- timestamps                 │  │
           │  └─────────────┘  └─────────────────────────────┘  │
           └─────────────────────────────────────────────────────┘
```

## 6. 使用流程

### 6.1 Expert 注册与订阅

```
1. Expert 启动
2. 调用 POST /api/v1/mail/register 注册地址
3. 建立 WebSocket 连接 /api/v1/ws/subscribe/expert:xxx
4. 等待服务器推送新邮件通知
```

### 6.2 MC 发送任务

```
1. MC 决定调用 Expert
2. 调用 POST /api/v1/mail/send 发送任务邮件
3. 服务器将邮件写入 Expert 收件箱
4. 服务器通过 WebSocket 通知 Expert
5. Expert 处理完成后发送回复邮件
```

### 6.3 邮件线程流程

```
1. Expert A 发送邮件给 Expert B
   POST /api/v1/mail/send

2. Expert B 收到 WebSocket 通知

3. Expert B 回复邮件
   POST /api/v1/mail/:messageId/reply

4. 双方可以获取完整线程
   GET /api/v1/mail/:messageId/thread
```

## 7. 部署配置

### 7.1 环境变量

```env
# Server
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/agent_mailbox

# WebSocket
WS_ENABLED=true
WS_PING_INTERVAL=30000

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
```

### 7.2 启动命令

```bash
# 开发
pnpm dev

# 生产
pnpm build
pnpm start

# 测试
pnpm test
```

## 8. 实现状态

- [x] 创建项目结构和基础文件
- [x] 实现 Fastify 服务器
- [x] 实现邮件 API 路由
- [x] 实现 WebSocket 订阅
- [x] 集成 PostgreSQL 存储
- [x] 实现邮件回复功能
- [x] 实现邮件线程功能
- [x] 实现批量操作功能
- [x] 编写测试 (61+ tests passing)
- [x] 完善配置管理
- [x] 创建工具函数库
- [x] 统一错误处理
