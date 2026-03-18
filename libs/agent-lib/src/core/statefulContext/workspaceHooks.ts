/**
 * Workspace Hooks API
 *
 * Provides hook-based access to workspace global components.
 * Similar to React hooks pattern for convenient API access.
 *
 * @example
 * ```typescript
 * const hooks = createWorkspaceHooks(workspace);
 *
 * // Send mail
 * const result = await hooks.useMail().sendMail({
 *   to: 'recipient@expert',
 *   subject: 'Hello',
 *   body: 'World'
 * });
 *
 * // Get inbox
 * const inbox = await hooks.useMail().getInbox({ limit: 20 });
 *
 * // Get unread count
 * const count = await hooks.useMail().getUnreadCount();
 * ```
 */

import type { IVirtualWorkspace } from '../../components/core/types.js';
import type { ToolComponent } from '../../components/core/toolComponent.js';
import type { MailComponent } from '../../components/mail/mailComponent.js';

// ==================== Hook Types ====================

/**
 * Mail Hooks - Convenient API for MailComponent operations
 */
export interface MailHooks {
    /** Get the MailComponent instance */
    getComponent: () => MailComponent | undefined;

    /** Send an email */
    sendMail: (params: SendMailParams) => Promise<SendResult>;

    /** Get inbox messages */
    getInbox: (params?: GetInboxParams) => Promise<InboxResult>;

    /** Get unread message count */
    getUnreadCount: (params?: GetUnreadCountParams) => Promise<number>;

    /** Mark message as read */
    markAsRead: (params: MessageIdParams) => Promise<StorageResult>;

    /** Mark message as unread */
    markAsUnread: (params: MessageIdParams) => Promise<StorageResult>;

    /** Star a message */
    starMessage: (params: MessageIdParams) => Promise<StorageResult>;

    /** Unstar a message */
    unstarMessage: (params: MessageIdParams) => Promise<StorageResult>;

    /** Delete a message */
    deleteMessage: (params: MessageIdParams) => Promise<StorageResult>;

    /** Search messages */
    searchMessages: (params: SearchMessagesParams) => Promise<MailMessage[]>;

    /** Reply to a message */
    replyToMessage: (params: ReplyToMessageParams) => Promise<SendResult>;
}

/**
 * Workspace Hooks - All available hooks for workspace components
 */
export interface WorkspaceHooks {
    /** Mail component hooks */
    useMail: () => MailHooks;
}

// ==================== Parameter Types ====================

export interface SendMailParams {
    to: string;
    subject: string;
    body: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    taskId?: string;
    attachments?: string[];
    payload?: Record<string, unknown>;
}

export interface GetInboxParams {
    address?: string;
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    starredOnly?: boolean;
}

export interface GetUnreadCountParams {
    address?: string;
}

export interface MessageIdParams {
    messageId: string;
}

