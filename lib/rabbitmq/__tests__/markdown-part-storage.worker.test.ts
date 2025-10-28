import { MarkdownPartStorageWorker } from '../markdown-part-storage.worker';
import { MarkdownPartStorageRequestMessage } from '../message.types';
import { RabbitMQService } from '../rabbitmq.service';
import { MongoDBMarkdownPartCache } from '../markdown-part-cache-mongodb';
import { PdfPartTrackerImpl } from '../pdf-part-tracker-impl';
import { MarkdownPartCache } from '../markdown-part-cache';
import { IPdfPartTracker } from '../pdf-part-tracker';
import { PdfProcessingStatusInfo } from '../pdf-part-tracker';

vi.mock('../../../lib/logger', () => ({
  default: vi.fn(() => ({
    debug: vi.fn(console.log),
    info: vi.fn(console.log),
    warn: vi.fn(console.log),
    error: vi.fn(console.log),
  })),
}));

// Mock RabbitMQ service
vi.mock('../rabbitmq.service', () => ({
  getRabbitMQService: vi.fn(() => ({
    isConnected: vi.fn(() => true),
    initialize: vi.fn(() => Promise.resolve()),
    publishMessage: vi.fn(() => Promise.resolve(true)),
    publishMarkdownPartStorageProgress: vi.fn(() => Promise.resolve(true)),
    publishMarkdownPartStorageCompleted: vi.fn(() => Promise.resolve(true)),
    publishMarkdownPartStorageFailed: vi.fn(() => Promise.resolve(true)),
    publishPdfMergingRequest: vi.fn(() => Promise.resolve(true)),
    consumeMessages: vi.fn(() => Promise.resolve('mock-consumer-tag')),
    stopConsuming: vi.fn(() => Promise.resolve()),
  })),
}));

// Mock Markdown Part Cache
class MockMarkdownPartCache extends MarkdownPartCache {
  private parts: Map<string, Map<number, { content: string; status: string }>> =
    new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async storePartMarkdown(
    itemId: string,
    partIndex: number,
    markdownContent: string,
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }
    if (!this.parts.has(itemId)) {
      this.parts.set(itemId, new Map());
    }
    this.parts
      .get(itemId)!
      .set(partIndex, { content: markdownContent, status: 'completed' });
  }

  async getPartMarkdown(
    itemId: string,
    partIndex: number,
  ): Promise<string | null> {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }
    const itemParts = this.parts.get(itemId);
    return itemParts?.get(partIndex)?.content || null;
  }

  async getAllParts(
    itemId: string,
  ): Promise<Array<{ partIndex: number; content: string; status?: string }>> {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }
    const itemParts = this.parts.get(itemId);
    if (!itemParts) {
      return [];
    }
    return Array.from(itemParts.entries()).map(([partIndex, data]) => ({
      partIndex,
      content: data.content,
      status: data.status,
    }));
  }

  async updatePartStatus(
    itemId: string,
    partIndex: number,
    status: string,
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }
    const itemParts = this.parts.get(itemId);
    if (itemParts && itemParts.has(partIndex)) {
      const existing = itemParts.get(partIndex)!;
      itemParts.set(partIndex, { ...existing, status });
    } else {
      // Create a placeholder part for failed parts
      if (!this.parts.has(itemId)) {
        this.parts.set(itemId, new Map());
      }
      this.parts.get(itemId)!.set(partIndex, { content: '', status });
    }
  }

  async getPartStatus(
    itemId: string,
    partIndex: number,
  ): Promise<string | null> {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }
    const itemParts = this.parts.get(itemId);
    return itemParts?.get(partIndex)?.status || null;
  }

  async cleanup(itemId: string): Promise<void> {
    this.parts.delete(itemId);
  }
}

