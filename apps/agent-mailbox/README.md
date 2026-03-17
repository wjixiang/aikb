# Agent Mailbox

基于 Fastify 的类邮箱消息系统，为多 Agent 通信提供基础设施服务。

## 功能特性

- **邮件发送与接收**: 支持一对一和一对多邮件发送
- **收件箱管理**: 分页、过滤、排序邮件列表
- **状态管理**: 已读/未读、星标、删除状态
- **邮件搜索**: 多维度搜索（发件人、主题、正文、日期等）
- **邮件回复**: 支持邮件回复和对话线程
- **批量操作**: 批量标记、删除邮件
- **实时通知**: WebSocket 推送新邮件通知
- **地址注册**: 动态注册邮箱地址

## 架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Agent Mailbox Service                             │
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
│                    │  │ REST API    │  │  ← /api/v1/mail/*           │
│                    │  │ WebSocket   │  │  ← /api/v1/ws/*             │
│                    │  └─────────────┘  │                              │
│                    └─────────┬─────────┘                              │
│                              │                                          │
│                    ┌─────────┴─────────┐                              │
│                    │  PostgreSQL       │                              │
│                    │  - MailMessage    │                              │
│                    │  - RegisteredAddr │                              │
│                    └───────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────┘
```

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，设置数据库连接等配置
```

### 数据库设置

```bash
# 生成 Prisma 客户端
pnpm prisma generate

# 运行数据库迁移
pnpm prisma migrate dev
```

### 启动服务

```bash
# 开发模式（热重载）
pnpm dev

# 生产模式
pnpm build
pnpm start
```

服务启动后：
- API 地址: http://localhost:3000
- Swagger UI: http://localhost:3000/docs

## 使用示例

### 1. 注册地址

```bash
curl -X POST http://localhost:3000/api/v1/mail/register \
  -H "Content-Type: application/json" \
  -d '{"address": "myagent@expert"}'
```

### 2. 发送邮件

```bash
curl -X POST http://localhost:3000/api/v1/mail/send \
  -H "Content-Type: application/json" \
  -d '{
    "from": "myagent@expert",
    "to": "another@expert",
    "subject": "Hello",
    "body": "This is a test message",
    "priority": "normal"
  }'
```

### 3. 获取收件箱

```bash
curl "http://localhost:3000/api/v1/mail/inbox/another@expert?limit=10&offset=0"
```

### 4. WebSocket 订阅（JavaScript）

```javascript
const ws = new WebSocket('ws://localhost:3000/api/v1/ws/subscribe/another@expert');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'new_mail') {
    console.log('New mail received:', data.mail.subject);
  }
};
```

### 5. 回复邮件

```bash
curl -X POST http://localhost:3000/api/v1/mail/mail_1234567890_abc_0/reply \
  -H "Content-Type: application/json" \
  -d '{
    "body": "Thanks for your message!"
  }'
```

### 6. 获取邮件线程

```bash
curl http://localhost:3000/api/v1/mail/mail_1234567890_abc_0/thread
```

### 7. 批量操作

```bash
curl -X POST http://localhost:3000/api/v1/mail/batch \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "markAsRead",
    "messageIds": ["mail_123", "mail_124"]
  }'
```

## 项目结构

```
apps/agent-mailbox/
├── src/
│   ├── index.ts              # 应用入口
│   ├── config.ts             # 配置管理
│   ├── router/
│   │   ├── mail.router.ts    # 邮件 REST API
│   │   └── websocket.router.ts # WebSocket 路由
│   ├── lib/
│   │   ├── storage/          # 存储层
│   │   │   ├── type.ts       # 类型定义
│   │   │   └── postgreMailStorage.ts
│   │   ├── websocket/        # WebSocket 管理
│   │   │   └── subscriptionManager.ts
│   │   └── utils/            # 工具函数
│   │       ├── date.ts       # 日期工具
│   │       ├── pagination.ts # 分页工具
│   │       ├── response.ts   # 响应格式化
│   │       └── errors.ts     # 错误类
│   └── generated/prisma/     # Prisma 生成文件
├── prisma/
│   └── schema.prisma         # 数据库模型
├── package.json
├── tsconfig.json
├── DESIGN.md                 # 设计文档
└── API.md                    # API 文档
```

## API 文档

详细 API 文档请参见 [API.md](./API.md)。

主要端点：

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/v1/mail/health` | 健康检查 |
| POST | `/api/v1/mail/send` | 发送邮件 |
| GET | `/api/v1/mail/inbox/:address` | 获取收件箱 |
| GET | `/api/v1/mail/inbox/:address/unread` | 未读计数 |
| POST | `/api/v1/mail/:messageId/read` | 标记已读 |
| POST | `/api/v1/mail/:messageId/star` | 添加星标 |
| DELETE | `/api/v1/mail/:messageId` | 删除邮件 |
| POST | `/api/v1/mail/search` | 搜索邮件 |
| POST | `/api/v1/mail/:messageId/reply` | 回复邮件 |
| GET | `/api/v1/mail/:messageId/thread` | 获取线程 |
| POST | `/api/v1/mail/batch` | 批量操作 |
| POST | `/api/v1/mail/register` | 注册地址 |
| WS | `/api/v1/ws/subscribe/:address` | WebSocket 订阅 |

## 测试

```bash
# 运行所有测试
pnpm test

# 运行测试（监视模式）
pnpm test:watch
```

## 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| PORT | 服务端口 | 3000 |
| HOST | 服务主机 | 0.0.0.0 |
| DATABASE_URL | PostgreSQL 连接字符串 | - |
| LOG_LEVEL | 日志级别 | info |
| WS_ENABLED | 启用 WebSocket | true |
| RATE_LIMIT_ENABLED | 启用限流 | false |

完整环境变量配置请参见 [.env.example](./.env.example)。

## 相关文档

- [设计文档](./DESIGN.md) - 系统架构和设计决策
- [API 文档](./API.md) - 完整的 API 参考

## License

MIT
