/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Tool,
  ToolCallResult,
  ToolComponent,
  TUIElement,
  tdiv,
  th,
  tp,
} from 'agent-lib';
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
} from 'agent-lib';
import {
  mailToolSchemas,
  type SendMailParams,
  type GetInboxParams,
  type GetUnreadCountParams,
  type MessageIdParams,
  type SearchMessagesParams,
  type ReplyToMessageParams,
  type RegisterAddressParams,
  type SaveDraftParams,
  type EditDraftParams,
  type GetDraftsParams,
  type DeleteDraftParams,
  type InsertDraftContentParams,
  type ReplaceDraftContentParams,
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
 * - Auto-refresh inbox on render (side effect)
 * - Mark messages as read/unread/starred
 * - Search messages
 * - Reply to messages
 *
 * This component communicates with the agent-mailbox service via REST API.
 * Inbox data is automatically fetched during render.
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
 *
 * // Render - inbox will be auto-fetched
 * const elements = await mail.renderImply();
 * ```
 */
/**
 * MailComponent State - for property-based rendering
 */
export interface MailComponentState {
  /** Current mailbox address */
  address?: MailAddress;
  /** Messages to display */
  messages: MailMessage[];
  /** Total message count */
  total: number;
  /** Unread message count */
  unread: number;
  /** Starred message count */
  starred: number;
  /** Currently selected message */
  selectedMessage?: MailMessage;
  /** Drafts list */
  drafts: Array<{
    draftId: string;
    to: string;
    subject: string;
    body: string;
    priority: string;
    taskId?: string;
    attachments?: DraftAttachment[];
    payload?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }>;
  /** Drafts total count */
  draftsTotal: number;
  /** Currently selected draft for editing */
  selectedDraft?: {
    draftId: string;
    to: string;
    subject: string;
    body: string;
    priority: string;
  };
}

/**
 * Draft data for saving/editing drafts
 */
export interface DraftData {
  from: string;
  to: string;
  subject: string;
  body: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  taskId?: string;
  attachments?: string[];
  payload?: Record<string, unknown>;
}

export interface DraftUpdate {
  to?: string;
  subject?: string;
  body?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  taskId?: string;
  attachments?: string[];
  payload?: Record<string, unknown>;
}

export interface DraftResult {
  success: boolean;
  draftId?: string;
  error?: string;
}

/**
 * Attachment interface for draft attachments
 */
export interface DraftAttachment {
  name: string;
  url?: string;
}

export interface DraftsResult {
  drafts: Array<{
    draftId: string;
    to: string;
    subject: string;
    body: string;
    priority: string;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
}

export class MailComponent extends ToolComponent {
  override componentId = 'mail';
  override displayName = 'Mail';
  override description = 'Email-style messaging system for agent communication';

  toolSet: Map<string, Tool>;
  private config: MailComponentConfig;

  // Property-based state (auto-refreshed during render)
  private state: MailComponentState = {
    messages: [],
    total: 0,
    unread: 0,
    starred: 0,
    drafts: [],
    draftsTotal: 0,
  };

  // Local in-memory storage for drafts (replaces API)
  private draftsStore: Map<string, {
    draftId: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    priority: string;
    taskId?: string;
    attachments?: DraftAttachment[];
    payload?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }> = new Map();

  // Generate unique draft ID
  private generateDraftId(): string {
    return `draft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Legacy support: currentInbox for backward compatibility
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

  // ==================== Property-Based State Management ====================
  // Internal methods - called by the system for state refresh

  /**
   * Set component state directly with messages (internal use)
   * Called by the system to update message state
   */
  private _setState(state: Partial<MailComponentState>): void {
    this.state = { ...this.state, ...state };

    // Also update legacy inbox for backward compatibility
    if (state.messages || state.address) {
      this.currentInbox = {
        address: this.state.address || this.config.defaultAddress || '',
        messages: this.state.messages,
        total: this.state.total,
        unread: this.state.unread,
        starred: this.state.starred,
      };
    }
  }

  /**
   * Select a draft for editing
   */
  private _selectDraft(draft: {
    draftId: string;
    to: string;
    subject: string;
    body: string;
    priority: string;
  }): void {
    this.state.selectedDraft = draft;
  }

  /**
   * Clear selected draft
   */
  private _clearDraftSelection(): void {
    this.state.selectedDraft = undefined;
  }

  /**
   * Get current component state (internal use)
   */
  private _getState(): MailComponentState {
    return { ...this.state };
  }

  /**
   * Clear all messages (internal use)
   */
  private _clearMessages(): void {
    this.state = {
      messages: [],
      total: 0,
      unread: 0,
      starred: 0,
      drafts: [],
      draftsTotal: 0,
    };
    this.currentInbox = null;
    this.selectedMessage = null;
  }

  /**
   * Select a message to show details (internal use)
   */
  private _selectMessage(messageId: string): void {
    const message = this.state.messages.find((m) => m.messageId === messageId);
    this.state.selectedMessage = message;
    this.selectedMessage = message || null;
  }

  /**
   * Clear selected message (internal use)
   */
  private _clearSelection(): void {
    this.state.selectedMessage = undefined;
    this.selectedMessage = null;
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
      ['saveDraft', mailToolSchemas.saveDraft],
      ['editDraft', mailToolSchemas.editDraft],
      ['getDrafts', mailToolSchemas.getDrafts],
      ['deleteDraft', mailToolSchemas.deleteDraft],
      ['insertDraftContent', mailToolSchemas.insertDraftContent],
      ['replaceDraftContent', mailToolSchemas.replaceDraftContent],
    ];

    toolEntries.forEach(([name, tool]) => {
      tools.set(name, tool);
    });

    return tools;
  }

  // ==================== Tool Handlers ====================

  handleToolCall = async (
    toolName: string,
    params: unknown,
  ): Promise<ToolCallResult> => {
    try {
      switch (toolName) {
        case 'sendMail':
          return await this.handleSendMail(params as SendMailParams);
        case 'getInbox':
          return await this.handleGetInbox(params as GetInboxParams);
        case 'getUnreadCount':
          return await this.handleGetUnreadCount(
            params as GetUnreadCountParams,
          );
        case 'markAsRead':
          return await this.handleMarkAsRead(params as MessageIdParams);
        case 'markAsUnread':
          return await this.handleMarkAsUnread(params as MessageIdParams);
        case 'starMessage':
          return await this.handleStarMessage(params as MessageIdParams);
        case 'unstarMessage':
          return await this.handleUnstarMessage(params as MessageIdParams);
        case 'deleteMessage':
          return await this.handleDeleteMessage(params as MessageIdParams);
        case 'searchMessages':
          return await this.handleSearchMessages(
            params as SearchMessagesParams,
          );
        case 'replyToMessage':
          return await this.handleReplyToMessage(
            params as ReplyToMessageParams,
          );
        case 'registerAddress':
          return await this.handleRegisterAddress(
            params as RegisterAddressParams,
          );
        case 'saveDraft':
          return this.handleSaveDraft(params as SaveDraftParams);
        case 'editDraft':
          return this.handleEditDraft(params as EditDraftParams);
        case 'getDrafts':
          return this.handleGetDrafts(params as GetDraftsParams);
        case 'deleteDraft':
          return this.handleDeleteDraft(params as DeleteDraftParams);
        case 'insertDraftContent':
          return this.handleInsertDraftContent(params as InsertDraftContentParams);
        case 'replaceDraftContent':
          return this.handleReplaceDraftContent(params as ReplaceDraftContentParams);
        default:
          return {
            data: { error: `Unknown tool: ${toolName}` },
            summary: `[Mail] Unknown tool: ${toolName}`,
          };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        data: { error: errorMessage },
        summary: `[Mail] Error: ${errorMessage}`,
      };
    }
  };

  private async handleSendMail(
    params: SendMailParams,
  ): Promise<ToolCallResult> {
    const from = this.config.defaultAddress;
    if (!from) {
      return {
        data: { error: 'No default address configured' },
        summary: '[Mail] Error: No default address configured',
      };
    }

    const mail: OutgoingMail = {
      from,
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

  private async handleGetInbox(
    params: GetInboxParams,
  ): Promise<ToolCallResult> {
    const address = params.address || this.config.defaultAddress;
    if (!address) {
      return {
        data: {
          error: 'No address specified and no default address configured',
        },
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

    return {
      data: result,
      summary: `[Mail] ${address}: ${result.messages.length}/${result.total} messages (${result.unread} unread)`,
    };
  }

  private async handleGetUnreadCount(
    params: GetUnreadCountParams,
  ): Promise<ToolCallResult> {
    const address = params.address || this.config.defaultAddress;
    if (!address) {
      return {
        data: {
          error: 'No address specified and no default address configured',
        },
        summary: '[Mail] Error: No address configured',
      };
    }

    const count = await this.getUnreadCount(address);

    return {
      data: { count, address },
      summary: `[Mail] ${address} has ${count} unread messages`,
    };
  }

  private async handleMarkAsRead(
    params: MessageIdParams,
  ): Promise<ToolCallResult> {
    const result = await this.markAsRead(params.messageId);
    return {
      data: result,
      summary: result.success
        ? `[Mail] Marked ${params.messageId} as read`
        : `[Mail] Failed to mark as read: ${result.error}`,
    };
  }

  private async handleMarkAsUnread(
    params: MessageIdParams,
  ): Promise<ToolCallResult> {
    const result = await this.markAsUnread(params.messageId);
    return {
      data: result,
      summary: result.success
        ? `[Mail] Marked ${params.messageId} as unread`
        : `[Mail] Failed to mark as unread: ${result.error}`,
    };
  }

  private async handleStarMessage(
    params: MessageIdParams,
  ): Promise<ToolCallResult> {
    const result = await this.starMessage(params.messageId);
    return {
      data: result,
      summary: result.success
        ? `[Mail] Starred ${params.messageId}`
        : `[Mail] Failed to star: ${result.error}`,
    };
  }

  private async handleUnstarMessage(
    params: MessageIdParams,
  ): Promise<ToolCallResult> {
    const result = await this.unstarMessage(params.messageId);
    return {
      data: result,
      summary: result.success
        ? `[Mail] Unstarred ${params.messageId}`
        : `[Mail] Failed to unstar: ${result.error}`,
    };
  }

  private async handleDeleteMessage(
    params: MessageIdParams,
  ): Promise<ToolCallResult> {
    const result = await this.deleteMessage(params.messageId);
    return {
      data: result,
      summary: result.success
        ? `[Mail] Deleted ${params.messageId}`
        : `[Mail] Failed to delete: ${result.error}`,
    };
  }

  private async handleSearchMessages(
    params: SearchMessagesParams,
  ): Promise<ToolCallResult> {
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

  private async handleReplyToMessage(
    params: ReplyToMessageParams,
  ): Promise<ToolCallResult> {
    // First get the original message to find the sender
    const messages = await this.searchMessages({ subject: params.messageId });
    const originalMessage = messages.find(
      (m) => m.messageId === params.messageId,
    );

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

  private async handleRegisterAddress(
    params: RegisterAddressParams,
  ): Promise<ToolCallResult> {
    const result = await this.registerAddress(params.address);
    return {
      data: result,
      summary: result.success
        ? `[Mail] Registered ${params.address}`
        : `[Mail] Failed to register: ${result.error}`,
    };
  }

  private handleSaveDraft(
    params: SaveDraftParams,
  ): ToolCallResult {
    const from = this.config.defaultAddress;
    if (!from) {
      return {
        data: { error: 'No default address configured' },
        summary: '[Mail] Error: No default address configured',
      };
    }

    const draft = {
      from,
      to: params.to,
      subject: params.subject,
      body: params.body,
      priority: params.priority || 'normal',
      taskId: params.taskId,
      attachments: params.attachments,
      payload: params.payload,
    };

    const result = this.saveDraft(draft);

    return {
      data: result,
      summary: result.success
        ? `[Mail] Draft saved: "${params.subject}"`
        : `[Mail] Failed to save draft: ${result.error}`,
    };
  }

  private handleEditDraft(
    params: EditDraftParams,
  ): ToolCallResult {
    const result = this.editDraft(params.draftId, {
      to: params.to,
      subject: params.subject,
      body: params.body,
      priority: params.priority,
      taskId: params.taskId,
      attachments: params.attachments,
      payload: params.payload,
    });

    return {
      data: result,
      summary: result.success
        ? `[Mail] Draft edited: "${params.draftId}"`
        : `[Mail] Failed to edit draft: ${result.error}`,
    };
  }

  private handleGetDrafts(
    params: GetDraftsParams,
  ): ToolCallResult {
    const address = params.address || this.config.defaultAddress;
    if (!address) {
      return {
        data: {
          error: 'No address specified and no default address configured',
        },
        summary: '[Mail] Error: No address configured',
      };
    }

    const result = this.getDrafts(address, {
      limit: params.limit || 20,
      offset: params.offset || 0,
    });

    return {
      data: result,
      summary: `[Mail] ${address}: ${result.drafts.length} drafts`,
    };
  }

  private handleDeleteDraft(
    params: DeleteDraftParams,
  ): ToolCallResult {
    const result = this.deleteDraft(params.draftId);

    return {
      data: result,
      summary: result.success
        ? `[Mail] Draft deleted: "${params.draftId}"`
        : `[Mail] Failed to delete draft: ${result.error}`,
    };
  }

  private handleInsertDraftContent(
    params: InsertDraftContentParams,
  ): ToolCallResult {
    const result = this.insertDraftContent(params.draftId, params.content, params.position);

    return {
      data: result,
      summary: result.success
        ? `[Mail] Inserted content at position ${params.position} in draft "${params.draftId}"`
        : `[Mail] Failed to insert content: ${result.error}`,
    };
  }

  private handleReplaceDraftContent(
    params: ReplaceDraftContentParams,
  ): ToolCallResult {
    const result = this.replaceDraftContent(params.draftId, params.search, params.replacement, params.replaceAll);

    return {
      data: result,
      summary: result.success
        ? `[Mail] Replaced "${params.search}" with "${params.replacement}" in draft "${params.draftId}"`
        : `[Mail] Failed to replace content: ${result.error}`,
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
  async getInbox(
    address: MailAddress,
    query?: InboxQuery,
  ): Promise<InboxResult> {
    const queryParams = new URLSearchParams();
    if (query?.pagination?.limit)
      queryParams.set('limit', String(query.pagination.limit));
    if (query?.pagination?.offset)
      queryParams.set('offset', String(query.pagination.offset));
    if (query?.unreadOnly) queryParams.set('unreadOnly', 'true');
    if (query?.starredOnly) queryParams.set('starredOnly', 'true');
    if (query?.sortBy) queryParams.set('sortBy', query.sortBy);
    if (query?.sortOrder) queryParams.set('sortOrder', query.sortOrder);

    const response = await this.fetchApi<InboxResult>(
      `/inbox/${encodeURIComponent(address)}?${queryParams.toString()}`,
    );
    return response;
  }

  /**
   * Get unread message count
   */
  async getUnreadCount(address: MailAddress): Promise<number> {
    const response = await this.fetchApi<number>(
      `/inbox/${encodeURIComponent(address)}/unread`,
    );
    return response;
  }

  /**
   * Get a single message by ID
   */
  async getMessage(messageId: string): Promise<MailMessage | null> {
    const messages = await this.searchMessages({ subject: messageId });
    return messages.find((m) => m.messageId === messageId) || null;
  }

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<StorageResult> {
    return this.fetchApi<StorageResult>(`/${messageId}/read`, {
      method: 'POST',
    });
  }

  /**
   * Mark a message as unread
   */
  async markAsUnread(messageId: string): Promise<StorageResult> {
    return this.fetchApi<StorageResult>(`/${messageId}/unread`, {
      method: 'POST',
    });
  }

  /**
   * Star a message
   */
  async starMessage(messageId: string): Promise<StorageResult> {
    return this.fetchApi<StorageResult>(`/${messageId}/star`, {
      method: 'POST',
    });
  }

  /**
   * Unstar a message
   */
  async unstarMessage(messageId: string): Promise<StorageResult> {
    return this.fetchApi<StorageResult>(`/${messageId}/unstar`, {
      method: 'POST',
    });
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
   * Save an email as a draft (state-based, no API)
   */
  saveDraft(draft: DraftData): DraftResult {
    try {
      const draftId = this.generateDraftId();
      const now = new Date().toISOString();

      // Convert string[] attachments to DraftAttachment[]
      const attachments: DraftAttachment[] | undefined = draft.attachments?.map(s3Key => ({
        name: s3Key.split('/').pop() || s3Key,
        url: s3Key,
      }));

      const newDraft = {
        draftId,
        from: draft.from,
        to: draft.to,
        subject: draft.subject,
        body: draft.body,
        priority: draft.priority || 'normal',
        taskId: draft.taskId,
        attachments,
        payload: draft.payload,
        createdAt: now,
        updatedAt: now,
      };

      // Store in local memory
      this.draftsStore.set(draftId, newDraft);

      // Update state
      this._setState({
        drafts: Array.from(this.draftsStore.values()).map(d => ({
          draftId: d.draftId,
          to: d.to,
          subject: d.subject,
          body: d.body,
          priority: d.priority,
          taskId: d.taskId,
          attachments: d.attachments,
          payload: d.payload,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        })),
        draftsTotal: this.draftsStore.size,
      });

      return {
        success: true,
        draftId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Edit an existing draft (state-based, no API)
   */
  editDraft(draftId: string, update: DraftUpdate): DraftResult {
    try {
      const existingDraft = this.draftsStore.get(draftId);
      if (!existingDraft) {
        return {
          success: false,
          error: `Draft ${draftId} not found`,
        };
      }

      // Convert string[] attachments to DraftAttachment[] if needed
      let attachments: DraftAttachment[] | undefined = (update as any).attachments;
      if (attachments && attachments.length > 0 && typeof attachments[0] === 'string') {
        attachments = (attachments as unknown as string[]).map((s3Key: string) => ({
          name: s3Key.split('/').pop() || s3Key,
          url: s3Key,
        }));
      }

      const updatedDraft = {
        ...existingDraft,
        to: update.to ?? existingDraft.to,
        subject: update.subject ?? existingDraft.subject,
        body: update.body ?? existingDraft.body,
        priority: update.priority ?? existingDraft.priority,
        taskId: update.taskId ?? existingDraft.taskId,
        attachments: attachments ?? existingDraft.attachments,
        payload: update.payload ?? existingDraft.payload,
        updatedAt: new Date().toISOString(),
      };

      // Store in local memory
      this.draftsStore.set(draftId, updatedDraft);

      // Update state
      this._setState({
        drafts: Array.from(this.draftsStore.values()).map(d => ({
          draftId: d.draftId,
          to: d.to,
          subject: d.subject,
          body: d.body,
          priority: d.priority,
          taskId: d.taskId,
          attachments: d.attachments,
          payload: d.payload,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        })),
        draftsTotal: this.draftsStore.size,
      });

      return {
        success: true,
        draftId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get drafts for an address (state-based, no API)
   */
  getDrafts(
    _address: MailAddress,
    options?: { limit?: number; offset?: number },
  ): DraftsResult {
    const allDrafts = Array.from(this.draftsStore.values());

    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const paginatedDrafts = allDrafts.slice(offset, offset + limit);

    return {
      drafts: paginatedDrafts.map(d => ({
        draftId: d.draftId,
        to: d.to,
        subject: d.subject,
        body: d.body,
        priority: d.priority,
        taskId: d.taskId,
        attachments: d.attachments,
        payload: d.payload,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
      total: allDrafts.length,
    };
  }

  /**
   * Delete a draft (state-based, no API)
   */
  deleteDraft(draftId: string): DraftResult {
    try {
      const existingDraft = this.draftsStore.get(draftId);
      if (!existingDraft) {
        return {
          success: false,
          error: `Draft ${draftId} not found`,
        };
      }

      // Delete from local memory
      this.draftsStore.delete(draftId);

      // Clear selected draft if it was deleted
      if (this.state.selectedDraft?.draftId === draftId) {
        this._clearDraftSelection();
      }

      // Update state
      this._setState({
        drafts: Array.from(this.draftsStore.values()).map(d => ({
          draftId: d.draftId,
          to: d.to,
          subject: d.subject,
          body: d.body,
          priority: d.priority,
          taskId: d.taskId,
          attachments: d.attachments,
          payload: d.payload,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        })),
        draftsTotal: this.draftsStore.size,
      });

      return {
        success: true,
        draftId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Insert content at a specific position in a draft body (state-based)
   */
  insertDraftContent(draftId: string, content: string, position: number): DraftResult {
    try {
      const existingDraft = this.draftsStore.get(draftId);
      if (!existingDraft) {
        return {
          success: false,
          error: `Draft ${draftId} not found`,
        };
      }

      const currentBody = existingDraft.body || '';
      // Validate position
      const validPosition = Math.max(0, Math.min(position, currentBody.length));
      const newBody = currentBody.slice(0, validPosition) + content + currentBody.slice(validPosition);

      const updatedDraft = {
        ...existingDraft,
        body: newBody,
        updatedAt: new Date().toISOString(),
      };

      // Store in local memory
      this.draftsStore.set(draftId, updatedDraft);

      // Update state
      this._setState({
        drafts: Array.from(this.draftsStore.values()).map(d => ({
          draftId: d.draftId,
          to: d.to,
          subject: d.subject,
          body: d.body,
          priority: d.priority,
          taskId: d.taskId,
          attachments: d.attachments,
          payload: d.payload,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        })),
        draftsTotal: this.draftsStore.size,
      });

      return {
        success: true,
        draftId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Replace content in a draft body (state-based)
   */
  replaceDraftContent(draftId: string, search: string, replacement: string, replaceAll: boolean = false): DraftResult {
    try {
      const existingDraft = this.draftsStore.get(draftId);
      if (!existingDraft) {
        return {
          success: false,
          error: `Draft ${draftId} not found`,
        };
      }

      const currentBody = existingDraft.body || '';

      // Check if search string exists
      if (!currentBody.includes(search)) {
        return {
          success: false,
          error: `Search text "${search}" not found in draft body`,
        };
      }

      let newBody: string;
      if (replaceAll) {
        newBody = currentBody.split(search).join(replacement);
      } else {
        newBody = currentBody.replace(search, replacement);
      }

      const updatedDraft = {
        ...existingDraft,
        body: newBody,
        updatedAt: new Date().toISOString(),
      };

      // Store in local memory
      this.draftsStore.set(draftId, updatedDraft);

      // Update state
      this._setState({
        drafts: Array.from(this.draftsStore.values()).map(d => ({
          draftId: d.draftId,
          to: d.to,
          subject: d.subject,
          body: d.body,
          priority: d.priority,
          taskId: d.taskId,
          attachments: d.attachments,
          payload: d.payload,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        })),
        draftsTotal: this.draftsStore.size,
      });

      return {
        success: true,
        draftId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Internal fetch helper
   */
  private async fetchApi<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.config.baseUrl}/api/v1/mail${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Merge custom headers if provided
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

  // ==================== UI Rendering ====================

  /**
   * Render the component based on property state
   * Automatically fetches inbox data as a side effect during rendering
   */
  renderImply = async (): Promise<TUIElement[]> => {
    // Side effect: auto-refresh inbox and drafts data from local state
    await this.refreshInbox();
    this.refreshDrafts();

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
    const displayAddress = this.state.address || this.config.defaultAddress;
    if (displayAddress) {
      infoTexts.push(`Address: ${displayAddress}`);
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

    // Inbox view
    const messages = this.state.messages || [];
    if (messages.length > 0) {
      elements.push(this.renderInboxFromState());
    } else if (this.currentInbox) {
      elements.push(this.renderInbox());
    }

    // Drafts section
    elements.push(new tp({ content: '', indent: 1 }));
    elements.push(new tp({ content: '═'.repeat(60), indent: 1 }));
    elements.push(new tp({ content: '', indent: 1 }));

    // Show draft editor if a draft is selected
    if (this.state.selectedDraft) {
      elements.push(this.renderDraftEditor());
    } else {
      elements.push(this.renderDraftsList());
    }

    return elements;
  };

  /**
   * Auto-refresh inbox data from API (side effect during render)
   * This is called automatically when renderImply is invoked
   */
  private async refreshInbox(): Promise<void> {
    const address = this.config.defaultAddress;
    if (!address) {
      return;
    }

    // Skip if already fetching to avoid duplicate requests
    if (this._isFetchingInbox) {
      return;
    }

    this._isFetchingInbox = true;
    try {
      const inbox = await this.getInbox(address);
      // Update state with fetched data
      this._setState({
        address,
        messages: inbox.messages,
        total: inbox.total,
        unread: inbox.unread,
        starred: inbox.starred,
      });
    } catch {
      // Silently ignore errors during auto-refresh
      // The UI will simply show no messages
    } finally {
      this._isFetchingInbox = false;
    }
  }

  // Flag to prevent duplicate inbox fetch requests
  private _isFetchingInbox = false;

  /**
   * Auto-refresh drafts data from local state
   */
  private refreshDrafts(): void {
    const address = this.config.defaultAddress;
    if (!address) {
      return;
    }

    // Get drafts from local state
    const draftsResult = this.getDrafts(address);
    this._setState({
      drafts: draftsResult.drafts,
      draftsTotal: draftsResult.total,
    });
  }

  /**
   * Render inbox from state properties (new approach)
   */
  private renderInboxFromState(): TUIElement {
    const container = new tdiv({
      styles: { showBorder: true, padding: { vertical: 1 } },
    });

    // Title
    container.addChild(
      new th({
        content: `Inbox: ${this.state.address || this.config.defaultAddress || 'Unknown'}`,
        level: 2,
        styles: { align: 'center' },
      }),
    );

    // Stats
    const stateMessages = this.state.messages || [];
    container.addChild(
      new tp({
        content: `Messages: ${stateMessages.length}/${this.state.total} | Unread: ${this.state.unread} | Starred: ${this.state.starred}`,
        indent: 1,
        textStyle: { bold: true },
      }),
    );

    // Messages list
    if (stateMessages.length === 0) {
      container.addChild(new tp({ content: 'No messages found.', indent: 2 }));
    } else {
      container.addChild(new tp({ content: '─'.repeat(60), indent: 1 }));

      stateMessages.forEach((msg, index) => {
        const starMarker = msg.status.starred ? '[STARRED]' : '';
        const readMarker = msg.status.read ? '[UNREAD]' : '[READ]';
        const priorityMarker =
          msg.priority === 'urgent'
            ? ' [URGENT]'
            : msg.priority === 'high'
              ? ' [HIGH]'
              : '';

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
          const preview =
            msg.body.length > 100
              ? msg.body.substring(0, 100) + '...'
              : msg.body;
          container.addChild(new tp({ content: `   ${preview}`, indent: 2 }));
        }

        container.addChild(new tp({ content: '─'.repeat(60), indent: 1 }));
      });
    }

    // Selected message detail
    if (this.state.selectedMessage) {
      container.addChild(this.renderMessageDetail(this.state.selectedMessage));
    }

    return container;
  }

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
    const inboxMessages = this.currentInbox?.messages || [];
    const mailStatusBox = new tp({
      content: `Messages: ${inboxMessages.length}/${this.currentInbox.total} | Unread: ${this.currentInbox.unread} | Starred: ${this.currentInbox.starred}`,
      indent: 1,
    });

    container.addChild(mailStatusBox);

    // Messages list
    if (inboxMessages.length === 0) {
      container.addChild(new tp({ content: 'No messages found.', indent: 2 }));
    } else {
      container.addChild(new tp({ content: '─'.repeat(60), indent: 1 }));

      inboxMessages.forEach((msg, index) => {
        const starMarker = msg.status.starred ? '[STARRED]' : '';
        const readMarker = msg.status.read ? '[UNDREAD]' : '[READ]';
        const priorityMarker =
          msg.priority === 'urgent'
            ? ' [URGENT]'
            : msg.priority === 'high'
              ? ' [HIGH]'
              : '';

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
          const preview =
            msg.body.length > 100
              ? msg.body.substring(0, 100) + '...'
              : msg.body;
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

    container.addChild(
      new tp({
        content: `Subject: ${message.subject}`,
        indent: 1,
        textStyle: { bold: true },
      }),
    );
    container.addChild(new tp({ content: `From: ${message.from}`, indent: 1 }));
    container.addChild(
      new tp({
        content: `To: ${Array.isArray(message.to) ? message.to.join(', ') : message.to}`,
        indent: 1,
      }),
    );
    container.addChild(
      new tp({
        content: `Date: ${new Date(message.sentAt).toLocaleString()}`,
        indent: 1,
      }),
    );
    container.addChild(
      new tp({ content: `Priority: ${message.priority}`, indent: 1 }),
    );

    if (message.taskId) {
      container.addChild(
        new tp({ content: `Task ID: ${message.taskId}`, indent: 1 }),
      );
    }

    container.addChild(new tp({ content: '', indent: 1 }));

    if (message.body) {
      container.addChild(new th({ content: 'Body:', level: 4 }));
      container.addChild(new tp({ content: message.body, indent: 1 }));
    }

    if (message.attachments && message.attachments.length > 0) {
      container.addChild(new tp({ content: '', indent: 1 }));
      container.addChild(new th({ content: 'Attachments:', level: 4 }));
      message.attachments.forEach((att) => {
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

  /**
   * Render drafts list view
   */
  private renderDraftsList(): TUIElement {
    const container = new tdiv({
      styles: { showBorder: true, padding: { vertical: 1 } },
    });

    // Title
    container.addChild(
      new th({
        content: 'Drafts',
        level: 2,
        styles: { align: 'center' },
      }),
    );

    // Stats
    const drafts = this.state.drafts || [];
    container.addChild(
      new tp({
        content: `Total drafts: ${drafts.length}/${this.state.draftsTotal}`,
        indent: 1,
        textStyle: { bold: true },
      }),
    );

    // Drafts list
    if (drafts.length === 0) {
      container.addChild(new tp({ content: 'No drafts found.', indent: 2 }));
    } else {
      container.addChild(new tp({ content: '─'.repeat(60), indent: 1 }));

      drafts.forEach((draft, index) => {
        container.addChild(
          new tp({
            content: `${index + 1}. ${draft.subject || '(No Subject)'}`,
            indent: 1,
            textStyle: { bold: true },
          }),
        );

        container.addChild(
          new tp({
            content: `   To: ${draft.to || '(No recipient)'} | Priority: ${draft.priority}`,
            indent: 2,
          }),
        );

        // Render taskId if present
        if (draft.taskId) {
          container.addChild(
            new tp({
              content: `   Task ID: ${draft.taskId}`,
              indent: 2,
            }),
          );
        }

        if (draft.body) {
          const preview =
            draft.body.length > 80
              ? draft.body.substring(0, 80) + '...'
              : draft.body;
          container.addChild(new tp({ content: `   ${preview}`, indent: 2 }));
        }

        // Render attachments if present
        if (draft.attachments && draft.attachments.length > 0) {
          container.addChild(
            new tp({
              content: `   Attachments: ${draft.attachments.map(a => a.name).join(', ')}`,
              indent: 2,
            }),
          );
        }

        // Render payload indicator if present
        if (draft.payload) {
          const payloadKeys = Object.keys(draft.payload);
          container.addChild(
            new tp({
              content: `   Payload: {${payloadKeys.join(', ')}}`,
              indent: 2,
              textStyle: { italic: true },
            }),
          );
        }

        container.addChild(
          new tp({
            content: `   Updated: ${new Date(draft.updatedAt).toLocaleString()}`,
            indent: 2,
          }),
        );

        container.addChild(new tp({ content: '─'.repeat(60), indent: 1 }));
      });
    }

    return container;
  }

  /**
   * Render draft editor view
   */
  private renderDraftEditor(): TUIElement {
    const draft = this.state.selectedDraft;
    if (!draft) {
      return new tdiv({ content: 'No draft selected' });
    }

    const container = new tdiv({
      styles: { showBorder: true, padding: { vertical: 1 } },
    });

    // Title
    container.addChild(
      new th({
        content: 'Edit Draft',
        level: 2,
        styles: { align: 'center' },
      }),
    );

    container.addChild(new tp({ content: '', indent: 1 }));

    // Draft ID (read-only)
    container.addChild(
      new tp({
        content: `Draft ID: ${draft.draftId}`,
        indent: 1,
        textStyle: { bold: true },
      }),
    );

    // To
    container.addChild(
      new tp({
        content: `To: ${draft.to || '(empty)'}`,
        indent: 1,
      }),
    );

    // Subject
    container.addChild(
      new tp({
        content: `Subject: ${draft.subject || '(no subject)'}`,
        indent: 1,
      }),
    );

    // Priority
    container.addChild(
      new tp({
        content: `Priority: ${draft.priority}`,
        indent: 1,
      }),
    );

    container.addChild(new tp({ content: '', indent: 1 }));
    container.addChild(new tp({ content: '─'.repeat(40), indent: 1 }));
    container.addChild(new tp({ content: '', indent: 1 }));

    // Body
    container.addChild(
      new th({
        content: 'Body:',
        level: 4,
      }),
    );

    if (draft.body) {
      container.addChild(new tp({ content: draft.body, indent: 1 }));
    } else {
      container.addChild(new tp({ content: '(empty)', indent: 1, textStyle: { italic: true } }));
    }

    container.addChild(new tp({ content: '', indent: 1 }));
    container.addChild(new tp({ content: '─'.repeat(40), indent: 1 }));

    // Instructions
    container.addChild(new tp({ content: '', indent: 1 }));
    container.addChild(
      new tp({
        content: 'Actions:',
        indent: 1,
        textStyle: { bold: true },
      }),
    );
    container.addChild(
      new tp({
        content: '  - Use editDraft tool to modify this draft',
        indent: 2,
      }),
    );
    container.addChild(
      new tp({
        content: '  - Use sendMail to send this draft',
        indent: 2,
      }),
    );
    container.addChild(
      new tp({
        content: '  - Use saveDraft to create a new draft',
        indent: 2,
      }),
    );

    return container;
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
