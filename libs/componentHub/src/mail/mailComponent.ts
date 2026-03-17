import { z } from 'zod';
import {
  Tool,
  ToolCallResult,
  ToolComponent,
  TUIElement,
  tdiv,
  th,
  tp,
} from 'agent-lib/components/ui';
import {
  type MailAddress,
  type OutgoingMail,
  type MailMessage,
  type InboxQuery,
  type InboxResult,
  type SearchQuery,
  type MailComponentConfig,
  type SendResult,
  type StorageResult,
} from 'agent-lib/multi-agent';
import {
  mailToolSchemas,
  type SendMailParams,
  type GetInboxParams,
  type GetUnreadCountParams,
  type MessageIdParams,
  type SearchMessagesParams,
  type ReplyToMessageParams,
  type RegisterAddressParams,
} from './mailSchemas';

/**
 * MailComponent Configuration
 * (Re-exported from mailSchemas.ts for backward compatibility)
 */
export type { MailComponentConfig } from './mailSchemas';

/**
 * MailComponent - Email-style messaging component for agent communication
 *
 * Features:
 * - Send emails to other agents/experts via REST API
 * - View inbox with filtering and pagination
 * - Mark messages as read/unread/starred
 * - Search messages
 * - Reply to messages
 *
 * This component communicates with the agent-mailbox service via REST API.
 *
 * @example
 * ```typescript
 * const mail = new MailComponent({
 *   baseUrl: 'http://localhost:3000',
 *   defaultAddress: 'myagent@expert',
 * });
 *
 * // Send a message
 * await mail.handleToolCall('sendMail', {
 *   to: 'other@expert',
 *   subject: 'Hello',
 *   body: 'World',
 * });
 * ```
 */
export class MailComponent extends ToolComponent {
  override componentId = 'mail';
  override displayName = 'Mail';
  override description = 'Email-style messaging system for agent communication';

  private config: MailComponentConfig;
  private currentInbox: InboxResult | null = null;
  private selectedMessage: MailMessage | null = null;

  constructor(config: MailComponentConfig) {
    super();
    this.config = {
      timeout: 30000,
      ...config,
    };
    this.toolSet = this.initializeToolSet();
  }

  // ==================== Tool Definitions ====================

  private initializeToolSet(): Map<string, Tool> {
    const tools = new Map<string, Tool>();

    // Import tool schemas from mailSchemas
    const toolEntries: [string, Tool][] = [
      ['sendMail', mailToolSchemas.sendMail],
      ['getInbox', mailToolSchemas.getInbox],
      ['getUnreadCount', mailToolSchemas.getUnreadCount],
      ['markAsRead', mailToolSchemas.markAsRead],
      ['markAsUnread', mailToolSchemas.markAsUnread],
      ['starMessage', mailToolSchemas.starMessage],
      ['unstarMessage', mailToolSchemas.unstarMessage],
      ['deleteMessage', mailToolSchemas.deleteMessage],
      ['searchMessages', mailToolSchemas.searchMessages],
      ['replyToMessage', mailToolSchemas.replyToMessage],
      ['registerAddress', mailToolSchemas.registerAddress],
    ];

    toolEntries.forEach(([name, tool]) => {
      tools.set(name, tool);
    });

    return tools;
  }

  override toolSet = this.initializeToolSet();

  // ==================== Tool Handlers ====================

