/**
 * MailComponent E2E Tests
 *
 * These tests use the real agent-mailbox backend server.
 * Requires the server to be running at http://localhost:3000
 *
 * Run with: pnpm test:integrated
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MailComponent } from '../mailComponent';
import type { MailComponentConfig } from 'agent-lib/multi-agent';

const TEST_ADDRESS = 'e2e-test@expert';
const SECOND_ADDRESS = 'e2e-test-2@expert';

const config: MailComponentConfig = {
  baseUrl: 'http://localhost:3000',
  defaultAddress: TEST_ADDRESS,
  timeout: 10000,
};

describe('MailComponent E2E', () => {
  let component: MailComponent;
  let secondComponent: MailComponent;

  beforeAll(async () => {
    // Create components
    component = new MailComponent(config);
    secondComponent = new MailComponent({
      ...config,
      defaultAddress: SECOND_ADDRESS,
    });

    // Register test addresses
    await component.registerAddress(TEST_ADDRESS);
    await secondComponent.registerAddress(SECOND_ADDRESS);
  });

  describe('Address Registration', () => {
    it('should register a new address', async () => {
      const result = await component.registerAddress('new-e2e-addr@expert');
      expect(result.success).toBe(true);
    });

    it('should handle duplicate address gracefully', async () => {
      const result = await component.registerAddress(TEST_ADDRESS);
      // Either success or already exists is acceptable
      expect(result.success === true || result.error).toBeDefined();
    });
  });

  describe('Send Mail', () => {
    it('should send mail to another address', async () => {
      const result = await component.sendMail({
        from: TEST_ADDRESS,
        to: SECOND_ADDRESS,
        subject: 'E2E Test Message',
        body: 'This is an E2E test message',
        priority: 'normal',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should send mail with priority', async () => {
      const result = await component.sendMail({
        from: TEST_ADDRESS,
        to: SECOND_ADDRESS,
        subject: 'Urgent Message',
        body: 'This is urgent',
        priority: 'urgent',
      });

      expect(result.success).toBe(true);
    });

    it('should send mail with attachments and payload', async () => {
      const result = await component.sendMail({
        from: TEST_ADDRESS,
        to: SECOND_ADDRESS,
        subject: 'Message with extras',
        body: 'Testing attachments and payload',
        attachments: ['s3://bucket/file.pdf'],
        payload: { key: 'value', nested: { data: 123 } },
      });

      expect(result.success).toBe(true);
    });

    it('should send mail to self', async () => {
      const result = await component.sendMail({
        from: TEST_ADDRESS,
        to: TEST_ADDRESS,
        subject: 'Self message',
        body: 'Testing self-mail',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Get Inbox', () => {
    it('should get inbox for address', async () => {
      const result = await component.getInbox(TEST_ADDRESS);

      expect(result.address).toBe(TEST_ADDRESS);
      expect(result.messages).toBeDefined();
      expect(Array.isArray(result.messages)).toBe(true);
      expect(result.total).toBeDefined();
      expect(result.unread).toBeDefined();
      expect(result.starred).toBeDefined();
    });

    it('should get inbox with pagination', async () => {
      const result = await component.getInbox(TEST_ADDRESS, {
        pagination: { limit: 5, offset: 0 },
      });

      expect(result.messages.length).toBeLessThanOrEqual(5);
    });

    it('should filter unread messages', async () => {
      // First send a new message
      await component.sendMail({
        from: TEST_ADDRESS,
        to: TEST_ADDRESS,
        subject: 'Unread test',
        body: 'Testing unread filter',
      });

      const result = await component.getInbox(TEST_ADDRESS, {
        unreadOnly: true,
      });

      // All messages should be unread (or empty if all read)
      expect(Array.isArray(result.messages)).toBe(true);
    });
  });

  describe('Get Unread Count', () => {
    it('should get unread count for address', async () => {
      const count = await component.getUnreadCount(TEST_ADDRESS);

      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Search Messages', () => {
    it('should search by subject', async () => {
      const results = await component.searchMessages({
        subject: 'E2E Test',
      });

      expect(Array.isArray(results)).toBe(true);
    });

    it('should search by body content', async () => {
      const results = await component.searchMessages({
        body: 'testing',
      });

      expect(Array.isArray(results)).toBe(true);
    });

    it('should search by sender', async () => {
      const results = await component.searchMessages({
        from: SECOND_ADDRESS,
      });

      expect(Array.isArray(results)).toBe(true);
    });

    it('should return empty array for no matches', async () => {
      const results = await component.searchMessages({
        subject: 'nonexistent-xyz-12345',
      });

      expect(results).toEqual([]);
    });
  });

  describe('Render', () => {
    it('should render component with inbox data', async () => {
      const elements = await component.renderImply();

      expect(elements.length).toBeGreaterThan(0);
      // Check that header is rendered
      const headerText = elements[0]?.render() || '';
      expect(headerText).toContain('Mail Component');
    });
  });

  describe('Tool Call Handlers', () => {
    it('should handle sendMail tool call', async () => {
      const result = await component.handleToolCall('sendMail', {
        to: SECOND_ADDRESS,
        subject: 'Tool call test',
        body: 'Testing via tool call',
      });

      expect(result.data).toBeDefined();
      expect(result.summary).toContain('Sent');
    });

    it('should handle getInbox tool call', async () => {
      const result = await component.handleToolCall('getInbox', {});

      expect(result.data).toBeDefined();
      expect(result.summary).toContain(TEST_ADDRESS);
    });

    it('should handle getUnreadCount tool call', async () => {
      const result = await component.handleToolCall('getUnreadCount', {});

      expect(result.data).toBeDefined();
      expect(result.summary).toContain('unread');
    });

    it('should handle searchMessages tool call', async () => {
      const result = await component.handleToolCall('searchMessages', {
        query: 'test',
      });

      expect(result.data).toBeDefined();
      expect(result.summary).toContain('Found');
    });

    it('should handle registerAddress tool call', async () => {
      const result = await component.handleToolCall('registerAddress', {
        address: 'tool-call-test@expert',
      });

      expect(result.data).toBeDefined();
      expect(result.summary).toContain('Registered');
    });

    it('should return error for unknown tool', async () => {
      const result = await component.handleToolCall('unknownTool', {});

      expect(result.data).toHaveProperty('error');
      expect(result.summary).toContain('Unknown tool');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const badComponent = new MailComponent({
        baseUrl: 'http://localhost:9999', // Invalid port
        defaultAddress: TEST_ADDRESS,
        timeout: 1000,
      });

      const result = await badComponent.handleToolCall('getInbox', {});
      expect(result.data).toHaveProperty('error');
    });
  });
});
