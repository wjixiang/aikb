/**
 * Mail Reply Mechanism Tests
 *
 * Tests for the draft-based reply mechanism:
 * - replyToMessage creates a draft (doesn't send directly)
 * - sendDraft sends the draft
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MailComponent } from '../mailComponent.js';

// Mock fetch for MailComponent
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('MailComponent - Reply Draft Mechanism', () => {
    let mailComponent: MailComponent;

    const mockMessages = [
        {
            messageId: 'msg-1',
            subject: 'Task 1',
            body: 'Please do task 1',
            from: 'user1@test.com',
            to: ['agent@expert'],
            priority: 'normal' as const,
            status: { read: true, starred: false, deleted: false },
            sentAt: '2026-03-19T10:00:00Z',
            receivedAt: '2026-03-19T10:00:00Z',
            updatedAt: '2026-03-19T10:00:00Z',
        },
        {
            messageId: 'msg-2',
            subject: 'Task 2',
            body: 'Please do task 2',
            from: 'user2@test.com',
            to: ['agent@expert'],
            priority: 'high' as const,
            status: { read: false, starred: true, deleted: false },
            sentAt: '2026-03-19T11:00:00Z',
            receivedAt: '2026-03-19T11:00:00Z',
            updatedAt: '2026-03-19T11:00:00Z',
        },
    ];

    beforeEach(() => {
        mailComponent = new MailComponent({
            baseUrl: 'http://localhost:3001',
            defaultAddress: 'agent@expert',
        });

        mockFetch.mockReset();

        // Mock successful send by default
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ success: true, messageId: 'sent-123' }),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('replyToMessage creates draft (not direct send)', () => {
        it('should create a draft reply instead of sending directly', async () => {
            // Mock searchMessages to find the original message
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockMessages),
            });

            const result = await mailComponent.handleToolCall('replyToMessage', {
                messageId: 'msg-1',
                body: 'Here is the result of task 1',
            });

            const data = result.data as { success: boolean; draftId?: string; inReplyTo?: string; messageId?: string };
            expect(data.success).toBe(true);
            expect(data.draftId).toBeDefined();
            expect(data.inReplyTo).toBe('msg-1');
            expect(data.messageId).toBeUndefined(); // Not sent yet

            // Verify summary indicates draft was created
            expect(result.summary).toContain('Reply draft created');

            // Verify send was NOT called (only search was called)
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should return error if original message not found', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve([]),
            });

            const result = await mailComponent.handleToolCall('replyToMessage', {
                messageId: 'nonexistent',
                body: 'Reply',
            });

            const data = result.data as { error?: string };
            expect(data.error).toContain('not found');
        });
    });

    describe('sendDraft sends the draft', () => {
        it('should send a draft and return success', async () => {
            // First create a draft
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockMessages),
            });

            const draftResult = await mailComponent.handleToolCall('replyToMessage', {
                messageId: 'msg-1',
                body: 'Task 1 completed',
            });

            const draftData = draftResult.data as { success: boolean; draftId?: string };
            expect(draftData.success).toBe(true);
            const draftId = draftData.draftId!;

            // Now send the draft
            const sendResult = await mailComponent.handleToolCall('sendDraft', {
                draftId,
            });

            const sendData = sendResult.data as { success: boolean };
            expect(sendData.success).toBe(true);
            // When inReplyTo is set, it should say "Reply sent successfully"
            expect(sendResult.summary).toMatch(/Reply sent successfully|Draft sent/);
        });

        it('should return error if draft not found', async () => {
            const result = await mailComponent.handleToolCall('sendDraft', {
                draftId: 'nonexistent-draft',
            });

            expect(result.summary).toContain('Draft not found');
        });
    });

    describe('draft storage', () => {
        it('should store reply drafts with inReplyTo field', async () => {
            // Create draft for msg-1
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockMessages),
            });

            const result = await mailComponent.handleToolCall('replyToMessage', {
                messageId: 'msg-1',
                body: 'Reply content',
            });

            const data = result.data as { success: boolean; draftId?: string; inReplyTo?: string };
            expect(data.success).toBe(true);
            expect(data.inReplyTo).toBe('msg-1');
        });

        it('should delete draft after sending', async () => {
            // Create draft
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockMessages),
            });

            const draftResult = await mailComponent.handleToolCall('replyToMessage', {
                messageId: 'msg-1',
                body: 'Task 1 done',
            });

            const draftData = draftResult.data as { draftId?: string };
            const draftId = draftData.draftId!;

            // Send draft
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: true, messageId: 'reply-123' }),
            });

            await mailComponent.handleToolCall('sendDraft', { draftId });

            // Try to send again - should fail because draft was deleted
            const result = await mailComponent.handleToolCall('sendDraft', { draftId });
            expect(result.summary).toContain('Draft not found');
        });
    });
});

describe('MailComponent - Reply Draft Tracking', () => {
    let mailComponent: MailComponent;

    beforeEach(() => {
        mailComponent = new MailComponent({
            baseUrl: 'http://localhost:3001',
            defaultAddress: 'agent@expert',
        });

        mockFetch.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should track multiple reply drafts', async () => {
        const messages = [
            {
                messageId: 'task-a',
                subject: 'Task A',
                body: 'Do task A',
                from: 'user@test.com',
                to: ['agent@expert'],
                priority: 'normal' as const,
                status: { read: true, starred: false, deleted: false },
                sentAt: '2026-03-19T10:00:00Z',
                receivedAt: '2026-03-19T10:00:00Z',
                updatedAt: '2026-03-19T10:00:00Z',
            },
            {
                messageId: 'task-b',
                subject: 'Task B',
                body: 'Do task B',
                from: 'user@test.com',
                to: ['agent@expert'],
                priority: 'normal' as const,
                status: { read: true, starred: false, deleted: false },
                sentAt: '2026-03-19T10:05:00Z',
                receivedAt: '2026-03-19T10:05:00Z',
                updatedAt: '2026-03-19T10:05:00Z',
            },
        ];

        // Create draft for task-a
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(messages),
        });

        const draftAResult = await mailComponent.handleToolCall('replyToMessage', {
            messageId: 'task-a',
            body: 'Task A done',
        });

        // Create draft for task-b
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(messages),
        });

        const draftBResult = await mailComponent.handleToolCall('replyToMessage', {
            messageId: 'task-b',
            body: 'Task B done',
        });

        const draftAData = draftAResult.data as { success: boolean; draftId?: string };
        const draftBData = draftBResult.data as { success: boolean; draftId?: string };

        expect(draftAData.success).toBe(true);
        expect(draftBData.success).toBe(true);
        expect(draftAData.draftId).toBeDefined();
        expect(draftBData.draftId).toBeDefined();
        // Draft IDs should be different
        expect(draftAData.draftId).not.toBe(draftBData.draftId);
    });
});
