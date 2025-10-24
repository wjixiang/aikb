import { describe, it, expect } from 'vitest';
import { MinerUPdfConvertor } from '../../../lib/MinerU/MinerUPdfConvertor';
import type { IPdfConvertor } from '../IPdfConvertor';

describe('IPdfConvertor Interface', () => {
  it('should validate that MinerUPdfConvertor implements IPdfConvertor', () => {
    // Create a mock config for testing
    const mockConfig = {
      token: 'test-token',
      baseUrl: 'https://test.api.com',
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      downloadDir: './test/download',
    };

    // Create an instance of MinerUPdfConvertor
    const converter = new MinerUPdfConvertor(mockConfig);

    // Verify that the converter implements the IPdfConvertor interface
    expect(converter).toBeDefined();

    // Check that required methods exist
    expect(typeof converter.convertPdfToMarkdown).toBe('function');
    expect(typeof converter.convertPdfToMarkdownFromS3).toBe('function');
    expect(typeof converter.processLocalFile).toBe('function');
    expect(typeof converter.processMultipleFiles).toBe('function');
    expect(typeof converter.processUrls).toBe('function');
    expect(typeof converter.cancelTask).toBe('function');
    expect(typeof converter.getTaskStatus).toBe('function');
    expect(typeof converter.validateToken).toBe('function');
    expect(typeof converter.cleanupDownloadedFiles).toBe('function');
    expect(typeof converter.getDownloadDirectory).toBe('function');
    expect(typeof converter.setDownloadDirectory).toBe('function');

    // Type assertion to verify compatibility
    const pdfConvertor: IPdfConvertor = converter;
    expect(pdfConvertor).toBeDefined();
  });
});
