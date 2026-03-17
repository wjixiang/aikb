import {
  Tool,
  ToolCallResult,
  ToolComponent,
  TUIElement,
  tdiv,
  tspan,
  tbutton,
  tinput,
  ttextarea,
  tselect,
  tlabel,
  th2,
  th3,
  ttable,
  tthead,
  ttbody,
  ttr,
  tth,
  ttd,
  tbadge,
  tcard,
  tform,
  tcheckbox,
  tpagination,
  tempty,
  tloading,
  tdialog,
  talert,
} from 'agent-lib/components/ui';
import {
  type MailAddress,
  type OutgoingMail,
  type MailMessage,
  type InboxQuery,
  type InboxResult,
  type SearchQuery,
  type MailPriority,
} from 'agent-lib/multi-agent';

/**
 * MailComponent Configuration
 */
export interface MailComponentConfig {
  /** Mailbox service base URL */
  baseUrl: string;
  /** Default sender address for this agent */
  defaultAddress?: MailAddress;
  /** API key for authentication (if required) */
  apiKey?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * MailComponent - Email-style messaging component for agent communication
 *
 * Features:
 * - Send emails to other agents/experts
 * - View inbox with filtering and pagination
 * - Mark messages as read/unread/starred
 * - Search messages
 * - Reply to messages
 *
 * This component communicates with the agent-mailbox service via REST API.
 */
export class MailComponent extends ToolComponent {
  override componentId = 'mail';
  override displayName = 'Mail';
  override description = 'Email-style messaging system for agent communication';

  private config: MailComponentConfig;
  private currentInbox: InboxResult | null = null;
  private selectedMessage: MailMessage | null = null;
  private isLoading = false;
  private error: string | null = null;

  // Default query parameters
  private inboxQuery: InboxQuery = {
    pagination: { limit: 20, offset: 0 },
    unreadOnly: false,
    starredOnly: false,
    sortBy: 'sentAt',
    sortOrder: 'desc',
  };

  constructor(config: MailComponentConfig) {
    super();
    this.config = {
      timeout: 30000,
      ...config,
    };
    this.initializeTools();
  }

  // ==================== Tool Definitions ====================

  override toolSet = new Map<string, Tool>();

