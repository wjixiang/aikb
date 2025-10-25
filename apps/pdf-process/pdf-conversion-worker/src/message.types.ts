/**
 * Base RabbitMQ message interface
 */
export interface BaseRabbitMQMessage {
  messageId: string;
  timestamp: number;
  eventType: string;
}

/**
 * PDF conversion request message
 */
export interface PdfConversionRequestMessage extends BaseRabbitMQMessage {
  eventType: 'PDF_CONVERSION_REQUEST';
  itemId: string;
  s3Key: string;
  pdfMetadata?: any;
  priority?: 'high' | 'normal' | 'low';
  retryCount?: number;
  maxRetries?: number;
}

/**
 * PDF part conversion request message
 */
export interface PdfPartConversionRequestMessage extends BaseRabbitMQMessage {
  eventType: 'PDF_PART_CONVERSION_REQUEST';
  itemId: string;
  s3Key: string;
  partIndex: number;
  totalParts: number;
  startPage?: number;
  endPage?: number;
  pdfMetadata?: any;
  priority?: 'high' | 'normal' | 'low';
  retryCount?: number;
  maxRetries?: number;
}

/**
 * PDF conversion progress message
 */
export interface PdfConversionProgressMessage extends BaseRabbitMQMessage {
  eventType: 'PDF_CONVERSION_PROGRESS';
  itemId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  startedAt?: number;
}

/**
 * PDF conversion completed message
 */
export interface PdfConversionCompletedMessage extends BaseRabbitMQMessage {
  eventType: 'PDF_CONVERSION_COMPLETED';
  itemId: string;
  status: 'completed';
  processingTime?: number;
}

/**
 * PDF conversion failed message
 */
export interface PdfConversionFailedMessage extends BaseRabbitMQMessage {
  eventType: 'PDF_CONVERSION_FAILED';
  itemId: string;
  status: 'failed';
  error: string;
  retryCount: number;
  maxRetries: number;
  canRetry: boolean;
  processingTime?: number;
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
  pageCount?: number;
  processingTime?: number;
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
  retryCount: number;
  maxRetries: number;
  canRetry: boolean;
  processingTime?: number;
}

/**
 * Markdown storage request message
 */
export interface MarkdownStorageRequestMessage extends BaseRabbitMQMessage {
  eventType: 'MARKDOWN_STORAGE_REQUEST';
  itemId: string;
  markdownContent: string;
  metadata?: any;
  priority?: 'high' | 'normal' | 'low';
  retryCount?: number;
  maxRetries?: number;
}

/**
 * Markdown part storage request message
 */
export interface MarkdownPartStorageRequestMessage extends BaseRabbitMQMessage {
  eventType: 'MARKDOWN_PART_STORAGE_REQUEST';
  itemId: string;
  partIndex: number;
  totalParts: number;
  markdownContent: string;
  metadata?: any;
  priority?: 'high' | 'normal' | 'low';
  retryCount?: number;
  maxRetries?: number;
}

/**
 * RabbitMQ queue names
 */
export const RABBITMQ_QUEUES = {
  PDF_CONVERSION_REQUEST: 'pdf-conversion-request',
  PDF_PART_CONVERSION_REQUEST: 'pdf-part-conversion-request',
  PDF_CONVERSION_PROGRESS: 'pdf-conversion-progress',
  PDF_CONVERSION_COMPLETED: 'pdf-conversion-completed',
  PDF_CONVERSION_FAILED: 'pdf-conversion-failed',
  PDF_PART_CONVERSION_COMPLETED: 'pdf-part-conversion-completed',
  PDF_PART_CONVERSION_FAILED: 'pdf-part-conversion-failed',
  MARKDOWN_STORAGE_REQUEST: 'markdown-storage-request',
  MARKDOWN_PART_STORAGE_REQUEST: 'markdown-part-storage-request',
} as const;

/**
 * RabbitMQ consumer tags
 */
export const RABBITMQ_CONSUMER_TAGS = {
  PDF_CONVERSION_WORKER: 'pdf-conversion-worker',
  PDF_PART_CONVERSION_WORKER: 'pdf-part-conversion-worker',
} as const;

/**
 * PDF processing status
 */
export type PdfProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';