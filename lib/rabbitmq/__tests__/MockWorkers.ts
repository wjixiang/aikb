import { vi } from 'vitest';
import { getMockRabbitMQService } from '../__mocks__/MockRabbitMQService';
import { AbstractLibraryStorage } from '../../../knowledgeBase/knowledgeImport/library';
import { PdfProcessingStatus } from '../message.types';

/**
 * Mock PDF Analysis Worker
 */
export class MockPdfAnalysisWorker {
  private isRunningValue = false;
  private consumerTag: string | null = null;
  private storage: AbstractLibraryStorage;

  constructor(storage: AbstractLibraryStorage) {
    this.storage = storage;
  }

  async start(): Promise<void> {
    console.log('[MockPdfAnalysisWorker] Starting...');
    this.isRunningValue = true;
    this.consumerTag = 'mock-pdf-analysis-worker-' + Date.now();

    // Simulate worker startup delay
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log('[MockPdfAnalysisWorker] Started successfully');
  }

  async stop(): Promise<void> {
    console.log('[MockPdfAnalysisWorker] Stopping...');
    this.isRunningValue = false;
    this.consumerTag = null;
    console.log('[MockPdfAnalysisWorker] Stopped successfully');
  }

  isWorkerRunning(): boolean {
    return this.isRunningValue;
  }

  async getWorkerStats(): Promise<any> {
    return {
      isRunning: this.isRunningValue,
      consumerTag: this.consumerTag,
      rabbitMQConnected: true,
    };
  }

  /**
   * Simulate PDF analysis process
   */
  async simulatePdfAnalysis(itemId: string): Promise<void> {
    console.log(
      `[MockPdfAnalysisWorker] Simulating PDF analysis for item: ${itemId}`,
    );

    // Update status to processing
    await this.updateItemStatus(
      itemId,
      PdfProcessingStatus.PROCESSING,
      'Analyzing PDF structure...',
    );

    // Simulate analysis delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Update status to completed
    await this.updateItemStatus(
      itemId,
      PdfProcessingStatus.PROCESSING,
      'PDF analysis completed',
    );

    // Publish analysis completed message
    const mockRabbitMQService = getMockRabbitMQService();
    await mockRabbitMQService.publishPdfAnalysisCompleted({
      messageId: 'mock-analysis-completed-' + Date.now(),
      timestamp: Date.now(),
      eventType: 'PDF_ANALYSIS_COMPLETED',
      itemId,
      pageCount: 10,
      requiresSplitting: false,
      processingTime: 1000,
      pdfMetadata: {
        pageCount: 10,
        fileSize: 1024000,
        title: 'Test PDF Document',
        author: 'Test Author',
      },
    });
  }

  private async updateItemStatus(
    itemId: string,
    status: PdfProcessingStatus,
    message: string,
  ): Promise<void> {
    try {
      const metadata = await this.storage.getMetadata(itemId);
      if (metadata) {
        await this.storage.updateMetadata({
          ...metadata,
          pdfProcessingStatus: status,
          pdfProcessingMessage: message,
          dateModified: new Date(),
        });
      }
    } catch (error) {
      console.error(
        `[MockPdfAnalysisWorker] Failed to update status for item ${itemId}:`,
        error,
      );
    }
  }
}

/**
 * Mock PDF Processing Coordinator Worker
 */
export class MockPdfProcessingCoordinatorWorker {
  private isRunningValue = false;
  private analysisConsumerTag: string | null = null;
  private storage: AbstractLibraryStorage;

  constructor(storage: AbstractLibraryStorage) {
    this.storage = storage;
  }

  async start(): Promise<void> {
    console.log('[MockPdfProcessingCoordinatorWorker] Starting...');
    this.isRunningValue = true;
    this.analysisConsumerTag = 'mock-pdf-coordinator-worker-' + Date.now();

    // Simulate worker startup delay
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log('[MockPdfProcessingCoordinatorWorker] Started successfully');
  }

  async stop(): Promise<void> {
    console.log('[MockPdfProcessingCoordinatorWorker] Stopping...');
    this.isRunningValue = false;
    this.analysisConsumerTag = null;
    console.log('[MockPdfProcessingCoordinatorWorker] Stopped successfully');
  }

