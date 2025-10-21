import { vi } from 'vitest';
import { PdfProcessingStatus } from '../../../lib/rabbitmq/message.types';
import { v4 as uuidv4 } from 'uuid';

// Mock RabbitMQ Service
export const createMockRabbitMQService = () => {
  const mockPublishPdfAnalysisRequest = vi.fn();
  const mockInitialize = vi.fn();
  const mockClose = vi.fn();
  const mockPurgeQueue = vi.fn();

  return {
    initialize: mockInitialize,
    close: mockClose,
    isConnected: vi.fn(() => true),
    publishPdfAnalysisRequest: mockPublishPdfAnalysisRequest,
    publishPdfConversionRequest: vi.fn(),
    publishPdfPartConversionRequest: vi.fn(),
    purgeQueue: mockPurgeQueue,
    consumeMessages: vi.fn(),
    stopConsuming: vi.fn(),
    getQueueInfo: vi.fn(),
    healthCheck: vi.fn(),
  };
};

// Mock PDF Analyzer Service
export const createMockPdfAnalyzerService = () => {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    getWorkerStats: vi.fn(() => ({
      isRunning: true,
      consumerTag: 'mock-analyzer-tag',
    })),
  };
};

// Mock PDF Conversion Worker
export const createMockPdfConversionWorker = () => {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    getWorkerStats: vi.fn(() => ({
      isRunning: true,
      consumerTag: 'mock-conversion-tag',
      partConsumerTag: 'mock-part-conversion-tag',
      pdfConvertorAvailable: true,
    })),
  };
};

// Mock PDF Merger Service
export const createMockPdfMergerService = () => {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    getWorkerStats: vi.fn(() => ({
      isRunning: true,
      consumerTag: 'mock-merger-tag',
    })),
  };
};

// Mock S3 Service
export const createMockS3Service = () => {
  return {
    uploadToS3: vi.fn(),
    uploadPdfFromPath: vi.fn(),
    getSignedUploadUrl: vi.fn(),
    getSignedUrlForDownload: vi.fn(),
    deleteFromS3: vi.fn(),
    getPdfDownloadUrl: vi.fn((s3Key: string) => {
      return Promise.resolve(`https://mock-bucket.s3.amazonaws.com/${s3Key}`);
    }),
  };
};

// Mock processing status tracker
export const createMockProcessingTracker = () => {
  const statusMap = new Map<string, any>();

  return {
    setProcessingStatus: (itemId: string, status: any) => {
      statusMap.set(itemId, status);
    },
    getProcessingStatus: (itemId: string) => {
      return (
        statusMap.get(itemId) || {
          status: PdfProcessingStatus.PENDING,
          progress: 0,
          message: 'Processing started',
        }
      );
    },
    updateProcessingStatus: (itemId: string, updates: any) => {
      const current = statusMap.get(itemId) || {
        status: PdfProcessingStatus.PENDING,
      };
      statusMap.set(itemId, { ...current, ...updates });
    },
    completeProcessing: (itemId: string, markdownContent?: string) => {
      statusMap.set(itemId, {
        status: PdfProcessingStatus.COMPLETED,
        progress: 100,
        message: 'Processing completed',
        markdownContent,
        completedAt: new Date(),
      });
    },
    failProcessing: (itemId: string, error: string) => {
      statusMap.set(itemId, {
        status: PdfProcessingStatus.FAILED,
        progress: 0,
        message: 'Processing failed',
        error,
        completedAt: new Date(),
      });
    },
    clear: () => {
      statusMap.clear();
    },
  };
};

// Mock PDF conversion results
export const createMockPdfConversionResult = (
  success: boolean = true,
  markdown?: string,
) => {
  return {
    success,
    data:
      markdown || '# Mock PDF Content\n\nThis is mock PDF content for testing.',
    taskId: uuidv4(),
    downloadedFiles: [],
  };
};

// Mock PDF analysis result
export const createMockPdfAnalysisResult = (pageCount: number = 10) => {
  return {
    pageCount,
    fileSize: 1024 * 1024, // 1MB
    title: 'Mock PDF Title',
    author: 'Mock Author',
    requiresSplitting: pageCount > 50,
    suggestedSplitSize: 25,
  };
};

// Helper to simulate async processing
export const simulateAsyncProcessing = async (
  tracker: any,
  itemId: string,
  delay: number = 1000,
  success: boolean = true,
  markdown?: string,
) => {
  // Set initial status
  tracker.setProcessingStatus(itemId, {
    status: PdfProcessingStatus.PROCESSING,
    progress: 0,
    message: 'Starting processing',
  });

  // Simulate progress updates
  for (let i = 0; i <= 100; i += 20) {
    await new Promise((resolve) => setTimeout(resolve, delay / 5));
    tracker.updateProcessingStatus(itemId, {
      progress: i,
      message: `Processing... ${i}%`,
    });
  }

  // Complete or fail
  if (success) {
    tracker.completeProcessing(itemId, markdown);
  } else {
    tracker.failProcessing(itemId, 'Mock processing error');
  }
};

// Helper to automatically process requests
export const setupAutoProcessing = (mockTracker: any) => {
  const processRequest = async (message: any) => {
    const { itemId, s3Key, fileName } = message;

    // Check if this is an invalid PDF
    const isInvalidPdf =
      fileName.includes('invalid') || s3Key.includes('invalid');
    if (isInvalidPdf) {
      await simulateAsyncProcessing(
        mockTracker,
        itemId,
        500,
        false, // Fail for invalid PDFs
        undefined,
      );
      return;
    }

    // Simulate different processing based on file size
    const isLargePdf =
      s3Key.includes('large') ||
      fileName.includes('large') ||
      fileName.includes('workflow');
    const delay = isLargePdf ? 1500 : 800;

    // Simulate processing
    await simulateAsyncProcessing(
      mockTracker,
      itemId,
      delay,
      true, // Succeed for valid PDFs
      isLargePdf
        ? '# Large PDF Content\n\nThis is mock content for a large PDF file that would normally be split.'
        : '# Small PDF Content\n\nThis is mock content for a small PDF file.',
    );
  };

  return processRequest;
};
