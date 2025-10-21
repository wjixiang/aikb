import { MinerUClient, MinerUDefaultConfig } from './MinerUClient';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe(MinerUClient, () => {
  let client: MinerUClient;
  let mockCreateSingleFileTask: any;
  let mockWaitForTaskCompletion: any;
  let mockDownloadResultZip: any;
  let testDownloadDir: string;
  let testTaskId: string;
  let testZipPath: string;

  beforeEach(() => {
    // Create a unique test directory for each test
    testDownloadDir = path.join(
      __dirname,
      'test/download',
      Date.now().toString(),
    );
    testTaskId = 'test-task-123';
    testZipPath = path.join(testDownloadDir, `${testTaskId}.zip`);

    // Create a mock client with mocked methods
    client = new MinerUClient(MinerUDefaultConfig);

    // Mock the methods we need to control
    mockCreateSingleFileTask = vi.spyOn(client as any, 'createSingleFileTask');
    mockWaitForTaskCompletion = vi.spyOn(
      client as any,
      'waitForTaskCompletion',
    );
    mockDownloadResultZip = vi.spyOn(client as any, 'downloadResultZip');

    // Ensure the test directory exists
    if (!fs.existsSync(testDownloadDir)) {
      fs.mkdirSync(testDownloadDir, { recursive: true });
    }
  });

  describe('processSingleFile', () => {
    it('should return full path of downloaded .zip', async () => {
      // Arrange
      const testRequest = {
        url: 'https://example.com/test-document.pdf',
        is_ocr: false,
        enable_formula: true,
        enable_table: true,
        language: 'en' as const,
      };

      const testOptions = {
        downloadDir: testDownloadDir,
      };

      const mockTaskResult = {
        task_id: testTaskId,
        data_id: 'test-data-123',
        file_name: 'test-document.pdf',
        state: 'done' as const,
        full_zip_url: 'https://example.com/download/test-task-123.zip',
      };

      // Mock the method implementations
      mockCreateSingleFileTask.mockResolvedValue(testTaskId);
      mockWaitForTaskCompletion.mockResolvedValue({
        result: mockTaskResult,
        downloadedFiles: [testZipPath],
      });

      // Act
      const result = await client.processSingleFile(testRequest, testOptions);

      // Assert
      expect(mockCreateSingleFileTask).toHaveBeenCalledWith(testRequest);
      expect(mockWaitForTaskCompletion).toHaveBeenCalledWith(
        testTaskId,
        testOptions,
      );

      // Verify the result contains the expected structure
      expect(result).toBeDefined();
      expect(result.result).toBeDefined();
      expect(result.result.task_id).toBe(testTaskId);
      expect(result.result.state).toBe('done');
      expect(result.downloadedFiles).toBeDefined();
      expect(result.downloadedFiles).toHaveLength(1);
      expect(result.downloadedFiles![0]).toBe(testZipPath);

      // Verify the returned path is an absolute path
      expect(path.isAbsolute(result.downloadedFiles![0])).toBe(true);

      // Verify the path ends with the expected filename
      expect(result.downloadedFiles![0]).toContain(`${testTaskId}.zip`);
    });

    it('should use default download directory when none provided', async () => {
      // Arrange
      const testRequest = {
        url: 'https://example.com/test-document.pdf',
      };

      const defaultDownloadDir = path.resolve('./test/mineru-downloads');
      const expectedZipPath = path.join(
        defaultDownloadDir,
        `${testTaskId}.zip`,
      );

      mockCreateSingleFileTask.mockResolvedValue(testTaskId);
      mockWaitForTaskCompletion.mockResolvedValue({
        result: {
          task_id: testTaskId,
          state: 'done' as const,
          full_zip_url: 'https://example.com/download/test-task-123.zip',
        },
        downloadedFiles: [expectedZipPath],
      });

      // Act
      const result = await client.processSingleFile(testRequest);

      // Assert
      expect(mockWaitForTaskCompletion).toHaveBeenCalledWith(
        testTaskId,
        undefined,
      );
      expect(result.downloadedFiles![0]).toBe(expectedZipPath);
    });
  });
});
