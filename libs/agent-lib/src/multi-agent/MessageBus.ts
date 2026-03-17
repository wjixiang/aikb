/**
 * MessageBus - Email-style Message Router for Multi-Agent System
 *
 * 设计原则：
 * - 类似电子邮件系统：每个 Expert/MC 有自己的收件箱
 * - 事件驱动：新邮件到达时立即触发回调（不是轮询）
 * - 异步通信：发送邮件后立即返回，由接收者异步处理
 */

import { injectable } from 'inversify';
import type {
  MailAddress,
  MailMessage,
  OutgoingMail,
  IMailListener,
  SubscriptionId,
  MailSubscription,
  MailPriority,
} from './types.js';
import { isBroadcast } from './types.js';

/**
 * Helper function to convert Map to array of entries
 */
function ArrayFromMap<T>(map: Map<string, T>): Array<[string, T]> {
  return Array.from(map.entries());
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `mail_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * MessageBus - 邮件风格消息路由器
 */
@injectable()
export class MessageBus implements IMessageBus {
  // 内存存储：address -> 邮件列表
  private readonly mailboxes: Map<string, MailMessage[]> = new Map();

  // 订阅：address -> 订阅者列表
  private readonly subscriptions: Map<
    string,
    Map<SubscriptionId, IMailListener>
  > = new Map();

  // 订阅 ID 管理
  private subscriptionIds: Set<SubscriptionId> = new Set();

  // 初始化状态
  private initialized = false;

  /**
   * 初始化 MessageBus
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
  }

  /**
   * 关闭 MessageBus
   */
  async shutdown(): Promise<void> {
    this.mailboxes.clear();
    this.subscriptions.clear();
    this.subscriptionIds.clear();
    this.initialized = false;
  }

  /**
   * 检查是否已初始化
   */
  isReady(): boolean {
    return this.initialized;
  }

  // ==================== 发送邮件 ====================

  /**
   * 发送邮件 - 类似 SMTP 发送
   *
   * 流程：
   * 1. 创建邮件
   * 2. 写入收件人收件箱
   * 3. 触发收件人的回调
   */
  async send(mail: OutgoingMail): Promise<MailMessage> {
    this.ensureReady();

    const recipients = Array.isArray(mail.to) ? mail.to : [mail.to];

    // 为每个收件人创建邮件副本
    const createdMails: MailMessage[] = [];

    for (const recipient of recipients) {
      const mailMessage: MailMessage = {
        messageId: generateId(),
        subject: mail.subject,
        body: mail.body,
        from: mail.from,
        to: recipient,
        cc: mail.cc,
        bcc: mail.bcc,
        attachments: mail.attachments,
        payload: mail.payload,
        priority: mail.priority || 'normal',
        sentAt: new Date(),
        read: false,
        starred: false,
        deleted: false,
        inReplyTo: mail.inReplyTo,
        taskId: mail.taskId,
      };

      // 写入收件人收件箱
      const inboxKey = recipient; // MailAddress is now a simple string
      if (!this.mailboxes.has(inboxKey)) {
        this.mailboxes.set(inboxKey, []);
      }
      this.mailboxes.get(inboxKey)!.push(mailMessage);

      // 触发收件人的回调（新邮件到达通知）
      await this.notifyNewMail(recipient, mailMessage);

      createdMails.push(mailMessage);
    }

    // 返回第一封邮件（如果是群发，返回第一封的副本）
    return createdMails[0];
  }

  /**
   * 发送邮件给广播地址（所有订阅者）
   */
  async broadcast(mail: OutgoingMail): Promise<MailMessage[]> {
    this.ensureReady();

    // 获取所有已订阅的地址
    const allAddresses: MailAddress[] = Array.from(
      this.subscriptions.keys(),
    ).filter((key) => !isBroadcast(key));

    // 发送给每个地址
    const results: MailMessage[] = [];
    for (const address of allAddresses) {
      const singleMail: OutgoingMail = {
        ...mail,
        to: address,
      };
      const result = await this.send(singleMail);
      results.push(result);
    }

    return results;
  }

  // ==================== 订阅机制 ====================

  /**
   * 订阅地址 - 类似 IMAP 订阅
   *
   * 当新邮件到达该地址时，会立即触发 listener.onNewMail()
   */
  subscribe(address: MailAddress, listener: IMailListener): SubscriptionId {
    this.ensureReady();

    const key = address; // MailAddress is now a simple string

    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Map());
    }

    const subscriptionId = generateId();
    this.subscriptions.get(key)!.set(subscriptionId, listener);
    this.subscriptionIds.add(subscriptionId);

    return subscriptionId;
  }

  /**
   * 取消订阅
   */
  unsubscribe(subscriptionId: SubscriptionId): void {
    if (!this.subscriptionIds.has(subscriptionId)) {
      return;
    }

    for (const [key, listeners] of ArrayFromMap(this.subscriptions)) {
      if (listeners.has(subscriptionId)) {
        listeners.delete(subscriptionId);
        this.subscriptionIds.delete(subscriptionId);

        // 如果没有订阅者了，清理空 Map
        if (listeners.size === 0) {
          this.subscriptions.delete(key);
        }
        return;
      }
    }
  }

  /**
   * 获取所有订阅
   */
  getSubscriptions(): MailSubscription[] {
    const result: MailSubscription[] = [];

    for (const [key, listeners] of Array.from(this.subscriptions.entries())) {
      const address = key; // MailAddress is now a simple string
      for (const [id, listener] of ArrayFromMap(listeners)) {
        result.push({
          subscriptionId: id,
          address,
          listener,
          createdAt: new Date(),
        });
      }
    }

    return result;
  }

  // ==================== 收件箱操作 ====================

  /**
   * 获取收件箱 - 类似 IMAP FETCH
   */
  getInbox(address: MailAddress): MailMessage[] {
    this.ensureReady();

    const key = address; // MailAddress is now a simple string
    const messages = this.mailboxes.get(key) || [];

    // 返回未删除的消息
    return messages.filter((m) => !m.deleted);
  }

  /**
   * 获取未读邮件
   */
  getUnreadMail(address: MailAddress): MailMessage[] {
    return this.getInbox(address).filter((m) => !m.read);
  }

  /**
   * 获取未读数量
   */
  getUnreadCount(address: MailAddress): number {
    return this.getUnreadMail(address).length;
  }

  // ==================== 邮件状态操作 ====================

  /**
   * 标记为已读
   */
  async markAsRead(messageId: string): Promise<void> {
    this.ensureReady();
    this.updateMessage(messageId, { read: true });
  }

  /**
   * 标记为未读
   */
  async markAsUnread(messageId: string): Promise<void> {
    this.ensureReady();
    this.updateMessage(messageId, { read: false });
  }

  /**
   * 星标邮件
   */
  async starMessage(messageId: string): Promise<void> {
    this.ensureReady();
    this.updateMessage(messageId, { starred: true });
  }

  /**
   * 取消星标
   */
  async unstarMessage(messageId: string): Promise<void> {
    this.ensureReady();
    this.updateMessage(messageId, { starred: false });
  }

  /**
   * 删除邮件（软删除）
   */
  async deleteMessage(messageId: string): Promise<void> {
    this.ensureReady();
    this.updateMessage(messageId, { deleted: true });
  }

  /**
   * 永久删除邮件
   */
  async permanentlyDeleteMessage(messageId: string): Promise<void> {
    this.ensureReady();

    for (const [key, messages] of ArrayFromMap(this.mailboxes)) {
      const index = messages.findIndex((m) => m.messageId === messageId);
      if (index !== -1) {
        messages.splice(index, 1);
        return;
      }
    }
  }

  // ==================== 搜索（可选）====================

  /**
   * 搜索邮件
   */
  search(query: {
    from?: MailAddress;
    to?: MailAddress;
    subject?: string;
    body?: string;
    unread?: boolean;
  }): MailMessage[] {
    this.ensureReady();

    const results: MailMessage[] = [];

    for (const messages of Array.from(this.mailboxes.values())) {
      for (const mail of messages) {
        if (mail.deleted) continue;

        // 过滤条件 - comparing strings directly now
        if (query.from && mail.from !== query.from) continue;
        if (query.to && mail.to !== query.to) continue;
        if (
          query.subject &&
          !mail.subject.toLowerCase().includes(query.subject.toLowerCase())
        )
          continue;
        if (
          query.body &&
          (!mail.body ||
            !mail.body.toLowerCase().includes(query.body.toLowerCase()))
        )
          continue;
        if (query.unread && mail.read) continue;

        results.push(mail);
      }
    }

    return results;
  }

  // ==================== 内部方法 ====================

  /**
   * 新邮件到达通知 - 事件驱动核心
   */
  private async notifyNewMail(
    address: MailAddress,
    mail: MailMessage,
  ): Promise<void> {
    const key = address; // MailAddress is now a simple string
    const listeners = this.subscriptions.get(key);

    if (!listeners || listeners.size === 0) {
      return;
    }

    // 通知所有订阅者
    const promises: Promise<void>[] = [];
    for (const [id, listener] of ArrayFromMap(listeners)) {
      promises.push(
        listener.onNewMail(mail).catch(async (error) => {
          if (listener.onError) {
            listener.onError(error);
          } else {
            console.error(`[MessageBus] Listener ${id} error:`, error);
          }
        }),
      );
    }

    // 等待所有回调完成（不阻塞发送流程）
    await Promise.allSettled(promises);
  }

  /**
   * 更新邮件状态
   */
  private updateMessage(
    messageId: string,
    updates: Partial<MailMessage>,
  ): void {
    for (const messages of Array.from(this.mailboxes.values())) {
      const mail = messages.find((m) => m.messageId === messageId);
      if (mail) {
        Object.assign(mail, updates);
        return;
      }
    }
  }

  /**
   * 确保已初始化
   */
  private ensureReady(): void {
    if (!this.initialized) {
      throw new Error(
        'MessageBus is not initialized. Call initialize() first.',
      );
    }
  }

  // ==================== 兼容旧接口 ====================

  /**
   * 发送任务（兼容旧接口）
   * @deprecated 使用 send() 代替
   */
  async sendTask(message: {
    taskId: string;
    summary: string;
    from: MailAddress;
    to: MailAddress;
    payload?: Record<string, unknown>;
    attachments?: string[];
    priority?: MailPriority;
  }): Promise<MailMessage> {
    return this.send({
      from: message.from,
      to: message.to,
      subject: message.summary,
      body: message.summary,
      payload: message.payload,
      attachments: message.attachments,
      priority: message.priority,
      taskId: message.taskId,
    });
  }
}

/**
 * IMessageBus 接口 - 邮件风格
 */
export interface IMessageBus {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  isReady(): boolean;

  // 发送邮件
  send(mail: OutgoingMail): Promise<MailMessage>;
  broadcast(mail: OutgoingMail): Promise<MailMessage[]>;

  // 订阅
  subscribe(address: MailAddress, listener: IMailListener): SubscriptionId;
  unsubscribe(subscriptionId: SubscriptionId): void;
  getSubscriptions(): MailSubscription[];

  // 收件箱
  getInbox(address: MailAddress): MailMessage[];
  getUnreadMail(address: MailAddress): MailMessage[];
  getUnreadCount(address: MailAddress): number;

  // 状态管理
  markAsRead(messageId: string): Promise<void>;
  markAsUnread(messageId: string): Promise<void>;
  starMessage(messageId: string): Promise<void>;
  unstarMessage(messageId: string): Promise<void>;
  deleteMessage(messageId: string): Promise<void>;
  permanentlyDeleteMessage(messageId: string): Promise<void>;

  // 搜索
  search(query: {
    from?: MailAddress;
    to?: MailAddress;
    subject?: string;
    body?: string;
    unread?: boolean;
  }): MailMessage[];
}