  private initializeTools(): void {
    this.toolSet.set('sendMail', {
      name: 'sendMail',
      description: 'Send an email message to another agent or expert',
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Recipient address (e.g., "pubmed@expert", "analysis@expert")',
          },
          subject: {
            type: 'string',
            description: 'Email subject line',
          },
          body: {
            type: 'string',
            description: 'Email body content',
          },
          priority: {
            type: 'string',
            enum: ['low', 'normal', 'high', 'urgent'],
            description: 'Message priority',
            default: 'normal',
          },
          taskId: {
            type: 'string',
            description: 'Associated task ID',
          },
          attachments: {
            type: 'array',
            items: { type: 'string' },
            description: 'S3 keys of attachments',
          },
          payload: {
            type: 'object',
            description: 'Additional JSON payload data',
          },
        },
        required: ['to', 'subject', 'body'],
      },
    });

    this.toolSet.set('getInbox', {
      name: 'getInbox',
      description: 'Get inbox messages with optional filtering',
      parameters: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Mailbox address to query (defaults to component defaultAddress)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of messages to return',
            default: 20,
          },
          offset: {
            type: 'number',
            description: 'Number of messages to skip',
            default: 0,
          },
          unreadOnly: {
            type: 'boolean',
            description: 'Filter to show only unread messages',
            default: false,
          },
          starredOnly: {
            type: 'boolean',
            description: 'Filter to show only starred messages',
            default: false,
          },
        },
      },
    });

    this.toolSet.set('getUnreadCount', {
      name: 'getUnreadCount',
      description: 'Get the count of unread messages for an address',
      parameters: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Mailbox address (defaults to component defaultAddress)',
          },
        },
      },
    });

    this.toolSet.set('markAsRead', {
      name: 'markAsRead',
      description: 'Mark a message as read',
      parameters: {
        type: 'object',
        properties: {
          messageId: {
            type: 'string',
            description: 'ID of the message to mark as read',
          },
        },
        required: ['messageId'],
      },
    });

    this.toolSet.set('markAsUnread', {
      name: 'markAsUnread',
      description: 'Mark a message as unread',
      parameters: {
        type: 'object',
        properties: {
          messageId: {
            type: 'string',
            description: 'ID of the message to mark as unread',
          },
        },
        required: ['messageId'],
      },
    });

    this.toolSet.set('starMessage', {
      name: 'starMessage',
      description: 'Star a message',
      parameters: {
        type: 'object',
        properties: {
          messageId: {
            type: 'string',
            description: 'ID of the message to star',
          },
        },
        required: ['messageId'],
      },
    });

    this.toolSet.set('unstarMessage', {
      name: 'unstarMessage',
      description: 'Unstar a message',
      parameters: {
        type: 'object',
        properties: {
          messageId: {
            type: 'string',
            description: 'ID of the message to unstar',
          },
        },
        required: ['messageId'],
      },
    });

    this.toolSet.set('deleteMessage', {
      name: 'deleteMessage',
      description: 'Delete a message (soft delete)',
      parameters: {
        type: 'object',
        properties: {
          messageId: {
            type: 'string',
            description: 'ID of the message to delete',
          },
        },
        required: ['messageId'],
      },
    });

    this.toolSet.set('searchMessages', {
      name: 'searchMessages',
      description: 'Search messages across mailboxes',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search text for subject or body',
          },
          from: {
            type: 'string',
            description: 'Filter by sender address',
          },
          to: {
            type: 'string',
            description: 'Filter by recipient address',
          },
          unread: {
            type: 'boolean',
            description: 'Filter by unread status',
          },
          starred: {
            type: 'boolean',
            description: 'Filter by starred status',
          },
          priority: {
            type: 'string',
            enum: ['low', 'normal', 'high', 'urgent'],
            description: 'Filter by priority',
          },
        },
      },
    });

    this.toolSet.set('replyToMessage', {
      name: 'replyToMessage',
      description: 'Reply to an existing message',
      parameters: {
        type: 'object',
        properties: {
          messageId: {
            type: 'string',
            description: 'ID of the message to reply to',
          },
          body: {
            type: 'string',
            description: 'Reply body content',
          },
          attachments: {
            type: 'array',
            items: { type: 'string' },
            description: 'S3 keys of attachments',
          },
          payload: {
            type: 'object',
            description: 'Additional JSON payload data',
          },
        },
        required: ['messageId', 'body'],
      },
    });

    this.toolSet.set('registerAddress', {
      name: 'registerAddress',
      description: 'Register a new mailbox address',
      parameters: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Address to register (e.g., "myagent@expert")',
          },
        },
        required: ['address'],
      },
    });
  }

  // ==================== Tool Handlers ====================

  override handleToolCall = async (
    toolName: string,
    params: any,
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
            success: false,
            error: `Unknown tool: ${toolName}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  private async handleSendMail(params: any): Promise<ToolCallResult> {
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
      success: result.success,
      data: result,
      summary: result.success
        ? `📧 Sent mail to ${params.to} with subject "${params.subject}"`
        : `❌ Failed to send mail: ${result.error}`,
    };
  }

  private async handleGetInbox(params: any): Promise<ToolCallResult> {
    const address = params.address || this.config.defaultAddress;
    if (!address) {
      return {
        success: false,
        error: 'No address specified and no default address configured',
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

    return {
      success: true,
      data: result,
      summary: `📥 Retrieved ${result.messages.length} messages for ${address} (total: ${result.total}, unread: ${result.unread})`,
    };
  }

  private async handleGetUnreadCount(params: any): Promise<ToolCallResult> {
    const address = params.address || this.config.defaultAddress;
    if (!address) {
      return {
        success: false,
        error: 'No address specified and no default address configured',
      };
    }

    const count = await this.getUnreadCount(address);

    return {
      success: true,
      data: { count, address },
      summary: `📬 ${address} has ${count} unread messages`,
    };
  }

  private async handleMarkAsRead(params: any): Promise<ToolCallResult> {
    const result = await this.markAsRead(params.messageId);
    return {
      success: result.success,
      data: result,
      summary: result.success
        ? `✉️ Marked message ${params.messageId} as read`
        : `❌ Failed to mark as read: ${result.error}`,
    };
  }

  private async handleMarkAsUnread(params: any): Promise<ToolCallResult> {
    const result = await this.markAsUnread(params.messageId);
    return {
      success: result.success,
      data: result,
      summary: result.success
        ? `✉️ Marked message ${params.messageId} as unread`
        : `❌ Failed to mark as unread: ${result.error}`,
    };
  }

  private async handleStarMessage(params: any): Promise<ToolCallResult> {
    const result = await this.starMessage(params.messageId);
    return {
      success: result.success,
      data: result,
      summary: result.success
        ? `⭐ Starred message ${params.messageId}`
        : `❌ Failed to star message: ${result.error}`,
    };
  }

  private async handleUnstarMessage(params: any): Promise<ToolCallResult> {
    const result = await this.unstarMessage(params.messageId);
    return {
      success: result.success,
      data: result,
      summary: result.success
        ? `☆ Unstarred message ${params.messageId}`
        : `❌ Failed to unstar message: ${result.error}`,
    };
  }

  private async handleDeleteMessage(params: any): Promise<ToolCallResult> {
    const result = await this.deleteMessage(params.messageId);
    return {
      success: result.success,
      data: result,
      summary: result.success
        ? `🗑️ Deleted message ${params.messageId}`
        : `❌ Failed to delete message: ${result.error}`,
    };
  }

  private async handleSearchMessages(params: any): Promise<ToolCallResult> {
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
      success: true,
      data: results,
      summary: `🔍 Found ${results.length} messages matching "${params.query}"`,
    };
  }

  private async handleReplyToMessage(params: any): Promise<ToolCallResult> {
    // First get the original message to find the sender
    const originalMessage = await this.getMessage(params.messageId);
    if (!originalMessage) {
      return {
        success: false,
        error: `Message ${params.messageId} not found`,
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
      success: result.success,
      data: result,
      summary: result.success
        ? `↩️ Replied to "${originalMessage.subject}" from ${originalMessage.from}`
        : `❌ Failed to send reply: ${result.error}`,
    };
  }

  private async handleRegisterAddress(params: any): Promise<ToolCallResult> {
    const result = await this.registerAddress(params.address);
    return {
      success: result.success,
      data: result,
      summary: result.success
        ? `📫 Registered address ${params.address}`
        : `❌ Failed to register address: ${result.error}`,
    };
  }

  // ==================== API Methods ====================

  /**
   * Send an email message
   */
  async sendMail(mail: OutgoingMail): Promise<{ success: boolean; messageId?: string; sentAt?: string; error?: string }> {
    const response = await this.fetchApi('/send', {
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

    const response = await this.fetchApi(`/inbox/${encodeURIComponent(address)}?${queryParams}`);
    return response;
  }

  /**
   * Get unread message count
   */
  async getUnreadCount(address: MailAddress): Promise<number> {
    const response = await this.fetchApi(`/inbox/${encodeURIComponent(address)}/unread`);
    return response;
  }

  /**
   * Get a single message by ID
   */
  async getMessage(messageId: string): Promise<MailMessage | null> {
    // Note: This endpoint may need to be added to the server
    const messages = await this.searchMessages({ subject: messageId });
    return messages.find(m => m.messageId === messageId) || null;
  }

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<{ success: boolean; error?: string }> {
    return this.fetchApi(`/${messageId}/read`, { method: 'POST' });
  }

  /**
   * Mark a message as unread
   */
  async markAsUnread(messageId: string): Promise<{ success: boolean; error?: string }> {
    return this.fetchApi(`/${messageId}/unread`, { method: 'POST' });
  }

  /**
   * Star a message
   */
  async starMessage(messageId: string): Promise<{ success: boolean; error?: string }> {
    return this.fetchApi(`/${messageId}/star`, { method: 'POST' });
  }

  /**
   * Unstar a message
   */
  async unstarMessage(messageId: string): Promise<{ success: boolean; error?: string }> {
    return this.fetchApi(`/${messageId}/unstar`, { method: 'POST' });
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId: string): Promise<{ success: boolean; error?: string }> {
    return this.fetchApi(`/${messageId}`, { method: 'DELETE' });
  }

  /**
   * Search messages
   */
  async searchMessages(query: SearchQuery): Promise<MailMessage[]> {
    return this.fetchApi('/search', {
      method: 'POST',
      body: JSON.stringify(query),
    });
  }

  /**
   * Register a new address
   */
  async registerAddress(address: MailAddress): Promise<{ success: boolean; error?: string }> {
    return this.fetchApi('/register', {
      method: 'POST',
      body: JSON.stringify({ address }),
    });
  }

  /**
   * Internal fetch helper
   */
  private async fetchApi(path: string, options: RequestInit = {}): Promise<any> {
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
      th2({}, 'Mail Component'),
      tdiv({ styles: { marginBottom: '16px' } }, [
        tspan({ styles: { color: 'text.secondary' } },
          `Connected to: ${this.config.baseUrl}`),
        this.config.defaultAddress && tspan({}, ` | Default Address: ${this.config.defaultAddress}`),
      ]),
    );

    // Error display
    if (this.error) {
      elements.push(talert({ type: 'error', message: this.error }));
    }

    // Loading state
    if (this.isLoading) {
      elements.push(tloading({ message: 'Loading...' }));
    }

    // Quick stats
    if (this.config.defaultAddress) {
      try {
        const unreadCount = await this.getUnreadCount(this.config.defaultAddress);
        elements.push(
          tdiv({ styles: { display: 'flex', gap: '12px', marginBottom: '16px' } }, [
            tbadge({ variant: 'primary', label: `Unread: ${unreadCount}` }),
            this.currentInbox && tbadge({ variant: 'secondary', label: `Total: ${this.currentInbox.total}` }),
          ]),
        );
      } catch (e) {
        // Ignore error in rendering
      }
    }

    // Compose button
    elements.push(
      tdiv({ styles: { marginBottom: '16px' } }, [
        tbutton({
          label: '✉️ Compose',
          variant: 'primary',
          onClick: () => this.showComposeDialog(),
        }),
      ]),
    );

    // Inbox view
    if (this.currentInbox) {
      elements.push(...this.renderInbox());
    } else {
      // Load inbox button
      elements.push(
        tbutton({
          label: '📥 Load Inbox',
          onClick: async () => {
            if (this.config.defaultAddress) {
              this.isLoading = true;
              try {
                this.currentInbox = await this.getInbox(this.config.defaultAddress, this.inboxQuery);
              } catch (e) {
                this.error = String(e);
              } finally {
                this.isLoading = false;
              }
            }
          },
        }),
      );
    }

    return elements;
  };

  private renderInbox(): TUIElement[] {
    if (!this.currentInbox) return [];

    const elements: TUIElement[] = [];

    // Filters
    elements.push(
      tdiv({ styles: { display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' } }, [
        tlabel({}, 'Filters:'),
        tcheckbox({
          label: 'Unread only',
          checked: this.inboxQuery.unreadOnly || false,
          onChange: (checked) => {
            this.inboxQuery.unreadOnly = checked;
            this.refreshInbox();
          },
        }),
        tcheckbox({
          label: 'Starred only',
          checked: this.inboxQuery.starredOnly || false,
          onChange: (checked) => {
            this.inboxQuery.starredOnly = checked;
            this.refreshInbox();
          },
        }),
        tselect({
          value: this.inboxQuery.sortBy || 'sentAt',
          options: [
            { value: 'sentAt', label: 'Date' },
            { value: 'subject', label: 'Subject' },
            { value: 'priority', label: 'Priority' },
          ],
          onChange: (value) => {
            this.inboxQuery.sortBy = value as InboxQuery['sortBy'];
            this.refreshInbox();
          },
        }),
      ]),
    );

    // Messages table
    if (this.currentInbox.messages.length === 0) {
      elements.push(tempty({ message: 'No messages found' }));
    } else {
      const rows = this.currentInbox.messages.map(msg =>
        ttr({
          styles: {
            fontWeight: msg.status.read ? 'normal' : 'bold',
            backgroundColor: this.selectedMessage?.messageId === msg.messageId ? 'primary.light' : undefined,
            cursor: 'pointer',
          },
          onClick: () => {
            this.selectedMessage = msg;
            if (!msg.status.read) {
              this.markAsRead(msg.messageId);
            }
          },
        }, [
          ttd({}, msg.status.starred ? '⭐' : '☆'),
          ttd({}, msg.priority === 'urgent' ? '🔴' : msg.priority === 'high' ? '🟡' : '⚪'),
          ttd({}, msg.from),
          ttd({}, msg.subject),
          ttd({}, new Date(msg.sentAt).toLocaleString()),
          ttd({}, [
            tbutton({
              label: 'Reply',
              size: 'small',
              onClick: (e) => {
                e.stopPropagation();
                this.showReplyDialog(msg);
              },
            }),
            tbutton({
              label: 'Delete',
              size: 'small',
              variant: 'danger',
              onClick: (e) => {
                e.stopPropagation();
                this.deleteMessage(msg.messageId).then(() => this.refreshInbox());
              },
            }),
          ]),
        ]),
      );

      elements.push(
        ttable({}, [
          tthead({}, [
            ttr({}, [
              tth({}, ''),
              tth({}, ''),
              tth({}, 'From'),
              tth({}, 'Subject'),
              tth({}, 'Date'),
              tth({}, 'Actions'),
            ]),
          ]),
          ttbody({}, rows),
        ]),
      );

      // Pagination
      const totalPages = Math.ceil(this.currentInbox.total / (this.inboxQuery.pagination?.limit || 20));
      const currentPage = Math.floor((this.inboxQuery.pagination?.offset || 0) / (this.inboxQuery.pagination?.limit || 20)) + 1;

      elements.push(
        tpagination({
          currentPage,
          totalPages,
          onPageChange: (page) => {
            this.inboxQuery.pagination = {
              ...this.inboxQuery.pagination,
              offset: (page - 1) * (this.inboxQuery.pagination?.limit || 20),
            };
            this.refreshInbox();
          },
        }),
      );
    }

    // Message detail view
    if (this.selectedMessage) {
      elements.push(this.renderMessageDetail(this.selectedMessage));
    }

    return elements;
  }

  private renderMessageDetail(message: MailMessage): TUIElement {
    return tcard({
      title: message.subject,
      styles: { marginTop: '16px' },
    }, [
      tdiv({ styles: { marginBottom: '12px' } }, [
        tdiv({}, [
          tspan({ styles: { fontWeight: 'bold' } }, 'From: '),
          tspan({}, message.from),
        ]),
        tdiv({}, [
          tspan({ styles: { fontWeight: 'bold' } }, 'To: '),
          tspan({}, Array.isArray(message.to) ? message.to.join(', ') : message.to),
        ]),
        tdiv({}, [
          tspan({ styles: { fontWeight: 'bold' } }, 'Date: '),
          tspan({}, new Date(message.sentAt).toLocaleString()),
        ]),
        message.taskId && tdiv({}, [
          tspan({ styles: { fontWeight: 'bold' } }, 'Task ID: '),
          tspan({}, message.taskId),
        ]),
      ]),
      tdiv({ styles: { borderTop: '1px solid #eee', paddingTop: '12px', whiteSpace: 'pre-wrap' } },
        message.body || '(No content)'),
      message.attachments && message.attachments.length > 0 && tdiv({ styles: { marginTop: '12px' } }, [
        th3({}, 'Attachments:'),
        ...message.attachments.map(att => tdiv({}, att)),
      ]),
      message.payload && tdiv({ styles: { marginTop: '12px' } }, [
        th3({}, 'Payload:'),
        tdiv({ styles: { fontFamily: 'monospace', fontSize: '12px' } }, JSON.stringify(message.payload, null, 2)),
      ]),
    ]);
  }

  private showComposeDialog(): void {
    // This would typically open a dialog - simplified version
    console.log('[MailComponent] Opening compose dialog');
  }

  private showReplyDialog(message: MailMessage): void {
    // This would typically open a reply dialog
    console.log('[MailComponent] Opening reply dialog for message:', message.messageId);
  }

  private async refreshInbox(): Promise<void> {
    if (!this.config.defaultAddress) return;
    this.isLoading = true;
    try {
      this.currentInbox = await this.getInbox(this.config.defaultAddress, this.inboxQuery);
    } catch (e) {
      this.error = String(e);
    } finally {
      this.isLoading = false;
    }
  }
}

/**
 * Factory function to create MailComponent
 */
export function createMailComponent(config: MailComponentConfig): MailComponent {
  return new MailComponent(config);
}
