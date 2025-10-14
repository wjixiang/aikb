import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PdfAnalyzerService } from '../pdf-analyzer.service';
import { AbstractLibraryStorage } from '../../../knowledgeImport/library';
import { PdfAnalysisRequestMessage } from '../message.types';

// Mock the dependencies
vi.mock('../rabbitmq.service');
vi.mock('../s3Service/S3Service');
vi.mock('../../../pdfProcess-ts/pdfSpliter');

describe('PDF Analysis Split Threshold', () => {
  let analyzerService: PdfAnalyzerService;
  let mockStorage: AbstractLibraryStorage;

  beforeEach(() => {
    // Create a mock storage
    mockStorage = {
      getMetadata: vi.fn(),
      updateMetadata: vi.fn(),
      saveMarkdown: vi.fn(),
      getMarkdown: vi.fn(),
    } as any;

    analyzerService = new PdfAnalyzerService(mockStorage);

    // Mock the storage metadata
    (mockStorage.getMetadata as any).mockResolvedValue({
      id: 'test-item-id',
      title: 'Test PDF',
      pageCount: 0,
      pdfProcessingStatus: 'pending',
    });
  });

  it('should use splitThreshold from message when provided', async () => {
    // Set up environment variable
    process.env.PDF_SPLIT_THRESHOLD = '30';
    process.env.PDF_SPLIT_SIZE = '20';

    const request: PdfAnalysisRequestMessage = {
      messageId: 'test-message-id',
      timestamp: Date.now(),
      eventType: 'PDF_ANALYSIS_REQUEST',
      itemId: 'test-item-id',
      s3Key: 'test-s3-key',
      fileName: 'test-file.pdf',
      splitThreshold: 25, // Custom threshold in message
      splitSize: 15, // Custom split size in message
    };

    // Mock the download and page count
    const mockDownloadPdfFromS3 = vi.spyOn(
      analyzerService as any,
      'downloadPdfFromS3'
    );
    mockDownloadPdfFromS3.mockResolvedValue(Buffer.from('mock-pdf-content'));

    const mockGetPageCount = vi.spyOn(analyzerService as any, 'getPageCount');
    mockGetPageCount.mockResolvedValue(30); // 30 pages

    // Mock the splitting process
    const mockSplitPdfAndUploadParts = vi.spyOn(
      analyzerService as any,
      'splitPdfAndUploadParts'
    );
    mockSplitPdfAndUploadParts.mockResolvedValue([]);

    // Mock the publish methods
    const mockPublishAnalysisCompleted = vi.spyOn(
      analyzerService as any,
      'publishAnalysisCompleted'
    );
    mockPublishAnalysisCompleted.mockResolvedValue(undefined);

    try {
      await analyzerService.analyzePdf(request);
    } catch (error) {
      // Expected to fail due to mocking, but we can check the parameters used
    }

    // Verify that the custom threshold from message was used
    expect(mockSplitPdfAndUploadParts).toHaveBeenCalledWith(
      'test-item-id',
      'test-file.pdf',
      expect.any(Buffer),
      30,
      15 // Should use the custom split size from message
    );

    // Clean up
    delete process.env.PDF_SPLIT_THRESHOLD;
    delete process.env.PDF_SPLIT_SIZE;
  });

  it('should use splitThreshold from environment variable when not provided in message', async () => {
    // Set up environment variable
    process.env.PDF_SPLIT_THRESHOLD = '30';
    process.env.PDF_SPLIT_SIZE = '20';

    const request: PdfAnalysisRequestMessage = {
      messageId: 'test-message-id',
      timestamp: Date.now(),
      eventType: 'PDF_ANALYSIS_REQUEST',
      itemId: 'test-item-id',
      s3Key: 'test-s3-key',
      fileName: 'test-file.pdf',
      // No splitThreshold or splitSize in message
    };

    // Mock the download and page count
    const mockDownloadPdfFromS3 = vi.spyOn(
      analyzerService as any,
      'downloadPdfFromS3'
    );
    mockDownloadPdfFromS3.mockResolvedValue(Buffer.from('mock-pdf-content'));

    const mockGetPageCount = vi.spyOn(analyzerService as any, 'getPageCount');
    mockGetPageCount.mockResolvedValue(35); // 35 pages

    // Mock the splitting process
    const mockSplitPdfAndUploadParts = vi.spyOn(
      analyzerService as any,
      'splitPdfAndUploadParts'
    );
    mockSplitPdfAndUploadParts.mockResolvedValue([]);

    // Mock the publish methods
    const mockPublishAnalysisCompleted = vi.spyOn(
      analyzerService as any,
      'publishAnalysisCompleted'
    );
    mockPublishAnalysisCompleted.mockResolvedValue(undefined);

    try {
      await analyzerService.analyzePdf(request);
    } catch (error) {
      // Expected to fail due to mocking, but we can check the parameters used
    }

    // Verify that the environment variable threshold was used
    expect(mockSplitPdfAndUploadParts).toHaveBeenCalledWith(
      'test-item-id',
      'test-file.pdf',
      expect.any(Buffer),
      35,
      20 // Should use the split size from environment variable
    );

    // Clean up
    delete process.env.PDF_SPLIT_THRESHOLD;
    delete process.env.PDF_SPLIT_SIZE;
  });

  it('should use default values when neither message nor environment variables are provided', async () => {
    // Ensure environment variables are not set
    delete process.env.PDF_SPLIT_THRESHOLD;
    delete process.env.PDF_SPLIT_SIZE;

    const request: PdfAnalysisRequestMessage = {
      messageId: 'test-message-id',
      timestamp: Date.now(),
      eventType: 'PDF_ANALYSIS_REQUEST',
      itemId: 'test-item-id',
      s3Key: 'test-s3-key',
      fileName: 'test-file.pdf',
      // No splitThreshold or splitSize in message
    };

    // Mock the download and page count
    const mockDownloadPdfFromS3 = vi.spyOn(
      analyzerService as any,
      'downloadPdfFromS3'
    );
    mockDownloadPdfFromS3.mockResolvedValue(Buffer.from('mock-pdf-content'));

    const mockGetPageCount = vi.spyOn(analyzerService as any, 'getPageCount');
    mockGetPageCount.mockResolvedValue(60); // 60 pages

    // Mock the splitting process
    const mockSplitPdfAndUploadParts = vi.spyOn(
      analyzerService as any,
      'splitPdfAndUploadParts'
    );
    mockSplitPdfAndUploadParts.mockResolvedValue([]);

    // Mock the publish methods
    const mockPublishAnalysisCompleted = vi.spyOn(
      analyzerService as any,
      'publishAnalysisCompleted'
    );
    mockPublishAnalysisCompleted.mockResolvedValue(undefined);

    try {
      await analyzerService.analyzePdf(request);
    } catch (error) {
      // Expected to fail due to mocking, but we can check the parameters used
    }

    // Verify that the default values were used
    expect(mockSplitPdfAndUploadParts).toHaveBeenCalledWith(
      'test-item-id',
      'test-file.pdf',
      expect.any(Buffer),
      60,
      25 // Should use the default split size
    );
  });

  it('should not split when page count is below threshold', async () => {
    // Set up environment variable
    process.env.PDF_SPLIT_THRESHOLD = '50';

    const request: PdfAnalysisRequestMessage = {
      messageId: 'test-message-id',
      timestamp: Date.now(),
      eventType: 'PDF_ANALYSIS_REQUEST',
      itemId: 'test-item-id',
      s3Key: 'test-s3-key',
      fileName: 'test-file.pdf',
    };

    // Mock the download and page count
    const mockDownloadPdfFromS3 = vi.spyOn(
      analyzerService as any,
      'downloadPdfFromS3'
    );
    mockDownloadPdfFromS3.mockResolvedValue(Buffer.from('mock-pdf-content'));

    const mockGetPageCount = vi.spyOn(analyzerService as any, 'getPageCount');
    mockGetPageCount.mockResolvedValue(30); // 30 pages, below threshold

    // Mock the publish methods
    const mockPublishAnalysisCompleted = vi.spyOn(
      analyzerService as any,
      'publishAnalysisCompleted'
    );
    mockPublishAnalysisCompleted.mockResolvedValue(undefined);

    try {
      await analyzerService.analyzePdf(request);
    } catch (error) {
      // Expected to fail due to mocking, but we can check the parameters used
    }

    // Verify that splitting was not triggered
    expect(mockPublishAnalysisCompleted).toHaveBeenCalledWith(
      'test-item-id',
      30,
      false, // requiresSplitting should be false
      expect.any(Number),
      expect.any(Number),
      expect.any(Object),
      undefined,
      'test-s3-key'
    );

    // Clean up
    delete process.env.PDF_SPLIT_THRESHOLD;
  });
});