export interface SearchMessagesParams {
    query: string;
    from?: string;
    to?: string;
    unread?: boolean;
    starred?: boolean;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface ReplyToMessageParams {
    messageId: string;
    body: string;
    attachments?: string[];
    payload?: Record<string, unknown>;
}

// ==================== Result Types ====================

export interface SendResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

export interface InboxResult {
    address: string;
    messages: MailMessage[];
    total: number;
    unread: number;
    starred: number;
}

export interface MailMessage {
    messageId: string;
    from: string;
    to: string[];
    subject: string;
    body: string;
    sentAt: string;
    priority: string;
    status: {
        read: boolean;
        starred: boolean;
        deleted: boolean;
    };
    taskId?: string;
    inReplyTo?: string;
    attachments?: string[];
    payload?: Record<string, unknown>;
}

export interface StorageResult {
    success: boolean;
    error?: string;
}

// ==================== Internal Hook Factory ====================

function createMailHooksFactory(workspace: IVirtualWorkspace, componentId = 'mail'): MailHooks {
    return {
        getComponent: () => {
            return workspace.getGlobalComponent(componentId) as MailComponent | undefined;
        },

        sendMail: async (params: SendMailParams) => {
            const component = workspace.getGlobalComponent(componentId) as MailComponent | undefined;
            if (!component) {
                return { success: false, error: `MailComponent '${componentId}' not found` };
            }
            const result = await component.handleToolCall('sendMail', params);
            return result.data as SendResult;
        },

        getInbox: async (params?: GetInboxParams) => {
            const component = workspace.getGlobalComponent(componentId) as MailComponent | undefined;
            if (!component) {
                throw new Error(`MailComponent '${componentId}' not found`);
            }
            const result = await component.handleToolCall('getInbox', params || {});
            return result.data as InboxResult;
        },

        getUnreadCount: async (params?: GetUnreadCountParams) => {
            const component = workspace.getGlobalComponent(componentId) as MailComponent | undefined;
            if (!component) {
                throw new Error(`MailComponent '${componentId}' not found`);
            }
            const result = await component.handleToolCall('getUnreadCount', params || {});
            return (result.data as { count: number }).count;
        },

        markAsRead: async (params: MessageIdParams) => {
            const component = workspace.getGlobalComponent(componentId) as MailComponent | undefined;
            if (!component) {
                return { success: false, error: `MailComponent '${componentId}' not found` };
            }
            const result = await component.handleToolCall('markAsRead', params);
            return result.data as StorageResult;
        },

        markAsUnread: async (params: MessageIdParams) => {
            const component = workspace.getGlobalComponent(componentId) as MailComponent | undefined;
            if (!component) {
                return { success: false, error: `MailComponent '${componentId}' not found` };
            }
            const result = await component.handleToolCall('markAsUnread', params);
            return result.data as StorageResult;
        },

        starMessage: async (params: MessageIdParams) => {
            const component = workspace.getGlobalComponent(componentId) as MailComponent | undefined;
            if (!component) {
                return { success: false, error: `MailComponent '${componentId}' not found` };
            }
            const result = await component.handleToolCall('starMessage', params);
            return result.data as StorageResult;
        },

        unstarMessage: async (params: MessageIdParams) => {
            const component = workspace.getGlobalComponent(componentId) as MailComponent | undefined;
            if (!component) {
                return { success: false, error: `MailComponent '${componentId}' not found` };
            }
            const result = await component.handleToolCall('unstarMessage', params);
            return result.data as StorageResult;
        },

        deleteMessage: async (params: MessageIdParams) => {
            const component = workspace.getGlobalComponent(componentId) as MailComponent | undefined;
            if (!component) {
                return { success: false, error: `MailComponent '${componentId}' not found` };
            }
            const result = await component.handleToolCall('deleteMessage', params);
            return result.data as StorageResult;
        },

        searchMessages: async (params: SearchMessagesParams) => {
            const component = workspace.getGlobalComponent(componentId) as MailComponent | undefined;
            if (!component) {
                throw new Error(`MailComponent '${componentId}' not found`);
            }
            const result = await component.handleToolCall('searchMessages', params);
            return result.data as unknown as MailMessage[];
        },

        replyToMessage: async (params: ReplyToMessageParams) => {
            const component = workspace.getGlobalComponent(componentId) as MailComponent | undefined;
            if (!component) {
                return { success: false, error: `MailComponent '${componentId}' not found` };
            }
            const result = await component.handleToolCall('replyToMessage', params);
            return result.data as SendResult;
        },
    };
}

// ==================== Main Factory ====================

/**
 * Create workspace hooks - provides hook-based API for workspace components
 *
 * @param workspace - The VirtualWorkspace instance
 * @returns WorkspaceHooks - Object containing all hook functions
 *
 * @example
 * ```typescript
 * const hooks = createWorkspaceHooks(workspace);
 *
 * // Access mail hooks
 * const mailHooks = hooks.useMail();
 *
 * // Send an email
 * await mailHooks.sendMail({
 *   to: 'recipient@expert',
 *   subject: 'Hello',
 *   body: 'World'
 * });
 *
 * // Check inbox
 * const inbox = await mailHooks.getInbox({ limit: 10 });
 * ```
 */
export function createWorkspaceHooks(workspace: IVirtualWorkspace): WorkspaceHooks {
    return {
        useMail: () => createMailHooksFactory(workspace),
    };
}

/**
 * Create a standalone hook for MailComponent
 *
 * @param workspace - The VirtualWorkspace instance
 * @param componentId - The component ID (default: 'mail')
 * @returns MailHooks for convenient access
 *
 * @example
 * ```typescript
 * const mailHooks = createMailHooks(workspace);
 * await mailHooks.sendMail({ to: '...', subject: '...', body: '...' });
 * ```
 */
export function createMailHooks(workspace: IVirtualWorkspace, componentId = 'mail'): MailHooks {
    return createMailHooksFactory(workspace, componentId);
}

/**
 * Type guard to check if a component supports the hook API
 */
export function isHookableComponent(component: ToolComponent | undefined): component is ToolComponent {
    return component !== undefined && typeof (component as any).handleToolCall === 'function';
}

/**
 * Type guard for MailComponent
 */
export function isMailComponent(component: ToolComponent | undefined): component is MailComponent {
    return component !== undefined && (component as any).componentId === 'mail';
}
