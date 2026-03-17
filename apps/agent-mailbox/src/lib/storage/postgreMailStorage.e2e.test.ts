import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreMailStorage } from './postgreMailStorage.js';
import { type IMailStorage, type MailAddress, type OutgoingMail } from './type.js';

describe('PostgreMailStorage E2E', () => {
  let storage: PostgreMailStorage;
  const testAddress1: MailAddress = 'test1@expert';
  const testAddress2: MailAddress = 'test2@expert';

  beforeAll(async () => {
    storage = new PostgreMailStorage();
    await storage.initialize();

    // Register test addresses
    await storage.registerAddress(testAddress1);
    await storage.registerAddress(testAddress2);
  });

  afterAll(async () => {
    await storage.close();
  });

  describe('send and receive', () => {
    it('should send mail to recipient', async () => {
      const mail: OutgoingMail = {
        from: testAddress1,
        to: testAddress2,
        subject: 'Test Subject',
        body: 'Test body content',
        priority: 'normal',
      };

      const result = await storage.send(mail);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.sentAt).toBeDefined();
    });

    it('should send to multiple recipients', async () => {
      const mail: OutgoingMail = {
        from: testAddress1,
        to: [testAddress2, 'test3@expert'],
        subject: 'Broadcast test',
        body: 'Testing multiple recipients',
      };

      const result = await storage.send(mail);

      expect(result.success).toBe(true);
    });

    it('should store mail in recipient inbox', async () => {
      const mail: OutgoingMail = {
        from: testAddress1,
        to: testAddress2,
        subject: 'Inbox test',
        body: 'Check inbox',
      };

      await storage.send(mail);

      const inbox = await storage.getInbox(testAddress2);

      expect(inbox.messages.length).toBeGreaterThan(0);
      expect(inbox.messages.some((m) => m.subject === 'Inbox test')).toBe(true);
    });
  });

  describe('getInbox', () => {
    it('should get inbox messages', async () => {
      const inbox = await storage.getInbox(testAddress2);

      expect(inbox.address).toBe(testAddress2);
      expect(inbox.messages).toBeDefined();
      expect(inbox.total).toBeGreaterThan(0);
    });

    it('should filter by unread only', async () => {
      const inbox = await storage.getInbox(testAddress2, { unreadOnly: true });

      expect(inbox.unread).toBeGreaterThanOrEqual(0);
    });

    it('should support pagination', async () => {
      const inbox = await storage.getInbox(testAddress2, {
        pagination: { limit: 5, offset: 0 },
      });

      expect(inbox.messages.length).toBeLessThanOrEqual(5);
    });
  });

  describe('message status', () => {
    it('should mark message as read', async () => {
      const inbox = await storage.getInbox(testAddress2);
      const message = inbox.messages[0];

      if (message) {
        await storage.markAsRead(message.messageId);
        const updated = await storage.getMessage(message.messageId);

        expect(updated?.status.read).toBe(true);
      }
    });

    it('should mark message as unread', async () => {
      const inbox = await storage.getInbox(testAddress2);
      const message = inbox.messages[0];

      if (message) {
        await storage.markAsUnread(message.messageId);
        const updated = await storage.getMessage(message.messageId);

        expect(updated?.status.read).toBe(false);
      }
    });

    it('should star message', async () => {
      const inbox = await storage.getInbox(testAddress2);
      const message = inbox.messages[0];

      if (message) {
        await storage.starMessage(message.messageId);
        const updated = await storage.getMessage(message.messageId);

        expect(updated?.status.starred).toBe(true);
      }
    });

    it('should unstar message', async () => {
      const inbox = await storage.getInbox(testAddress2);
      const message = inbox.messages[0];

      if (message) {
        await storage.unstarMessage(message.messageId);
        const updated = await storage.getMessage(message.messageId);

        expect(updated?.status.starred).toBe(false);
      }
    });

    it('should delete message (soft delete)', async () => {
      // Send a new message to delete
      const mail: OutgoingMail = {
        from: testAddress1,
        to: testAddress2,
        subject: 'To be deleted',
        body: 'This will be deleted',
      };
      const result = await storage.send(mail);
      const messageId = result.messageId + '_0';

      await storage.deleteMessage(messageId);

      // Message should not appear in inbox (default excludes deleted)
      const inbox = await storage.getInbox(testAddress2);
      expect(inbox.messages.some((m) => m.messageId === messageId)).toBe(false);
    });
  });

  describe('search', () => {
    it('should search by subject', async () => {
      const results = await storage.search({
        subject: 'Test',
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should search by sender', async () => {
      const results = await storage.search({
        from: testAddress1,
      });

      expect(results.every((m) => m.from === testAddress1)).toBe(true);
    });

    it('should filter by unread', async () => {
      const results = await storage.search({
        unread: true,
      });

      expect(results.every((m) => m.status.read === false)).toBe(true);
    });
  });

  describe('address registration', () => {
    it('should register new address', async () => {
      const newAddress: MailAddress = 'newuser@expert';

      const result = await storage.registerAddress(newAddress);

      expect(result.success).toBe(true);
    });

    it('should check if address is registered', async () => {
      const isRegistered = await storage.isAddressRegistered(testAddress1);

      expect(isRegistered).toBe(true);
    });

    it('should get all registered addresses', async () => {
      const addresses = await storage.getRegisteredAddresses();

      expect(addresses.length).toBeGreaterThan(0);
      expect(addresses).toContain(testAddress1);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      const count = await storage.getUnreadCount(testAddress2);

      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getMessage', () => {
    it('should get message by ID', async () => {
      const inbox = await storage.getInbox(testAddress2);
      const message = inbox.messages[0];

      if (message) {
        const retrieved = await storage.getMessage(message.messageId);

        expect(retrieved).not.toBeNull();
        expect(retrieved?.messageId).toBe(message.messageId);
      }
    });

    it('should return null for non-existent message', async () => {
      const message = await storage.getMessage('non_existent_id');

      expect(message).toBeNull();
    });
  });

  describe('replyToMessage', () => {
    it('should reply to a message', async () => {
      // First send a message
      const mail: OutgoingMail = {
        from: testAddress1,
        to: testAddress2,
        subject: 'Original message',
        body: 'Original body',
      };
      const sendResult = await storage.send(mail);
      expect(sendResult.success).toBe(true);

      const messageId = sendResult.messageId + '_0';

      // Reply to the message
      const replyResult = await storage.replyToMessage(messageId, {
        body: 'This is a reply',
      });

      expect(replyResult.success).toBe(true);
      expect(replyResult.messageId).toBeDefined();
    });

    it('should return error for non-existent message', async () => {
      const result = await storage.replyToMessage('non_existent_id', {
        body: 'This is a reply',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('getThread', () => {
    it('should get message thread', async () => {
      // Send a message
      const mail: OutgoingMail = {
        from: testAddress1,
        to: testAddress2,
        subject: 'Thread test',
        body: 'Original message',
      };
      const sendResult = await storage.send(mail);
      const messageId = sendResult.messageId + '_0';

      // Reply to create a thread
      await storage.replyToMessage(messageId, {
        body: 'Reply message',
      });

      // Get the thread
      const thread = await storage.getThread(messageId);

      expect(thread).not.toBeNull();
      expect(thread?.rootMessage).toBeDefined();
      expect(thread?.messages.length).toBeGreaterThanOrEqual(1);
    });

    it('should return null for non-existent message', async () => {
      const thread = await storage.getThread('non_existent_id');

      expect(thread).toBeNull();
    });
  });

  describe('batchOperation', () => {
    it('should mark multiple messages as read', async () => {
      // Send two messages
      const mail1: OutgoingMail = {
        from: testAddress1,
        to: testAddress2,
        subject: 'Batch test 1',
        body: 'Message 1',
      };
      const mail2: OutgoingMail = {
        from: testAddress1,
        to: testAddress2,
        subject: 'Batch test 2',
        body: 'Message 2',
      };

      const result1 = await storage.send(mail1);
      const result2 = await storage.send(mail2);

      const messageIds = [
        result1.messageId + '_0',
        result2.messageId + '_0',
      ];

      // Batch mark as read
      const batchResult = await storage.batchOperation({
        operation: 'markAsRead',
        messageIds,
      });

      expect(batchResult.success).toBe(true);
      expect(batchResult.succeeded).toBe(2);
      expect(batchResult.failed).toBe(0);

      // Verify messages are marked as read
      for (const msgId of messageIds) {
        const msg = await storage.getMessage(msgId);
        expect(msg?.status.read).toBe(true);
      }
    });

    it('should handle invalid operation type', async () => {
      const result = await storage.batchOperation({
        operation: 'invalidOperation' as any,
        messageIds: ['msg1', 'msg2'],
      });

      expect(result.success).toBe(false);
      expect(result.failed).toBe(2);
    });

    it('should handle partial failures', async () => {
      // Send one message
      const mail: OutgoingMail = {
        from: testAddress1,
        to: testAddress2,
        subject: 'Partial failure test',
        body: 'Test',
      };
      const sendResult = await storage.send(mail);

      // Try to mark one valid and one invalid message
      const result = await storage.batchOperation({
        operation: 'markAsRead',
        messageIds: [sendResult.messageId + '_0', 'non_existent_id'],
      });

      // Should have partial success
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBe(1);
    });
  });
});
