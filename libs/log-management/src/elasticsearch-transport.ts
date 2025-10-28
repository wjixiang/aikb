import { Client } from '@elastic/elasticsearch';
import Transport from 'winston-transport';

/**
 * Elasticsearch transport for Winston logger
 */
export class ElasticsearchTransport extends Transport {
  private client: Client;
  private indexName: string;
  private indexPattern: string;

  constructor(
    options: any & {
      elasticsearchUrl?: string;
      indexName?: string;
      indexPattern?: string;
      client?: Client;
    },
  ) {
    super(options);

    this.indexName = options.indexName || 'logs';
    this.indexPattern = options.indexPattern || 'logs-YYYY.MM.DD';

    // Use provided client or create a new one
    if (options.client) {
      this.client = options.client;
    } else {
      const elasticsearchUrl =
        options.elasticsearchUrl ||
        process.env['ELASTICSEARCH_URL'] ||
        'http://localhost:9200';

      this.client = new Client({
        node: elasticsearchUrl,
        auth: {
          apiKey: process.env['ELASTICSEARCH_API_KEY'] || '',
          username: process.env['ELASTICSEARCH_USERNAME'] || 'elastic',
          password: process.env['ELASTICSEARCH_PASSWORD'] || 'changeme',
        },
        tls: {
          rejectUnauthorized:
            process.env['ELASTICSEARCH_VERIFY_SSL'] !== 'false',
        },
      });
    }
  }

  /**
   * Initialize the log index with proper mappings
   */
  private async initializeIndex(): Promise<void> {
    try {
      const indexName = this.getIndexName();
      const exists = await this.client.indices.exists({
        index: indexName,
      });

      if (!exists) {
        try {
          await this.client.indices.create({
            index: indexName,
            mappings: {
              properties: {
                timestamp: {
                  type: 'date',
                },
                level: {
                  type: 'keyword',
                },
                message: {
                  type: 'text',
                  analyzer: 'standard',
                },
                label: {
                  type: 'keyword',
                },
                meta: {
                  type: 'object',
                  dynamic: true,
                },
                service: {
                  type: 'keyword',
                },
                environment: {
                  type: 'keyword',
                },
              },
            },
          } as any);
        } catch (createError: any) {
          // If index already exists (race condition), just continue
          if (
            createError?.meta?.body?.error?.type ===
            'resource_already_exists_exception'
          ) {
            // Index already exists, continue
            return;
          }
          // For other errors, log but don't fail
          console.error('Failed to create Elasticsearch index:', createError);
        }
      }
    } catch (error) {
      // If checking index existence fails, log but don't fail the logging
      // We don't want logging failures to break the application
      console.error('Failed to check Elasticsearch index existence:', error);
    }
  }

  /**
   * Get the appropriate index name based on the pattern
   */
  private getIndexName(): string {
    if (
      this.indexPattern.includes('YYYY') ||
      this.indexPattern.includes('MM') ||
      this.indexPattern.includes('DD')
    ) {
      const now = new Date();
      return this.indexPattern
        .replace('YYYY', now.getFullYear().toString())
        .replace('MM', (now.getMonth() + 1).toString().padStart(2, '0'))
        .replace('DD', now.getDate().toString().padStart(2, '0'));
    }
    return this.indexPattern;
  }

  /**
   * Log the info to Elasticsearch
   */
  override async log(info: any, callback: () => void): Promise<void> {
    try {
      // Initialize index if needed
      await this.initializeIndex();

      const indexName = this.getIndexName();

      // Extract only the fields that are defined in the mapping
      // Avoid using spread operator to prevent unmapped fields
      const document = {
        timestamp: info.timestamp || new Date().toISOString(),
        level: info.level,
        message: info.message,
        label: info.label,
        meta: info.meta || {},
        service: process.env['SERVICE_NAME'] || 'aikb',
        environment: process.env['NODE_ENV'] || 'development',
      };

      // Ensure meta is properly serialized and flattened for Elasticsearch
      if (document.meta && typeof document.meta === 'object') {
        // Flatten nested objects for better searchability in Elasticsearch
        const flattenedMeta: any = {};
        this.flattenObject(document.meta, flattenedMeta);
        document.meta = flattenedMeta;
      }

      // Index the document with only mapped fields
      await this.client.index({
        index: indexName,
        body: document,
      });

      callback();
    } catch (error) {
      // Log the error but don't fail the operation
      console.error('Failed to log to Elasticsearch:', error);
      callback();
    }
  }

  /**
   * Flatten nested objects for Elasticsearch indexing
   */
  private flattenObject(obj: any, result: any = '', prefix: string = ''): void {
    // Handle null/undefined objects
    if (obj === null || obj === undefined) {
      return;
    }

    // Handle non-object types
    if (typeof obj !== 'object') {
      return;
    }

    // Use Object.prototype.hasOwnProperty.call for safety
    // This works even if obj was created with Object.create(null)
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (
          typeof obj[key] === 'object' &&
          obj[key] !== null &&
          !Array.isArray(obj[key])
        ) {
          // Recursively flatten nested objects
          this.flattenObject(obj[key], result, newKey);
        } else {
          // Convert arrays and primitives to string for Elasticsearch
          const value = Array.isArray(obj[key])
            ? obj[key].join(', ')
            : obj[key];
          result[newKey] = value;
        }
      }
    }
  }
}
