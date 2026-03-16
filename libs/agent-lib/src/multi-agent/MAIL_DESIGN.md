# MessageBus 邮件风格重新设计计划

## 0. 背景与约束

### Expert 生命周期
```
创建 → 激活 → 处理任务 → 完成 → 结束 (complete)
```

- Expert 处理完任务后进入 complete 状态
- 需要外部触发（MC）来创建和激活 Expert
- 不需要时 Expert 会被销毁

### 核心约束
1. **MC 驱动** - 所有任务先发给 MC，由 MC 决策创建/调度 Expert
2. **事件驱动** - 新邮件到达时立即触发 Expert，不是轮询
3. **即时处理** - Expert 收到邮件后立即处理，不需要等待轮询

## 1. 设计目标

将 MessageBus 打造成类似电子邮件系统的消息通信基础设施，实现 Expert 之间的异步消息传递。

## 2. 核心概念映射

| 电子邮件概念 | MessageBus 实现 |
|------------|----------------|
| 邮箱地址 | `MailAddress` - Expert/MC 的唯一标识 |
| 收件箱 (Inbox) | 每个地址的输入消息存储 |
| 发件箱 (Sent) | 已发送消息的历史记录 |
| 草稿箱 (Draft) | 暂存的消息 |
| 已读/未读 | 消息状态追踪 |
| 邮件删除 | 软删除/硬删除支持 |
| IMAP IDLE | 事件驱动通知（不是轮询） |
| 邮件过滤器 | 消息过滤规则 |
| 群发/邮件列表 | Broadcast 广播机制 |

## 3. 架构设计

### 3.1 核心类型定义

```typescript
// 地址类型 - 类似 email 地址
type AddressType = 'expert' | 'mc' | 'broadcast';

interface MailAddress {
  type: AddressType;
  // expert: { type: 'expert'; expertId: string }     → "expert:pubmed"
  // mc: { type: 'mc'; mcId: string }                → "mc:main"
  // broadcast: { type: 'broadcast' }                  → "broadcast"
}

type MailAddress =
  | { type: 'expert'; expertId: string }
  | { type: 'mc'; mcId: string }
  | { type: 'broadcast' };

// 邮件消息
interface MailMessage {
  // 邮件元数据
  messageId: string;
  threadId?: string;          // 邮件thread，用于会话
  subject: string;            // 主题 (= summary)
  date: Date;                // 发送时间
  read: boolean;             // 已读状态
  starred: boolean;          // 星标/标记
  deleted: boolean;          // 删除状态

  // 邮件内容
  from: MailAddress;         // 发件人
  to: MailAddress;           // 收件人
  cc?: MailAddress[];        // 抄送
  bcc?: MailAddress[];       // 密送

  body?: string;             // 正文 (= payload or summary)
  payload?: Record<string, unknown>;  // 额外数据

  attachments: Attachment[]; // 附件 (= inputFiles/outputFiles)

  // 邮件头
  headers?: Record<string, string>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  inReplyTo?: string;        // 回复的邮件ID
  references?: string[];     // 邮件引用链
}

// 附件
interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  s3Key?: string;            // S3 存储键
  url?: string;             // 或外部URL
}

// 邮箱文件夹
type MailboxFolder = 'inbox' | 'sent' | 'drafts' | 'trash' | 'archive';

// 邮箱
interface Mailbox {
  address: MailAddress;
  folder: MailboxFolder;
  messages: MailMessage[];
  totalCount: number;
  unreadCount: number;
}
```

### 3.2 邮箱接口

