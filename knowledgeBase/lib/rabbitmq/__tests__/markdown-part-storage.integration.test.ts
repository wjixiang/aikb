import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MarkdownPartStorageWorker } from '../markdown-part-storage.worker';
import { PdfMergerService } from '../pdf-merger.service';
import { MarkdownPartCache } from '../markdown-part-cache';
import { MongoDBMarkdownPartCache } from '../markdown-part-cache-mongodb';
import { PdfPartTrackerImpl } from '../pdf-part-tracker-impl';
import { IPdfPartTracker } from '../pdf-part-tracker';
import {
  MarkdownPartStorageRequestMessage,
  MarkdownPartStorageProgressMessage,
  MarkdownPartStorageCompletedMessage,
  MarkdownPartStorageFailedMessage,
  PdfMergingRequestMessage,
  PdfProcessingStatus,
  PdfPartStatus,
} from '../message.types';
import { getRabbitMQService } from '../rabbitmq.service';
import { AbstractLibraryStorage } from '../../../knowledgeImport/library';
import { v4 as uuidv4 } from 'uuid';

// Mock RabbitMQ service
const mockRabbitMQService = {
  isConnected: vi.fn(() => true),
  initialize: vi.fn(() => Promise.resolve()),
  publishMarkdownPartStorageProgress: vi.fn(() => Promise.resolve(true)),
  publishMarkdownPartStorageCompleted: vi.fn(() => Promise.resolve(true)),
  publishMarkdownPartStorageFailed: vi.fn(() => Promise.resolve(true)),
  publishMarkdownPartStorageRequest: vi.fn(() => Promise.resolve(true)),
  publishPdfMergingRequest: vi.fn(() => Promise.resolve(true)),
  consumeMessages: vi.fn(() => Promise.resolve('test-consumer-tag')),
  stopConsuming: vi.fn(() => Promise.resolve()),
  close: vi.fn(() => Promise.resolve()),
};

vi.mock('../rabbitmq.service', () => ({
  getRabbitMQService: vi.fn(() => mockRabbitMQService),
}));

// Mock storage
const mockStorage = {
  getMetadata: vi.fn(),
  updateMetadata: vi.fn(),
  saveMarkdown: vi.fn(),
  getMarkdown: vi.fn(),
  getChunksByItemId: vi.fn(),
  saveCitation: vi.fn(),
  deleteMetadata: vi.fn(),
  ensureIndexes: vi.fn(),
  uploadPdf: vi.fn(),
  uploadPdfFromPath: vi.fn(),
  getPdfDownloadUrl: vi.fn(),
  getPdf: vi.fn(),
  getMetadataByHash: vi.fn(),
  searchMetadata: vi.fn(),
  saveCollection: vi.fn(),
  getCollections: vi.fn(),
  addItemToCollection: vi.fn(),
  removeItemFromCollection: vi.fn(),
  clear: vi.fn(),
} as unknown as AbstractLibraryStorage;

