# 邮件唤醒 Agent 测试方法

## 测试架构

```
┌─────────────────┐     REST API      ┌──────────────────┐
│  demo-expert    │ ◄────────────────►│  agent-mailbox   │
│  (ebm-agent)    │                   │   (Port 3001)    │
└─────────────────┘                   └──────────────────┘
         │
         │ wakeUpAgent()
         ▼
┌─────────────────┐
│  Agent          │
│  (处理邮件任务)  │
└─────────────────┘
```

## 测试步骤

### 1. 启动邮箱服务器

```bash
# 在后台启动 agent-mailbox (端口3001)
cd apps/agent-mailbox && pnpm start
```

### 2. 注册 Expert 邮箱地址

```bash
curl -s -X POST http://localhost:3001/api/v1/mail/register \
  -H "Content-Type: application/json" \
  -d '{"address": "pubmed-retrieve@expert"}'
```

### 3. 启动 Expert (邮件驱动模式)

```bash
cd apps/ebm-agent
MAILBOX_URL=http://localhost:3001 pnpm exec tsx src/demo-expert.ts
```

### 4. 发送测试任务邮件

**方式1: 使用 curl**

```bash
curl -s -X POST http://localhost:3001/api/v1/mail/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "pubmed-retrieve@expert",
    "from": "test@user",
    "subject": "Test task",
    "body": "Search for articles about machine learning in healthcare"
  }'
```

**方式2: 使用脚本**

```bash
cd apps/ebm-agent
MAILBOX_URL=http://localhost:3001 pnpm exec tsx src/send-task.ts \
  "pubmed-retrieve@expert" "Search papers" "Find articles about AI in healthcare"
```

### 5. 验证结果

- Expert 控制台应显示检测到新邮件
- Expert 应自动唤醒并处理任务
- Agent 应执行搜索并获取结果

## 关键配置 (demo-expert.ts)

```typescript
config.mailConfig = {
  enabled: true,
  baseUrl: mailboxUrl,
  pollInterval: 10000,
};
```

## 邮件驱动模式原理

1. ExpertInstance 轮询邮箱检查未读消息数
2. 检测到新消息时调用 `wakeUpAgent()`
3. Agent 执行 `requestLoop('Check your inbox...')`
4. LLM 分析邮件内容并调用 mail/bibliography 组件执行任务
5. Agent 通过 mail 回复用户

## 相关文件

- `/mnt/disk1/project/project/aikb/apps/ebm-agent/src/demo-expert.ts` - Expert 示例
- `/mnt/disk1/project/project/aikb/apps/ebm-agent/src/send-task.ts` - 发送任务脚本
- `/mnt/disk1/project/project/aikb/libs/agent-lib/src/components/mail/` - MailComponent 实现
