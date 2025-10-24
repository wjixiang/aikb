import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import createLoggerWithPrefix from '@aikb/log-management/logger';

describe('Logger with Meta Object Support - Simple Tests', () => {
  beforeEach(() => {
    // Disable Elasticsearch for all tests
    process.env.ELASTICSEARCH_LOGGING_ENABLED = 'false';
  });

  afterEach(() => {
    // Reset environment variables after each test
    delete process.env.ELASTICSEARCH_LOGGING_ENABLED;
  });

  it('should create logger with all required methods', () => {
    const logger = createLoggerWithPrefix('TestService');

    // Test that logger methods exist
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.log).toBe('function');
  });

  it('should handle logging with meta object', () => {
    const logger = createLoggerWithPrefix('TestService');
    const testMeta = { userId: '12345', action: 'login', ip: '192.168.1.1' };

    // These should not throw errors
    expect(() => {
      logger.info('Test message', testMeta);
      logger.error('Error message', testMeta);
      logger.warn('Warning message', testMeta);
      logger.debug('Debug message', testMeta);
    }).not.toThrow();
  });

  it('should handle logging without meta object', () => {
    const logger = createLoggerWithPrefix('TestService');

    // These should not throw errors
    expect(() => {
      logger.info('Simple message');
      logger.error('Simple error');
      logger.warn('Simple warning');
      logger.debug('Simple debug');
    }).not.toThrow();
  });

  it('should handle complex nested objects in meta', () => {
    const logger = createLoggerWithPrefix('TestService');
    const complexMeta = {
      user: {
        id: '12345',
        profile: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      },
      request: {
        method: 'POST',
        url: '/api/v1/users',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer token123',
        },
      },
      timestamps: {
        start: '2023-01-01T00:00:00Z',
        end: '2023-01-01T00:00:05Z',
      },
    };

    // This should not throw errors
    expect(() => {
      logger.info('Complex operation completed', complexMeta);
    }).not.toThrow();
  });

  it('should handle arrays in meta objects', () => {
    const logger = createLoggerWithPrefix('TestService');
    const arrayMeta = {
      tags: ['user', 'login', 'success'],
      errors: ['Error 1', 'Error 2'],
      numbers: [1, 2, 3, 4, 5],
    };

    // This should not throw errors
    expect(() => {
      logger.info('Operation with arrays', arrayMeta);
    }).not.toThrow();
  });

  it('should handle null and undefined values in meta', () => {
    const logger = createLoggerWithPrefix('TestService');
    const metaWithNulls = {
      userId: '12345',
      profile: null,
      settings: undefined,
      tags: ['tag1', null, 'tag2'],
    };

    // This should not throw errors
    expect(() => {
      logger.info('Operation with null values', metaWithNulls);
    }).not.toThrow();
  });

  it('should work with all log levels', () => {
    const logger = createLoggerWithPrefix('TestService');
    const testMeta = { test: 'value' };

    // These should not throw errors
    expect(() => {
      logger.error('Error message', testMeta);
      logger.warn('Warning message', testMeta);
      logger.info('Info message', testMeta);
      logger.debug('Debug message', testMeta);
    }).not.toThrow();
  });
});
