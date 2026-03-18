# Expert 邮件驱动架构设计

## 1. 设计目标

将 Expert 从**同步命令模式**转变为**异步消息驱动模式**：

| 方面 | 当前模式 | 目标模式 |
|------|---------|---------|
| Task 来源 | `execute(task)` 显式传入 | 从 MailComponent 收件箱获取 |
| 调用方式 | 同步调用，等待结果 | Agent 主动拉取/轮询邮件 |
| 返回方式 | 函数返回值 | 通过 `replyToMessage` 回复邮件 |
| 生命周期 | 单次执行 | 持续运行，循环处理任务 |

## 2. 核心组件设计

### 2.1 ExpertExecutor 改造

```typescript
// 新增配置项：MailConfig
interface MailConfig {
  baseUrl: string;        // agent-mailbox 服务地址
  defaultAddress: string; // Expert 的邮箱地址 (如 pubmed-retrieve@expert)
  apiKey?: string;         // 可选的 API 密钥
  pollInterval?: number;   // 轮询间隔 (默认 30s)
}

class ExpertExecutor {
  private mailConfig?: MailConfig;

  constructor(
    registry: ExpertRegistry,
    container?: Container,
    mailConfig?: MailConfig,  // 新增
  ) {
    this.mailConfig = mailConfig;
    // ...
  }

  async createExpert(expertId: string): Promise<IExpertInstance> {
    // ... 现有逻辑 ...

    // 新增：固定注入 MailComponent
    if (this.mailConfig) {
      const mailComponent = createMailComponent({
        baseUrl: this.mailConfig.baseUrl,
        defaultAddress: `${expertId}@expert`,  // 使用 expertId 作为邮箱前缀
        apiKey: this.mailConfig.apiKey,
      });
      workspace.registerComponent('mail', mailComponent, -1);  // 高优先级
    }

    // ...
  }
}
```

### 2.2 ExpertInstance 改造

```typescript
class ExpertInstance implements IExpertInstance {
  private running = false;
  private stopSignal = new AbortController();

  // 新增：邮件驱动运行模式
  async run(): Promise<void> {
    this.running = true;
    this.status = 'running';

    const mailComponent = this.getMailComponent();
    if (!mailComponent) {
      throw new Error('MailComponent not available');
    }

    try {
      while (this.running && !this.stopSignal.signal.aborted) {
        // 1. 获取未读邮件
        const inbox = await mailComponent.getInbox(
          mailComponent.config.defaultAddress,
          { unreadOnly: true, limit: 10 }
        );

        // 2. 处理每封邮件
        for (const message of inbox.messages) {
          await this.processMessage(message, mailComponent);
        }

        // 3. 等待一段时间再检查
        await this.sleep(POLL_INTERVAL);
      }
    } finally {
      this.running = false;
      this.status = 'idle';
    }
  }

  // 停止运行
  async stop(): Promise<void> {
    this.running = false;
    this.stopSignal.abort();
    this.stopSignal = new AbortController();
  }

  private async processMessage(
    message: MailMessage,
    mailComponent: MailComponent
  ): Promise<void> {
    // 1. 标记为已读
    await mailComponent.markAsRead(message.messageId);

    // 2. 解析任务
    const task = this.parseTaskFromMail(message);

    // 3. 执行任务
    const result = await this.execute(task);

    // 4. 发送回复
    const replyBody = this.formatReply(result);
    await mailComponent.replyToMessage({
      messageId: message.messageId,
      body: replyBody,
    });
  }

  private parseTaskFromMail(message: MailMessage): ExpertTask {
    return {
      taskId: message.taskId || message.messageId,
      description: message.subject,  // Subject 作为任务描述
      input: {
        body: message.body,
        payload: message.payload,
        from: message.from,
      },
    };
  }

  private formatReply(result: ExpertResult): string {
    if (result.success) {
      return `任务完成\n\n${result.summary}\n\n结果: ${JSON.stringify(result.output, null, 2)}`;
    } else {
      return `任务失败\n\n错误: ${result.errors?.join('\n')}`;
    }
  }
}
```

### 2.3 ExpertConfig 新增配置