  isWorkerRunning(): boolean {
    return this.isRunningValue;
  }

  async getWorkerStats(): Promise<any> {
    return {
      isRunning: this.isRunningValue,
      analysisConsumerTag: this.analysisConsumerTag,
      rabbitMQConnected: true,
    };
  }

  /**
   * Simulate handling analysis completed event
   */
  async simulateAnalysisCompleted(itemId: string): Promise<void> {
    console.log(
      `[MockPdfProcessingCoordinatorWorker] Simulating analysis completed for item: ${itemId}`,
    );

    // Update status to processing
    await this.updateItemStatus(
      itemId,
      PdfProcessingStatus.PROCESSING,
      'Starting PDF conversion...',
    );

    // Publish conversion request
    const mockRabbitMQService = getMockRabbitMQService();
    await mockRabbitMQService.publishPdfConversionRequest({
      messageId: 'mock-conversion-request-' + Date.now(),
      timestamp: Date.now(),
      eventType: 'PDF_CONVERSION_REQUEST',
      itemId,
      s3Key: `mock/pdfs/${itemId}.pdf`,
      fileName: `${itemId}.pdf`,
      metadata: {
        title: 'Test PDF Document',
        authors: [{ firstName: 'Test', lastName: 'Author' }],
        tags: ['test'],
        collections: [],
      },
      priority: 'normal',
      retryCount: 0,
      maxRetries: 3,
      pdfMetadata: {
        pageCount: 10,
        fileSize: 1024000,
        title: 'Test PDF Document',
        author: 'Test Author',
      },
    });
  }

  private async updateItemStatus(
    itemId: string,
    status: PdfProcessingStatus,
    message: string,
  ): Promise<void> {
    try {
      const metadata = await this.storage.getMetadata(itemId);
      if (metadata) {
        await this.storage.updateMetadata({
          ...metadata,
          pdfProcessingStatus: status,
          pdfProcessingMessage: message,
          dateModified: new Date(),
        });
      }
    } catch (error) {
      console.error(
        `[MockPdfProcessingCoordinatorWorker] Failed to update status for item ${itemId}:`,
        error,
      );
    }
  }
}

/**
 * Mock PDF Conversion Worker
 */
export class MockPdfConversionWorker {
  private isRunningValue = false;
  private consumerTag: string | null = null;
  private partConsumerTag: string | null = null;

  async start(): Promise<void> {
    console.log('[MockPdfConversionWorker] Starting...');
    this.isRunningValue = true;
    this.consumerTag = 'mock-pdf-conversion-worker-' + Date.now();
    this.partConsumerTag = 'mock-pdf-part-conversion-worker-' + Date.now();

    // Simulate worker startup delay
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log('[MockPdfConversionWorker] Started successfully');
  }

  async stop(): Promise<void> {
    console.log('[MockPdfConversionWorker] Stopping...');
    this.isRunningValue = false;
    this.consumerTag = null;
    this.partConsumerTag = null;
    console.log('[MockPdfConversionWorker] Stopped successfully');
  }

  isWorkerRunning(): boolean {
    return this.isRunningValue;
  }

  async getWorkerStats(): Promise<any> {
    return {
      isRunning: this.isRunningValue,
      consumerTag: this.consumerTag,
      partConsumerTag: this.partConsumerTag,
      rabbitMQConnected: true,
    };
  }

