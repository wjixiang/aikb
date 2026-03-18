/**
 * Workspace Hooks Tests
 *
 * Tests for the hook-based API for workspace global components
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VirtualWorkspace } from '../virtualWorkspace.js';
import {
    createWorkspaceHooks,
    createMailHooks,
    isHookableComponent,
    isMailComponent,
    type MailHooks,
} from '../workspaceHooks.js';
import { TestComponent } from './testComponents.js';

// Mock MailComponent for testing
class MockMailComponent extends TestComponent {
    override readonly componentId = 'mail';
    override readonly displayName = 'Mock Mail Component';
    override readonly description = 'Mock mail for testing';

    private messages: any[] = [];
    private unreadCount = 0;

    handleToolCall = async (toolName: string, params: any) => {
        switch (toolName) {
            case 'sendMail':
                return {
                    data: { success: true, messageId: 'msg-123' },
                    summary: 'Mail sent',
                };
            case 'getInbox':
                return {
                    data: {
                        address: 'test@expert',
                        messages: this.messages,
                        total: this.messages.length,
                        unread: this.unreadCount,
                        starred: 0,
                    },
                };
            case 'getUnreadCount':
                return { data: { count: this.unreadCount } };
            case 'markAsRead':
                return { data: { success: true } };
            case 'markAsUnread':
                return { data: { success: true } };
            case 'starMessage':
                return { data: { success: true } };
            case 'unstarMessage':
                return { data: { success: true } };
            case 'deleteMessage':
                return { data: { success: true } };
            case 'searchMessages':
                return { data: this.messages };
            case 'replyToMessage':
                return { data: { success: true, messageId: 'reply-123' } };
            default:
                return { data: { error: 'Unknown tool' } };
        }
    };
}

describe('Workspace Hooks API', () => {
    let workspace: VirtualWorkspace;
    let mockMailComponent: MockMailComponent;

    beforeEach(() => {
        workspace = new VirtualWorkspace({
            id: 'hooks-test-workspace',
            name: 'Hooks Test Workspace',
        });
        mockMailComponent = new MockMailComponent();
    });

    describe('createWorkspaceHooks', () => {
        it('should create workspace hooks with useMail', () => {
            const hooks = createWorkspaceHooks(workspace);
            expect(hooks.useMail).toBeDefined();
            expect(typeof hooks.useMail).toBe('function');
        });

        it('should return MailHooks when useMail is called', () => {
            const hooks = createWorkspaceHooks(workspace);
            const mailHooks = hooks.useMail();

            expect(mailHooks.sendMail).toBeDefined();
            expect(mailHooks.getInbox).toBeDefined();
            expect(mailHooks.getUnreadCount).toBeDefined();
            expect(mailHooks.markAsRead).toBeDefined();
            expect(mailHooks.markAsUnread).toBeDefined();
            expect(mailHooks.starMessage).toBeDefined();
            expect(mailHooks.unstarMessage).toBeDefined();
            expect(mailHooks.deleteMessage).toBeDefined();
            expect(mailHooks.searchMessages).toBeDefined();
            expect(mailHooks.replyToMessage).toBeDefined();
        });
    });

    describe('createMailHooks', () => {
        it('should create standalone mail hooks', () => {
            const mailHooks = createMailHooks(workspace);
            expect(mailHooks.sendMail).toBeDefined();
            expect(mailHooks.getInbox).toBeDefined();
        });

        it('should use custom component ID', () => {
            const mailHooks = createMailHooks(workspace, 'custom-mail');
            const component = mailHooks.getComponent();
            expect(component).toBeUndefined(); // Not registered yet
        });
    });

    describe('MailHooks operations without component', () => {
        let mailHooks: MailHooks;

        beforeEach(() => {
            mailHooks = createWorkspaceHooks(workspace).useMail();
        });

        it('getComponent should return undefined when mail not registered', () => {
            const component = mailHooks.getComponent();
            expect(component).toBeUndefined();
        });

        it('sendMail should return error when component not found', async () => {
            const result = await mailHooks.sendMail({
                to: 'test@expert',
                subject: 'Test',
                body: 'Test body',
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('getInbox should throw when component not found', async () => {
            await expect(mailHooks.getInbox()).rejects.toThrow('not found');
        });

        it('getUnreadCount should throw when component not found', async () => {
            await expect(mailHooks.getUnreadCount()).rejects.toThrow('not found');
        });

        it('markAsRead should return error when component not found', async () => {
            const result = await mailHooks.markAsRead({ messageId: 'msg-123' });
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('searchMessages should throw when component not found', async () => {
            await expect(
                mailHooks.searchMessages({ query: 'test' })
            ).rejects.toThrow('not found');
        });
    });

    describe('MailHooks operations with registered component', () => {
        let mailHooks: MailHooks;

        beforeEach(() => {
            workspace.registerGlobalComponent('mail', mockMailComponent);
            mailHooks = createWorkspaceHooks(workspace).useMail();
        });

        it('getComponent should return the registered MailComponent', () => {
            const component = mailHooks.getComponent();
            expect(component).toBe(mockMailComponent);
        });

        it('sendMail should send email successfully', async () => {
            const result = await mailHooks.sendMail({
                to: 'recipient@expert',
                subject: 'Test Subject',
                body: 'Test body content',
            });
            expect(result.success).toBe(true);
            expect(result.messageId).toBe('msg-123');
        });

        it('getInbox should return inbox data', async () => {
            const result = await mailHooks.getInbox({ limit: 20 });
            expect(result.address).toBe('test@expert');
            expect(result.messages).toEqual([]);
        });

        it('getInbox should work without params', async () => {
            const result = await mailHooks.getInbox();
            expect(result.total).toBe(0);
        });

        it('getUnreadCount should return count', async () => {
            const count = await mailHooks.getUnreadCount();
            expect(count).toBe(0);
        });

        it('markAsRead should mark message as read', async () => {
            const result = await mailHooks.markAsRead({ messageId: 'msg-123' });
            expect(result.success).toBe(true);
        });

        it('markAsUnread should mark message as unread', async () => {
            const result = await mailHooks.markAsUnread({ messageId: 'msg-123' });
            expect(result.success).toBe(true);
        });

        it('starMessage should star a message', async () => {
            const result = await mailHooks.starMessage({ messageId: 'msg-123' });
            expect(result.success).toBe(true);
        });

        it('unstarMessage should unstar a message', async () => {
            const result = await mailHooks.unstarMessage({ messageId: 'msg-123' });
            expect(result.success).toBe(true);
        });

        it('deleteMessage should delete a message', async () => {
            const result = await mailHooks.deleteMessage({ messageId: 'msg-123' });
            expect(result.success).toBe(true);
        });

        it('searchMessages should search messages', async () => {
            const result = await mailHooks.searchMessages({ query: 'test' });
            expect(Array.isArray(result)).toBe(true);
        });

        it('replyToMessage should send reply', async () => {
            const result = await mailHooks.replyToMessage({
                messageId: 'msg-123',
                body: 'Reply content',
            });
            expect(result.success).toBe(true);
            expect(result.messageId).toBe('reply-123');
        });
    });

    describe('Type guards', () => {
        it('isHookableComponent should return true for components with handleToolCall', () => {
            expect(isHookableComponent(mockMailComponent)).toBe(true);
        });

        it('isHookableComponent should return false for undefined', () => {
            expect(isHookableComponent(undefined)).toBe(false);
        });

        it('isMailComponent should return true for mail component', () => {
            expect(isMailComponent(mockMailComponent)).toBe(true);
        });

        it('isMailComponent should return false for non-mail component', () => {
            const nonMailComponent = new TestComponent();
            expect(isMailComponent(nonMailComponent)).toBe(false);
        });
    });
});

describe('Workspace Hooks Integration with VirtualWorkspace', () => {
    let workspace: VirtualWorkspace;
    let mockMailComponent: MockMailComponent;

    beforeEach(() => {
        workspace = new VirtualWorkspace({
            id: 'integration-workspace',
            name: 'Integration Test Workspace',
        });
        mockMailComponent = new MockMailComponent();
    });

    it('should work with globalComponents config initialization', () => {
        // Create workspace with MailComponent pre-registered via config
        const wsWithMail = new VirtualWorkspace({
            id: 'pre-registered-workspace',
            name: 'Pre-registered Workspace',
            globalComponents: [
                {
                    componentId: 'mail',
                    factory: () => mockMailComponent,
                },
            ],
        });

        // Hooks should work without manual registration
        const hooks = createWorkspaceHooks(wsWithMail);
        const mailHooks = hooks.useMail();
        const component = mailHooks.getComponent();

        expect(component).toBe(mockMailComponent);
    });

    it('should handle multiple component registrations gracefully', () => {
        // Register mail component
        workspace.registerGlobalComponent('mail', mockMailComponent);

        // Create hooks - should return the registered component
        const hooks1 = createWorkspaceHooks(workspace);
        expect(hooks1.useMail().getComponent()).toBe(mockMailComponent);

        // Create new hooks instance - should also work
        const hooks2 = createWorkspaceHooks(workspace);
        expect(hooks2.useMail().getComponent()).toBe(mockMailComponent);
    });
});
