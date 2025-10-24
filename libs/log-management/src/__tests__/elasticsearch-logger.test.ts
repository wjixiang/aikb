import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import createLoggerWithPrefix from '../logger';

describe('Elasticsearch Logger', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset environment variables after each test
    delete process.env.ELASTICSEARCH_LOGGING_ENABLED;
    delete process.env.ELASTICSEARCH_LOG_LEVEL;
    delete process.env.ELASTICSEARCH_URL;
    delete process.env.ELASTICSEARCH_LOG_INDEX;
    delete process.env.ELASTICSEARCH_LOG_INDEX_PATTERN;
  });

  it('should create logger without Elasticsearch transport when disabled', () => {
    // Set up environment variables
    process.env.ELASTICSEARCH_LOGGING_ENABLED = 'false';

    const logger = createLoggerWithPrefix('TestLogger');

    // Check that the logger was created
    expect(logger).toBeDefined();

    // Check that it has the expected transports (console and file)
    expect(logger.transports).toHaveLength(2);
  });

  it('should create logger with Elasticsearch transport when enabled', () => {
    // Set up environment variables
    process.env.ELASTICSEARCH_LOGGING_ENABLED = 'true';
    process.env.ELASTICSEARCH_LOG_LEVEL = 'debug';
    process.env.ELASTICSEARCH_URL = 'http://test-elasticsearch:9200';
    process.env.ELASTICSEARCH_LOG_INDEX = 'test-logs';
    process.env.ELASTICSEARCH_LOG_INDEX_PATTERN = 'test-logs-YYYY.MM.DD';

    const logger = createLoggerWithPrefix('TestLogger');

    // Check that the logger was created
    expect(logger).toBeDefined();

    // Check that it has the expected transports (console, file, and elasticsearch)
    expect(logger.transports).toHaveLength(3);

    // Find the Elasticsearch transport
    const elasticsearchTransport = logger.transports.find(
      (transport: any) =>
        transport.constructor.name === 'ElasticsearchTransport',
    );

    expect(elasticsearchTransport).toBeDefined();

    // Check that the transport has the correct configuration
    expect((elasticsearchTransport as any).indexName).toBe('test-logs');
    expect((elasticsearchTransport as any).indexPattern).toBe(
      'test-logs-YYYY.MM.DD',
    );
  });

  it('should use default values when environment variables are not set', () => {
    // Set up environment variables
    process.env.ELASTICSEARCH_LOGGING_ENABLED = 'true';

    const logger = createLoggerWithPrefix('TestLogger');

    // Check that the logger was created
    expect(logger).toBeDefined();

    // Check that it has the expected transports
    expect(logger.transports).toHaveLength(3);

    // Find the Elasticsearch transport
    const elasticsearchTransport = logger.transports.find(
      (transport: any) =>
        transport.constructor.name === 'ElasticsearchTransport',
    );

    expect(elasticsearchTransport).toBeDefined();

    // Check that the transport has default configuration
    expect((elasticsearchTransport as any).indexName).toBe('logs');
    expect((elasticsearchTransport as any).indexPattern).toBe(
      'logs-YYYY.MM.DD',
    );
  });

  it('should log messages to Elasticsearch when enabled', () => {
    // Set up environment variables
    process.env.ELASTICSEARCH_LOGGING_ENABLED = 'true';

    const logger = createLoggerWithPrefix('TestLogger');

    // Check that the logger was created with Elasticsearch transport
    expect(logger).toBeDefined();
    expect(logger.transports).toHaveLength(3);

    // Find the Elasticsearch transport
    const elasticsearchTransport = logger.transports.find(
      (transport: any) =>
        transport.constructor.name === 'ElasticsearchTransport',
    );

    expect(elasticsearchTransport).toBeDefined();
  });
});
