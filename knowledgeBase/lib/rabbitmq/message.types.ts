/**
 * Base interface for all RabbitMQ messages
 */
export interface BaseRabbitMQMessage {
  messageId: string;
  timestamp: number;
  eventType: string;
}

/**
 * PDF processing status enum
 */
export enum PdfProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ANALYZING = 'analyzing',
  SPLITTING = 'splitting',
  MERGING = 'merging',
}

/**
 * PDF part processing status
 */
export enum PdfPartStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * PDF conversion request message
 */
export interface PdfConversionRequestMessage extends BaseRabbitMQMessage {
  eventType: 'PDF_CONVERSION_REQUEST';
  itemId: string;
  s3Url: string;
  s3Key: string;
  fileName: string;
  metadata: {
    title: string;
    authors: Array<{
      firstName: string;
      lastName: string;
      middleName?: string;
    }>;
    tags: string[];
    collections: string[];
  };
  priority?: 'low' | 'normal' | 'high';
  retryCount?: number;
  maxRetries?: number;
}

/**
 * PDF conversion progress message
 */
export interface PdfConversionProgressMessage extends BaseRabbitMQMessage {
  eventType: 'PDF_CONVERSION_PROGRESS';
  itemId: string;
  status: PdfProcessingStatus;
  progress: number; // 0-100
  message?: string;
  error?: string;
  startedAt?: number;
  estimatedCompletion?: number;
}

/**
 * PDF conversion completed message
 */
export interface PdfConversionCompletedMessage extends BaseRabbitMQMessage {
  eventType: 'PDF_CONVERSION_COMPLETED';
  itemId: string;
  status: PdfProcessingStatus.COMPLETED;
  markdownContent: string;
  pageCount?: number;
  processingTime: number; // in milliseconds
  metadata?: {
    extractedTitle?: string;
    extractedAuthors?: Array<{
      firstName: string;
      lastName: string;
      middleName?: string;
    }>;
    language?: string;
  };
}

/**
 * PDF conversion failed message
 */
export interface PdfConversionFailedMessage extends BaseRabbitMQMessage {
  eventType: 'PDF_CONVERSION_FAILED';
  itemId: string;
  status: PdfProcessingStatus.FAILED;
  error: string;
  errorCode?: string;
  retryCount: number;
  maxRetries: number;
  canRetry: boolean;
  processingTime: number; // in milliseconds
}

/**
 * PDF analysis request message
 */
export interface PdfAnalysisRequestMessage extends BaseRabbitMQMessage {
  eventType: 'PDF_ANALYSIS_REQUEST';
  itemId: string;
  s3Url: string;
  s3Key: string;
  fileName: string;
  priority?: 'low' | 'normal' | 'high';
  retryCount?: number;
  maxRetries?: number;
}

/**
 * PDF analysis completed message
 */
export interface PdfAnalysisCompletedMessage extends BaseRabbitMQMessage {
  eventType: 'PDF_ANALYSIS_COMPLETED';
  itemId: string;
  pageCount: number;
  requiresSplitting: boolean;
  suggestedSplitSize?: number;
  processingTime: number;
}

/**
 * PDF analysis failed message
 */
export interface PdfAnalysisFailedMessage extends BaseRabbitMQMessage {
  eventType: 'PDF_ANALYSIS_FAILED';
  itemId: string;
  error: string;
  errorCode?: string;
  retryCount: number;
  maxRetries: number;
  canRetry: boolean;
  processingTime: number;
}

/**
 * PDF splitting request message
 */
export interface PdfSplittingRequestMessage extends BaseRabbitMQMessage {
  eventType: 'PDF_SPLITTING_REQUEST';
  itemId: string;
  s3Url: string;
  s3Key: string;
  fileName: string;
  pageCount: number;
  splitSize: number;
  priority?: 'low' | 'normal' | 'high';
  retryCount?: number;
  maxRetries?: number;
}

/**
 * PDF part conversion request message
 */
export interface PdfPartConversionRequestMessage extends BaseRabbitMQMessage {
  eventType: 'PDF_PART_CONVERSION_REQUEST';
  itemId: string;
  partIndex: number;
  totalParts: number;
  s3Url: string;
  s3Key: string;
  fileName: string;
  startPage: number;
  endPage: number;
  priority?: 'low' | 'normal' | 'high';
  retryCount?: number;
  maxRetries?: number;
}

/**
 * PDF part conversion completed message
 */
export interface PdfPartConversionCompletedMessage extends BaseRabbitMQMessage {
  eventType: 'PDF_PART_CONVERSION_COMPLETED';
  itemId: string;
  partIndex: number;
  totalParts: number;
  markdownContent: string;
  pageCount: number;
  processingTime: number;
}