describe('Markdown Part Storage Integration Tests', () => {
  let markdownCache: MarkdownPartCache;
  let partTracker: IPdfPartTracker;
  let storageWorker: MarkdownPartStorageWorker;
  let mergerService: PdfMergerService;
  let testItemId: string;

  // Test data
  const testParts = [
    {
      partIndex: 0,
      content: '# Introduction\n\nThis is the introduction part of the document.',
    },
    {
      partIndex: 1,
      content: '# Chapter 1\n\nThis is the first chapter with detailed content.',
    },
    {
      partIndex: 2,
      content: '# Chapter 2\n\nThis is the second chapter with more information.',
    },
    {
      partIndex: 3,
      content: '# Conclusion\n\nThis is the conclusion of the document.',
    },
  ];

  beforeEach(async () => {
    // Generate unique test item ID
    testItemId = `test-item-${uuidv4()}`;

    // Initialize markdown cache
    markdownCache = new MongoDBMarkdownPartCache();
    await markdownCache.initialize();

    // Initialize part tracker
    partTracker = new PdfPartTrackerImpl();
    await partTracker.initializePdfProcessing(testItemId, testParts.length);

    // Initialize storage worker
    storageWorker = new MarkdownPartStorageWorker(markdownCache, partTracker);
    await storageWorker.start();

    // Initialize merger service
    mergerService = new PdfMergerService(mockStorage, markdownCache);
    await mergerService.start();

    // Reset mock call history
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test data
    try {
      if (markdownCache) {
        await markdownCache.cleanup(testItemId);
      }
      if (partTracker) {
        await partTracker.cleanupPdfProcessing(testItemId);
      }
      if (storageWorker) {
        await storageWorker.stop();
      }
      if (mergerService) {
        await mergerService.stop();
      }
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  });

  describe('Normal PDF part conversion and storage flow', () => {
    it('should process all parts successfully and trigger merging', async () => {
      // Process each part
      for (const part of testParts) {
        const requestMessage: MarkdownPartStorageRequestMessage = {
          messageId: uuidv4(),
          timestamp: Date.now(),
          eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
          itemId: testItemId,
          partIndex: part.partIndex,
          totalParts: testParts.length,
          markdownContent: part.content,
          priority: 'normal',
        };

        // Simulate message handling by the worker
        await (storageWorker as any).handleMarkdownPartStorageRequest(requestMessage, null);

        // Verify progress message was published
        expect(mockRabbitMQService.publishMarkdownPartStorageProgress).toHaveBeenCalled();

        // Verify completion message was published
        expect(mockRabbitMQService.publishMarkdownPartStorageCompleted).toHaveBeenCalledWith(
          expect.objectContaining({
            itemId: testItemId,
            partIndex: part.partIndex,
            totalParts: testParts.length,
            status: PdfProcessingStatus.COMPLETED,
          })
        );

        // Verify part was stored in cache
        const storedContent = await markdownCache.getPartMarkdown(testItemId, part.partIndex);
        expect(storedContent).toBe(part.content);

        // Verify part status is completed
        const partStatus = await markdownCache.getPartStatus(testItemId, part.partIndex);
        expect(partStatus).toBe('completed');
      }

      // Verify all parts are stored
      const allParts = await markdownCache.getAllParts(testItemId);
      expect(allParts).toHaveLength(testParts.length);

      // Verify merging request was published (should happen after last part)
      expect(mockRabbitMQService.publishPdfMergingRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          totalParts: testParts.length,
          completedParts: [0, 1, 2, 3],
        })
      );

      // Verify merged content is available
      const mergedContent = await markdownCache.mergeAllParts(testItemId);
      expect(mergedContent).toContain('# Introduction');
      expect(mergedContent).toContain('# Chapter 1');
      expect(mergedContent).toContain('# Chapter 2');
      expect(mergedContent).toContain('# Conclusion');
    });

    it('should handle parts in random order and still merge correctly', async () => {
      // Process parts in random order
      const shuffledParts = [...testParts].sort(() => Math.random() - 0.5);

      for (const part of shuffledParts) {
        const requestMessage: MarkdownPartStorageRequestMessage = {
          messageId: uuidv4(),
          timestamp: Date.now(),
          eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
          itemId: testItemId,
          partIndex: part.partIndex,
          totalParts: testParts.length,
          markdownContent: part.content,
          priority: 'normal',
        };

        await (storageWorker as any).handleMarkdownPartStorageRequest(requestMessage, null);
      }

      // Verify all parts are stored
      const allParts = await markdownCache.getAllParts(testItemId);
      expect(allParts).toHaveLength(testParts.length);

      // Verify merged content is in correct order
      const mergedContent = await markdownCache.mergeAllParts(testItemId);
      const lines = mergedContent.split('\n');
      
      // Check that parts are in correct order (0, 1, 2, 3)
      const introIndex = lines.findIndex(line => line.includes('# Introduction'));
      const chapter1Index = lines.findIndex(line => line.includes('# Chapter 1'));
      const chapter2Index = lines.findIndex(line => line.includes('# Chapter 2'));
      const conclusionIndex = lines.findIndex(line => line.includes('# Conclusion'));
      
      expect(introIndex).toBeLessThan(chapter1Index);
      expect(chapter1Index).toBeLessThan(chapter2Index);
      expect(chapter2Index).toBeLessThan(conclusionIndex);
    });
  });

  describe('Retry mechanism for failed part conversion', () => {
    it('should retry failed parts up to max retries', async () => {
      const failingPartIndex = 1;
      const maxRetries = 3;

      // Process successful parts first
      for (const part of testParts) {
        if (part.partIndex === failingPartIndex) continue;

        const requestMessage: MarkdownPartStorageRequestMessage = {
          messageId: uuidv4(),
          timestamp: Date.now(),
          eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
          itemId: testItemId,
          partIndex: part.partIndex,
          totalParts: testParts.length,
          markdownContent: part.content,
          priority: 'normal',
        };

        await (storageWorker as any).handleMarkdownPartStorageRequest(requestMessage, null);
      }

      // Process failing part with empty content (should fail)
      const failingRequestMessage: MarkdownPartStorageRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
        itemId: testItemId,
        partIndex: failingPartIndex,
        totalParts: testParts.length,
        markdownContent: '', // Empty content should cause failure
        priority: 'normal',
        retryCount: 0,
        maxRetries,
      };

      await (storageWorker as any).handleMarkdownPartStorageRequest(failingRequestMessage, null);

      // Verify failure message was published
      expect(mockRabbitMQService.publishMarkdownPartStorageFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          partIndex: failingPartIndex,
          totalParts: testParts.length,
          status: PdfProcessingStatus.FAILED,
          retryCount: 1,
          maxRetries,
        })
      );

      // Verify retry request was published
      expect(mockRabbitMQService.publishMarkdownPartStorageRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          partIndex: failingPartIndex,
          retryCount: 1,
        })
      );

      // Simulate retry attempts
      for (let retry = 2; retry <= maxRetries; retry++) {
        const retryRequestMessage: MarkdownPartStorageRequestMessage = {
          ...failingRequestMessage,
          messageId: uuidv4(),
          timestamp: Date.now(),
          retryCount: retry,
        };

        await (storageWorker as any).handleMarkdownPartStorageRequest(retryRequestMessage, null);

        if (retry < maxRetries) {
          // Should retry again
          expect(mockRabbitMQService.publishMarkdownPartStorageRequest).toHaveBeenCalledWith(
            expect.objectContaining({
              itemId: testItemId,
              partIndex: failingPartIndex,
              retryCount: retry + 1,
            })
          );
        } else {
          // Final failure - should not retry anymore
          expect(mockRabbitMQService.publishMarkdownPartStorageFailed).toHaveBeenCalledWith(
            expect.objectContaining({
              itemId: testItemId,
              partIndex: failingPartIndex,
              retryCount: maxRetries,
              canRetry: false,
            })
          );
        }
      }
    });

    it('should succeed on retry after initial failure', async () => {
      const failingPartIndex = 1;
      const maxRetries = 3;

      // First attempt - fail with empty content
      const failingRequestMessage: MarkdownPartStorageRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
        itemId: testItemId,
        partIndex: failingPartIndex,
        totalParts: testParts.length,
        markdownContent: '', // Empty content should cause failure
        priority: 'normal',
        retryCount: 0,
        maxRetries,
      };

      await (storageWorker as any).handleMarkdownPartStorageRequest(failingRequestMessage, null);

      // Verify failure and retry request
      expect(mockRabbitMQService.publishMarkdownPartStorageFailed).toHaveBeenCalled();
      expect(mockRabbitMQService.publishMarkdownPartStorageRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          partIndex: failingPartIndex,
          retryCount: 1,
        })
      );

      // Second attempt - succeed with valid content
      const retryRequestMessage: MarkdownPartStorageRequestMessage = {
        ...failingRequestMessage,
        messageId: uuidv4(),
        timestamp: Date.now(),
        retryCount: 1,
        markdownContent: testParts[failingPartIndex].content, // Valid content now
      };

      await (storageWorker as any).handleMarkdownPartStorageRequest(retryRequestMessage, null);

      // Verify success
      expect(mockRabbitMQService.publishMarkdownPartStorageCompleted).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          partIndex: failingPartIndex,
          status: PdfProcessingStatus.COMPLETED,
        })
      );

      // Verify part was stored
      const storedContent = await markdownCache.getPartMarkdown(testItemId, failingPartIndex);
      expect(storedContent).toBe(testParts[failingPartIndex].content);
    });
  });

  describe('Automatic merging after all parts complete', () => {
    it('should trigger merging only when all parts are completed', async () => {
      // Process first 3 parts
      for (let i = 0; i < 3; i++) {
        const requestMessage: MarkdownPartStorageRequestMessage = {
          messageId: uuidv4(),
          timestamp: Date.now(),
          eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
          itemId: testItemId,
          partIndex: testParts[i].partIndex,
          totalParts: testParts.length,
          markdownContent: testParts[i].content,
          priority: 'normal',
        };

        await (storageWorker as any).handleMarkdownPartStorageRequest(requestMessage, null);
      }

      // Merging should not be triggered yet
      expect(mockRabbitMQService.publishPdfMergingRequest).not.toHaveBeenCalled();

      // Process the last part
      const lastPartMessage: MarkdownPartStorageRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
        itemId: testItemId,
        partIndex: testParts[3].partIndex,
        totalParts: testParts.length,
        markdownContent: testParts[3].content,
        priority: 'normal',
      };

      await (storageWorker as any).handleMarkdownPartStorageRequest(lastPartMessage, null);

      // Now merging should be triggered
      expect(mockRabbitMQService.publishPdfMergingRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          totalParts: testParts.length,
          completedParts: [0, 1, 2, 3],
        })
      );
    });

    it('should not trigger merging if some parts failed', async () => {
      // Process 3 successful parts
      for (let i = 0; i < 3; i++) {
        const requestMessage: MarkdownPartStorageRequestMessage = {
          messageId: uuidv4(),
          timestamp: Date.now(),
          eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
          itemId: testItemId,
          partIndex: testParts[i].partIndex,
          totalParts: testParts.length,
          markdownContent: testParts[i].content,
          priority: 'normal',
        };

        await (storageWorker as any).handleMarkdownPartStorageRequest(requestMessage, null);
      }

      // Process last part with empty content (should fail)
      const failingPartMessage: MarkdownPartStorageRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
        itemId: testItemId,
        partIndex: testParts[3].partIndex,
        totalParts: testParts.length,
        markdownContent: '', // Empty content should cause failure
        priority: 'normal',
        maxRetries: 1, // Only try once to fail quickly
      };

      await (storageWorker as any).handleMarkdownPartStorageRequest(failingPartMessage, null);

      // Merging should not be triggered
      expect(mockRabbitMQService.publishPdfMergingRequest).not.toHaveBeenCalled();

      // Verify part status is failed
      const partStatus = await markdownCache.getPartStatus(testItemId, testParts[3].partIndex);
      expect(partStatus).toBe('failed');
    });
  });

  describe('Concurrent processing of multiple PDF parts', () => {
    it('should handle concurrent processing of multiple parts', async () => {
      // Process all parts concurrently
      const processingPromises = testParts.map(async (part) => {
        const requestMessage: MarkdownPartStorageRequestMessage = {
          messageId: uuidv4(),
          timestamp: Date.now(),
          eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
          itemId: testItemId,
          partIndex: part.partIndex,
          totalParts: testParts.length,
          markdownContent: part.content,
          priority: 'normal',
        };

        return (storageWorker as any).handleMarkdownPartStorageRequest(requestMessage, null);
      });

      // Wait for all parts to complete
      await Promise.all(processingPromises);

      // Verify all parts were stored
      const allParts = await markdownCache.getAllParts(testItemId);
      expect(allParts).toHaveLength(testParts.length);

      // Verify merging was triggered
      expect(mockRabbitMQService.publishPdfMergingRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          totalParts: testParts.length,
          completedParts: [0, 1, 2, 3],
        })
      );

      // Verify merged content is correct
      const mergedContent = await markdownCache.mergeAllParts(testItemId);
      expect(mergedContent).toContain('# Introduction');
      expect(mergedContent).toContain('# Chapter 1');
      expect(mergedContent).toContain('# Chapter 2');
      expect(mergedContent).toContain('# Conclusion');
    });

    it('should handle concurrent processing with some failures', async () => {
      // Process all parts concurrently, with one failing
      const processingPromises = testParts.map(async (part, index) => {
        const requestMessage: MarkdownPartStorageRequestMessage = {
          messageId: uuidv4(),
          timestamp: Date.now(),
          eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
          itemId: testItemId,
          partIndex: part.partIndex,
          totalParts: testParts.length,
          markdownContent: index === 2 ? '' : part.content, // Part 2 fails
          priority: 'normal',
          maxRetries: 3, // Allow more retries
        };

        return (storageWorker as any).handleMarkdownPartStorageRequest(requestMessage, null);
      });

      // Wait for all parts to complete or fail
      await Promise.allSettled(processingPromises);
      
      // Add a longer delay to ensure all async operations have completed
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify parts were stored successfully (excluding failed parts)
      const allParts = await markdownCache.getAllParts(testItemId);
      const successfulParts = allParts.filter(part => part.status !== 'failed');
      console.log(allParts)
      // Check that at least parts 0, 1, and 3 are successful (part 2 should fail)
      const successfulPartIndices = successfulParts.map(part => part.partIndex);
      expect(successfulPartIndices).toContain(0);
      expect(successfulPartIndices).toContain(1);
      expect(successfulPartIndices).toContain(3);
      expect(successfulPartIndices).not.toContain(2);

      // Verify part 2 status is failed
      const part2Status = await markdownCache.getPartStatus(testItemId, 2);
      expect(part2Status).toBe('failed');

      // Merging should not be triggered
      expect(mockRabbitMQService.publishPdfMergingRequest).not.toHaveBeenCalled();
    });
  });

  describe('Error handling and recovery', () => {
    it('should handle cache errors gracefully', async () => {
      // Mock cache to throw error
      const originalStorePart = markdownCache.storePartMarkdown;
      markdownCache.storePartMarkdown = vi.fn().mockRejectedValue(new Error('Cache error'));

      const requestMessage: MarkdownPartStorageRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
        itemId: testItemId,
        partIndex: 0,
        totalParts: testParts.length,
        markdownContent: testParts[0].content,
        priority: 'normal',
      };

      await (storageWorker as any).handleMarkdownPartStorageRequest(requestMessage, null);

      // Verify failure message was published
      expect(mockRabbitMQService.publishMarkdownPartStorageFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          partIndex: 0,
          status: PdfProcessingStatus.FAILED,
          error: expect.stringContaining('Cache error'),
        })
      );

      // Restore original method
      markdownCache.storePartMarkdown = originalStorePart;
    });

    it('should handle tracker errors gracefully', async () => {
      // Mock tracker to throw error
      const originalUpdateStatus = partTracker.updatePartStatus;
      partTracker.updatePartStatus = vi.fn().mockRejectedValue(new Error('Tracker error'));

      const requestMessage: MarkdownPartStorageRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
        itemId: testItemId,
        partIndex: 0,
        totalParts: testParts.length,
        markdownContent: testParts[0].content,
        priority: 'normal',
      };

      await (storageWorker as any).handleMarkdownPartStorageRequest(requestMessage, null);

      // Verify part was still stored in cache
      const storedContent = await markdownCache.getPartMarkdown(testItemId, 0);
      expect(storedContent).toBe(testParts[0].content);

      // Restore original method
      partTracker.updatePartStatus = originalUpdateStatus;
    });

    it('should handle RabbitMQ publish errors gracefully', async () => {
      // Mock RabbitMQ to throw error
      mockRabbitMQService.publishMarkdownPartStorageProgress.mockRejectedValueOnce(
        new Error('RabbitMQ error')
      );

      const requestMessage: MarkdownPartStorageRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
        itemId: testItemId,
        partIndex: 0,
        totalParts: testParts.length,
        markdownContent: testParts[0].content,
        priority: 'normal',
      };

      // Should not throw error
      await expect(
        (storageWorker as any).handleMarkdownPartStorageRequest(requestMessage, null)
      ).resolves.not.toThrow();

      // Verify part was still stored
      const storedContent = await markdownCache.getPartMarkdown(testItemId, 0);
      expect(storedContent).toBe(testParts[0].content);
    });
  });

  describe('Merger service integration', () => {
    it('should merge parts when requested', async () => {
      // First, store all parts
      for (const part of testParts) {
        await markdownCache.storePartMarkdown(testItemId, part.partIndex, part.content);
        await markdownCache.updatePartStatus(testItemId, part.partIndex, 'completed');
      }

      // Mock storage methods
      (mockStorage.getMetadata as any).mockResolvedValue({
        id: testItemId,
        title: 'Test Document',
        pdfProcessingStatus: PdfProcessingStatus.PROCESSING,
      });

      (mockStorage.saveMarkdown as any).mockResolvedValue(undefined);

      const mergingRequest: PdfMergingRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_MERGING_REQUEST',
        itemId: testItemId,
        totalParts: testParts.length,
        completedParts: [0, 1, 2, 3],
        priority: 'normal',
      };

      // Handle merging request
      await (mergerService as any).handlePdfMergingRequest(mergingRequest, null);

      // Verify markdown was saved to storage
      expect(mockStorage.saveMarkdown).toHaveBeenCalledWith(
        testItemId,
        expect.stringContaining('# Introduction')
      );

      // Verify status was updated
      expect(mockStorage.updateMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          pdfProcessingStatus: PdfProcessingStatus.COMPLETED,
          pdfProcessingProgress: 100,
        })
      );
    });

    it('should handle merging when parts are not in cache', async () => {
      // Mock storage to return metadata but no markdown in cache
      (mockStorage.getMetadata as any).mockResolvedValue({
        id: testItemId,
        title: 'Test Document',
        pdfProcessingStatus: PdfProcessingStatus.PROCESSING,
      });

      (mockStorage.getMarkdown as any).mockResolvedValue(
        '--- PART 0 ---\n# Introduction\n\nThis is the introduction.\n\n--- PART 1 ---\n# Chapter 1\n\nThis is chapter 1.'
      );

      (mockStorage.saveMarkdown as any).mockResolvedValue(undefined);

      const mergingRequest: PdfMergingRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_MERGING_REQUEST',
        itemId: testItemId,
        totalParts: 2,
        completedParts: [0, 1],
        priority: 'normal',
      };

      // Handle merging request
      await (mergerService as any).handlePdfMergingRequest(mergingRequest, null);

      // Verify markdown was saved to storage
      expect(mockStorage.saveMarkdown).toHaveBeenCalledWith(
        testItemId,
        expect.stringContaining('# Merged PDF Document')
      );

      // Verify status was updated
      expect(mockStorage.updateMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          pdfProcessingStatus: PdfProcessingStatus.COMPLETED,
          pdfProcessingProgress: 100,
        })
      );
    });
  });
});