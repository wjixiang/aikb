/**
 * Validation Module Tests
 */

import { describe, it, expect } from 'vitest';
import {
  validateMailAddress,
  validateMailAddresses,
  validateMessageId,
  validateSubject,
  validateBody,
  validatePriority,
  validatePagination,
  validateSort,
  validateSearchQuery,
  validateOutgoingMail,
  containsNoSqlInjection,
  sanitizeNoSql,
  MAX_ADDRESS_LENGTH,
  MAX_SUBJECT_LENGTH,
  MAX_BODY_LENGTH,
  MAX_MESSAGE_ID_LENGTH,
  MAX_TASK_ID_LENGTH,
  MAX_RECIPIENTS,
  MAX_ATTACHMENTS,
  MAX_PAGINATION_LIMIT,
} from '../validation.js';

describe('Validation Module', () => {
  describe('validateMailAddress', () => {
    it('should validate simple addresses', () => {
      expect(validateMailAddress('broadcast').valid).toBe(true);
      expect(validateMailAddress('@broadcast').valid).toBe(true);
      expect(validateMailAddress('simple').valid).toBe(true);
    });

    it('should validate email-style addresses', () => {
      expect(validateMailAddress('user@domain').valid).toBe(true);
      expect(validateMailAddress('pubmed@expert').valid).toBe(true);
      expect(validateMailAddress('analysis-agent@expert').valid).toBe(true);
    });

    it('should reject empty addresses', () => {
      expect(validateMailAddress('').valid).toBe(false);
      expect(validateMailAddress(null as unknown as string).valid).toBe(false);
      expect(validateMailAddress(undefined as unknown as string).valid).toBe(false);
    });

    it('should reject addresses that are too long', () => {
      const longAddress = 'a'.repeat(MAX_ADDRESS_LENGTH + 1);
      const result = validateMailAddress(longAddress);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('maximum length');
    });

    it('should reject addresses with control characters', () => {
      const result = validateMailAddress('test\x00@expert');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid characters');
    });

    it('should reject addresses with invalid characters in local part', () => {
      expect(validateMailAddress('test!@expert').valid).toBe(false);
      expect(validateMailAddress('test#@expert').valid).toBe(false);
    });

    it('should reject addresses with invalid characters in domain part', () => {
      expect(validateMailAddress('test@expert!').valid).toBe(false);
      expect(validateMailAddress('test@expert#').valid).toBe(false);
    });

    it('should reject addresses with empty local part', () => {
      expect(validateMailAddress('@expert').valid).toBe(false);
    });

    it('should reject addresses with empty domain part', () => {
      expect(validateMailAddress('user@').valid).toBe(false);
    });
  });

  describe('validateMailAddresses', () => {
    it('should validate array of addresses', () => {
      const result = validateMailAddresses(['user1@expert', 'user2@expert']);
      expect(result.valid).toBe(true);
    });

    it('should reject non-array input', () => {
      const result = validateMailAddresses('not-an-array' as unknown as string[]);
      expect(result.valid).toBe(false);
    });

    it('should reject too many recipients', () => {
      const addresses = Array(MAX_RECIPIENTS + 1).fill('user@expert');
      const result = validateMailAddresses(addresses);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Too many recipients');
    });

    it('should reject if any address is invalid', () => {
      const result = validateMailAddresses(['valid@expert', 'invalid!@expert']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid address');
    });
  });

  describe('validateMessageId', () => {
    it('should validate valid message IDs', () => {
      expect(validateMessageId('mail_1234567890_abc123').valid).toBe(true);
      expect(validateMessageId('msg_abc_def').valid).toBe(true);
    });

    it('should reject empty message IDs', () => {
      expect(validateMessageId('').valid).toBe(false);
      expect(validateMessageId(null as unknown as string).valid).toBe(false);
    });

    it('should reject message IDs that are too long', () => {
      const longId = 'a'.repeat(MAX_MESSAGE_ID_LENGTH + 1);
      const result = validateMessageId(longId);
      expect(result.valid).toBe(false);
    });

    it('should reject message IDs with invalid characters', () => {
      expect(validateMessageId('mail_123!abc').valid).toBe(false);
      expect(validateMessageId('mail_123@abc').valid).toBe(false);
    });
  });

  describe('validateSubject', () => {
    it('should validate valid subjects', () => {
      expect(validateSubject('Hello World').valid).toBe(true);
      expect(validateSubject('Test Subject 123').valid).toBe(true);
    });

    it('should reject empty subjects', () => {
      expect(validateSubject('').valid).toBe(false);
      expect(validateSubject(null as unknown as string).valid).toBe(false);
    });

    it('should reject subjects that are too long', () => {
      const longSubject = 'a'.repeat(MAX_SUBJECT_LENGTH + 1);
      const result = validateSubject(longSubject);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('maximum length');
    });

    it('should reject subjects with control characters', () => {
      const result = validateSubject('Test\x00Subject');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid characters');
    });
  });

  describe('validateBody', () => {
    it('should allow valid bodies', () => {
      expect(validateBody('Hello World').valid).toBe(true);
      expect(validateBody('Multi\nline\nbody').valid).toBe(true);
    });

    it('should allow undefined/null body', () => {
      expect(validateBody(undefined).valid).toBe(true);
      expect(validateBody(null as unknown as string).valid).toBe(true);
    });

    it('should reject non-string body', () => {
      expect(validateBody(123 as unknown as string).valid).toBe(false);
      expect(validateBody({} as unknown as string).valid).toBe(false);
    });

    it('should reject bodies that are too long', () => {
      const longBody = 'a'.repeat(MAX_BODY_LENGTH + 1);
      const result = validateBody(longBody);
      expect(result.valid).toBe(false);
    });
  });

  describe('validatePriority', () => {
    it('should allow valid priorities', () => {
      expect(validatePriority('low').valid).toBe(true);
      expect(validatePriority('normal').valid).toBe(true);
      expect(validatePriority('high').valid).toBe(true);
      expect(validatePriority('urgent').valid).toBe(true);
    });

    it('should allow undefined/null priority', () => {
      expect(validatePriority(undefined).valid).toBe(true);
      expect(validatePriority(null).valid).toBe(true);
    });

    it('should reject invalid priorities', () => {
      expect(validatePriority('invalid').valid).toBe(false);
      expect(validatePriority('critical').valid).toBe(false);
    });
  });

  describe('validatePagination', () => {
    it('should allow valid pagination', () => {
      expect(validatePagination(10, 0).valid).toBe(true);
      expect(validatePagination(100, 50).valid).toBe(true);
    });

    it('should allow undefined values', () => {
      expect(validatePagination(undefined, undefined).valid).toBe(true);
    });

    it('should reject non-integer limit', () => {
      expect(validatePagination(10.5, 0).valid).toBe(false);
      expect(validatePagination('10' as unknown as number, 0).valid).toBe(false);
    });

    it('should reject limit less than 1', () => {
      expect(validatePagination(0, 0).valid).toBe(false);
      expect(validatePagination(-1, 0).valid).toBe(false);
    });

    it('should reject limit exceeding maximum', () => {
      const result = validatePagination(MAX_PAGINATION_LIMIT + 1, 0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot exceed');
    });

    it('should reject negative offset', () => {
      expect(validatePagination(10, -1).valid).toBe(false);
    });

    it('should reject non-integer offset', () => {
      expect(validatePagination(10, 0.5).valid).toBe(false);
    });
  });

  describe('validateSort', () => {
    it('should allow valid sort fields', () => {
      expect(validateSort('sentAt', 'asc').valid).toBe(true);
      expect(validateSort('receivedAt', 'desc').valid).toBe(true);
      expect(validateSort('subject', 'asc').valid).toBe(true);
      expect(validateSort('priority', 'desc').valid).toBe(true);
    });

    it('should allow undefined values', () => {
      expect(validateSort(undefined, undefined).valid).toBe(true);
    });

    it('should reject invalid sort fields', () => {
      expect(validateSort('invalid', 'asc').valid).toBe(false);
      expect(validateSort('timestamp', 'asc').valid).toBe(false);
    });

    it('should reject invalid sort orders', () => {
      expect(validateSort('sentAt', 'invalid').valid).toBe(false);
      expect(validateSort('sentAt', 'ascending').valid).toBe(false);
    });
  });

  describe('validateSearchQuery', () => {
    it('should allow valid search queries', () => {
      expect(validateSearchQuery({}).valid).toBe(true);
      expect(validateSearchQuery({ from: 'user@expert' }).valid).toBe(true);
      expect(validateSearchQuery({ priority: 'high' }).valid).toBe(true);
    });

    it('should validate date formats', () => {
      expect(validateSearchQuery({ dateFrom: '2024-01-01' }).valid).toBe(true);
      expect(validateSearchQuery({ dateTo: '2024-12-31T23:59:59Z' }).valid).toBe(true);
    });

    it('should reject invalid date formats', () => {
      expect(validateSearchQuery({ dateFrom: 'invalid-date' }).valid).toBe(false);
      expect(validateSearchQuery({ dateTo: 'not-a-date' }).valid).toBe(false);
    });

    it('should validate priority', () => {
      expect(validateSearchQuery({ priority: 'urgent' }).valid).toBe(true);
      expect(validateSearchQuery({ priority: 'invalid' }).valid).toBe(false);
    });
  });

  describe('validateOutgoingMail', () => {
    it('should validate valid mail', () => {
      const mail = {
        from: 'sender@expert',
        to: 'recipient@expert',
        subject: 'Test Subject',
      };
      expect(validateOutgoingMail(mail).valid).toBe(true);
    });

    it('should validate mail with array recipients', () => {
      const mail = {
        from: 'sender@expert',
        to: ['recipient1@expert', 'recipient2@expert'],
        subject: 'Test Subject',
      };
      expect(validateOutgoingMail(mail).valid).toBe(true);
    });

    it('should validate mail with optional fields', () => {
      const mail = {
        from: 'sender@expert',
        to: 'recipient@expert',
        subject: 'Test Subject',
        body: 'Test body',
        cc: ['cc@expert'],
        bcc: ['bcc@expert'],
        priority: 'high' as const,
        taskId: 'task_123',
      };
      expect(validateOutgoingMail(mail).valid).toBe(true);
    });

    it('should reject mail with invalid from address', () => {
      const mail = {
        from: 'invalid!address',
        to: 'recipient@expert',
        subject: 'Test',
      };
      const result = validateOutgoingMail(mail);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('from address');
    });

    it('should reject mail with invalid to address', () => {
      const mail = {
        from: 'sender@expert',
        to: 'invalid!address',
        subject: 'Test',
      };
      const result = validateOutgoingMail(mail);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('to address');
    });

    it('should reject mail with empty subject', () => {
      const mail = {
        from: 'sender@expert',
        to: 'recipient@expert',
        subject: '',
      };
      const result = validateOutgoingMail(mail);
      expect(result.valid).toBe(false);
    });

    it('should reject mail with too many attachments', () => {
      const mail = {
        from: 'sender@expert',
        to: 'recipient@expert',
        subject: 'Test',
        attachments: Array(MAX_ATTACHMENTS + 1).fill('file.txt'),
      };
      const result = validateOutgoingMail(mail);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Too many attachments');
    });

    it('should reject mail with invalid taskId', () => {
      const mail = {
        from: 'sender@expert',
        to: 'recipient@expert',
        subject: 'Test',
        taskId: 'a'.repeat(MAX_TASK_ID_LENGTH + 1),
      };
      const result = validateOutgoingMail(mail);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Task ID');
    });
  });

  describe('containsNoSqlInjection', () => {
    it('should detect MongoDB operators', () => {
      expect(containsNoSqlInjection('{ "$where": "this.x == this.y" }')).toBe(true);
      expect(containsNoSqlInjection('{ "$ne": null }')).toBe(true);
      expect(containsNoSqlInjection('{ "$gt": 0 }')).toBe(true);
      expect(containsNoSqlInjection('{ "$regex": "/.*/" }')).toBe(true);
      expect(containsNoSqlInjection('{ "$in": [1, 2, 3] }')).toBe(true);
    });

    it('should return false for safe strings', () => {
      expect(containsNoSqlInjection('Hello World')).toBe(false);
      expect(containsNoSqlInjection('user@example.com')).toBe(false);
    });

    it('should return false for strings with $ but no operators', () => {
      // $ followed by non-operator text is safe
      expect(containsNoSqlInjection('Test $100 price')).toBe(false);
      expect(containsNoSqlInjection('Price is $50.00')).toBe(false);
    });

    it('should handle empty input', () => {
      expect(containsNoSqlInjection('')).toBe(false);
      expect(containsNoSqlInjection(null as unknown as string)).toBe(false);
    });
  });

  describe('sanitizeNoSql', () => {
    it('should remove MongoDB operators', () => {
      expect(sanitizeNoSql('{ "$where": "test" }')).toBe('{ "": "test" }');
      expect(sanitizeNoSql('test $gt value')).toBe('test  value');
    });

    it('should preserve safe strings', () => {
      expect(sanitizeNoSql('Hello World')).toBe('Hello World');
    });

    it('should remove dollar sign followed by letters', () => {
      // The function removes $ followed by letters (potential operators)
      expect(sanitizeNoSql('Price: $100')).toBe('Price: 100');
      expect(sanitizeNoSql('test $gt value')).toBe('test  value');
    });

    it('should handle empty input', () => {
      expect(sanitizeNoSql('')).toBe('');
      expect(sanitizeNoSql(null as unknown as string)).toBe('');
    });
  });
});