```typescript
// 邮箱客户端接口 - 类似 IMAP 客户端
interface IMailClient {
  // 连接/断开
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // 邮箱操作
  getInbox(address: MailAddress): Promise<Mailbox>;
  getSentBox(address: MailAddress): Promise<Mailbox>;
  getTrash(address: MailAddress): Promise<Mailbox>;

  // 消息操作
  send(mail: OutgoingMail): Promise<MailMessage>;    // 发送邮件
  fetch(address: MailAddress, options?: FetchOptions): Promise<MailMessage[]>;  // 拉取邮件
  markAsRead(messageId: string): Promise<void>;       // 标记已读
  markAsUnread(messageId: string): Promise<void>;    // 标记未读
  star(messageId: string): Promise<void>;            // 星标
  unstar(messageId: string): Promise<void>;          // 取消星标
  delete(messageId: string): Promise<void>;          // 删除到回收站
  permanentlyDelete(messageId: string): Promise<void>; // 永久删除
  move(messageId: string, folder: MailboxFolder): Promise<void>; // 移动到文件夹

  // 搜索
  search(query: MailSearchQuery): Promise<MailMessage[]>;

  // 统计
  getStats(address: MailAddress): Promise<MailboxStats>;
}

// 获取选项
interface FetchOptions {
  limit?: number;           // 最多获取数量
  offset?: number;          // 起始位置
  unreadOnly?: boolean;     // 只获取未读
  since?: Date;             // 只获取指定时间后的
  before?: Date;            // 只获取指定时间前的
  hasAttachment?: boolean;  // 只获取有附件的
}

// 邮箱统计
interface MailboxStats {
  total: number;
  unread: number;
  starred: number;
  deleted: number;
}

// 搜索查询
interface MailSearchQuery {
  from?: MailAddress;
  to?: MailAddress;
  subject?: string;         // 主题关键词
  body?: string;           // 正文关键词
  hasAttachment?: boolean;
  read?: boolean;
  starred?: boolean;
  deleted?: boolean;
  dateSince?: Date;
  dateBefore?: Date;
}

// 发送邮件
interface OutgoingMail {
  from: MailAddress;
  to: MailAddress | MailAddress[];
  cc?: MailAddress[];
  bcc?: MailAddress[];
  subject: string;
  body?: string;
  payload?: Record<string, unknown>;
  attachments?: string[];   // S3 keys
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  inReplyTo?: string;
}
```

### 3.3 订阅机制 - 事件驱动（不是轮询）

```typescript
// 事件类型 - 新邮件到达时立即通知
type MailEventType = 'new_mail' | 'mail_read' | 'mail_deleted' | 'mail_moved';

// 邮件事件 - 新邮件到达时立即触发
interface MailEvent {
  type: MailEventType;
  address: MailAddress;      // 收件人地址
  message: MailMessage;     // 邮件内容（new_mail 时包含）
  timestamp: Date;
}

// 邮件回调 - Expert 实现此接口来处理新邮件
interface IMailListener {
  onNewMail(mail: MailMessage): Promise<void>;  // 新邮件到达时立即调用
  onError(error: Error): void;                   // 处理错误
}

// 订阅接口 - Expert 注册监听自己的收件箱
interface IMailSubscription {
  subscribe(address: MailAddress, listener: IMailListener): SubscriptionId;
  unsubscribe(subscriptionId: SubscriptionId): void;
  unsubscribeAll(address: MailAddress): void;
}

// 移除轮询相关代码 - 不再需要轮询！
// 新邮件到达时，MessageBus 主动回调已注册的 listener
```

### 3.4 MC (Main Controller) - Expert 生命周期管理

```typescript
// MC 负责：
// 1. 接收外部任务请求
// 2. 分析任务，决定调用哪个 Expert
// 3. 创建 Expert 实例
// 4. 发邮件给 Expert 处理

interface IMC {
  // MC 地址
  getAddress(): MailAddress;  // { type: 'mc', mcId: 'main' }

  // 接收外部任务
  receiveTask(request: TaskRequest): Promise<TaskResponse>;

  // 决定调用哪个 Expert
  selectExpert(task: TaskRequest): ExpertSelection;

  // 创建 Expert 实例
  createExpert(expertId: string): Promise<ExpertInstance>;

  // 发送任务邮件给 Expert
  sendToExpert(expertId: string, task: TaskRequest): Promise<void>;

  // 收集 Expert 结果
  collectResults(taskId: string): Promise<ExpertResult[]>;
}

// Expert 注册表 - MC 知道有哪些可用的 Expert
interface IExpertRegistry {
  register(expertId: string, capabilities: string[]): void;
  findByCapability(capability: string): string[];
  listExperts(): ExpertInfo[];
}
```

### 3.5 MessageBus 核心接口（保持兼容）

