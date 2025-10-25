import {
  ConversionResult,
  MinerUPdfConvertor,
} from '@aikb/pdf-converter';
import { IPdfPartTracker } from './pdf-part-tracker.js';
import { MarkdownPartCache } from './markdown-part-cache.js';

/**
 * PDF conversion request parameters
 */
export interface PdfConversionRequest {
  itemId: string;
  s3Key: string;
  pdfMetadata?: any;
  retryCount?: number;
  maxRetries?: number;
}

/**
 * PDF part conversion request parameters
 */
export interface PdfPartConversionRequest {
  itemId: string;
  s3Key: string;
  partIndex: number;
  totalParts: number;
  startPage?: number;
  endPage?: number;
  pdfMetadata?: any;
  retryCount?: number;
  maxRetries?: number;
}

/**
 * PDF conversion result
 */
export interface PdfConversionResult {
  success: boolean;
  markdownContent: string;
  processingTime: number;
  error?: string;
}

/**
 * PDF part conversion result
 */
export interface PdfPartConversionResult {
  success: boolean;
  markdownContent: string;
  processingTime: number;
  partIndex: number;
  totalParts: number;
  error?: string;
}

/**
 * Progress update callback
 */
export type ProgressCallback = (
  itemId: string,
  status: string,
  progress: number,
  message: string,
) => Promise<void>;

/**
 * PDF Conversion Service interface
 * Handles the core PDF conversion functionality
 */
export interface IPdfConversionService {
  /**
   * Initialize the service
   */
  initialize(): Promise<void>;

  /**
   * Convert a PDF file to Markdown
   */
  convertPdfToMarkdown(
    request: PdfConversionRequest,
    onProgress?: ProgressCallback,
  ): Promise<PdfConversionResult>;

  /**
   * Convert a part of a PDF file to Markdown
   */
  convertPdfPartToMarkdown(
    request: PdfPartConversionRequest,
    onProgress?: ProgressCallback,
  ): Promise<PdfPartConversionResult>;

  /**
   * Check if the service is ready
   */
  isReady(): boolean;

  /**
   * Get service statistics
   */
  getStats(): {
    isReady: boolean;
    pdfConvertorAvailable: boolean;
  };
}