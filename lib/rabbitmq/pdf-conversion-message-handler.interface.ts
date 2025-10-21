import {
  PdfConversionRequestMessage,
  PdfPartConversionRequestMessage,
  PdfConversionProgressMessage,
  PdfConversionCompletedMessage,
  PdfConversionFailedMessage,
  PdfPartConversionCompletedMessage,
  PdfPartConversionFailedMessage,
  MarkdownStorageRequestMessage,
  MarkdownPartStorageRequestMessage,
} from './message.types';
import { IMessageService } from './message-service.interface';
import { IPdfConversionService } from './pdf-conversion.service.interface';

/**
 * Message handler result
 */
export interface MessageHandlerResult {
  success: boolean;
  shouldAcknowledge: boolean;
  shouldRetry?: boolean;
  retryDelay?: number;
  error?: string;
}

/**
 * PDF Conversion Message Handler interface
 * Handles message processing and communication for PDF conversion
 */
export interface IPdfConversionMessageHandler {
  /**
   * Initialize the message handler
   */
  initialize(): Promise<void>;

  /**
   * Start consuming messages
   */
  startConsuming(): Promise<void>;

  /**
   * Stop consuming messages
   */
  stopConsuming(): Promise<void>;

  /**
   * Handle PDF conversion request message
   */
  handlePdfConversionRequest(
    message: PdfConversionRequestMessage,
    originalMessage: any,
  ): Promise<MessageHandlerResult>;

  /**
   * Handle PDF part conversion request message
   */
  handlePdfPartConversionRequest(
    message: PdfPartConversionRequestMessage,
    originalMessage: any,
  ): Promise<MessageHandlerResult>;

  /**
   * Publish progress message
   */
  publishProgressMessage(
    itemId: string,
    status: string,
    progress: number,
    message: string,
  ): Promise<void>;

  /**
   * Publish conversion completion message
   */
  publishConversionCompletionMessage(
    itemId: string,
    processingTime: number,
  ): Promise<void>;

  /**
   * Publish failure message
   */
  publishFailureMessage(
    itemId: string,
    error: string,
    retryCount: number,
    maxRetries: number,
    processingTime: number,
  ): Promise<void>;

  /**
   * Publish part completion message
   */
  publishPartCompletionMessage(
    itemId: string,
    partIndex: number,
    totalParts: number,
    markdownContent: string,
    processingTime: number,
  ): Promise<void>;

  /**
   * Publish part failure message
   */
  publishPartFailureMessage(
    itemId: string,
    partIndex: number,
    totalParts: number,
    error: string,
    retryCount: number,
    maxRetries: number,
    processingTime: number,
  ): Promise<void>;

  /**
   * Send markdown storage request
   */
  sendMarkdownStorageRequest(
    itemId: string,
    markdownContent: string,
    processingTime: number,
  ): Promise<void>;

  /**
   * Send markdown part storage request
   */
  sendMarkdownPartStorageRequest(
    itemId: string,
    partIndex: number,
    totalParts: number,
    markdownContent: string,
    startPage?: number,
    endPage?: number,
  ): Promise<void>;

  /**
   * Check if the handler is running
   */
  isRunning(): boolean;

  /**
   * Get handler statistics
   */
  getStats(): {
    isRunning: boolean;
    consumerTag: string | null;
    partConsumerTag: string | null;
    messageServiceConnected: boolean;
  };
}