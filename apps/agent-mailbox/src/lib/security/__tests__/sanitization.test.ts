/**
 * Sanitization Module Tests
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizePlainText,
  sanitizeEmailBody,
  sanitizeStringArray,
  escapeRegex,
  removeControlChars,
  sanitizeSearchQuery,
  sanitizeJsonPayload,
  sanitizeOutgoingMail,
  containsHtml,
  containsDangerousJs,
  type SanitizableMail,
} from '../sanitization.js';

describe('Sanitization Module', () => {
  describe('sanitizePlainText', () => {
    it('should remove HTML tags from plain text', () => {
      const input = '<script>alert("xss")</script>Hello World';
      const result = sanitizePlainText(input);
      expect(result).toBe('Hello World');
    });

    it('should handle empty input', () => {
      expect(sanitizePlainText('')).toBe('');
      expect(sanitizePlainText(null as unknown as string)).toBe('');
      expect(sanitizePlainText(undefined as unknown as string)).toBe('');
    });

    it('should preserve plain text', () => {
      const input = 'Hello World! This is a test.';
      expect(sanitizePlainText(input)).toBe(input);
    });

    it('should remove all HTML tags', () => {
      const input = '<div><p>Hello</p></div>';
      expect(sanitizePlainText(input)).toBe('Hello');
    });
  });

  describe('sanitizeEmailBody', () => {
    it('should allow safe HTML tags', () => {
      const input = '<p>Hello <strong>World</strong></p>';
      const result = sanitizeEmailBody(input);
      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
    });

    it('should remove dangerous HTML tags', () => {
      const input = '<script>alert("xss")</script><p>Hello</p>';
      const result = sanitizeEmailBody(input);
      expect(result).not.toContain('<script>');
      expect(result).toContain('<p>');
    });

    it('should handle empty input', () => {
      expect(sanitizeEmailBody('')).toBe('');
    });
  });

  describe('sanitizeStringArray', () => {
    it('should sanitize all strings in array', () => {
      const input = ['<script>test</script>hello', '<p>world</p>'];
      const result = sanitizeStringArray(input);
      expect(result).toEqual(['hello', 'world']);
    });

    it('should filter out empty strings', () => {
      const input = ['hello', '', 'world', '   '];
      const result = sanitizeStringArray(input);
      expect(result).toEqual(['hello', 'world']);
    });

    it('should handle non-array input', () => {
      expect(sanitizeStringArray(null as unknown as string[])).toEqual([]);
      expect(sanitizeStringArray(undefined as unknown as string[])).toEqual([]);
    });
  });

  describe('escapeRegex', () => {
    it('should escape special regex characters', () => {
      const input = 'test[abc].*+';
      const result = escapeRegex(input);
      expect(result).toBe('test\\[abc\\]\\.\\*\\+');
    });

    it('should handle empty input', () => {
      expect(escapeRegex('')).toBe('');
    });
  });

  describe('removeControlChars', () => {
    it('should remove control characters', () => {
      const input = 'hello\x00world\x01test';
      const result = removeControlChars(input);
      expect(result).toBe('helloworldtest');
    });

    it('should preserve common whitespace', () => {
      const input = 'hello\nworld\ttest';
      const result = removeControlChars(input);
      expect(result).toBe('hello\nworld\ttest');
    });
  });

  describe('sanitizeSearchQuery', () => {
    it('should escape regex special characters', () => {
      const input = 'test[abc].*';
      const result = sanitizeSearchQuery(input);
      expect(result).toContain('\\[');
    });

    it('should remove control characters', () => {
      const input = 'hello\x00world';
      const result = sanitizeSearchQuery(input);
      expect(result).not.toContain('\x00');
    });
  });

  describe('sanitizeJsonPayload', () => {
    it('should return valid JSON', () => {
      const input = { key: 'value', number: 123 };
      const result = sanitizeJsonPayload(input);
      expect(result).toEqual(input);
    });

    it('should block prototype pollution', () => {
      const input = JSON.parse('{"__proto__": {"polluted": true}}');
      const result = sanitizeJsonPayload(input);
      expect(result).toBeNull();
    });

    it('should block constructor pollution', () => {
      const input = JSON.parse('{"constructor": {"prototype": {"polluted": true}}}');
      const result = sanitizeJsonPayload(input);
      expect(result).toBeNull();
    });

    it('should handle invalid input', () => {
      expect(sanitizeJsonPayload(null)).toBeNull();
      expect(sanitizeJsonPayload(undefined)).toBeNull();
      expect(sanitizeJsonPayload('string' as unknown as Record<string, unknown>)).toBeNull();
    });
  });

  describe('sanitizeOutgoingMail', () => {
    it('should sanitize mail content', () => {
      const mail: SanitizableMail = {
        from: '<script>test</script>sender@expert',
        to: '<p>recipient</p>@expert',
        subject: '<b>Test</b> Subject',
        body: '<script>alert("xss")</script><p>Hello</p>',
      };

      const result = sanitizeOutgoingMail(mail);
      expect(result.from).toBe('sender@expert');
      expect(result.to).toBe('recipient@expert');
      expect(result.subject).toBe('Test Subject');
      expect(result.body).not.toContain('<script>');
    });

    it('should handle array recipients', () => {
      const mail: SanitizableMail = {
        from: 'sender@expert',
        to: ['<b>user1</b>@expert', 'user2@expert'],
        subject: 'Test',
      };

      const result = sanitizeOutgoingMail(mail);
      expect(Array.isArray(result.to)).toBe(true);
      // HTML tags are stripped, leaving just the text content
      expect(result.to).toEqual(['user1@expert', 'user2@expert']);
    });

    it('should sanitize cc and bcc arrays', () => {
      const mail: SanitizableMail = {
        from: 'sender@expert',
        to: 'recipient@expert',
        subject: 'Test',
        cc: ['<b>cc1</b>@expert', 'cc2@expert'],
        bcc: ['<i>bcc1</i>@expert'],
      };

      const result = sanitizeOutgoingMail(mail);
      expect(result.cc).toEqual(['cc1@expert', 'cc2@expert']);
      expect(result.bcc).toEqual(['bcc1@expert']);
    });

    it('should sanitize attachments', () => {
      const mail: SanitizableMail = {
        from: 'sender@expert',
        to: 'recipient@expert',
        subject: 'Test',
        attachments: ['file\x00.txt', 'normal.pdf'],
      };

      const result = sanitizeOutgoingMail(mail);
      expect(result.attachments).toEqual(['file.txt', 'normal.pdf']);
    });

    it('should sanitize payload', () => {
      const mail: SanitizableMail = {
        from: 'sender@expert',
        to: 'recipient@expert',
        subject: 'Test',
        payload: { key: 'value' },
      };

      const result = sanitizeOutgoingMail(mail);
      expect(result.payload).toEqual({ key: 'value' });
    });

    it('should handle missing optional fields', () => {
      const mail: SanitizableMail = {
        from: 'sender@expert',
        to: 'recipient@expert',
        subject: 'Test',
      };

      const result = sanitizeOutgoingMail(mail);
      expect(result.body).toBeUndefined();
      expect(result.cc).toBeUndefined();
      expect(result.bcc).toBeUndefined();
    });
  });

  describe('containsHtml', () => {
    it('should detect HTML tags', () => {
      expect(containsHtml('<p>test</p>')).toBe(true);
      expect(containsHtml('<script>alert(1)</script>')).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(containsHtml('Hello World')).toBe(false);
      expect(containsHtml('test < 5')).toBe(false);
    });

    it('should handle empty input', () => {
      expect(containsHtml('')).toBe(false);
    });
  });

  describe('containsDangerousJs', () => {
    it('should detect script tags', () => {
      expect(containsDangerousJs('<script>alert(1)</script>')).toBe(true);
    });

    it('should detect javascript: protocol', () => {
      expect(containsDangerousJs('javascript:alert(1)')).toBe(true);
    });

    it('should detect event handlers', () => {
      expect(containsDangerousJs('<img onload=alert(1)>')).toBe(true);
      expect(containsDangerousJs('<div onclick="alert(1)">')).toBe(true);
    });

    it('should return false for safe content', () => {
      expect(containsDangerousJs('Hello World')).toBe(false);
      expect(containsDangerousJs('This is a test')).toBe(false);
    });
  });
});
