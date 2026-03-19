/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { ToolComponent, ExportOptions } from '../core/toolComponent.js';
import {
  Tool,
  ToolCallResult,
  TUIElement,
  tdiv,
  th,
  tp,
} from '../ui/index.js';
import {
  type MailMessage,
  type MailComponentConfig,
} from '../../multi-agent/types.js';
import {
  mailToolSchemas,
  type MailToolName,
  type ToolReturnType,
  type GetInboxParams,
  type MarkAsReadParams,
  type GetUnreadCountParams,
} from './mailSchemas';

/**
 * MailComponent Configuration
 */
export type { MailComponentConfig } from './mailSchemas';

/**
 * MailComponent - Simplified email component for agent communication
 *
 * Provides only read access to mailbox for task instructions.
 * Does NOT support sending or replying to emails.
 *
 * @example
 * ```typescript
 * const mail = new MailComponent({
 *   baseUrl: 'http://localhost:3000',
 *   defaultAddress: 'myagent@expert',
 * });
 *
 * // Get inbox messages (task instructions)
 * const messages = await mail.handleToolCall('getInbox', { limit: 20 });
 *
 * // Mark message as read after processing
 * await mail.handleToolCall('markAsRead', { messageId: 'msg-123' });
 * ```
 */

export class MailComponent extends ToolComponent {
  override componentId = 'mail';
  override displayName = 'Mail';
  override description = 'Email-style messaging system for agent communication';

  toolSet: Map<string, Tool>;
  private config: MailComponentConfig;

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

    const toolEntries: [string, Tool][] = [
      ['getInbox', mailToolSchemas.getInbox],
      ['markAsRead', mailToolSchemas.markAsRead],
      ['getUnreadCount', mailToolSchemas.getUnreadCount],
    ];

    toolEntries.forEach(([name, tool]) => {
      tools.set(name, tool);
    });