  override handleToolCall = async (
    toolName: string,
    params: unknown,
  ): Promise<ToolCallResult> => {
    try {
      switch (toolName) {
        case 'sendMail':
          return await this.handleSendMail(params);
        case 'getInbox':
          return await this.handleGetInbox(params);
        case 'getUnreadCount':
          return await this.handleGetUnreadCount(params);
        case 'markAsRead':
          return await this.handleMarkAsRead(params);
        case 'markAsUnread':
          return await this.handleMarkAsUnread(params);
        case 'starMessage':
          return await this.handleStarMessage(params);
        case 'unstarMessage':
          return await this.handleUnstarMessage(params);
        case 'deleteMessage':
          return await this.handleDeleteMessage(params);
        case 'searchMessages':
          return await this.handleSearchMessages(params);
        case 'replyToMessage':
          return await this.handleReplyToMessage(params);
        case 'registerAddress':
          return await this.handleRegisterAddress(params);
        default:
          return {
            data: { error: `Unknown tool: ${toolName}` },
            summary: `[Mail] Unknown tool: ${toolName}`,
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        data: { error: errorMessage },
        summary: `[Mail] Error: ${errorMessage}`,
      };
    }
  };

  private async handleSendMail(params: SendMailParams): Promise<ToolCallResult> {
    const mail: OutgoingMail = {
      from: this.config.defaultAddress || params.from,
      to: params.to,
      subject: params.subject,
      body: params.body,
      priority: params.priority || 'normal',
      taskId: params.taskId,
      attachments: params.attachments,
      payload: params.payload,
    };

    const result = await this.sendMail(mail);

    return {
      data: result,
      summary: result.success
        ? `[Mail] Sent to ${params.to}: "${params.subject}"`
        : `[Mail] Failed to send: ${result.error}`,
    };
  }

  private async handleGetInbox(params: GetInboxParams): Promise<ToolCallResult> {
    const address = params.address || this.config.defaultAddress;
    if (!address) {
      return {
        data: { error: 'No address specified and no default address configured' },
        summary: '[Mail] Error: No address configured',
      };
    }

    const query: InboxQuery = {
      pagination: {
        limit: params.limit || 20,
        offset: params.offset || 0,
      },
      unreadOnly: params.unreadOnly,
      starredOnly: params.starredOnly,
    };

    const result = await this.getInbox(address, query);
    this.currentInbox = result;

    return {
      data: result,
      summary: `[Mail] Inbox for ${address}: ${result.messages.length}/${result.total} messages (${result.unread} unread)`,
    };
  }

  private async handleGetUnreadCount(params: GetUnreadCountParams): Promise<ToolCallResult> {
    const address = params.address || this.config.defaultAddress;
    if (!address) {
      return {
        data: { error: 'No address specified and no default address configured' },
        summary: '[Mail] Error: No address configured',
      };
    }

    const count = await this.getUnreadCount(address);

    return {
      data: { count, address },
      summary: `[Mail] ${address} has ${count} unread messages`,
    };
  }

  private async handleMarkAsRead(params: MessageIdParams): Promise<ToolCallResult> {
    const result = await this.markAsRead(params.messageId);
    return {
      data: result,
      summary: result.success
        ? `[Mail] Marked ${params.messageId} as read`
        : `[Mail] Failed to mark as read: ${result.error}`,
    };
  }

  private async handleMarkAsUnread(params: MessageIdParams): Promise<ToolCallResult> {
    const result = await this.markAsUnread(params.messageId);
    return {
      data: result,
      summary: result.success
        ? `[Mail] Marked ${params.messageId} as unread`
        : `[Mail] Failed to mark as unread: ${result.error}`,
    };
  }

  private async handleStarMessage(params: MessageIdParams): Promise<ToolCallResult> {
    const result = await this.starMessage(params.messageId);
    return {
      data: result,
      summary: result.success
        ? `[Mail] Starred ${params.messageId}`
        : `[Mail] Failed to star: ${result.error}`,
    };
  }

  private async handleUnstarMessage(params: MessageIdParams): Promise<ToolCallResult> {
    const result = await this.unstarMessage(params.messageId);
    return {
      data: result,
      summary: result.success
        ? `[Mail] Unstarred ${params.messageId}`
        : `[Mail] Failed to unstar: ${result.error}`,
    };
  }

  private async handleDeleteMessage(params: MessageIdParams): Promise<ToolCallResult> {
    const result = await this.deleteMessage(params.messageId);
    return {
      data: result,
      summary: result.success
        ? `[Mail] Deleted ${params.messageId}`
        : `[Mail] Failed to delete: ${result.error}`,
    };
  }

  private async handleSearchMessages(params: SearchMessagesParams): Promise<ToolCallResult> {
    const query: SearchQuery = {
      subject: params.query,
      body: params.query,
      from: params.from,
      to: params.to,
      unread: params.unread,
      starred: params.starred,
      priority: params.priority,
    };

    const results = await this.searchMessages(query);

    return {
      data: results,
      summary: `[Mail] Found ${results.length} messages matching "${params.query}"`,
    };
  }

  private async handleReplyToMessage(params: ReplyToMessageParams): Promise<ToolCallResult> {
    // First get the original message to find the sender
    const messages = await this.searchMessages({ subject: params.messageId });
    const originalMessage = messages.find(m => m.messageId === params.messageId);

    if (!originalMessage) {
      return {
        data: { error: `Message ${params.messageId} not found` },
        summary: '[Mail] Error: Original message not found',
      };
    }

    const reply: OutgoingMail = {
      from: this.config.defaultAddress || '',
      to: originalMessage.from,
      subject: `Re: ${originalMessage.subject}`,
      body: params.body,
      inReplyTo: params.messageId,
      taskId: originalMessage.taskId,
      attachments: params.attachments,
      payload: params.payload,
    };

    const result = await this.sendMail(reply);

    return {
      data: result,
      summary: result.success
        ? `[Mail] Replied to "${originalMessage.subject}"`
        : `[Mail] Failed to send reply: ${result.error}`,
    };
  }

  private async handleRegisterAddress(params: RegisterAddressParams): Promise<ToolCallResult> {
    const result = await this.registerAddress(params.address);
    return {
      data: result,
      summary: result.success
        ? `[Mail] Registered ${params.address}`
        : `[Mail] Failed to register: ${result.error}`,
    };
  }

  // ==================== API Methods ====================

  /**
   * Send an email message
   */
  async sendMail(mail: OutgoingMail): Promise<SendResult> {
    const response = await this.fetchApi<SendResult>('/send', {
      method: 'POST',
      body: JSON.stringify(mail),
    });
    return response;
  }

  /**
   * Get inbox messages for an address
   */
  async getInbox(address: MailAddress, query?: InboxQuery): Promise<InboxResult> {
    const queryParams = new URLSearchParams();
    if (query?.pagination?.limit) queryParams.set('limit', String(query.pagination.limit));
    if (query?.pagination?.offset) queryParams.set('offset', String(query.pagination.offset));
    if (query?.unreadOnly) queryParams.set('unreadOnly', 'true');
    if (query?.starredOnly) queryParams.set('starredOnly', 'true');
    if (query?.sortBy) queryParams.set('sortBy', query.sortBy);
    if (query?.sortOrder) queryParams.set('sortOrder', query.sortOrder);

    const response = await this.fetchApi<InboxResult>(`/inbox/${encodeURIComponent(address)}?${queryParams}`);
    return response;
  }

  /**
   * Get unread message count
   */
  async getUnreadCount(address: MailAddress): Promise<number> {
    const response = await this.fetchApi<number>(`/inbox/${encodeURIComponent(address)}/unread`);
    return response;
  }

  /**
   * Get a single message by ID
   */
  async getMessage(messageId: string): Promise<MailMessage | null> {
    const messages = await this.searchMessages({ subject: messageId });
    return messages.find(m => m.messageId === messageId) || null;
  }

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<StorageResult> {
    return this.fetchApi<StorageResult>(`/${messageId}/read`, { method: 'POST' });
  }

  /**
   * Mark a message as unread
   */
  async markAsUnread(messageId: string): Promise<StorageResult> {
    return this.fetchApi<StorageResult>(`/${messageId}/unread`, { method: 'POST' });
  }

  /**
   * Star a message
   */
  async starMessage(messageId: string): Promise<StorageResult> {
    return this.fetchApi<StorageResult>(`/${messageId}/star`, { method: 'POST' });
  }

  /**
   * Unstar a message
   */
  async unstarMessage(messageId: string): Promise<StorageResult> {
    return this.fetchApi<StorageResult>(`/${messageId}/unstar`, { method: 'POST' });
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId: string): Promise<StorageResult> {
    return this.fetchApi<StorageResult>(`/${messageId}`, { method: 'DELETE' });
  }

  /**
   * Search messages
   */
  async searchMessages(query: SearchQuery): Promise<MailMessage[]> {
    return this.fetchApi<MailMessage[]>('/search', {
      method: 'POST',
      body: JSON.stringify(query),
    });
  }

  /**
   * Register a new address
   */
  async registerAddress(address: MailAddress): Promise<StorageResult> {
    return this.fetchApi<StorageResult>('/register', {
      method: 'POST',
      body: JSON.stringify({ address }),
    });
  }

  /**
   * Internal fetch helper
   */
  private async fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.baseUrl}/api/v1/mail${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  // ==================== UI Rendering ====================

  override renderImply = async (): Promise<TUIElement[]> => {
    const elements: TUIElement[] = [];

    // Header
    elements.push(
      new th({
        content: 'Mail Component',
        styles: { align: 'center' },
      }),
    );

    // Connection info
    const infoTexts: string[] = [`Server: ${this.config.baseUrl}`];
    if (this.config.defaultAddress) {
      infoTexts.push(`Address: ${this.config.defaultAddress}`);
    }

    elements.push(
      new tdiv({
        content: infoTexts.join(' | '),
        styles: {
          align: 'center',
          padding: { vertical: 1 },
        },
      }),
    );

    // Quick stats
    if (this.config.defaultAddress) {
      try {
        const unreadCount = await this.getUnreadCount(this.config.defaultAddress);
        elements.push(
          new tdiv({
            content: `Unread: ${unreadCount}${this.currentInbox ? ` | Total: ${this.currentInbox.total}` : ''}`,
            styles: {
              align: 'center',
              showBorder: true,
              padding: { vertical: 1 },
            },
          }),
        );
      } catch (e) {
        // Ignore error in rendering
      }
    }

    // Inbox view
    if (this.currentInbox) {
      elements.push(this.renderInbox());
    } else {
      elements.push(
        new tp({
          content: 'Use getInbox tool to load messages.',
          indent: 1,
        }),
      );
    }

    return elements;
  };

  private renderInbox(): TUIElement {
    if (!this.currentInbox) {
      return new tdiv({ content: 'No inbox data' });
    }

    const container = new tdiv({
      styles: { showBorder: true, padding: { vertical: 1 } },
    });

    // Title
    container.addChild(
      new th({
        content: `Inbox: ${this.currentInbox.address}`,
        level: 2,
        styles: { align: 'center' },
      }),
    );

    // Stats
    container.addChild(
      new tp({
        content: `Messages: ${this.currentInbox.messages.length}/${this.currentInbox.total} | Unread: ${this.currentInbox.unread} | Starred: ${this.currentInbox.starred}`,
        indent: 1,
        textStyle: { bold: true },
      }),
    );

    // Messages list
    if (this.currentInbox.messages.length === 0) {
      container.addChild(new tp({ content: 'No messages found.', indent: 2 }));
    } else {
      container.addChild(new tp({ content: '─'.repeat(60), indent: 1 }));

      this.currentInbox.messages.forEach((msg, index) => {
        const starMarker = msg.status.starred ? '⭐ ' : '';
        const readMarker = msg.status.read ? '  ' : '● ';
        const priorityMarker = msg.priority === 'urgent' ? ' [URGENT]' : msg.priority === 'high' ? ' [HIGH]' : '';

        container.addChild(
          new tp({
            content: `${readMarker}${starMarker}${index + 1}. ${msg.subject}${priorityMarker}`,
            indent: 1,
            textStyle: { bold: !msg.status.read },
          }),
        );

        container.addChild(
          new tp({
            content: `   From: ${msg.from} | ${new Date(msg.sentAt).toLocaleString()}`,
            indent: 2,
          }),
        );

        if (msg.body) {
          const preview = msg.body.length > 100 ? msg.body.substring(0, 100) + '...' : msg.body;
          container.addChild(new tp({ content: `   ${preview}`, indent: 2 }));
        }

        container.addChild(new tp({ content: '─'.repeat(60), indent: 1 }));
      });
    }

    // Selected message detail
    if (this.selectedMessage) {
      container.addChild(this.renderMessageDetail(this.selectedMessage));
    }

    return container;
  }

  private renderMessageDetail(message: MailMessage): TUIElement {
    const container = new tdiv({
      styles: {
        showBorder: true,
        padding: { vertical: 1 },
        margin: { top: 1 },
      },
    });

    container.addChild(
      new th({
        content: 'Message Detail',
        level: 3,
        styles: { align: 'center' },
      }),
    );

    container.addChild(new tp({ content: `Subject: ${message.subject}`, indent: 1, textStyle: { bold: true } }));
    container.addChild(new tp({ content: `From: ${message.from}`, indent: 1 }));
    container.addChild(new tp({ content: `To: ${Array.isArray(message.to) ? message.to.join(', ') : message.to}`, indent: 1 }));
    container.addChild(new tp({ content: `Date: ${new Date(message.sentAt).toLocaleString()}`, indent: 1 }));
    container.addChild(new tp({ content: `Priority: ${message.priority}`, indent: 1 }));

    if (message.taskId) {
      container.addChild(new tp({ content: `Task ID: ${message.taskId}`, indent: 1 }));
    }

    container.addChild(new tp({ content: '', indent: 1 }));

    if (message.body) {
      container.addChild(new th({ content: 'Body:', level: 4 }));
      container.addChild(new tp({ content: message.body, indent: 1 }));
    }

    if (message.attachments && message.attachments.length > 0) {
      container.addChild(new tp({ content: '', indent: 1 }));
      container.addChild(new th({ content: 'Attachments:', level: 4 }));
      message.attachments.forEach(att => {
        container.addChild(new tp({ content: `  • ${att}`, indent: 1 }));
      });
    }

    if (message.payload) {
      container.addChild(new tp({ content: '', indent: 1 }));
      container.addChild(new th({ content: 'Payload:', level: 4 }));
      container.addChild(
        new tp({
          content: JSON.stringify(message.payload, null, 2),
          indent: 1,
        }),
      );
    }

    return container;
  }
}

/**
 * Factory function to create MailComponent
 */
export function createMailComponent(config: MailComponentConfig): MailComponent {
  return new MailComponent(config);
}
