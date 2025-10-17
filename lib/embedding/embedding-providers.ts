import createLoggerWithPrefix from '../logger';
import axios, { AxiosError } from 'axios';
import { OpenAIModel, AlibabaModel, OnnxModel } from './embedding';

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
            model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
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
    model: AlibabaModel = AlibabaModel.TEXT_EMBEDDING_V3,
  ): Promise<number[] | null> {
    if (!this.apiKey) {
      logger.error('Alibaba API key not configured');
      return null;
    }

    let retries = 0;
    const inputType = Array.isArray(text) ? `array[${text.length}]` : 'string';
    logger.debug(`Starting embed for ${inputType} input`);

    while (retries < this.maxRetries) {
      try {
        logger.debug(
          `Making API call (attempt ${retries + 1}) for ${inputType} input`,
        );
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

        logger.debug(`API response structure for ${inputType} input:`, {
          hasOutput: !!response.data.output,
          hasData: !!response.data.data,
          outputKeys: response.data.output
            ? Object.keys(response.data.output)
            : [],
          dataKeys: response.data.data ? Object.keys(response.data.data) : [],
        });

        // Handle both response structures consistently
        let embedding: number[] | null = null;

        if (response.data.output && response.data.output.embeddings) {
          // Batch-style response structure
          if (Array.isArray(text)) {
            // For array input, return first embedding only to maintain consistent return type
            embedding =
              (response.data.output.embeddings[0]?.embedding as number[]) ||
              null;
          } else {
            // For single text input, get the first embedding
            embedding =
              (response.data.output.embeddings[0]?.embedding as number[]) ||
              null;
          }
        } else if (response.data.data && response.data.data.length > 0) {
          // Single-style response structure
          embedding = response.data.data[0].embedding as number[];
        }

        if (!embedding) {
          logger.error(`No embedding found in response for ${inputType} input`);
          return null;
        }

        logger.debug(
          `Returning embedding for ${inputType} input: ${embedding.length} dimensions`,
        );
        return embedding;
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

            logger.error(
              `Bad request (400) - check input parameters for ${inputInfo}`,
            );
            // Don't retry on 400 errors
            return null;
          } else {
            logger.warn(
              `Request failed (status: ${status || error.code}). Retrying in ${Math.round(delay)}ms... (Attempt ${retries}/${this.maxRetries})`,
            );
          }
        } else {
          logger.error('Error fetching Alibaba embedding:', error);
        }

        if (retries >= this.maxRetries) {
          logger.error(
            `Max retries (${this.maxRetries}) exceeded for ${inputType} input`,
          );
          return null;
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    logger.error(
      `Max retries (${this.maxRetries}) exceeded for ${inputType} input`,
    );
    return null;
  }

  async embedBatch(
    texts: string[],
    concurrencyLimit: number = CONCURRENCY_LIMIT,
  ): Promise<(number[] | null)[]> {
    logger.info(
      `Starting embedBatch with ${texts.length} texts, concurrency limit: ${concurrencyLimit}`,
    );
    const results: (number[] | null)[] = new Array(texts.length).fill(null);
    const MAX_BATCH_SIZE = 10; // Alibaba API limit

    // Process texts in batches of MAX_BATCH_SIZE
    for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
      const batch = texts.slice(i, i + MAX_BATCH_SIZE);
      const batchStartIndex = i;

      logger.info(
        `Processing batch ${Math.floor(i / MAX_BATCH_SIZE) + 1}: ${batch.length} texts, starting at index ${batchStartIndex}`,
      );

      try {
        const batchResults = await this.processBatchWithRetry(batch);
        logger.info(
          `Successfully processed batch with ${batchResults.length} embeddings`,
        );

        // Copy batch results to the main results array
        for (let j = 0; j < batchResults.length; j++) {
          results[batchStartIndex + j] = batchResults[j];
        }
      } catch (error) {
        logger.error(
          `Error in batch embedding for batch starting at index ${batchStartIndex}:`,
          error,
        );
        logger.info(
          `Falling back to individual processing for batch of ${batch.length} texts`,
        );

        // Fallback to individual processing for this batch
        await this.processBatchIndividually(
          batch,
          batchStartIndex,
          results,
          concurrencyLimit,
        );
      }
    }

    logger.info(
      `embedBatch completed. Results: ${results.filter((r) => r !== null).length} successful, ${results.filter((r) => r === null).length} failed`,
    );
    return results;
  }

  private async processBatchWithRetry(
    batch: string[],
  ): Promise<(number[] | null)[]> {
    let retries = 0;

    while (retries < this.maxRetries) {
      try {
        logger.debug(
          `Making batch API call (attempt ${retries + 1}) for ${batch.length} texts`,
        );
        const response = await axios.post(
          'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings',
          {
            model: AlibabaModel.TEXT_EMBEDDING_V3,
            input: batch,
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

        logger.debug(`Batch API response structure:`, {
          hasOutput: !!response.data.output,
          hasData: !!response.data.data,
          outputKeys: response.data.output
            ? Object.keys(response.data.output)
            : [],
          dataKeys: response.data.data ? Object.keys(response.data.data) : [],
        });

        // Handle both response structures consistently
        let batchResults: (number[] | null)[] = [];

        if (response.data.output && response.data.output.embeddings) {
          // Batch-style response structure
          batchResults = response.data.output.embeddings.map(
            (item: any) => (item.embedding as number[]) || null,
          );
        } else if (response.data.data && response.data.data.length > 0) {
          // Single-style response structure (unlikely for batch but handle it)
          batchResults = response.data.data.map(
            (item: any) => (item.embedding as number[]) || null,
          );
        }

        if (batchResults.length === 0) {
          throw new Error('No embeddings found in batch response');
        }

        return batchResults;
      } catch (error) {
        retries++;
        const jitter = Math.random() * 0.2 + 0.9; // Random between 0.9-1.1
        const delay = Math.pow(2, retries) * this.retryDelayBase * jitter;

        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          if (status === 400) {
            logger.error(`Bad request (400) - check batch input parameters`);
            throw error; // Don't retry on 400 errors
          } else {
            logger.warn(
              `Batch request failed (status: ${status || error.code}). Retrying in ${Math.round(delay)}ms... (Attempt ${retries}/${this.maxRetries})`,
            );
          }
        } else {
          logger.error('Error in batch embedding:', error);
        }

        if (retries >= this.maxRetries) {
          logger.error(
            `Max retries (${this.maxRetries}) exceeded for batch request`,
          );
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error(
      `Max retries (${this.maxRetries}) exceeded for batch request`,
    );
  }

  private async processBatchIndividually(
    batch: string[],
    batchStartIndex: number,
    results: (number[] | null)[],
    concurrencyLimit: number,
  ): Promise<void> {
    const processingQueue: Promise<void>[] = [];
    const completedPromises = new Set<Promise<void>>();

    for (let j = 0; j < batch.length; j++) {
      const processItem = async (batchIndex: number, globalIndex: number) => {
        try {
          results[globalIndex] = await this.embed(batch[batchIndex]);
          logger.debug(
            `Successfully processed individual text at index ${globalIndex}`,
          );
        } catch (error) {
          logger.error(`Error embedding text at index ${globalIndex}:`, error);
          results[globalIndex] = null;
        }
      };

      const promise = processItem(j, batchStartIndex + j);
      processingQueue.push(promise);

      // If we've reached the concurrency limit, wait for some to complete
      if (processingQueue.length >= concurrencyLimit) {
        await Promise.race(processingQueue);

        // Remove completed promises from the queue
        await Promise.allSettled(processingQueue);
        const stillPending = processingQueue.filter(
          (p) => !completedPromises.has(p),
        );
        processingQueue.length = 0;
        processingQueue.push(...stillPending);

        logger.debug(
          `Removed completed promises, queue size: ${processingQueue.length}`,
        );
      }
    }

    // Wait for all remaining promises to complete
    logger.debug(
      `Waiting for ${processingQueue.length} remaining promises to complete`,
    );
    await Promise.all(processingQueue);
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