  /**
   * Simulate PDF conversion process
   */
  async simulatePdfConversion(itemId: string): Promise<void> {
    console.log(
      `[MockPdfConversionWorker] Simulating PDF conversion for item: ${itemId}`,
    );

    // Update status to processing
    await this.updateItemStatus(
      itemId,
      PdfProcessingStatus.PROCESSING,
      'Converting PDF to markdown...',
      30,
    );

    // Simulate conversion delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Update status to almost complete
    await this.updateItemStatus(
      itemId,
      PdfProcessingStatus.PROCESSING,
      'Finalizing conversion...',
      80,
    );

    // Generate mock markdown content
    const mockMarkdownContent = this.generateMockMarkdownContent(itemId);

    // Send markdown storage request
    const mockRabbitMQService = getMockRabbitMQService();
    await mockRabbitMQService.publishMarkdownStorageRequest({
      messageId: 'mock-markdown-storage-request-' + Date.now(),
      timestamp: Date.now(),
      eventType: 'MARKDOWN_STORAGE_REQUEST',
      itemId,
      markdownContent: mockMarkdownContent,
      priority: 'normal',
      retryCount: 0,
      maxRetries: 3,
    });

    // Publish conversion completion message
    await mockRabbitMQService.publishPdfConversionCompleted({
      messageId: 'mock-conversion-completed-' + Date.now(),
      timestamp: Date.now(),
      eventType: 'PDF_CONVERSION_COMPLETED',
      itemId,
      status: PdfProcessingStatus.COMPLETED,
      processingTime: 2000,
    });
  }

  private generateMockMarkdownContent(itemId: string): string {
    return `# Test Document: ${itemId}

## Introduction
This is a test document generated for testing the PDF processing workflow.

## Content
This document contains information about viral pneumonia, which is a respiratory infection caused by viruses.

## Key Points
- Viral pneumonia affects the lungs
- It can be caused by various viruses including influenza virus
- Symptoms include fever, cough, and difficulty breathing
- Treatment depends on the specific virus causing the infection

## Conclusion
This test document demonstrates the PDF to markdown conversion capability of the system.

*Generated by MockPdfConversionWorker for testing purposes*`;
  }

  private async updateItemStatus(
    itemId: string,
    status: PdfProcessingStatus,
    message: string,
    progress?: number,
  ): Promise<void> {
    try {
      const mockRabbitMQService = getMockRabbitMQService();
      await mockRabbitMQService.publishPdfConversionProgress({
        messageId: 'mock-progress-' + Date.now(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_PROGRESS',
        itemId,
        status,
        progress: progress || 0,
        message,
      });
    } catch (error) {
      console.error(
        `[MockPdfConversionWorker] Failed to publish progress for item ${itemId}:`,
        error,
      );
    }
  }
}

/**
 * Mock Markdown Storage Worker
 */
export class MockMarkdownStorageWorker {
  private isRunningValue = false;
  private consumerTag: string | null = null;
  private storage: AbstractLibraryStorage;

  constructor(storage: AbstractLibraryStorage) {
    this.storage = storage;
  }

  async start(): Promise<void> {
    console.log('[MockMarkdownStorageWorker] Starting...');
    this.isRunningValue = true;
    this.consumerTag = 'mock-markdown-storage-worker-' + Date.now();

    // Simulate worker startup delay
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log('[MockMarkdownStorageWorker] Started successfully');
  }

  async stop(): Promise<void> {
    console.log('[MockMarkdownStorageWorker] Stopping...');
    this.isRunningValue = false;
    this.consumerTag = null;
    console.log('[MockMarkdownStorageWorker] Stopped successfully');
  }

  isWorkerRunning(): boolean {
    return this.isRunningValue;
  }

  async getWorkerStats(): Promise<any> {
    return {
      isRunning: this.isRunningValue,
      consumerTag: this.consumerTag,
      rabbitMQConnected: true,
    };
  }

  /**
   * Simulate markdown storage process
   */
  async simulateMarkdownStorage(
    itemId: string,
    markdownContent: string,
  ): Promise<void> {
    console.log(
      `[MockMarkdownStorageWorker] Simulating markdown storage for item: ${itemId}`,
    );

    // Update status to processing
    await this.updateItemStatus(
      itemId,
      PdfProcessingStatus.PROCESSING,
      'Storing markdown content...',
    );

    // Save markdown content
    await this.storage.saveMarkdown(itemId, markdownContent);

    // Update status to completed
    await this.updateItemStatus(
      itemId,
      PdfProcessingStatus.COMPLETED,
      'PDF processing completed successfully',
      100,
    );

    // Publish completion message
    const mockRabbitMQService = getMockRabbitMQService();
    await mockRabbitMQService.publishMarkdownStorageCompleted({
      messageId: 'mock-storage-completed-' + Date.now(),
      timestamp: Date.now(),
      eventType: 'MARKDOWN_STORAGE_COMPLETED',
      itemId,
      status: PdfProcessingStatus.COMPLETED,
      processingTime: 500,
    });
  }

