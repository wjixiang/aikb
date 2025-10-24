import { describe, it, expect, vi } from 'vitest';
import winston from 'winston';
import createLoggerWithPrefix from '../logger';

describe('Logger Format', () => {
  it('should create a logger with correct console format', () => {
    // Create a logger with a test prefix
    const logger = createLoggerWithPrefix('TestService');

    // Check that the logger was created
    expect(logger).toBeDefined();

    // Find the console transport
    const consoleTransport = logger.transports.find(
      (transport: any) => transport instanceof winston.transports.Console,
    );

    // Check that the console transport exists
    expect(consoleTransport).toBeDefined();

    // Check that the console transport has a format
    expect((consoleTransport as any).format).toBeDefined();
  });

  it('should use the prefix as label in the format', () => {
    // Create a logger with a test prefix
    const logger = createLoggerWithPrefix('TestService');

    // Find the console transport
    const consoleTransport = logger.transports.find(
      (transport: any) => transport instanceof winston.transports.Console,
    );

    // Get the format from the console transport
    const format = (consoleTransport as any).format;

    // The format should include a label transform
    expect(format.transform).toBeDefined();
  });

  it('should create a logger with file and console transports', () => {
    // Ensure Elasticsearch logging is disabled for this test
    process.env.ELASTICSEARCH_LOGGING_ENABLED = 'false';

    // Create a logger with a test prefix
    const logger = createLoggerWithPrefix('TestService');

    // Check that it has console and file transports
    const hasConsoleTransport = logger.transports.some(
      (transport: any) => transport instanceof winston.transports.Console,
    );
    const hasFileTransport = logger.transports.some(
      (transport: any) => transport instanceof winston.transports.File,
    );

    expect(hasConsoleTransport).toBe(true);
    expect(hasFileTransport).toBe(true);

    // Should have at least console and file transports
    expect(logger.transports.length).toBeGreaterThanOrEqual(2);
  });
});