```typescript
interface ExpertConfig {
  // ... 现有字段 ...

  // 新增：邮件驱动配置
  mailConfig?: {
    /** 是否启用邮件驱动模式 */
    enabled?: boolean;
    /** 轮询间隔 (ms)，默认 30000 */
    pollInterval?: number;
    /** 任务邮件格式 */
    taskFormat?: 'subject' | 'body' | 'json';
  };
}
```

## 3. Agent System Prompt 设计

Agent 需要知道如何与邮件系统交互：

```typescript
const MAIL_SYSTEM_PROMPT = `
## 邮件通信

你有一个邮箱地址: {mailAddress}

### 接收任务
- 使用 getInbox 工具查看收件箱
- 未读邮件代表新任务
- 邮件 Subject 是任务描述
- 邮件 Body 是额外上下文

### 返回结果
- 使用 replyToMessage 工具回复发件人
- 任务完成后必须回复，告知结果

### 示例
收到邮件:
Subject: 搜索血管外科相关论文
Body: 近5年的研究

你应该:
1. 分析任务要求
2. 使用搜索工具完成任务
3. 回复发件人告知结果
`;
```

## 4. 任务邮件格式协议

### 4.1 标准格式

```
To: pubmed-retrieve@expert
Subject: <任务描述>
Body: <可选的额外上下文>
Priority: <low|normal|high|urgent>
TaskId: <可选的任务ID>
```

### 4.2 示例

**任务请求:**
```
To: pubmed-retrieve@expert
Subject: 搜索血管外科近几年研究热点
Priority: normal

请搜索 PubMed 上血管外科领域的最新研究热点
```

**回复:**
```
Re: 搜索血管外科近几年研究热点

任务完成

结果:
- 主动脉瘤腔内修复术 (EVAR)
- 颈动脉支架置入术 (CAS)
- 下肢动脉介入治疗
...
```

## 5. 工作流程

```
┌─────────────────────────────────────────────────────────────┐
│                      ExpertExecutor                          │
│                                                              │
│  createExpert(expertId)                                      │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 1. 创建 Agent + VirtualWorkspace                     │    │
│  │ 2. 固定注入 MailComponent (componentId: 'mail')     │    │
│  │ 3. 注册 Expert 特有组件                              │    │
│  └─────────────────────────────────────────────────────┘    │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 4. 返回 ExpertInstance                               │    │
│  └─────────────────────────────────────────────────────┘    │
│       │                                                     │
│       ▼                                                     │
│  expert.run()                                                │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  while (running) {                                  │    │
│  │    1. getInbox(unreadOnly=true) → 获取未读邮件    │    │
│  │    2. 遍历每封邮件                                  │    │
│  │       - parseTaskFromMail() → 解析任务              │    │
│  │       - agent.start(task) → 执行任务               │    │
│  │       - replyToMessage() → 返回结果               │    │
│  │    3. sleep(pollInterval) → 等待                  │    │
│  │  }                                                  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 6. 配置变更

### 6.1 ExpertConfig 新增字段

```typescript
// libs/agent-lib/src/core/expert/types.ts

export interface ExpertConfig {
  // ... existing fields ...

  /**
   * 邮件驱动配置
   * 如果设置，Expert 将以邮件驱动模式运行
   */
  mailConfig?: {
    /** 是否启用邮件驱动模式 */
    enabled?: boolean;
    /** 轮询间隔 (ms)，默认 30000 */
    pollInterval?: number;
  };
}
```

### 6.2 config.json 新增字段

```json
{
  "id": "pubmed-retrieve",
  "displayName": "Pubmed Retrieve",
  "mail": {
    "enabled": true,
    "pollInterval": 30000
  }
}
```

## 7. 兼容性

- `execute(task)` 方法保留，用于直接调用模式
- `run()` 方法新增，用于邮件驱动模式
- 两种模式可以共存（根据配置选择）

## 8. 错误处理

- 网络错误：重试 3 次，间隔递增
- 任务执行错误：回复邮件告知发件人
- Agent 崩溃：记录日志，继续处理下一封邮件

## 9. 依赖项

- `MailComponent` from `agent-lib` (import from 'agent-lib')
- `agent-mailbox` 服务运行中