  private async updateItemStatus(
    itemId: string,
    status: PdfProcessingStatus,
    message: string,
    progress?: number,
  ): Promise<void> {
    try {
      const metadata = await this.storage.getMetadata(itemId);
      if (metadata) {
        await this.storage.updateMetadata({
          ...metadata,
          pdfProcessingStatus: status,
          pdfProcessingMessage: message,
          pdfProcessingProgress: progress,
          pdfProcessingCompletedAt:
            status === PdfProcessingStatus.COMPLETED ? new Date() : undefined,
          dateModified: new Date(),
        });
      }
    } catch (error) {
      console.error(
        `[MockMarkdownStorageWorker] Failed to update status for item ${itemId}:`,
        error,
      );
    }
  }
}

// Mock worker creation functions

export async function createPdfAnalysisWorker(
  storage: AbstractLibraryStorage,
): Promise<MockPdfAnalysisWorker> {
  const worker = new MockPdfAnalysisWorker(storage);
  await worker.start();
  return worker;
}

export async function createPdfProcessingCoordinatorWorker(
  storage: AbstractLibraryStorage,
): Promise<MockPdfProcessingCoordinatorWorker> {
  const worker = new MockPdfProcessingCoordinatorWorker(storage);
  await worker.start();
  return worker;
}

export async function createPdfConversionWorker(): Promise<MockPdfConversionWorker> {
  const worker = new MockPdfConversionWorker();
  await worker.start();
  return worker;
}

export async function startMarkdownStorageWorker(
  storage: AbstractLibraryStorage,
): Promise<MockMarkdownStorageWorker> {
  const worker = new MockMarkdownStorageWorker(storage);
  await worker.start();
  return worker;
}

/**
 * Simulate the complete PDF processing workflow for testing
 */
export async function simulateCompletePdfProcessingWorkflow(
  itemId: string,
  storage: AbstractLibraryStorage,
): Promise<void> {
  console.log(
    `[MockWorkflow] Starting complete PDF processing workflow for item: ${itemId}`,
  );

  const mockRabbitMQService = getMockRabbitMQService();

  // Step 1: PDF Analysis
  const analysisWorker = new MockPdfAnalysisWorker(storage);
  await analysisWorker.start();
  await analysisWorker.simulatePdfAnalysis(itemId);

  // Wait a bit for analysis to complete
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Step 2: PDF Processing Coordinator
  const coordinatorWorker = new MockPdfProcessingCoordinatorWorker(storage);
  await coordinatorWorker.start();
  await coordinatorWorker.simulateAnalysisCompleted(itemId);

  // Wait a bit for coordination to complete
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Step 3: PDF Conversion
  const conversionWorker = new MockPdfConversionWorker();
  await conversionWorker.start();
  await conversionWorker.simulatePdfConversion(itemId);

  // Wait a bit for conversion to complete
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Step 4: Markdown Storage
  const markdownContent = `# Test Document: ${itemId}

This is a test document generated for testing the PDF processing workflow.

## Content about viral_pneumonia

Viral pneumonia is an infection of the lungs caused by various viruses. It is a common illness that can affect people of all ages, but it can be particularly severe in young children, older adults, and people with weakened immune systems.

## Symptoms

Common symptoms of viral pneumonia include:
- Fever
- Cough
- Shortness of breath
- Fatigue
- Muscle aches
- Headache

## Treatment

Treatment for viral pneumonia depends on the specific virus causing the infection. In many cases, rest, fluids, and over-the-counter medications can help manage symptoms.

## Conclusion

This test document demonstrates the complete PDF processing workflow from analysis to storage.

*Generated by MockPdfConversionWorker for testing purposes*`;

  const storageWorker = new MockMarkdownStorageWorker(storage);
  await storageWorker.start();
  await storageWorker.simulateMarkdownStorage(itemId, markdownContent);

  console.log(
    `[MockWorkflow] Complete PDF processing workflow finished for item: ${itemId}`,
  );
}
