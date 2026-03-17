# Agent Mailbox API 文档

## 目录

- [概述](#概述)
- [基础信息](#基础信息)
- [认证](#认证)
- [错误处理](#错误处理)
- [API 端点](#api-端点)
  - [健康检查](#健康检查)
  - [发送邮件](#发送邮件)
  - [获取收件箱](#获取收件箱)
  - [获取未读计数](#获取未读计数)
  - [获取单封邮件](#获取单封邮件)
  - [标记已读/未读](#标记已读未读)
  - [星标/取消星标](#星标取消星标)
  - [删除邮件](#删除邮件)
  - [搜索邮件](#搜索邮件)
  - [回复邮件](#回复邮件)
  - [获取邮件线程](#获取邮件线程)
  - [批量操作](#批量操作)
  - [注册地址](#注册地址)
- [WebSocket API](#websocket-api)

## 概述

Agent Mailbox 是一个为 Multi-Agent 系统设计的类邮箱消息服务，提供 REST API 和 WebSocket 实时通知功能。

## 基础信息

- **Base URL**: `http://localhost:3000/api/v1`
- **Content-Type**: `application/json`
- **Swagger UI**: `http://localhost:3000/docs`

## 认证

目前版本使用简单的地址注册机制。调用方需要先注册地址，然后才能收发邮件。

```http
POST /mail/register
{
  "address": "yourname@expert"
}
```

## 错误处理

所有 API 返回统一的错误格式：

```json
{
  "success": false,
  "error": "错误描述",
  "errorCode": "ERROR_CODE",
  "timestamp": "2026-03-17T10:00:00Z"
}
```

### HTTP 状态码

| 状态码 | 描述 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## API 端点

### 健康检查

检查服务运行状态。

```http
GET /mail/health
```

**响应示例**:
```json
{
  "health": true,
  "timestamp": "2026-03-17T10:00:00Z"
}
```

---

### 发送邮件

发送邮件到一个或多个收件人。

```http
POST /mail/send
```

**请求体**:
```json
{
  "from": "sender@expert",
  "to": "recipient@expert",
  "subject": "邮件主题",
  "body": "邮件正文内容",
  "cc": ["cc@expert"],
  "bcc": ["bcc@expert"],
  "attachments": ["s3://bucket/file.pdf"],
  "priority": "normal",
  "taskId": "task-123",
  "payload": {
    "custom": "data"
  }
}
```

**字段说明**:

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| from | string | 是 | 发件人地址 |
| to | string \| string[] | 是 | 收件人地址（可多个） |
| subject | string | 是 | 邮件主题 |
| body | string | 否 | 邮件正文 |
| cc | string[] | 否 | 抄送地址 |
| bcc | string[] | 否 | 密送地址 |
| attachments | string[] | 否 | 附件 S3 路径 |
| priority | string | 否 | 优先级: low, normal, high, urgent |
| taskId | string | 否 | 关联任务ID |
| payload | object | 否 | 自定义数据 |

**响应示例**:
```json
{
  "success": true,
  "messageId": "mail_1234567890_abc",
  "sentAt": "2026-03-17T10:00:00Z"
}
```

---

### 获取收件箱

获取指定地址的收件箱邮件列表。

```http
GET /mail/inbox/:address?limit=20&offset=0&unreadOnly=false&starredOnly=false&sortBy=sentAt&sortOrder=desc
```

**路径参数**:
- `address`: 邮箱地址（需 URL 编码）

**查询参数**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| limit | number | 20 | 每页数量（最大 100） |
| offset | number | 0 | 跳过数量 |
| unreadOnly | boolean | false | 仅显示未读 |
| starredOnly | boolean | false | 仅显示星标 |
| sortBy | string | sentAt | 排序字段: sentAt, receivedAt, subject, priority |
| sortOrder | string | desc | 排序方向: asc, desc |

**响应示例**:
```json
{
  "address": "recipient@expert",
  "messages": [
    {
      "messageId": "mail_1234567890_abc_0",
      "subject": "邮件主题",
      "body": "邮件正文",
      "from": "sender@expert",
      "to": "recipient@expert",
      "cc": [],
      "bcc": [],
      "attachments": [],
      "priority": "normal",
      "status": {
        "read": false,
        "starred": false,
        "deleted": false
      },
      "sentAt": "2026-03-17T10:00:00Z",
      "receivedAt": "2026-03-17T10:00:01Z",
      "updatedAt": "2026-03-17T10:00:01Z"
    }
  ],
  "total": 1,
  "unread": 1,
  "starred": 0
}
```

---

### 获取未读计数

获取指定地址的未读邮件数量。

```http
GET /mail/inbox/:address/unread
```

**响应示例**:
```
1
```

---

### 获取单封邮件

根据 ID 获取单封邮件详情。

```http
GET /mail/:messageId
```

**响应示例**:
```json
{
  "messageId": "mail_1234567890_abc_0",
  "subject": "邮件主题",
  "body": "邮件正文",
  "from": "sender@expert",
  "to": "recipient@expert",
  "priority": "normal",
  "status": {
    "read": false,
    "starred": false,
    "deleted": false
  },
  "sentAt": "2026-03-17T10:00:00Z",
  "receivedAt": "2026-03-17T10:00:01Z",
  "updatedAt": "2026-03-17T10:00:01Z"
}
```

---

### 标记已读/未读

标记邮件为已读或未读状态。

```http
POST /mail/:messageId/read
POST /mail/:messageId/unread
```

**响应示例**:
```json
{
  "success": true
}
```

---

### 星标/取消星标

标记或取消邮件星标。

```http
POST /mail/:messageId/star
POST /mail/:messageId/unstar
```

**响应示例**:
```json
{
  "success": true
}
```

---

### 删除邮件

软删除邮件（标记为已删除，可从数据库恢复）。

```http
DELETE /mail/:messageId
```

**响应示例**:
```json
{
  "success": true
}
```

---

### 搜索邮件

跨所有邮箱搜索邮件。

```http
POST /mail/search
```

**请求体**:
```json
{
  "from": "sender@expert",
  "to": "recipient@expert",
  "subject": "关键词",
  "body": "正文内容",
  "unread": true,
  "starred": false,
  "priority": "high",
  "dateFrom": "2026-03-01T00:00:00Z",
  "dateTo": "2026-03-31T23:59:59Z"
}
```

**字段说明**:

| 字段 | 类型 | 描述 |
|------|------|------|
| from | string | 发件人地址 |
| to | string | 收件人地址 |
| subject | string | 主题包含的关键词 |
| body | string | 正文包含的关键词 |
| unread | boolean | 是否未读 |
| read | boolean | 是否已读 |
| starred | boolean | 是否星标 |
| priority | string | 优先级 |
| dateFrom | string | 开始日期（ISO 格式） |
| dateTo | string | 结束日期（ISO 格式） |

**响应示例**:
```json
[
  {
    "messageId": "mail_1234567890_abc_0",
    "subject": "搜索结果",
    "from": "sender@expert",
    "to": "recipient@expert",
    ...
  }
]
```

---

### 回复邮件

回复指定邮件。

```http
POST /mail/:messageId/reply
```

**请求体**:
```json
{
  "body": "回复内容",
  "attachments": ["s3://bucket/file.pdf"],
  "payload": {
    "custom": "data"
  },
  "from": "optional-sender@expert"
}
```

**字段说明**:

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| body | string | 是 | 回复正文 |
| attachments | string[] | 否 | 附件 S3 路径 |
| payload | object | 否 | 自定义数据 |
| from | string | 否 | 发件人（默认使用原邮件收件人） |

**响应示例**:
```json
{
  "success": true,
  "messageId": "mail_1234567891_def",
  "sentAt": "2026-03-17T10:05:00Z"
}
```

---

### 获取邮件线程

获取邮件的完整对话线程。

```http
GET /mail/:messageId/thread
```

**响应示例**:
```json
{
  "rootMessage": {
    "messageId": "mail_1234567890_abc_0",
    "subject": "原始邮件",
    ...
  },
  "messages": [
    {
      "messageId": "mail_1234567890_abc_0",
      "subject": "原始邮件",
      ...
    },
    {
      "messageId": "mail_1234567891_def",
      "subject": "Re: 原始邮件",
      "inReplyTo": "mail_1234567890_abc_0",
      ...
    }
  ],
  "total": 2
}
```

---

### 批量操作

对多封邮件执行批量操作。

```http
POST /mail/batch
```

**请求体**:
```json
{
  "operation": "markAsRead",
  "messageIds": ["mail_123", "mail_124", "mail_125"]
}
```

**操作类型**:
- `markAsRead` - 标记已读
- `markAsUnread` - 标记未读
- `star` - 添加星标
- `unstar` - 取消星标
- `delete` - 删除邮件

**响应示例**:
```json
{
  "success": true,
  "succeeded": 3,
  "failed": 0
}
```

失败时：
```json
{
  "success": false,
  "succeeded": 2,
  "failed": 1,
  "errors": [
    {
      "messageId": "mail_125",
      "error": "Message not found"
    }
  ]
}
```

---

### 注册地址

注册新的邮箱地址。

```http
POST /mail/register
```

**请求体**:
```json
{
  "address": "newuser@expert"
}
```

**响应示例**:
```json
{
  "success": true
}
```

---

## WebSocket API

### 连接

```javascript
const ws = new WebSocket('ws://localhost:3000/api/v1/ws/subscribe/user@expert');
```

### 消息类型

#### 订阅确认

连接成功后，服务器发送订阅确认：

```json
{
  "type": "subscribed",
  "address": "user@expert",
  "timestamp": "2026-03-17T10:00:00Z"
}
```

#### 新邮件通知

当有新邮件到达时：

```json
{
  "type": "new_mail",
  "mail": {
    "messageId": "mail_1234567890_abc",
    "subject": "新邮件",
    "from": "sender@expert",
    "to": "user@expert",
    "sentAt": "2026-03-17T10:05:00Z",
    "priority": "normal"
  },
  "timestamp": "2026-03-17T10:05:00Z"
}
```

#### 心跳

客户端发送：

```json
{
  "type": "ping"
}
```

服务器响应：

```json
{
  "type": "pong",
  "timestamp": "2026-03-17T10:00:30Z"
}
```

### JavaScript 示例

```javascript
const ws = new WebSocket('ws://localhost:3000/api/v1/ws/subscribe/myagent@expert');

// 连接建立
ws.onopen = () => {
  console.log('WebSocket connected');
};

// 接收消息
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'subscribed':
      console.log('Subscribed to:', data.address);
      break;
    case 'new_mail':
      console.log('New mail:', data.mail.subject);
      // 处理新邮件
      break;
    case 'pong':
      console.log('Heartbeat received');
      break;
  }
};

// 发送心跳
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
  }
}, 30000);

// 连接关闭
ws.onclose = () => {
  console.log('WebSocket disconnected');
};

// 错误处理
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

### WebSocket 统计

获取当前 WebSocket 连接统计：

```http
GET /ws/stats
```

**响应示例**:
```json
{
  "totalSubscriptions": 5,
  "subscribedAddresses": ["agent1@expert", "agent2@expert"]
}
```