/**
 * PDF part conversion failed message
 */
export interface PdfPartConversionFailedMessage extends BaseRabbitMQMessage {
  eventType: 'PDF_PART_CONVERSION_FAILED';
  itemId: string;
  partIndex: number;
  totalParts: number;
  error: string;
  errorCode?: string;
  retryCount: number;
  maxRetries: number;
  canRetry: boolean;
  processingTime: number;
}

/**
 * PDF merging request message
 */
export interface PdfMergingRequestMessage extends BaseRabbitMQMessage {
  eventType: 'PDF_MERGING_REQUEST';
  itemId: string;
  totalParts: number;
  completedParts: number[];
  priority?: 'low' | 'normal' | 'high';
  retryCount?: number;
  maxRetries?: number;
}

/**
 * PDF merging progress message
 */
export interface PdfMergingProgressMessage extends BaseRabbitMQMessage {
  eventType: 'PDF_MERGING_PROGRESS';
  itemId: string;
  status: PdfProcessingStatus;
  progress: number; // 0-100
  message?: string;
  error?: string;
  startedAt?: number;
  estimatedCompletion?: number;
  completedParts: number;
  totalParts: number;
}

/**
 * Markdown storage request message
 */
export interface MarkdownStorageRequestMessage extends BaseRabbitMQMessage {
  eventType: 'MARKDOWN_STORAGE_REQUEST';
  itemId: string;
  markdownContent: string;
  metadata?: {
    pageCount?: number;
    extractedTitle?: string;
    extractedAuthors?: Array<{
      firstName: string;
      lastName: string;
      middleName?: string;
    }>;
    language?: string;
    processingTime?: number;
    partIndex?: number;
    isPart?: boolean;
  };
  priority?: 'low' | 'normal' | 'high';
  retryCount?: number;
  maxRetries?: number;
}

/**
 * Markdown storage completed message
 */
export interface MarkdownStorageCompletedMessage extends BaseRabbitMQMessage {
  eventType: 'MARKDOWN_STORAGE_COMPLETED';
  itemId: string;
  status: PdfProcessingStatus.COMPLETED;
  processingTime: number;
}

/**
 * Markdown storage failed message
 */
export interface MarkdownStorageFailedMessage extends BaseRabbitMQMessage {
  eventType: 'MARKDOWN_STORAGE_FAILED';
  itemId: string;
  status: PdfProcessingStatus.FAILED;
  error: string;
  errorCode?: string;
  retryCount: number;
  maxRetries: number;
  canRetry: boolean;
  processingTime: number;
}

/**
 * Union type for all PDF conversion messages
 */
export type PdfConversionMessage =
  | PdfConversionRequestMessage
  | PdfConversionProgressMessage
  | PdfConversionCompletedMessage
  | PdfConversionFailedMessage
  | PdfAnalysisRequestMessage
  | PdfAnalysisCompletedMessage
  | PdfAnalysisFailedMessage
  | PdfSplittingRequestMessage
  | PdfPartConversionRequestMessage
  | PdfPartConversionCompletedMessage
  | PdfPartConversionFailedMessage
  | PdfMergingRequestMessage
  | PdfMergingProgressMessage
  | MarkdownStorageRequestMessage
  | MarkdownStorageCompletedMessage
  | MarkdownStorageFailedMessage;

/**
 * PDF part information
 */
export interface PdfPartInfo {
  partIndex: number;
  startPage: number;
  endPage: number;
  pageCount: number;
  s3Key: string;
  s3Url: string;
  status: PdfPartStatus;
  processingTime?: number;
  error?: string;
}

/**
 * PDF splitting result
 */
export interface PdfSplittingResult {
  itemId: string;
  originalFileName: string;
  totalParts: number;
  parts: PdfPartInfo[];
  processingTime: number;
}

/**
 * RabbitMQ configuration
 */
export interface RabbitMQConfig {
  url: string;
  hostname?: string;
  port?: number;
  username?: string;
  password?: string;
  vhost?: string;
  frameMax?: number;
  heartbeat?: number;
  locale?: string;
}

/**
 * RabbitMQ queue configuration
 */
export interface RabbitMQQueueConfig {
  name: string;
  durable?: boolean;
  exclusive?: boolean;
  autoDelete?: boolean;
  arguments?: Record<string, any>;
}

/**
 * RabbitMQ exchange configuration
 */
export interface RabbitMQExchangeConfig {
  name: string;
  type: 'direct' | 'topic' | 'headers' | 'fanout';
  durable?: boolean;
  autoDelete?: boolean;
  internal?: boolean;
  arguments?: Record<string, any>;
}

/**
 * RabbitMQ message options
 */
