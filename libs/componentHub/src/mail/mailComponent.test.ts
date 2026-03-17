import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MailComponent, createMailComponent } from './mailComponent.js';

describe('MailComponent', () => {
  const mockConfig = {
    baseUrl: 'http://localhost:3000',
    defaultAddress: 'test@expert',
    timeout: 5000,
  };

  let component: MailComponent;

  beforeEach(() => {
    component = new MailComponent(mockConfig);
    // Mock fetch globally
    global.fetch = vi.fn();
  });

  describe('initialization', () => {
    it('should create component with config', () => {
      expect(component.componentId).toBe('mail');
      expect(component.displayName).toBe('Mail');
      expect(component.toolSet.size).toBeGreaterThan(0);
    });

    it('should create component via factory', () => {
      const mail = createMailComponent(mockConfig);
      expect(mail).toBeInstanceOf(MailComponent);
    });
  });

  describe('toolSet', () => {
    it('should have sendMail tool', () => {
      expect(component.toolSet.has('sendMail')).toBe(true);
    });

    it('should have getInbox tool', () => {
      expect(component.toolSet.has('getInbox')).toBe(true);
    });

    it('should have getUnreadCount tool', () => {
      expect(component.toolSet.has('getUnreadCount')).toBe(true);
    });

    it('should have markAsRead tool', () => {
      expect(component.toolSet.has('markAsRead')).toBe(true);
    });

    it('should have starMessage tool', () => {
      expect(component.toolSet.has('starMessage')).toBe(true);
    });

    it('should have searchMessages tool', () => {
      expect(component.toolSet.has('searchMessages')).toBe(true);
    });

    it('should have replyToMessage tool', () => {
      expect(component.toolSet.has('replyToMessage')).toBe(true);
    });

    it('should have registerAddress tool', () => {
      expect(component.toolSet.has('registerAddress')).toBe(true);
    });
  });

  describe('handleToolCall - sendMail', () => {
    it('should send mail successfully', async () => {
      const mockResponse = {
        success: true,
        messageId: 'mail_123',
        sentAt: '2026-03-17T10:00:00Z',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await component.handleToolCall('sendMail', {
        to: 'recipient@expert',
        subject: 'Test',
        body: 'Hello',
      });

      expect(result.data.success).toBe(true);
      expect(result.summary).toContain('Sent to');
    });

    it('should handle send mail failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Server error'),
      } as Response);

      // When fetch fails, the error is caught and returned as an error result
      const result = await component.handleToolCall('sendMail', {
        to: 'recipient@expert',
        subject: 'Test',
        body: 'Hello',
      });

      expect(result.data.error).toContain('HTTP');
      expect(result.summary).toContain('Error');
    });
  });

  describe('handleToolCall - getInbox', () => {
    it('should get inbox with default address', async () => {
      const mockResponse = {
        address: 'test@expert',
        messages: [],
        total: 0,
        unread: 0,
        starred: 0,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await component.handleToolCall('getInbox', {});

      expect(result.data.address).toBe('test@expert');
      expect(result.summary).toContain('Inbox for');
    });

    it('should return error if no address configured', async () => {
      const componentWithoutAddress = new MailComponent({
        baseUrl: 'http://localhost:3000',
      });

      const result = await componentWithoutAddress.handleToolCall('getInbox', {});

      expect(result.data.error).toContain('No address');
    });
  });

  describe('handleToolCall - getUnreadCount', () => {
    it('should return unread count', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(5),
      } as Response);

      const result = await component.handleToolCall('getUnreadCount', {});

      expect(result.data.count).toBe(5);
      expect(result.summary).toContain('5 unread');
    });
  });

  describe('handleToolCall - markAsRead', () => {
    it('should mark message as read', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response);

      const result = await component.handleToolCall('markAsRead', {
        messageId: 'mail_123',
      });

      expect(result.data.success).toBe(true);
    });
  });

  describe('handleToolCall - registerAddress', () => {
    it('should register address', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response);

      const result = await component.handleToolCall('registerAddress', {
        address: 'new@expert',
      });

      expect(result.data.success).toBe(true);
      expect(result.summary).toContain('Registered');
    });
  });

  describe('handleToolCall - unknown tool', () => {
    it('should return error for unknown tool', async () => {
      const result = await component.handleToolCall('unknownTool', {});

      expect(result.data.error).toContain('Unknown tool');
    });
  });

  describe('API methods', () => {
    it('should call fetchApi with correct URL for sendMail', async () => {
      const mockResponse = {
        success: true,
        messageId: 'mail_123',
        sentAt: '2026-03-17T10:00:00Z',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await component.sendMail({
        from: 'sender@expert',
        to: 'recipient@expert',
        subject: 'Test',
        body: 'Hello',
      });

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/mail/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should include API key in headers when configured', async () => {
      const componentWithKey = new MailComponent({
        ...mockConfig,
        apiKey: 'secret-key',
      });

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response);

      await componentWithKey.registerAddress('test@expert');

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer secret-key',
          }),
        })
      );
    });
  });
});
