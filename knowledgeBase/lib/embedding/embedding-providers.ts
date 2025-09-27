import createLoggerWithPrefix from '../logger';
import axios, { AxiosError } from 'axios';

const logger = createLoggerWithPrefix('EmbeddingProviders');

// Configuration
const MAX_RETRIES = parseInt(process.env.EMBEDDING_MAX_RETRIES || '100');
const RETRY_DELAY_BASE = parseInt(
  process.env.EMBEDDING_RETRY_DELAY_BASE || '1000',
);
const CONCURRENCY_LIMIT = parseInt(
  process.env.EMBEDDING_CONCURRENCY_LIMIT || '5',
);

/**
 * Abstract base class for embedding providers
 */
export abstract class EmbeddingProviderBase {
  abstract embed(text: string | string[]): Promise<number[] | null>;
  abstract embedBatch(
    texts: string[],
    concurrencyLimit?: number,
  ): Promise<(number[] | null)[]>;
}

/**
 * OpenAI embedding provider implementation
 */
export class OpenAIEmbeddingProvider extends EmbeddingProviderBase {
  private apiKey: string;
  private apiBase: string;
  private maxRetries: number;
  private retryDelayBase: number;

  constructor(
    apiKey: string,
    apiBase: string,
    maxRetries: number = MAX_RETRIES,
    retryDelayBase: number = RETRY_DELAY_BASE,
  ) {
    super();
    this.apiKey = apiKey;
    this.apiBase = apiBase;
    this.maxRetries = maxRetries;
    this.retryDelayBase = retryDelayBase;
  }

  async embed(text: string | string[]): Promise<number[] | null> {
    if (Array.isArray(text)) {
      logger.error(
        'OpenAI embedding does not support array input in this implementation.',
      );
      return null;
    }

    if (!this.apiKey || !this.apiBase) {
      logger.error('OpenAI API credentials not configured');
      return null;
    }

    let retries = 0;
    while (true) {
      try {
        const response = await axios.post(
          `${this.apiBase}embeddings`,
          {
            model: 'text-embedding-ada-002',
            input: text,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.apiKey}`,
            },
            timeout: 10000, // 10 second timeout
          },
        );
        return response.data.data[0].embedding;
      } catch (error) {
        retries++;
        const jitter = Math.random() * 0.2 + 0.9; // Random between 0.9-1.1
        const delay = Math.pow(2, retries) * this.retryDelayBase * jitter;

        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          if (status === 400) {
            logger.error(
              `Bad request (400) - check input parameters: ${JSON.stringify(error.response?.data)}`,
            );
          } else {
            logger.warn(
              `Request failed (status: ${status || error.code}). Retrying in ${Math.round(delay)}ms... (Attempt ${retries})`,
            );
          }
        } else {
          logger.error('Error fetching OpenAI embedding:', error);
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  async embedBatch(
    texts: string[],
    concurrencyLimit: number = CONCURRENCY_LIMIT,
  ): Promise<(number[] | null)[]> {
    const results: (number[] | null)[] = new Array(texts.length).fill(null);
    const processingQueue: Promise<void>[] = [];

    for (let i = 0; i < texts.length; i++) {
      const processItem = async (index: number) => {
        try {
          results[index] = await this.embed(texts[index]);
        } catch (error) {
          logger.error(`Error embedding text at index ${index}:`, error);
          results[index] = null;
        }
      };

      const promise = processItem(i);
      processingQueue.push(promise);

      // If we've reached the concurrency limit, wait for some to complete
      if (processingQueue.length >= concurrencyLimit) {
        await Promise.race(processingQueue);
        // Remove completed promises from the queue
        processingQueue.splice(
          0,
          processingQueue.findIndex((p) => p === promise) + 1,
        );
      }
    }

    // Wait for all remaining promises to complete
    await Promise.all(processingQueue);

    return results;
  }
}

/**
 * Alibaba embedding provider implementation
 */
export class AlibabaEmbeddingProvider extends EmbeddingProviderBase {
  private apiKey: string;
  private maxRetries: number;
  private retryDelayBase: number;

  constructor(
    apiKey: string,
    maxRetries: number = MAX_RETRIES,
    retryDelayBase: number = RETRY_DELAY_BASE,
  ) {
    super();
    this.apiKey = apiKey;
    this.maxRetries = maxRetries;
    this.retryDelayBase = retryDelayBase;
  }

  async embed(
    text: string | string[],
    model: string = 'text-embedding-v3',
  ): Promise<number[] | null> {
    if (!this.apiKey) {
      logger.error('Alibaba API key not configured');
      return null;
    }

    let retries = 0;

    while (true) {
      try {
        const response = await axios.post(
          'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings',
          {
            model: model,
            input: text,
            dimension: '1024',
            encoding_format: 'float',
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.apiKey}`,
            },
            timeout: 10000, // 10 second timeout
          },
        );

        if (Array.isArray(text)) {
          // For array input, return first embedding only to maintain consistent return type
          return (
            (response.data.output.embeddings[0]?.embedding as number[]) || null
          );
        }
        return response.data.data[0].embedding as number[];
      } catch (error) {
        retries++;
        const jitter = Math.random() * 0.2 + 0.9; // Random between 0.9-1.1
        const delay = Math.pow(2, retries) * this.retryDelayBase * jitter;

        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          if (status === 400) {
            let inputInfo: string;
            if (Array.isArray(text)) {
              inputInfo = `Array[${text.length}]`;
            } else if (typeof text === 'string') {
              inputInfo =
                text.length > 100 ? `${text.substring(0, 100)}...` : text;
            } else {
              inputInfo = 'Unknown input type';
            }

            logger.error(`Bad request (400) - check input parameters`);
          } else {
            logger.warn(
              `Request failed (status: ${status || error.code}). Retrying in ${Math.round(delay)}ms... (Attempt ${retries})`,
            );
          }
        } else {
          logger.error('Error fetching Alibaba embedding:', error);
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  async embedBatch(
    texts: string[],
    concurrencyLimit: number = CONCURRENCY_LIMIT,
  ): Promise<(number[] | null)[]> {
    try {
      const response = await axios.post(
        'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings',
        {
          model: 'text-embedding-v3',
          input: texts,
          dimension: '1024',
          encoding_format: 'float',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 30000, // 30 second timeout for batch requests
        },
      );

      return response.data.output.embeddings.map(
        (item: any) => (item.embedding as number[]) || null,
      );
    } catch (error) {
      logger.error('Error in batch embedding:', error);

      // Fallback to individual processing
      const results: (number[] | null)[] = new Array(texts.length).fill(null);
      const processingQueue: Promise<void>[] = [];

      for (let i = 0; i < texts.length; i++) {
        const processItem = async (index: number) => {
          try {
            results[index] = await this.embed(texts[index]);
          } catch (error) {
            logger.error(`Error embedding text at index ${index}:`, error);
            results[index] = null;
          }
        };

        const promise = processItem(i);
        processingQueue.push(promise);

        // If we've reached the concurrency limit, wait for some to complete
        if (processingQueue.length >= concurrencyLimit) {
          await Promise.race(processingQueue);
          // Remove completed promises from the queue
          processingQueue.splice(
            0,
            processingQueue.findIndex((p) => p === promise) + 1,
          );
        }
      }

      // Wait for all remaining promises to complete
      await Promise.all(processingQueue);

      return results;
    }
  }
}

/**
 * ONNX embedding provider implementation (placeholder)
 */
export class ONNXEmbeddingProvider extends EmbeddingProviderBase {
  // private onnxEmbedder: ONNXEmbedder;

