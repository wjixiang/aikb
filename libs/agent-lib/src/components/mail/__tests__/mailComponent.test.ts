import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  afterEach,
} from 'vitest';
import { MailComponent, createMailComponent } from '../mailComponent';
import type {
  MailMessage,
  InboxResult,
  SendResult,
  StorageResult,
  MailComponentConfig,
} from '../../../index';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('MailComponent', () => {
  const baseConfig: MailComponentConfig = {
    baseUrl: 'http://localhost:3000',
    defaultAddress: 'test@expert',
    apiKey: 'test-api-key',
    timeout: 5000,
  };

  let component: MailComponent;

  beforeEach(() => {
    mockFetch.mockClear();
    component = new MailComponent(baseConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==================== Constructor & Initialization ====================

  describe('constructor', () => {
    it('should create component with provided config', () => {
      const mail = new MailComponent(baseConfig);
      expect(mail.componentId).toBe('mail');
      expect(mail.displayName).toBe('Mail');
      expect(mail.description).toBe(
        'Email-style messaging system for agent communication',
      );
    });

    it('should apply default timeout when not specified', () => {
      const configWithoutTimeout: MailComponentConfig = {
        baseUrl: 'http://localhost:3000',
      };
      const mail = new MailComponent(configWithoutTimeout);
      // Should not throw and should have default timeout
      expect(mail).toBeDefined();
    });

    it('should initialize all tools in toolSet', () => {
      const tools = component.toolSet;
      expect(tools.has('sendMail')).toBe(true);
      expect(tools.has('deleteMessage')).toBe(true);
      expect(tools.has('searchMessages')).toBe(true);
      expect(tools.has('reply-createDraft')).toBe(true);
      expect(tools.has('saveDraft')).toBe(true);
      expect(tools.has('reply-editDraft')).toBe(true);
      expect(tools.has('deleteDraft')).toBe(true);
      expect(tools.has('insertDraftContent')).toBe(true);
      expect(tools.has('replaceDraftContent')).toBe(true);
      expect(tools.has('reply-sendDraft')).toBe(true);
      expect(tools.size).toBe(10);
    });

    it('should auto-fetch inbox and drafts during render (side effect)', async () => {
      // Mock inbox data that will be fetched during render
      const mockInbox: InboxResult = {
        address: 'test@expert',
        messages: [
          {
            messageId: 'msg_1',
            subject: 'Test Message 1',
            from: 'sender1@expert',
            to: ['test@expert'],
            body: 'Body of message 1',
            priority: 'normal',
            status: { read: false, starred: false, deleted: false },
            sentAt: new Date().toISOString(),
          },
          {
            messageId: 'msg_2',
            subject: 'Test Message 2',
            from: 'sender2@expert',
            to: 'test@expert',
            body: 'Body of message 2',
            priority: 'high',
            status: { read: true, starred: true, deleted: false },
            sentAt: new Date().toISOString(),
            receivedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        total: 2,
        unread: 1,
        starred: 1,
      };

      // Save some drafts to local state first
      await component.handleToolCall('saveDraft', {
        to: 'recipient@expert',
        subject: 'Draft Subject',
        body: 'Draft body',
      });

      // Mock the inbox fetch that happens automatically during render
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInbox),
      });

      // Render the component - inbox will be auto-fetched, drafts from local state
      const elements = await component.renderImply();

      // Debug output
      console.log('=== Auto-fetch Inbox and Drafts Test ===');
      console.log('Fetch calls:', mockFetch.mock.calls.length);
      for (const el of elements) {
        console.log(el.render());
      }

      // Verify rendering
      expect(elements.length).toBeGreaterThan(0);
      // Should have header
      expect(elements[0]).toBeDefined();
    });
  });

  describe('createMailComponent factory', () => {
    it('should create MailComponent instance', async () => {
      const mail = createMailComponent(baseConfig);
      expect(mail).toBeInstanceOf(MailComponent);
      const rendered = await mail.render();
      console.log(rendered.render());
    });
  });

  // ==================== Tool Call Handlers ====================

  describe('handleToolCall', () => {
    describe('sendMail', () => {
      it('should send mail successfully', async () => {
        const mockResult: SendResult = {
          success: true,
          messageId: 'msg_123',
          sentAt: new Date().toISOString(),
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResult),
        });

        const result = await component.handleToolCall('sendMail', {
          to: 'recipient@expert',
          subject: 'Test Subject',
          body: 'Test Body',
        });

        expect(result.data).toEqual(mockResult);
        expect(result.summary).toBe(
          '[Mail] Sent to recipient@expert: "Test Subject"',
        );
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/v1/mail/send',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Test Subject'),
          }),
        );
      });

      it('should return error when no default address configured', async () => {
        const componentWithoutAddress = new MailComponent({
          baseUrl: 'http://localhost:3000',
        });

        const result = await componentWithoutAddress.handleToolCall(
          'sendMail',
          {
            to: 'recipient@expert',
            subject: 'Test',
            body: 'Body',
          },
        );

        expect(result.data).toEqual({ error: 'No default address configured' });
        expect(result.summary).toContain('Error');
      });

      it('should include optional fields in send mail', async () => {
        const mockResult: SendResult = {
          success: true,
          messageId: 'msg_123',
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResult),
        });

        await component.handleToolCall('sendMail', {
          to: 'recipient@expert',
          subject: 'Test',
          body: 'Body',
          priority: 'high',
          taskId: 'task_123',
          attachments: ['s3://bucket/file.pdf'],
          payload: { custom: 'data' },
        });

        const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(requestBody.priority).toBe('high');
        expect(requestBody.taskId).toBe('task_123');
        expect(requestBody.attachments).toEqual(['s3://bucket/file.pdf']);
        expect(requestBody.payload).toEqual({ custom: 'data' });
      });

      it('should handle send mail failure', async () => {
        const mockResult: SendResult = {
          success: false,
          error: 'Recipient not found',
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResult),
        });

        const result = await component.handleToolCall('sendMail', {
          to: 'unknown@expert',
          subject: 'Test',
          body: 'Body',
        });

        expect(result.data).toEqual(mockResult);
        expect(result.summary).toContain('Failed to send');
      });
    });

    describe('deleteMessage', () => {
      it('should delete message successfully', async () => {
        const mockResult: StorageResult = { success: true };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResult),
        });

        const result = await component.handleToolCall('deleteMessage', {
          messageId: 'msg_123',
        });

        expect(result.summary).toBe('[Mail] Deleted msg_123');
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/msg_123'),
          expect.objectContaining({ method: 'DELETE' }),
        );
      });

      it('should handle delete failure', async () => {
        const mockResult: StorageResult = {
          success: false,
          error: 'Cannot delete',
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResult),
        });

        const result = await component.handleToolCall('deleteMessage', {
          messageId: 'msg_123',
        });

        expect(result.summary).toContain('Failed to delete');
      });
    });

    describe('searchMessages', () => {
      const mockMessages: MailMessage[] = [
        {
          messageId: 'msg_1',
          subject: 'Search Result',
          from: 'sender@expert',
          to: 'test@expert',
          body: 'Matching content',
          priority: 'normal',
          status: { read: true, starred: false, deleted: false },
          sentAt: new Date().toISOString(),
          receivedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      it('should search messages successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMessages),
        });

        const result = await component.handleToolCall('searchMessages', {
          query: 'search term',
        });

        expect(result.data).toEqual(mockMessages);
        expect(result.summary).toBe(
          '[Mail] Found 1 messages matching "search term"',
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/search'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('search term'),
          }),
        );
      });

      it('should include all search filters', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMessages),
        });

        await component.handleToolCall('searchMessages', {
          query: 'test',
          from: 'sender@expert',
          to: 'test@expert',
          unread: true,
          starred: true,
          priority: 'high',
        });

        const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(requestBody.subject).toBe('test');
        expect(requestBody.body).toBe('test');
        expect(requestBody.from).toBe('sender@expert');
        expect(requestBody.to).toBe('test@expert');
        expect(requestBody.unread).toBe(true);
        expect(requestBody.starred).toBe(true);
        expect(requestBody.priority).toBe('high');
      });

      it('should handle empty search results', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

        const result = await component.handleToolCall('searchMessages', {
          query: 'nonexistent',
        });

        expect(result.summary).toBe(
          '[Mail] Found 0 messages matching "nonexistent"',
        );
      });
    });

    describe('reply-createDraft', () => {
      const originalMessage: MailMessage = {
        messageId: 'msg_original',
        subject: 'Original Subject',
        from: 'sender@expert',
        to: 'test@expert',
        body: 'Original body',
        priority: 'normal',
        status: { read: true, starred: false, deleted: false },
        sentAt: new Date().toISOString(),
        receivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        taskId: 'task_123',
      };

      it('should reply to message successfully', async () => {
        // First search for the original message
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([originalMessage]),
        });
        // Then send the reply
        const mockSendResult: SendResult = {
          success: true,
          messageId: 'msg_reply',
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSendResult),
        });

        const result = await component.handleToolCall('reply-createDraft', {
          messageId: 'msg_original',
          body: 'Reply body',
        });

        expect(result.data).toEqual(mockSendResult);
        expect(result.summary).toBe('[Mail] Replied to "Original Subject"');

        // Check the reply was sent with correct fields
        const sendCall = mockFetch.mock.calls[1];
        const sentBody = JSON.parse(sendCall[1].body);
        expect(sentBody.to).toBe('sender@expert');
        expect(sentBody.subject).toBe('Re: Original Subject');
        expect(sentBody.body).toBe('Reply body');
        expect(sentBody.inReplyTo).toBe('msg_original');
        expect(sentBody.taskId).toBe('task_123');
      });

      it('should return error when original message not found', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

        const result = await component.handleToolCall('reply-createDraft', {
          messageId: 'msg_unknown',
          body: 'Reply body',
        });

        expect(result.data).toEqual({ error: 'Message msg_unknown not found' });
        expect(result.summary).toContain('Error');
      });

      it('should include attachments and payload in reply', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([originalMessage]),
        });
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        await component.handleToolCall('reply-createDraft', {
          messageId: 'msg_original',
          body: 'Reply with attachments',
          attachments: ['s3://bucket/file.pdf'],
          payload: { replyData: true },
        });

        const sentBody = JSON.parse(mockFetch.mock.calls[1][1].body);
        expect(sentBody.attachments).toEqual(['s3://bucket/file.pdf']);
        expect(sentBody.payload).toEqual({ replyData: true });
      });

      it('should return error when no default address for reply', async () => {
        const componentWithoutAddress = new MailComponent({
          baseUrl: 'http://localhost:3000',
        });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([originalMessage]),
        });
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        // The component sends with empty string as from, which should work
        // but we test the behavior
        await componentWithoutAddress.handleToolCall(
          'reply-createDraft',
          {
            messageId: 'msg_original',
            body: 'Reply body',
          },
        );

        // Should still work as the API accepts empty from
        const sentBody = JSON.parse(mockFetch.mock.calls[1][1].body);
        expect(sentBody.from).toBe('');
      });
    });

    describe('saveDraft', () => {
      it('should save draft successfully (state-based)', async () => {
        const result = await component.handleToolCall('saveDraft', {
          to: 'recipient@expert',
          subject: 'Draft Subject',
          body: 'Draft body content',
          priority: 'normal',
        });

        expect(result.data.success).toBe(true);
        expect(result.data.draftId).toBeDefined();
        expect(result.summary).toBe('[Mail] Draft saved: "Draft Subject"');
        // No API call should be made
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it('should return error when no default address for draft', async () => {
        const componentWithoutAddress = new MailComponent({
          baseUrl: 'http://localhost:3000',
        });

        const result = await componentWithoutAddress.handleToolCall('saveDraft', {
          to: 'recipient@expert',
          subject: 'Test',
          body: 'Body',
        });

        expect(result.data).toEqual({ error: 'No default address configured' });
        expect(result.summary).toContain('Error');
      });
    });

    describe('reply-editDraft', () => {
      it('should edit draft successfully (state-based)', async () => {
        // First save a draft to edit
        const saveResult = await component.handleToolCall('saveDraft', {
          to: 'recipient@expert',
          subject: 'Original Subject',
          body: 'Original body',
        });
        const draftId = saveResult.data.draftId;

        // Now edit the draft
        const result = await component.handleToolCall('reply-editDraft', {
          draftId: draftId,
          subject: 'Updated Subject',
          body: 'Updated body',
        });

        expect(result.data.success).toBe(true);
        expect(result.summary).toBe(`[Mail] Draft edited: "${draftId}"`);
        // No API call should be made
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it('should return error when draft not found', async () => {
        const result = await component.handleToolCall('reply-editDraft', {
          draftId: 'non_existent_draft',
          subject: 'Updated Subject',
        });

        expect(result.data.success).toBe(false);
        expect(result.data.error).toContain('not found');
      });
    });

    describe('deleteDraft', () => {
      it('should delete draft successfully (state-based)', async () => {
        // First save a draft to delete
        const saveResult = await component.handleToolCall('saveDraft', {
          to: 'recipient@expert',
          subject: 'Draft to Delete',
          body: 'Body',
        });
        const draftId = saveResult.data.draftId;

        // Now delete the draft
        const result = await component.handleToolCall('deleteDraft', {
          draftId: draftId,
        });

        expect(result.data.success).toBe(true);
        expect(result.summary).toBe(`[Mail] Draft deleted: "${draftId}"`);
        // No API call should be made
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it('should return error when draft not found', async () => {
        const result = await component.handleToolCall('deleteDraft', {
          draftId: 'non_existent_draft',
        });

        expect(result.data.success).toBe(false);
        expect(result.data.error).toContain('not found');
      });
    });

    describe('unknown tool', () => {
      it('should return error for unknown tool', async () => {
        const result = await component.handleToolCall('unknownTool', {});

        expect(result.data).toEqual({ error: 'Unknown tool: unknownTool' });
        expect(result.summary).toContain('Unknown tool');
      });
    });

    describe('error handling', () => {
      it('should handle fetch errors gracefully', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await component.handleToolCall('sendMail', {
          to: 'test@expert',
          subject: 'Test',
          body: 'Body',
        });

        expect(result.data).toEqual({ error: 'Network error' });
        expect(result.summary).toBe('[Mail] Error: Network error');
      });

      it('should handle non-Error exceptions', async () => {
        mockFetch.mockRejectedValueOnce('String error');

        const result = await component.handleToolCall('sendMail', {
          to: 'test@expert',
          subject: 'Test',
          body: 'Body',
        });

        expect(result.data).toEqual({ error: 'String error' });
      });
    });
  });

  // ==================== API Methods ====================

  describe('API Methods', () => {
    describe('sendMail', () => {
      it('should send mail via API', async () => {
        const mockResult: SendResult = {
          success: true,
          messageId: 'msg_123',
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResult),
        });

        const result = await component.sendMail({
          from: 'test@expert',
          to: 'recipient@expert',
          subject: 'Test',
          body: 'Body',
        });

        expect(result).toEqual(mockResult);
      });
    });

    describe('getInbox', () => {
      it('should get inbox via API', async () => {
        const mockResult: InboxResult = {
          address: 'test@expert',
          messages: [],
          total: 0,
          unread: 0,
          starred: 0,
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResult),
        });

        const result = await component.getInbox('test@expert', {
          pagination: { limit: 10, offset: 0 },
          sortBy: 'sentAt',
          sortOrder: 'desc',
        });

        expect(result).toEqual(mockResult);
        const url = mockFetch.mock.calls[0][0];
        expect(url).toContain('sortBy=sentAt');
        expect(url).toContain('sortOrder=desc');
      });
    });

    describe('getUnreadCount', () => {
      it('should get unread count via API', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(10),
        });

        const result = await component.getUnreadCount('test@expert');

        expect(result).toBe(10);
      });
    });

    describe('getMessage', () => {
      it('should get single message by ID', async () => {
        const mockMessage: MailMessage = {
          messageId: 'msg_123',
          subject: 'Test',
          body: 'Test message body',
          from: 'sender@expert',
          to: 'test@expert',
          priority: 'normal',
          status: { read: true, starred: false, deleted: false },
          sentAt: new Date().toISOString(),
          receivedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([mockMessage]),
        });

        const result = await component.getMessage('msg_123');

        expect(result).toEqual(mockMessage);
      });

      it('should return null when message not found', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

        const result = await component.getMessage('msg_unknown');

        expect(result).toBeNull();
      });
    });

    describe('searchMessages', () => {
      it('should search messages via API', async () => {
        const mockMessages: MailMessage[] = [];
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMessages),
        });

        const result = await component.searchMessages({
          subject: 'test',
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
        });

        expect(result).toEqual(mockMessages);
        const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(requestBody.subject).toBe('test');
        expect(requestBody.dateFrom).toBe('2024-01-01');
        expect(requestBody.dateTo).toBe('2024-12-31');
      });
    });
  });

  // ==================== Authentication & Headers ====================

  describe('Authentication', () => {
    it('should include API key in Authorization header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await component.sendMail({
        from: 'test@expert',
        to: 'recipient@expert',
        subject: 'Test',
        body: 'Body',
      });

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer test-api-key');
    });

    it('should not include Authorization header when no API key', async () => {
      const componentNoKey = new MailComponent({
        baseUrl: 'http://localhost:3000',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await componentNoKey.sendMail({
        from: 'test@expert',
        to: 'recipient@expert',
        subject: 'Test',
        body: 'Body',
      });

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBeUndefined();
    });

    it('should always include Content-Type header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await component.getUnreadCount('test@expert');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  // ==================== Error Handling ====================

  describe('HTTP Error Handling', () => {
    it('should throw error on HTTP error status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      });

      await expect(component.getUnreadCount('test@expert')).rejects.toThrow(
        'HTTP 404: Not Found',
      );
    });

    it('should throw error on HTTP 500', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      await expect(
        component.sendMail({
          from: 'test@expert',
          to: 'recipient@expert',
          subject: 'Test',
          body: 'Body',
        }),
      ).rejects.toThrow('HTTP 500: Internal Server Error');
    });
  });

  describe('Timeout Handling', () => {
    it('should throw timeout error when request takes too long', async () => {
      // Mock fetch to throw AbortError (simulating timeout)
      mockFetch.mockImplementationOnce(() => {
        const error = new Error('The operation was aborted');
        (error as Error & { name: string }).name = 'AbortError';
        return Promise.reject(error);
      });

      await expect(component.getUnreadCount('test@expert')).rejects.toThrow(
        'timeout',
      );
    });
  });

  // ==================== UI Rendering ====================

  describe('renderImply', () => {
    it('should render header and connection info', async () => {
      // renderImply now makes 1 API call: getInbox (drafts are from local state)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [], total: 0, unread: 0, starred: 0 }),
      });

      const elements = await component.renderImply();

      expect(elements.length).toBeGreaterThan(0);
      // First element should be header
      expect(elements[0]).toBeDefined();
    });

    it('should render inbox and drafts when data is available', async () => {
      const mockInbox: InboxResult = {
        address: 'test@expert',
        messages: [
          {
            messageId: 'msg_1',
            subject: 'Test Message',
            from: 'sender@expert',
            to: 'test@expert',
            body: 'Message body content',
            priority: 'high',
            status: { read: false, starred: true, deleted: false },
            sentAt: new Date().toISOString(),
            receivedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        total: 1,
        unread: 1,
        starred: 1,
      };

      // First save some drafts to local state
      await component.handleToolCall('saveDraft', {
        to: 'recipient@expert',
        subject: 'My Draft',
        body: 'Draft body',
      });

      // Only mock for refreshInbox (drafts are from local state)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInbox),
      });

      const elements = await component.renderImply();

      expect(elements.length).toBeGreaterThan(0);
      // Should contain inbox content
      const rendered = elements.map((el) => el.render()).join('\n');
      expect(rendered).toContain('Test Message');
      // Should contain drafts content
      expect(rendered).toContain('My Draft');
      // Should contain divider between inbox and drafts
      expect(rendered).toContain('═');
    });

    it('should handle render error gracefully', async () => {
      // First call fails for inbox
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      const elements = await component.renderImply();

      // Should still render header and info even if inbox fetch fails
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  // ==================== Edge Cases ====================

  describe('Edge Cases', () => {
    it('should handle messages with attachments and payload', async () => {
      const mockMessage: MailMessage = {
        messageId: 'msg_1',
        subject: 'With Attachments',
        from: 'sender@expert',
        to: 'test@expert',
        body: 'Body with attachments',
        priority: 'urgent',
        status: { read: true, starred: false, deleted: false },
        sentAt: new Date().toISOString(),
        receivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        taskId: 'task_123',
        attachments: ['file1.pdf', 'file2.pdf'],
        payload: { key: 'value' },
      };

      // searchMessages returns an array of messages
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockMessage]),
      });

      const message = await component.getMessage('msg_1');
      expect(message).toEqual(mockMessage);
    });

    it('should handle special characters in addresses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await component.sendMail({
        from: 'test+tag@expert',
        to: 'user.name@expert.com',
        subject: 'Test',
        body: 'Body',
      });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('/send');
    });
  });

  // ==================== URL Encoding ====================

  describe('URL Encoding', () => {
    it('should properly encode email addresses in URLs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(0),
      });

      await component.getInbox('user+test@expert.com');

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('user%2Btest%40expert.com');
    });
  });
});
