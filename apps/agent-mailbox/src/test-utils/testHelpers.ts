/**
 * Test helper utilities for agent-mailbox tests
 */

import { PostgreMailStorage } from '../lib/storage/postgreMailStorage.js';
import type { MailAddress, OutgoingMail } from '../lib/storage/type.js';

/**
 * Generate a unique test address
 * @param prefix - Address prefix
 * @returns Unique test address
 */
export function generateTestAddress(prefix: string = 'test'): MailAddress {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}@expert`;
}

/**
 * Generate a test mail object
 * @param overrides - Override default values
 * @returns Test mail object
 */
export function generateTestMail(
  overrides: Partial<OutgoingMail> = {},
): OutgoingMail {
  const timestamp = Date.now();
  return {
    from: generateTestAddress('sender'),
    to: generateTestAddress('recipient'),
    subject: `Test Subject ${timestamp}`,
    body: `Test body content ${timestamp}`,
    priority: 'normal',
    ...overrides,
  };
}

/**
 * Test context with storage and cleanup
 */
export interface TestContext {
  storage: PostgreMailStorage;
  createdAddresses: MailAddress[];
  createdMessageIds: string[];
}

/**
 * Create a test context with storage
 * @returns Test context
 */
export async function createTestContext(): Promise<TestContext> {
  const storage = new PostgreMailStorage();
  await storage.initialize();

  return {
    storage,
    createdAddresses: [],
    createdMessageIds: [],
  };
}

/**
 * Clean up test context
 * @param context - Test context to clean up
 */
export async function cleanupTestContext(context: TestContext): Promise<void> {
  const { storage, createdMessageIds, createdAddresses } = context;

  // Delete created messages
  for (const messageId of createdMessageIds) {
    try {
      await storage.deleteMessage(messageId);
    } catch {
      // Ignore errors during cleanup
    }
  }

  // Clean up is done via soft delete, so addresses remain in DB
  // but can be marked inactive if needed

  await storage.close();
}

/**
 * Register a test address and track it for cleanup
 * @param context - Test context
 * @param prefix - Address prefix
 * @returns Registered address
 */
export async function registerTestAddress(
  context: TestContext,
  prefix: string = 'test',
): Promise<MailAddress> {
  const address = generateTestAddress(prefix);
  await context.storage.registerAddress(address);
  context.createdAddresses.push(address);
  return address;
}

/**
 * Send a test mail and track it for cleanup
 * @param context - Test context
 * @param overrides - Override default mail values
 * @returns Send result
 */
export async function sendTestMail(
  context: TestContext,
  overrides: Partial<OutgoingMail> = {},
): Promise<{ success: boolean; messageId?: string; sentAt?: string }> {
  const mail = generateTestMail(overrides);
  const result = await context.storage.send(mail);

  if (result.success && result.messageId) {
    // Track the first recipient's message ID
    const recipients = Array.isArray(mail.to) ? mail.to : [mail.to];
    if (recipients.length > 0) {
      context.createdMessageIds.push(`${result.messageId}_0`);
    }
  }

  return result;
}

/**
 * Wait for a condition to be true
 * @param condition - Condition function
 * @param timeout - Timeout in milliseconds
 * @param interval - Check interval in milliseconds
 * @returns True if condition met
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100,
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return false;
}

/**
 * Retry an async operation
 * @param operation - Operation to retry
 * @param retries - Number of retries
 * @param delay - Delay between retries in milliseconds
 * @returns Operation result
 */
export async function retry<T>(
  operation: () => Promise<T>,
  retries: number = 3,
  delay: number = 100,
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Create a mock storage for unit tests
 * @returns Mock storage implementation
 */
export function createMockStorage(): PostgreMailStorage {
  const mockStorage = {
    initialize: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue({
      success: true,
      messageId: 'test-message-id',
      sentAt: new Date().toISOString(),
    }),
    getInbox: vi.fn().mockResolvedValue({
      address: 'test@expert',
      messages: [],
      total: 0,
      unread: 0,
      starred: 0,
    }),
    getMessage: vi.fn().mockResolvedValue(null),
    getUnreadCount: vi.fn().mockResolvedValue(0),
    markAsRead: vi.fn().mockResolvedValue({ success: true }),
    markAsUnread: vi.fn().mockResolvedValue({ success: true }),
    starMessage: vi.fn().mockResolvedValue({ success: true }),
    unstarMessage: vi.fn().mockResolvedValue({ success: true }),
    deleteMessage: vi.fn().mockResolvedValue({ success: true }),
    removeMessage: vi.fn().mockResolvedValue({ success: true }),
    search: vi.fn().mockResolvedValue([]),
    replyToMessage: vi.fn().mockResolvedValue({
      success: true,
      messageId: 'reply-message-id',
      sentAt: new Date().toISOString(),
    }),
    getThread: vi.fn().mockResolvedValue(null),
    batchOperation: vi.fn().mockResolvedValue({
      success: true,
      succeeded: 0,
      failed: 0,
    }),
    registerAddress: vi.fn().mockResolvedValue({ success: true }),
    isAddressRegistered: vi.fn().mockResolvedValue(true),
    getRegisteredAddresses: vi.fn().mockResolvedValue([]),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as PostgreMailStorage;

  return mockStorage;
}