  constructor() {
    super();
    // Initialize ONNX embedder
    // this.onnxEmbedder = new ONNXEmbedder();
    // this.onnxEmbedder.init().catch(err => {
    //   logger.error('Failed to initialize ONNX embedder:', err);
    // });
  }

  async embed(text: string | string[]): Promise<number[] | null> {
    if (Array.isArray(text)) {
      logger.error(
        'ONNX embedding does not support array input in this implementation.',
      );
      return null;
    }

    try {
      // const embedding = await this.onnxEmbedder.embedDocument(text);
      // return Array.from(embedding);
      logger.error('ONNX embedding not implemented yet');
      return null;
    } catch (error) {
      logger.error('Error generating ONNX embedding:', error);
      return null;
    }
  }

  async embedBatch(
    texts: string[],
    concurrencyLimit: number = CONCURRENCY_LIMIT,
  ): Promise<(number[] | null)[]> {
    const results: (number[] | null)[] = new Array(texts.length).fill(null);
    const processingQueue: Promise<void>[] = [];

    for (let i = 0; i < texts.length; i++) {
      const processItem = async (index: number) => {
        try {
          results[index] = await this.embed(texts[index]);
        } catch (error) {
          logger.error(`Error embedding text at index ${index}:`, error);
          results[index] = null;
        }
      };

      const promise = processItem(i);
      processingQueue.push(promise);

      // If we've reached the concurrency limit, wait for some to complete
      if (processingQueue.length >= concurrencyLimit) {
        await Promise.race(processingQueue);
        // Remove completed promises from the queue
        processingQueue.splice(
          0,
          processingQueue.findIndex((p) => p === promise) + 1,
        );
      }
    }

    // Wait for all remaining promises to complete
    await Promise.all(processingQueue);

    return results;
  }
}