export interface RabbitMQMessageOptions {
  persistent?: boolean;
  expiration?: string;
  priority?: number;
  correlationId?: string;
  replyTo?: string;
  headers?: Record<string, any>;
}

/**
 * Queue and exchange names
 */
export const RABBITMQ_QUEUES = {
  PDF_CONVERSION_REQUEST: 'pdf-conversion-request',
  PDF_CONVERSION_PROGRESS: 'pdf-conversion-progress',
  PDF_CONVERSION_COMPLETED: 'pdf-conversion-completed',
  PDF_CONVERSION_FAILED: 'pdf-conversion-failed',
  PDF_ANALYSIS_REQUEST: 'pdf-analysis-request',
  PDF_ANALYSIS_COMPLETED: 'pdf-analysis-completed',
  PDF_ANALYSIS_FAILED: 'pdf-analysis-failed',
  PDF_SPLITTING_REQUEST: 'pdf-splitting-request',
  PDF_SPLITTING_COMPLETED: 'pdf-splitting-completed',
  PDF_PART_CONVERSION_REQUEST: 'pdf-part-conversion-request',
  PDF_PART_CONVERSION_COMPLETED: 'pdf-part-conversion-completed',
  PDF_PART_CONVERSION_FAILED: 'pdf-part-conversion-failed',
  PDF_MERGING_REQUEST: 'pdf-merging-request',
  PDF_MERGING_PROGRESS: 'pdf-merging-progress',
  MARKDOWN_STORAGE_REQUEST: 'markdown-storage-request',
  MARKDOWN_STORAGE_COMPLETED: 'markdown-storage-completed',
  MARKDOWN_STORAGE_FAILED: 'markdown-storage-failed',
  DEAD_LETTER_QUEUE: 'pdf-conversion-dlq',
} as const;

/**
 * Exchange names
 */
export const RABBITMQ_EXCHANGES = {
  PDF_CONVERSION: 'pdf-conversion-exchange',
  DEAD_LETTER: 'pdf-conversion-dlx',
} as const;

/**
 * Routing keys
 */
export const RABBITMQ_ROUTING_KEYS = {
  PDF_CONVERSION_REQUEST: 'pdf.conversion.request',
  PDF_CONVERSION_PROGRESS: 'pdf.conversion.progress',
  PDF_CONVERSION_COMPLETED: 'pdf.conversion.completed',
  PDF_CONVERSION_FAILED: 'pdf.conversion.failed',
  PDF_ANALYSIS_REQUEST: 'pdf.analysis.request',
  PDF_ANALYSIS_COMPLETED: 'pdf.analysis.completed',
  PDF_ANALYSIS_FAILED: 'pdf.analysis.failed',
  PDF_SPLITTING_REQUEST: 'pdf.splitting.request',
  PDF_SPLITTING_COMPLETED: 'pdf.splitting.completed',
  PDF_PART_CONVERSION_REQUEST: 'pdf.part.conversion.request',
  PDF_PART_CONVERSION_COMPLETED: 'pdf.part.conversion.completed',
  PDF_PART_CONVERSION_FAILED: 'pdf.part.conversion.failed',
  PDF_MERGING_REQUEST: 'pdf.merging.request',
  PDF_MERGING_PROGRESS: 'pdf.merging.progress',
  MARKDOWN_STORAGE_REQUEST: 'markdown.storage.request',
  MARKDOWN_STORAGE_COMPLETED: 'markdown.storage.completed',
  MARKDOWN_STORAGE_FAILED: 'markdown.storage.failed',
  DEAD_LETTER: 'pdf.conversion.dlq',
} as const;

/**
 * Consumer tags
 */
export const RABBITMQ_CONSUMER_TAGS = {
  PDF_CONVERSION_WORKER: 'pdf-conversion-worker',
  PDF_CONVERSION_MONITOR: 'pdf-conversion-monitor',
  PDF_ANALYSIS_WORKER: 'pdf-analysis-worker',
  PDF_SPLITTING_WORKER: 'pdf-splitting-worker',
  PDF_PART_CONVERSION_WORKER: 'pdf-part-conversion-worker',
  PDF_MERGING_WORKER: 'pdf-merger-worker',
  MARKDOWN_STORAGE_WORKER: 'markdown-storage-worker',
} as const;


/**
 * PDF processing configuration
 */
export const PDF_PROCESSING_CONFIG = {
  DEFAULT_SPLIT_THRESHOLD: 50, // Split PDFs with more than 50 pages
  DEFAULT_SPLIT_SIZE: 25, // Split into chunks of 25 pages each
  MAX_SPLIT_SIZE: 100, // Maximum pages per part
  MIN_SPLIT_SIZE: 10, // Minimum pages per part
  CONCURRENT_PART_PROCESSING: 3, // Number of parts to process concurrently
} as const;