```typescript
// 扩展 IMessageBus，添加邮件风格方法
interface IMessageBus {
  // 现有接口...

  // 邮件风格扩展
  send(mail: OutgoingMail): Promise<MailMessage>;
  receive(address: MailAddress, options?: FetchOptions): Promise<MailMessage[]>;
  getInbox(address: MailAddress): Promise<Mailbox>;

  // 状态管理
  markAsRead(messageId: string): Promise<void>;
  markAsUnread(messageId: string): Promise<void>;
  deleteMessage(messageId: string): Promise<void>;

  // 搜索
  search(query: MailSearchQuery): Promise<MailMessage[]>;

  // 统计
  getMailboxStats(address: MailAddress): Promise<MailboxStats>;

  // ====== 事件驱动通知（核心！）======
  // Expert 注册监听自己的收件箱，新邮件到达时立即触发回调
  subscribe(address: MailAddress, listener: IMailListener): SubscriptionId;

  // 取消订阅
  unsubscribe(subscriptionId: SubscriptionId): void;

  // 移除轮询相关方法 - 不再需要！
}
```

## 4. 完整工作流程

### 4.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           系统架构                                       │
│                                                                          │
│  ┌─────────────┐      ┌─────────────────┐      ┌─────────────────────┐ │
│  │   外部请求   │ ───→ │  mc:main        │ ───→ │  Expert Pool        │ │
│  └─────────────┘      │  (Main Controller)      │                     │ │
│                       │                         │  ┌───────────────┐  │ │
│                       │  1. 接收任务            │  │ expert:pubmed  │  │ │
│                       │  2. 分析任务            │  │ expert:analysis│  │ │
│                       │  3. 选择 Expert        │  │ expert:xxx    │  │ │
│                       │  4. 发邮件给 Expert    │  └───────────────┘  │ │
│                       └─────────────────┘      └─────────────────────┘ │
│                               │                        ↑                │
│                               │                        │                │
│                       ┌───────┴────────┐     新邮件到达 ──┘              │
│                       │  MessageBus    │     事件触发回调                  │
│                       │  (邮件服务器)   │                                │
│                       └───────────────┘                                │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 任务处理流程

```
步骤 1: 外部请求进入
┌─────────────────────────────────────────────────────────────┐
│  POST /tasks { description: "分析这篇论文" }                │
└─────────────────────────────────────────────────────────────┘
                            ↓
步骤 2: mc:main 接收任务
┌─────────────────────────────────────────────────────────────┐
│  mc:main 收件箱                                              │
│  ├── from: external | 分析这篇论文...  ← 新邮件              │
└─────────────────────────────────────────────────────────────┘
                            ↓
步骤 3: MC 分析任务，决定调用哪个 Expert
┌─────────────────────────────────────────────────────────────┐
│  MC 分析: "分析这篇论文"                                    │
│  → 需要: paper-analysis 能力                                │
│  → 选择: expert:analysis                                    │
│  → 创建: expert:analysis 实例                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
步骤 4: MC 发邮件给 Expert
┌─────────────────────────────────────────────────────────────┐
│  mc:main 发件箱                                             │
│  └── to: expert:analysis | 分析这篇论文... ✓ 已发送        │
│                                                             │
│  expert:analysis 收件箱                                     │
│  └── from: mc:main | 分析这篇论文...  ← 新邮件到达！       │
└─────────────────────────────────────────────────────────────┘
                            ↓
步骤 5: MessageBus 事件触发（核心！）
┌─────────────────────────────────────────────────────────────┐
│  MessageBus 检测到新邮件 → 查找订阅者                        │
│  → 找到 expert:analysis 的订阅者                            │
│  → 立即调用 onNewMail() 回调                                │
│  → Expert 被唤醒，开始处理                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
步骤 6: Expert 处理任务 → 发送结果邮件
┌─────────────────────────────────────────────────────────────┐
│  expert:analysis 发件箱                                     │
│  └── to: mc:main | 分析完成，结果如下... ✓ 已发送          │
│                                                             │
│  mc:main 收件箱                                             │
│  └── from: expert:analysis | 分析完成...  ← 结果邮件       │
└─────────────────────────────────────────────────────────────┘
                            ↓
步骤 7: MC 收集结果，返回给外部
┌─────────────────────────────────────────────────────────────┐
│  MC 汇总 Expert 结果                                        │
│  → 返回给外部请求者                                          │
│  → Expert 进入 complete 状态（可选销毁）                    │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Expert 注册与监听

```typescript
// Expert 启动时注册监听自己的收件箱
class ExpertAdapter {
  async start() {
    // 订阅自己的收件箱
    this.subscriptionId = await this.messageBus.subscribe(
      { type: 'expert', expertId: this.config.expertId },
      {
        async onNewMail(mail: MailMessage) {
          // 新邮件到达！立即处理
          await this.handleTask(mail);
        },
        onError(error) {
          console.error('处理失败:', error);
        }
      }
    );
  }