// Mock PDF Part Tracker
class MockPdfPartTracker implements IPdfPartTracker {
  private processingStatus: Map<string, PdfProcessingStatusInfo> = new Map();
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      this.initialized = true;
    }
  }

  async initializePdfProcessing(
    itemId: string,
    totalParts: number,
  ): Promise<void> {
    await this.ensureInitialized();
    const now = Date.now();
    this.processingStatus.set(itemId, {
      itemId,
      totalParts,
      completedParts: [],
      failedParts: [],
      processingParts: [],
      pendingParts: Array.from({ length: totalParts }, (_, i) => i),
      startTime: now,
      status: 'pending',
    });
  }

  async updatePartStatus(
    itemId: string,
    partIndex: number,
    status: any,
    error?: string,
  ): Promise<void> {
    await this.ensureInitialized();
    const processingStatus = this.processingStatus.get(itemId);
    if (!processingStatus) return;

    // Update part status arrays
    processingStatus.pendingParts = processingStatus.pendingParts.filter(
      (i) => i !== partIndex,
    );
    processingStatus.processingParts = processingStatus.processingParts.filter(
      (i) => i !== partIndex,
    );
    processingStatus.completedParts = processingStatus.completedParts.filter(
      (i) => i !== partIndex,
    );
    processingStatus.failedParts = processingStatus.failedParts.filter(
      (i) => i !== partIndex,
    );

    if (status === 'processing') {
      processingStatus.processingParts.push(partIndex);
      if (processingStatus.status === 'pending') {
        processingStatus.status = 'processing';
      }
    } else if (status === 'completed') {
      processingStatus.completedParts.push(partIndex);
    } else if (status === 'failed') {
      processingStatus.failedParts.push(partIndex);
    }

    // Update overall status
    if (
      processingStatus.completedParts.length === processingStatus.totalParts
    ) {
      processingStatus.status = 'completed';
      processingStatus.endTime = Date.now();
    } else if (
      processingStatus.failedParts.length > 0 &&
      processingStatus.completedParts.length === 0
    ) {
      processingStatus.status = 'failed';
      processingStatus.endTime = Date.now();
    }
  }

  async getPdfProcessingStatus(
    itemId: string,
  ): Promise<PdfProcessingStatusInfo | null> {
    await this.ensureInitialized();
    return this.processingStatus.get(itemId) || null;
  }

  async getAllPartStatuses(itemId: string): Promise<any[]> {
    await this.ensureInitialized();
    // Return mock part statuses
    const status = this.processingStatus.get(itemId);
    if (!status) return [];

    const allParts: any[] = [];
    for (let i = 0; i < status.totalParts; i++) {
      let partStatus = 'pending';
      if (status.completedParts.includes(i)) partStatus = 'completed';
      else if (status.failedParts.includes(i)) partStatus = 'failed';
      else if (status.processingParts.includes(i)) partStatus = 'processing';

      allParts.push({
        itemId,
        partIndex: i,
        totalParts: status.totalParts,
        status: partStatus,
      });
    }
    return allParts;
  }

  async areAllPartsCompleted(itemId: string): Promise<boolean> {
    await this.ensureInitialized();
    const status = this.processingStatus.get(itemId);
    return status ? status.completedParts.length === status.totalParts : false;
  }

  async hasAnyPartFailed(itemId: string): Promise<boolean> {
    await this.ensureInitialized();
    const status = this.processingStatus.get(itemId);
    return status ? status.failedParts.length > 0 : false;
  }

  async getCompletedParts(itemId: string): Promise<number[]> {
    await this.ensureInitialized();
    const status = this.processingStatus.get(itemId);
    return status?.completedParts || [];
  }

  async getFailedParts(itemId: string): Promise<number[]> {
    await this.ensureInitialized();
    const status = this.processingStatus.get(itemId);
    return status?.failedParts || [];
  }

  async cleanupPdfProcessing(itemId: string): Promise<void> {
    await this.ensureInitialized();
    this.processingStatus.delete(itemId);
  }

  async getAllProcessingPdfs(): Promise<string[]> {
    await this.ensureInitialized();
    return Array.from(this.processingStatus.keys());
  }

  async getFailedPartsDetails(itemId: string): Promise<any[]> {
    await this.ensureInitialized();
    const status = this.processingStatus.get(itemId);
    if (!status) return [];

    return status.failedParts.map((partIndex) => ({
      itemId,
      partIndex,
      totalParts: status.totalParts,
      status: 'failed',
    }));
  }

  async retryFailedParts(itemId: string): Promise<number[]> {
    await this.ensureInitialized();
    const status = this.processingStatus.get(itemId);
    if (!status) return [];

    const failedParts = [...status.failedParts];
    // Reset failed parts to pending
    status.failedParts = [];
    status.pendingParts.push(...failedParts);
    status.status = 'processing';

    return failedParts;
  }
}

describe(MarkdownPartStorageWorker, () => {
  let worker: MarkdownPartStorageWorker;
  let mockCache: MockMarkdownPartCache;
  let mockTracker: MockPdfPartTracker;

  const mockedRequest1: MarkdownPartStorageRequestMessage = {
    eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
    itemId: 'aaa',
    partIndex: 0,
    totalParts: 3,
    markdownContent: 'a',
    messageId: '111',
    timestamp: 0,
  };

  const mockedRequest2: MarkdownPartStorageRequestMessage = {
    eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
    itemId: 'aaa',
    partIndex: 1,
    totalParts: 3,
    markdownContent: 'b',
    messageId: '112',
    timestamp: 0,
  };

  const mockedRequest3: MarkdownPartStorageRequestMessage = {
    eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
    itemId: 'aaa',
    partIndex: 2,
    totalParts: 3,
    markdownContent: 'c',
    messageId: '113',
    timestamp: 0,
  };

  beforeEach(async () => {
    mockCache = new MockMarkdownPartCache();
    mockTracker = new MockPdfPartTracker();

    // Initialize mocks
    await mockCache.initialize();
    // Note: ensureInitialized is private, but it's called automatically by other methods

    // Create worker with mocked dependencies
    worker = new MarkdownPartStorageWorker(mockCache, mockTracker);
  });

  it('checkAndTriggerMerging', async () => {
    // Process all three parts for the same item
    await worker.handleMarkdownPartStorageRequest(mockedRequest1, '');
    await worker.handleMarkdownPartStorageRequest(mockedRequest2, '');
    await worker.handleMarkdownPartStorageRequest(mockedRequest3, '');

    // Verify that all parts were stored
    const allParts = await mockCache.getAllParts('aaa');
    expect(allParts).toHaveLength(3);
    expect(allParts[0].content).toBe('a');
    expect(allParts[1].content).toBe('b');
    expect(allParts[2].content).toBe('c');

    // Verify that the processing status is completed
    const status = await mockTracker.getPdfProcessingStatus('aaa');
    expect(status).not.toBeNull();
    expect(status!.completedParts).toHaveLength(3);
    expect(status!.status).toBe('completed');
  });
});
