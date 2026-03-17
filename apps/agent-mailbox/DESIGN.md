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
| 订阅 | WebSocket 实时接收新邮件 | `WS /ws/subscribe/:address` |

## 3. API 设计

### 3.1 发送邮件

```http
POST /api/v1/mail/send
Content-Type: application/json

{
  "from": { "type": "expert", "expertId": "pubmed" },
  "to": { "type": "expert", "expertId": "analysis" },
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
GET /api/v1/mail/inbox/expert:analysis?limit=20&offset=0&unreadOnly=false
```

响应：
```json
{
  "success": true,
  "address": { "type": "expert", "expertId": "analysis" },
  "messages": [
    {
      "messageId": "mail_1234567890_abc",
      "subject": "搜索结果",
      "body": "找到 50 篇相关论文",
      "from": { "type": "expert", "expertId": "pubmed" },
      "to": { "type": "expert", "expertId": "analysis" },
      "sentAt": "2026-03-17T10:00:00Z",
      "read": false,
      "starred": false,
      "priority": "high"
    }
  ],
  "total": 1,
  "unread": 1
}
```

### 3.3 WebSocket 订阅

```http
WS /api/v1/ws/subscribe/expert:analysis
```

服务器推送：
```json
{
  "type": "new_mail",
  "mail": {
    "messageId": "mail_1234567890_xyz",
    "subject": "新任务",
    ...
  }
}
```

### 3.4 注册地址

```http
POST /api/v1/address/register
Content-Type: application/json

{
  "address": { "type": "expert", "expertId": "pubmed" }
}
```

## 4. 技术架构

### 4.1 项目结构

```
apps/agent-mailbox/
├── src/
│   ├── index.ts              # 入口
│   ├── server.ts             # Fastify 服务器
│   ├── routes/
│   │   ├── mail.ts          # 邮件相关路由
│   │   ├── inbox.ts         # 收件箱路由
│   │   └── search.ts        # 搜索路由
│   ├── websocket/
│   │   └── subscription.ts  # WebSocket 订阅
│   ├── services/
│   │   └── mailbox.ts       # 邮箱服务（封装 MessageBus）
│   └── types/
│       └── index.ts          # API 类型
├── package.json
└── tsconfig.json
```

### 4.2 依赖

```json
{
  "dependencies": {
    "fastify": "^5.8.2",
    "@fastify/websocket": "^10.0.1",
    "@fastify/cors": "^10.0.1",
    "agent-lib": "workspace:*"
  }
}
```

### 4.3 核心服务

```typescript
// services/mailbox.ts
import { MessageBus } from 'agent-lib';

export class MailboxService {
  private messageBus: MessageBus;

  constructor() {
    this.messageBus = new MessageBus();
    await this.messageBus.initialize();
  }

  async sendMail(mail: OutgoingMail): Promise<MailMessage> {
    return this.messageBus.send(mail);
  }

  async getInbox(address: MailAddress, options?: FetchOptions): Promise<MailMessage[]> {
    const messages = this.messageBus.getInbox(address);
    // Apply pagination and filters
    return messages;
  }

  async getUnreadCount(address: MailAddress): Promise<number> {
    return this.messageBus.getUnreadCount(address);
  }

  subscribe(address: MailAddress, listener: IMailListener): SubscriptionId {
    return this.messageBus.subscribe(address, listener);
  }

  unsubscribe(subscriptionId: SubscriptionId): void {
    this.messageBus.unsubscribe(subscriptionId);
  }
}
```

## 5. 使用流程

### 5.1 Expert 注册与订阅

```
1. Expert 启动
2. 调用 POST /api/v1/address/register 注册地址
3. 建立 WebSocket 连接 /api/v1/ws/subscribe/expert:xxx
4. 等待服务器推送新邮件通知
```

### 5.2 MC 发送任务

```
1. MC 决定调用 Expert
2. 调用 POST /api/v1/mail/send 发送任务邮件
3. 服务器将邮件写入 Expert 收件箱
4. 服务器通过 WebSocket 通知 Expert
5. Expert 处理完成后发送回复邮件
```

## 6. 部署配置

### 6.1 环境变量

```env
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info
CORS_ORIGIN=*
```

### 6.2 启动命令

```bash
# 开发
pnpm dev

# 生产
pnpm start
```

## 7. 下一步

1. 创建项目结构和基础文件
2. 实现 Fastify 服务器
3. 实现邮件 API 路由
4. 实现 WebSocket 订阅
5. 集成 agent-lib 的 MessageBus
6. 编写测试
