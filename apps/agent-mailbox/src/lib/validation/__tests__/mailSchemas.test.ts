import { describe, it, expect } from 'vitest';
import {
  mailAddressSchema,
  messagePrioritySchema,
  paginationOptionsSchema,
  outgoingMailSchema,
  replyMailSchema,
  inboxQuerySchema,
  searchQuerySchema,
  batchOperationSchema,
  registerAddressSchema,
  messageIdParamSchema,
  addressParamSchema,
} from '../mailSchemas.js';

describe('mailAddressSchema', () => {
  it('should validate a simple address', () => {
    const result = mailAddressSchema.safeParse('pubmed');
    expect(result.success).toBe(true);
    expect(result.data).toBe('pubmed');
  });

  it('should validate an email-style address', () => {
    const result = mailAddressSchema.safeParse('pubmed@expert');
    expect(result.success).toBe(true);
    expect(result.data).toBe('pubmed@expert');
  });

  it('should reject empty address', () => {
    const result = mailAddressSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('should reject address with invalid characters', () => {
    const result = mailAddressSchema.safeParse('pubmed!@expert');
    expect(result.success).toBe(false);
  });

  it('should reject address that is too long', () => {
    const result = mailAddressSchema.safeParse('a'.repeat(256));
    expect(result.success).toBe(false);
  });
});

describe('messagePrioritySchema', () => {
  it('should validate valid priorities', () => {
    expect(messagePrioritySchema.safeParse('low').success).toBe(true);
    expect(messagePrioritySchema.safeParse('normal').success).toBe(true);
    expect(messagePrioritySchema.safeParse('high').success).toBe(true);
    expect(messagePrioritySchema.safeParse('urgent').success).toBe(true);
  });

  it('should default to normal', () => {
    const result = messagePrioritySchema.parse(undefined);
    expect(result).toBe('normal');
  });

  it('should reject invalid priorities', () => {
    expect(messagePrioritySchema.safeParse('invalid').success).toBe(false);
    expect(messagePrioritySchema.safeParse('').success).toBe(false);
  });
});

describe('paginationOptionsSchema', () => {
  it('should use default values', () => {
    const result = paginationOptionsSchema.parse({});
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it('should accept valid values', () => {
    const result = paginationOptionsSchema.parse({ limit: 50, offset: 10 });
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(10);
  });

  it('should coerce string values', () => {
    const result = paginationOptionsSchema.parse({ limit: '30', offset: '5' });
    expect(result.limit).toBe(30);
    expect(result.offset).toBe(5);
  });

  it('should reject negative values', () => {
    expect(paginationOptionsSchema.safeParse({ limit: -1 }).success).toBe(false);
    expect(paginationOptionsSchema.safeParse({ offset: -1 }).success).toBe(false);
  });

  it('should reject values over max', () => {
    expect(paginationOptionsSchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});

describe('outgoingMailSchema', () => {
  it('should validate a minimal mail', () => {
    const result = outgoingMailSchema.safeParse({
      from: 'sender@expert',
      to: 'recipient@expert',
      subject: 'Test Subject',
    });
    expect(result.success).toBe(true);
  });

  it('should validate mail with all fields', () => {
    const result = outgoingMailSchema.safeParse({
      from: 'sender@expert',
      to: ['recipient1@expert', 'recipient2@expert'],
      subject: 'Test Subject',
      body: 'Test body',
      cc: ['cc@expert'],
      bcc: ['bcc@expert'],
      attachments: ['file1.pdf', 'file2.pdf'],
      payload: { key: 'value' },
      priority: 'high',
      taskId: 'task_123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing required fields', () => {
    const result = outgoingMailSchema.safeParse({
      from: 'sender@expert',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty subject', () => {
    const result = outgoingMailSchema.safeParse({
      from: 'sender@expert',
      to: 'recipient@expert',
      subject: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject subject that is too long', () => {
    const result = outgoingMailSchema.safeParse({
      from: 'sender@expert',
      to: 'recipient@expert',
      subject: 'a'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('should reject too many attachments', () => {
    const result = outgoingMailSchema.safeParse({
      from: 'sender@expert',
      to: 'recipient@expert',
      subject: 'Test',
      attachments: Array(11).fill('file.pdf'),
    });
    expect(result.success).toBe(false);
  });
});

describe('replyMailSchema', () => {
  it('should validate a minimal reply', () => {
    const result = replyMailSchema.safeParse({
      body: 'Reply body',
    });
    expect(result.success).toBe(true);
  });

  it('should validate reply with all fields', () => {
    const result = replyMailSchema.safeParse({
      body: 'Reply body',
      attachments: ['file.pdf'],
      payload: { key: 'value' },
      from: 'sender@expert',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty body', () => {
    const result = replyMailSchema.safeParse({
      body: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing body', () => {
    const result = replyMailSchema.safeParse({
      attachments: ['file.pdf'],
    });
    expect(result.success).toBe(false);
  });
});

describe('inboxQuerySchema', () => {
  it('should accept empty query', () => {
    const result = inboxQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept valid query parameters', () => {
    const result = inboxQuerySchema.safeParse({
      limit: 50,
      offset: 10,
      unreadOnly: true,
      starredOnly: false,
      sortBy: 'sentAt',
      sortOrder: 'asc',
    });
    expect(result.success).toBe(true);
  });

  it('should coerce string values', () => {
    const result = inboxQuerySchema.parse({
      limit: '30',
      offset: '5',
      unreadOnly: 'true',
    });
    expect(result.limit).toBe(30);
    expect(result.offset).toBe(5);
    expect(result.unreadOnly).toBe(true);
  });

  it('should reject invalid sortBy', () => {
    const result = inboxQuerySchema.safeParse({
      sortBy: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});

describe('searchQuerySchema', () => {
  it('should accept empty query', () => {
    const result = searchQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept valid search parameters', () => {
    const result = searchQuerySchema.safeParse({
      from: 'sender@expert',
      to: 'recipient@expert',
      subject: 'test',
      body: 'content',
      unread: true,
      starred: false,
      priority: 'high',
      dateFrom: '2024-01-01T00:00:00Z',
      dateTo: '2024-12-31T23:59:59Z',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid date format', () => {
    const result = searchQuerySchema.safeParse({
      dateFrom: 'invalid-date',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid priority', () => {
    const result = searchQuerySchema.safeParse({
      priority: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});

describe('batchOperationSchema', () => {
  it('should validate valid batch operation', () => {
    const result = batchOperationSchema.safeParse({
      operation: 'markAsRead',
      messageIds: ['msg1', 'msg2', 'msg3'],
    });
    expect(result.success).toBe(true);
  });

  it('should accept all valid operations', () => {
    const operations = ['markAsRead', 'markAsUnread', 'star', 'unstar', 'delete'];
    for (const op of operations) {
      const result = batchOperationSchema.safeParse({
        operation: op,
        messageIds: ['msg1'],
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid operation', () => {
    const result = batchOperationSchema.safeParse({
      operation: 'invalid',
      messageIds: ['msg1'],
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty messageIds', () => {
    const result = batchOperationSchema.safeParse({
      operation: 'markAsRead',
      messageIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing messageIds', () => {
    const result = batchOperationSchema.safeParse({
      operation: 'markAsRead',
    });
    expect(result.success).toBe(false);
  });
});

describe('registerAddressSchema', () => {
  it('should validate valid address', () => {
    const result = registerAddressSchema.safeParse({
      address: 'newuser@expert',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty address', () => {
    const result = registerAddressSchema.safeParse({
      address: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid address format', () => {
    const result = registerAddressSchema.safeParse({
      address: 'invalid!address',
    });
    expect(result.success).toBe(false);
  });
});

describe('messageIdParamSchema', () => {
  it('should validate valid messageId', () => {
    const result = messageIdParamSchema.safeParse({
      messageId: 'msg_123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty messageId', () => {
    const result = messageIdParamSchema.safeParse({
      messageId: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing messageId', () => {
    const result = messageIdParamSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('addressParamSchema', () => {
  it('should validate valid address', () => {
    const result = addressParamSchema.safeParse({
      address: 'user@expert',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty address', () => {
    const result = addressParamSchema.safeParse({
      address: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid address format', () => {
    const result = addressParamSchema.safeParse({
      address: 'invalid!address',
    });
    expect(result.success).toBe(false);
  });
});
