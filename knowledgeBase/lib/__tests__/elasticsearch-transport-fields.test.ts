import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@elastic/elasticsearch';
import { ElasticsearchTransport } from '../elasticsearch-transport';

describe('Elasticsearch Transport Fields', () => {
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

  it('should only send mapped fields to Elasticsearch', async () => {
    // Create a log info object with extra fields that are not in the mapping
    const logInfo = {
      level: 'info',
      message: 'Test message',
      label: 'TestService',
      timestamp: '2023-01-01T00:00:00.000Z',
      meta: { key: 'value' },
      // These fields are NOT in the mapping and should not be sent
      unmappedField1: 'should not be sent',
      anotherUnmappedField: { nested: 'value' },
      // Winston internal fields
      [Symbol.for('level')]: 'info',
    };

    // Call the log method
    await new Promise<void>((resolve) => {
      transport.log(logInfo, resolve);
    });

    // Check what was sent to Elasticsearch
    expect(mockClient.index).toHaveBeenCalledWith({
      index: 'test-logs',
      body: {
        timestamp: '2023-01-01T00:00:00.000Z',
        level: 'info',
        message: 'Test message',
        label: 'TestService',
        meta: { key: 'value' },
        service: 'aikb',
        environment: 'development',
      },
    });

    // Verify that unmapped fields were not included
    const sentBody = mockClient.index.mock.calls[0][0].body;
    expect(sentBody).not.toHaveProperty('unmappedField1');
    expect(sentBody).not.toHaveProperty('anotherUnmappedField');
    // Check that the symbol key was not converted to a string property
    const hasSymbolKey = Object.keys(sentBody).some(key => key.includes('level') && !['level'].includes(key));
    expect(hasSymbolKey).toBe(false);
  });

  it('should use default values for missing fields', async () => {
    const logInfo = {
      level: 'error',
      message: 'Error message',
      // Missing label, timestamp, and meta
    };

    await new Promise<void>((resolve) => {
      transport.log(logInfo, resolve);
    });

    expect(mockClient.index).toHaveBeenCalledWith({
      index: 'test-logs',
      body: {
        timestamp: expect.any(String), // Should be generated
        level: 'error',
        message: 'Error message',
        label: undefined,
        meta: {},
        service: 'aikb',
        environment: 'development',
      },
    });
  });
});