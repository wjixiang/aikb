import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@elastic/elasticsearch';
import { ElasticsearchTransport } from '../elasticsearch-transport';

describe('Elasticsearch Transport hasOwnProperty Fix', () => {
  let mockClient: any;
  let transport: ElasticsearchTransport;

  beforeEach(() => {
    // Mock the Elasticsearch client
    mockClient = {
      indices: {
        exists: vi.fn().mockResolvedValue(false),
        create: vi.fn().mockResolvedValue({}),
      },
      index: vi.fn().mockResolvedValue({}),
    };

    // Create transport with mocked client
    transport = new ElasticsearchTransport({
      client: mockClient,
      indexName: 'test-logs',
      indexPattern: 'test-logs', // Use static pattern for testing
    });
  });

  it('should handle objects created with Object.create(null)', async () => {
    // Create an object without hasOwnProperty method
    const objWithoutHasOwnProperty = Object.create(null);
    objWithoutHasOwnProperty.key1 = 'value1';
    objWithoutHasOwnProperty.key2 = 'value2';

    const logInfo = {
      level: 'info',
      message: 'Test message',
      label: 'TestService',
      timestamp: '2023-01-01T00:00:00.000Z',
      meta: objWithoutHasOwnProperty,
    };

    // This should not throw errors
    await new Promise<void>((resolve) => {
      transport.log(logInfo, resolve);
    });

    // Check that the document was indexed
    expect(mockClient.index).toHaveBeenCalledWith({
      index: 'test-logs',
      body: {
        timestamp: '2023-01-01T00:00:00.000Z',
        level: 'info',
        message: 'Test message',
        label: 'TestService',
        meta: { key1: 'value1', key2: 'value2' },
        service: 'aikb',
        environment: 'development',
      },
    });
  });

  it('should handle null and undefined values in meta', async () => {
    const logInfo = {
      level: 'error',
      message: 'Error message',
      label: 'TestService',
      timestamp: '2023-01-01T00:00:00.000Z',
      meta: null,
    };

    // This should not throw errors
    await new Promise<void>((resolve) => {
      transport.log(logInfo, resolve);
    });

    // Check that the document was indexed with empty meta
    expect(mockClient.index).toHaveBeenCalledWith({
      index: 'test-logs',
      body: {
        timestamp: '2023-01-01T00:00:00.000Z',
        level: 'error',
        message: 'Error message',
        label: 'TestService',
        meta: {},
        service: 'aikb',
        environment: 'development',
      },
    });
  });

  it('should handle primitive values in meta', async () => {
    const logInfo = {
      level: 'warn',
      message: 'Warning message',
      label: 'TestService',
      timestamp: '2023-01-01T00:00:00.000Z',
      meta: 'string value', // Not an object
    };

    // This should not throw errors
    await new Promise<void>((resolve) => {
      transport.log(logInfo, resolve);
    });

    // Check that the document was indexed with the primitive meta value
    expect(mockClient.index).toHaveBeenCalledWith({
      index: 'test-logs',
      body: {
        timestamp: '2023-01-01T00:00:00.000Z',
        level: 'warn',
        message: 'Warning message',
        label: 'TestService',
        meta: 'string value',
        service: 'aikb',
        environment: 'development',
      },
    });
  });
});