  async handleTask(mail: MailMessage) {
    // 处理任务...
    // 处理完成后可以发送结果邮件回给 MC
    await this.messageBus.send({
      from: { type: 'expert', expertId: this.config.expertId },
      to: mail.from,  // 回发给 MC
      subject: `Re: ${mail.subject}`,
      body: '处理完成...'
    });
  }
}
```

## 5. 实现计划

### 5.1 阶段 1: 核心类型和存储
- [ ] 重构 `types.ts` - 添加邮件风格类型（MailAddress, MailMessage 等）
- [ ] 创建 `MailStorage.ts` - 消息持久化存储
- [ ] 实现 `Inbox.ts` - 收件箱实现
- [ ] 实现 `SentBox.ts` - 已发送邮件存储

### 5.2 阶段 2: MessageBus 重构
- [ ] 重构 `MessageBus.ts` - 实现邮件风格接口
- [ ] 实现 `send()` - 发送邮件（写入收件人邮箱）
- [ ] 实现事件驱动通知 - 新邮件到达时立即触发回调
- [ ] 添加状态管理方法（已读/未读/删除）

### 5.3 阶段 3: MC 和 ExpertAdapter
- [ ] 实现 `MCAdapter.ts` - MC 的邮件客户端
- [ ] 更新 `ExpertAdapter` - 适配新的邮件接口
- [ ] 实现 Expert 注册和订阅机制

### 5.4 阶段 4: 测试和示例
- [ ] 编写单元测试
- [ ] 集成测试
- [ ] 添加使用示例

## 5. 目录结构

```
src/multi-agent/
├── types.ts              # 类型定义（重构）
├── MessageBus.ts        # 核心实现（重构）
├── MessageQueue.ts       # 保留，底层队列
├── MailStorage.ts       # 新增：消息存储
├── Inbox.ts             # 新增：收件箱
├── Subscription.ts      # 新增：订阅管理
├── MailPoller.ts        # 新增：轮询机制
├── ExpertAdapter.ts     # 更新：适配新接口
└── index.ts             # 更新：导出
```

## 6. 使用示例

```typescript
// ===== MC 端 =====
const messageBus = new MessageBus();

// MC 接收外部任务
const taskRequest = {
  description: '分析这篇论文',
  paperId: 'PMID:12345'
};

// MC 发邮件给 expert:analysis
await messageBus.send({
  from: { type: 'mc', mcId: 'main' },
  to: { type: 'expert', expertId: 'analysis' },
  subject: taskRequest.description,
  body: JSON.stringify(taskRequest),
  priority: 'high'
});

// ===== Expert 端 =====
// Expert 启动时订阅自己的收件箱
const expertAdapter = new ExpertAdapter(messageBus, 'analysis');
await expertAdapter.start();  // 内部会订阅 expert:analysis 的收件箱

// 当新邮件到达时，onNewMail 会被立即调用
// 不需要轮询！


// ===== 查询功能（可选）=====
// 查看收件箱状态
const inbox = await messageBus.getInbox({ type: 'expert', expertId: 'analysis' });
console.log(`未读邮件: ${inbox.unreadCount}`);

// 搜索历史邮件
const results = await messageBus.search({
  subject: '分析',
  from: { type: 'mc', mcId: 'main' }
});

// 标记已读
await messageBus.markAsRead(messageId);
```

## 7. 向后兼容性

- 保留现有 `sendTask()` / `sendResult()` 方法
- 新旧接口可以共存
- 提供迁移指南

---

**计划制定完成，等待用户确认后开始实现。**