    return tools;
  }

  // ==================== Tool Handlers ====================

  handleToolCall: {
    <T extends MailToolName>(toolName: T, params: unknown): Promise<ToolCallResult<ToolReturnType<T>>>;
    (toolName: string, params: unknown): Promise<ToolCallResult<any>>;
  } = async (
    toolName: string,
    params: unknown,
  ): Promise<ToolCallResult<any>> => {
    try {
      switch (toolName) {
        case 'getInbox':
          return await this.handleGetInbox(params as GetInboxParams);
        case 'markAsRead':
          return await this.handleMarkAsRead(params as MarkAsReadParams);
        case 'getUnreadCount':
          return await this.handleGetUnreadCount(params as GetUnreadCountParams);
        default:
          return {
            success: false,
            data: { error: `Unknown tool: ${toolName}` },
            summary: `[Mail] Unknown tool: ${toolName}`,
          };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        data: { error: errorMessage },
        summary: `[Mail] Error: ${errorMessage}`,
      };
    }
  };

  private async handleGetInbox(
    params: GetInboxParams,
  ): Promise<ToolCallResult<{ messages: MailMessage[]; total: number; unread: number }>> {
    const address = this.config.defaultAddress;
    if (!address) {
      return {
        success: false,
        data: { error: 'No address configured' } as any,
        summary: '[Mail] Error: No address configured',
      };
    }

    try {
      const result = await this.getInbox(address, {
        pagination: { limit: params.limit, offset: params.offset },
        unreadOnly: params.unreadOnly,
      });

      return {
        success: true,
        data: {
          messages: result.messages,
          total: result.total,
          unread: result.unread,
        },
        summary: `[Mail] Got ${result.messages.length} messages (total: ${result.total}, unread: ${result.unread})`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        data: { error: errorMessage } as any,
        summary: `[Mail] Failed to get inbox: ${errorMessage}`,
      };
    }
  }

  private async handleMarkAsRead(
    params: MarkAsReadParams,
  ): Promise<ToolCallResult<{ success: boolean }>> {
    const address = this.config.defaultAddress;
    if (!address) {
      return {
        success: false,
        data: { error: 'No address configured' } as any,
        summary: '[Mail] Error: No address configured',
      };
    }

    try {
      const result = await this.markAsRead(address, params.messageId);
      return {
        success: result.success,
        data: { success: result.success },
        summary: result.success
          ? `[Mail] Marked ${params.messageId} as read`
          : `[Mail] Failed to mark as read`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        data: { error: errorMessage } as any,
        summary: `[Mail] Failed to mark as read: ${errorMessage}`,
      };
    }
  }

  private async handleGetUnreadCount(
    params: GetUnreadCountParams,
  ): Promise<ToolCallResult<{ count: number }>> {
    const address = params.address || this.config.defaultAddress;
    if (!address) {
      return {
        success: false,
        data: { error: 'No address configured' } as any,
        summary: '[Mail] Error: No address configured',
      };
    }

    try {
      const inbox = await this.getInbox(address, { unreadOnly: true, pagination: { limit: 1, offset: 0 } });
      return {
        success: true,
        data: { count: inbox.unread },
        summary: `[Mail] Unread count for ${address}: ${inbox.unread}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        data: { error: errorMessage } as any,
        summary: `[Mail] Failed to get unread count: ${errorMessage}`,
      };
    }
  }

  // ==================== API Methods ====================

  /**
   * Mark a message as read
   */
  async markAsRead(address: string, messageId: string): Promise<{ success: boolean; error?: string }> {
    return this.fetchApi<{ success: boolean; error?: string }>(
      `/${encodeURIComponent(messageId)}/read`,
      {
        method: 'POST',
        body: JSON.stringify({ address }),
      },
    );
  }

  /**
   * Register a new mailbox address (external use)
   */
  async registerAddress(address: string): Promise<{ success: boolean; error?: string }> {
    return this.fetchApi<{ success: boolean; error?: string }>('/register', {
      method: 'POST',
      body: JSON.stringify({ address }),
    });
  }

  /**
   * Get inbox messages
   */
  async getInbox(
    address: string,
    query?: {
      pagination?: { limit?: number; offset?: number };
      unreadOnly?: boolean;
    },
  ): Promise<{ messages: MailMessage[]; total: number; unread: number }> {
    const queryParams = new URLSearchParams();
    if (query?.pagination?.limit)
      queryParams.set('limit', String(query.pagination.limit));
    if (query?.pagination?.offset)
      queryParams.set('offset', String(query.pagination.offset));
    if (query?.unreadOnly) queryParams.set('unreadOnly', 'true');

    return this.fetchApi<{ messages: MailMessage[]; total: number; unread: number }>(
      `/inbox/${encodeURIComponent(address)}?${queryParams.toString()}`,
    );
  }

  // ==================== API Methods (kept for external use) ====================

  /**
   * Send an email message (external use only)
   */
  async sendMail(mail: {
    from: string;
    to: string;
    subject: string;
    body: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    taskId?: string;
    attachments?: string[];
    payload?: Record<string, unknown>;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return this.fetchApi<{ success: boolean; messageId?: string; error?: string }>('/send', {
      method: 'POST',
      body: JSON.stringify(mail),
    });
  }

  /**
   * Get a single message by ID (external use only)
   */
  async getMessage(messageId: string): Promise<MailMessage | null> {
    try {
      return await this.fetchApi<MailMessage>(`/message/${encodeURIComponent(messageId)}`);
    } catch {
      return null;
    }
  }

  // ==================== UI Rendering ====================

  /**
   * Render the component for display
   */
  renderImply = async (): Promise<TUIElement[]> => {
    const address = this.config.defaultAddress;
    const elements: TUIElement[] = [];

    // Header
    elements.push(
      new th({
        content: 'Mail Component',
        styles: { align: 'center' },
      }),
    );

    // Connection info
    elements.push(
      new tdiv({
        content: `Server: ${this.config.baseUrl} | Address: ${address || 'Not configured'}`,
        styles: {
          align: 'center',
          padding: { vertical: 1 },
        },
      }),
    );

    // Get and display messages
    if (address) {
      try {
        const inbox = await this.getInbox(address);
        elements.push(
          new tp({
            content: `Messages: ${inbox.messages.length}/${inbox.total} | Unread: ${inbox.unread}`,
            indent: 1,
            textStyle: { bold: true },
          }),
        );

        if (inbox.messages.length > 0) {
          elements.push(new tp({ content: '─'.repeat(60), indent: 1 }));

          inbox.messages.forEach((msg, index) => {
            const unreadMarker = !msg.status?.read ? '[UNREAD] ' : '';
            elements.push(
              new tp({
                content: `${index + 1}. ${unreadMarker}${msg.subject}`,
                indent: 1,
                textStyle: { bold: !msg.status?.read },
              }),
            );
            elements.push(
              new tp({
                content: `   From: ${msg.from} | ${new Date(msg.sentAt).toLocaleString()}`,
                indent: 2,
              }),
            );
          });
        } else {
          elements.push(new tp({ content: 'No messages.', indent: 1 }));
        }
      } catch (error) {
        elements.push(
          new tp({
            content: `Error loading inbox: ${error instanceof Error ? error.message : String(error)}`,
            indent: 1,
          }),
        );
      }
    } else {
      elements.push(new tp({ content: 'Not configured - no default address.', indent: 1 }));
    }

    return elements;
  };

  // ==================== Internal Fetch ====================

  private async fetchApi<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.config.baseUrl}/api/v1/mail${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options.headers) {
      const customHeaders = options.headers as Record<string, string>;
      Object.entries(customHeaders).forEach(([key, value]) => {
        headers[key] = value;
      });
    }

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

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  async exportData(options?: ExportOptions) {
    const address = this.config.defaultAddress;
    if (!address) {
      return {
        data: { config: this.config, messages: [] },
        format: options?.format ?? 'json',
        metadata: { componentId: this.componentId },
      };
    }

    const inbox = await this.getInbox(address);
    return {
      data: {
        config: this.config,
        messages: inbox.messages,
        total: inbox.total,
        unread: inbox.unread,
      },
      format: options?.format ?? 'json',
      metadata: {
        componentId: this.componentId,
        exportedAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * Factory function to create MailComponent
 */
export function createMailComponent(
  config: MailComponentConfig,
): MailComponent {
  return new MailComponent(config);
}
