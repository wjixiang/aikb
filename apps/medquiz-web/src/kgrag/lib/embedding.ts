import { createLoggerWithPrefix } from '@/lib/console/logger';
import axios, { AxiosError } from 'axios';
// import { ONNXEmbedder } from './embedding/ONNXEmbedder';

const logger = createLoggerWithPrefix('Embedding');

// Configuration
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY;
const EMBEDDING_API_BASE = process.env.EMBEDDING_API_BASE;
const ALIBABA_API_KEY = process.env.ALIBABA_API_KEY;
const MAX_RETRIES = parseInt(process.env.EMBEDDING_MAX_RETRIES || '100');
const RETRY_DELAY_BASE = parseInt(
  process.env.EMBEDDING_RETRY_DELAY_BASE || '1000',
);
const CONCURRENCY_LIMIT = parseInt(
  process.env.EMBEDDING_CONCURRENCY_LIMIT || '5',
);

// Embedding provider types

/**
 * - 'openai'
 * - 'alibaba':
 * - 'onnx': Local embedding
 */
type EmbeddingProvider = 'openai' | 'alibaba' | 'onnx';

// Current active provider (configurable)
let activeProvider: EmbeddingProvider = 'alibaba'; // Default to ONNX
// const onnxEmbedder = new ONNXEmbedder();

// Initialize ONNX embedder
// onnxEmbedder.init().catch(err => {
//   logger.error('Failed to initialize ONNX embedder:', err);
// });

/**
 * Set the active embedding provider
 * @param provider One of: 'openai', 'alibaba', 'onnx'
 */
export function setEmbeddingProvider(provider: EmbeddingProvider): void {
  activeProvider = provider;
}

async function getOpenAIEmbedding(text: string): Promise<number[] | null> {
  if (!EMBEDDING_API_KEY || !EMBEDDING_API_BASE) {
    logger.error('OpenAI API credentials not configured');
    return null;
  }

  let retries = 0;
  while (true) {
    // Infinite retries
    try {
      const response = await axios.post(
        `${EMBEDDING_API_BASE}embeddings`,
        {
          model: 'text-embedding-ada-002',
          input: text,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${EMBEDDING_API_KEY}`,
          },
          timeout: 10000, // 10 second timeout
        },
      );
      return response.data.data[0].embedding;
    } catch (error) {
      retries++;
      const jitter = Math.random() * 0.2 + 0.9; // Random between 0.9-1.1
      const delay = Math.pow(2, retries) * RETRY_DELAY_BASE * jitter;

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

async function getAlibabaEmbedding(
  text: string | string[],
  model: string = 'text-embedding-v3',
): Promise<number[] | null> {
  if (!ALIBABA_API_KEY) {
    logger.error('Alibaba API key not configured');
    return null;
  }

  let retries = 0;

  while (true) {
    // Infinite retries
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
            Authorization: `Bearer ${ALIBABA_API_KEY}`,
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
      const delay = Math.pow(2, retries) * RETRY_DELAY_BASE * jitter;

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

// async function getONNXEmbedding(text: string): Promise<number[] | null> {
//   try {
//     const embedding = await onnxEmbedder.embedDocument(text);
//     return Array.from(embedding);
//   } catch (error) {
//     logger.error('Error generating ONNX embedding:', error);
//     return null;
//   }
// }

export async function embedding(
  text: string | string[],
  provider: EmbeddingProvider = activeProvider,
): Promise<number[] | null> {
  switch (activeProvider) {
    case 'openai':
      if (Array.isArray(text)) {
        logger.error(
          'OpenAI embedding does not support array input in this implementation.',
        );
        return null;
      }
      return getOpenAIEmbedding(text);
    case 'alibaba':
      return getAlibabaEmbedding(text);
    // case 'onnx':
    //   if (Array.isArray(text)) {
    //      logger.error('ONNX embedding does not support array input in this implementation.');
    //      return null;
    //   }
    //   return getONNXEmbedding(text);
    default:
      logger.error('Unknown embedding provider:', provider);
      return null;
  }
}
