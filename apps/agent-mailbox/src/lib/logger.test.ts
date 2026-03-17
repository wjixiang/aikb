import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Logger,
  createLogger,
  generateRequestId,
  getRequestId,
  logRequestStart,
  logRequestComplete,
  globalLogger,
} from './logger.js';

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateRequestId', () => {
    it('should generate unique request IDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });
  });

  describe('getRequestId', () => {
    it('should return request ID from Fastify request', () => {
      const mockReq = { id: 'test-request-id' } as unknown as import('fastify').FastifyRequest;
      expect(getRequestId(mockReq)).toBe('test-request-id');
    });

    it('should generate new ID when request has no ID', () => {
      const mockReq = {} as unknown as import('fastify').FastifyRequest;
      const id = getRequestId(mockReq);
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate new ID when no request provided', () => {
      const id = getRequestId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('Logger', () => {
    it('should log info messages', () => {
      const logger = new Logger('test-id');
      logger.info('Test message', { key: 'value' });

      expect(mockConsoleLog).toHaveBeenCalled();
      const logOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(logOutput.level).toBe('INFO');
      expect(logOutput.message).toBe('Test message');
      expect(logOutput.requestId).toBe('test-id');
      expect(logOutput.context.key).toBe('value');
    });

    it('should log debug messages', () => {
      const logger = new Logger('test-id');
      logger.debug('Debug message');

      expect(mockConsoleLog).toHaveBeenCalled();
      const logOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(logOutput.level).toBe('DEBUG');
    });

    it('should log warn messages', () => {
      const logger = new Logger('test-id');
      logger.warn('Warning message');

      expect(mockConsoleWarn).toHaveBeenCalled();
      const logOutput = JSON.parse(mockConsoleWarn.mock.calls[0][0]);
      expect(logOutput.level).toBe('WARN');
    });

    it('should log error messages', () => {
      const logger = new Logger('test-id');
      const error = new Error('Test error');
      logger.error('Error message', error, { extra: 'data' });

      expect(mockConsoleError).toHaveBeenCalled();
      const logOutput = JSON.parse(mockConsoleError.mock.calls[0][0]);
      expect(logOutput.level).toBe('ERROR');
      expect(logOutput.error.message).toBe('Test error');
    });

    it('should create child logger with additional context', () => {
      const parentLogger = new Logger('test-id', { parentKey: 'parentValue' });
      const childLogger = parentLogger.child({ childKey: 'childValue' });

      childLogger.info('Child message');

      const logOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(logOutput.context.parentKey).toBe('parentValue');
      expect(logOutput.context.childKey).toBe('childValue');
    });

    it('should include timestamp in ISO format', () => {
      const logger = new Logger('test-id');
      logger.info('Test message');

      const logOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(new Date(logOutput.timestamp).toISOString()).toBe(logOutput.timestamp);
    });
  });

  describe('createLogger', () => {
    it('should create logger from Fastify request', () => {
      const mockReq = {
        id: 'req-123',
        method: 'GET',
        url: '/test',
      } as unknown as import('fastify').FastifyRequest;

      const logger = createLogger(mockReq, { extra: 'context' });
      logger.info('Test');

      const logOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(logOutput.requestId).toBe('req-123');
      expect(logOutput.context.extra).toBe('context');
    });

    it('should create logger without request', () => {
      const logger = createLogger(undefined, { extra: 'context' });
      logger.info('Test');

      const logOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(logOutput.context.extra).toBe('context');
      expect(logOutput.requestId).toBeDefined();
    });
  });

  describe('logRequestStart', () => {
    it('should log request start with request details', () => {
      const mockReq = {
        id: 'req-123',
        method: 'POST',
        url: '/api/mail',
        ip: '127.0.0.1',
        headers: { 'user-agent': 'test-agent' },
      } as unknown as import('fastify').FastifyRequest;

      const logger = logRequestStart(mockReq, { extra: 'data' });

      expect(mockConsoleLog).toHaveBeenCalled();
      const logOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(logOutput.level).toBe('INFO');
      expect(logOutput.message).toBe('Request started');
      expect(logOutput.context.method).toBe('POST');
      expect(logOutput.context.url).toBe('/api/mail');
      expect(logOutput.context.ip).toBe('127.0.0.1');
      expect(logOutput.context.userAgent).toBe('test-agent');
      expect(logOutput.context.extra).toBe('data');
    });
  });

  describe('logRequestComplete', () => {
    it('should log successful request completion', () => {
      const logger = new Logger('test-id');
      logRequestComplete(logger, 200, 100, { extra: 'data' });

      expect(mockConsoleLog).toHaveBeenCalled();
      const logOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(logOutput.level).toBe('INFO');
      expect(logOutput.message).toBe('Request completed');
      expect(logOutput.context.statusCode).toBe(200);
      expect(logOutput.context.durationMs).toBe(100);
      expect(logOutput.context.extra).toBe('data');
    });

    it('should log warning for 4xx status codes', () => {
      const logger = new Logger('test-id');
      logRequestComplete(logger, 404, 50);

      expect(mockConsoleWarn).toHaveBeenCalled();
      const logOutput = JSON.parse(mockConsoleWarn.mock.calls[0][0]);
      expect(logOutput.level).toBe('WARN');
      expect(logOutput.message).toBe('Request completed with warning');
      expect(logOutput.context.statusCode).toBe(404);
    });

    it('should log error for 5xx status codes', () => {
      const logger = new Logger('test-id');
      logRequestComplete(logger, 500, 200);

      expect(mockConsoleError).toHaveBeenCalled();
      const logOutput = JSON.parse(mockConsoleError.mock.calls[0][0]);
      expect(logOutput.level).toBe('ERROR');
      expect(logOutput.message).toBe('Request completed with error');
      expect(logOutput.context.statusCode).toBe(500);
    });
  });

  describe('globalLogger', () => {
    it('should be available as global logger', () => {
      expect(globalLogger).toBeInstanceOf(Logger);
      globalLogger.info('Global log test');
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });
});
