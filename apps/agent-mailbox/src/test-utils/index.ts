/**
 * Test utilities for agent-mailbox
 */

export {
  generateTestAddress,
  generateTestMail,
  createTestContext,
  cleanupTestContext,
  registerTestAddress,
  sendTestMail,
  waitFor,
  retry,
  createMockStorage,
} from './testHelpers.js';

export type { TestContext } from './testHelpers.js';
