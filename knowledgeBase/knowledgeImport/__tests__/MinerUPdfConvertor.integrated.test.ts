import { MinerUPdfConvertor } from '../MinerU/MinerUPdfConvertor';
import * as path from 'path';
import * as fs from 'fs';
import { config } from 'dotenv';
import { UploadTestPdf } from '../liberary.integrated.test';
config();


describe(MinerUPdfConvertor, () => {
  let converter: MinerUPdfConvertor;
  const testPdfPath = 'test/viral_pneumonia.pdf';
  const downloadDir = "test"

  beforeAll(() => {
    // Check if MINERU_TOKEN is available
    const token = process.env.MINERU_TOKEN;
    if (!token) {
      console.warn(
        'MINERU_TOKEN environment variable not set. Skipping integration tests.',
      );
      return;
    }

    // Create converter instance
    converter = new MinerUPdfConvertor({
      token: token,
      downloadDir: downloadDir,
      defaultOptions: {
        is_ocr: true,
        enable_formula: true,
        enable_table: true,
        language: 'en',
        extra_formats: ['docx', 'html'],
      },
      timeout: 120000, // 2 minutes timeout
      maxRetries: 3,
      retryDelay: 5000,
    });

    // Ensure download directory exists
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
  });

  afterAll(async () => {
    // Cleanup test downloads
    if (converter && fs.existsSync(downloadDir)) {
      try {
        await converter.cleanupDownloadedFiles(0);
        console.log('Test downloads cleaned up');
      } catch (error) {
        console.error('Failed to cleanup test downloads:', error);
      }
    }
  });

  it('should convert test PDF to JSON successfully', async () => {
    // Skip test if token is not available
    const token = process.env.MINERU_TOKEN;
    if (!token) {
      console.warn('Skipping test - MINERU_TOKEN not available');
      return;
    }

    // Verify test PDF exists
    if (!fs.existsSync(testPdfPath)) {
      throw new Error(`Test PDF not found at: ${testPdfPath}`);
    }

    console.log('Starting PDF conversion test...');
    console.log('PDF file:', testPdfPath);
    console.log('File size:', fs.statSync(testPdfPath).size, 'bytes');

    const startTime = Date.now();
    const book = await UploadTestPdf();
    const url = await book.getPdfDownloadUrl();
    try {
      // Convert PDF using MinerU
      const result = await converter.processUrls([url], {
        data_id: 'ruuskanen-viral-pneumonia-2011',
        is_ocr: true,
        enable_formula: true,
        enable_table: true,
        language: 'en',
        page_ranges: '1-10', // Process first 10 pages for testing
        extra_formats: ['docx', 'html'],
      });

      const processingTime = Date.now() - startTime;
      console.log(`Processing completed in ${processingTime}ms`);

      // Verify conversion was successful
      expect(result).toBeDefined();
      expect(result[0].success).toBe(true);
      expect(result[0].taskId).toBeDefined();
      expect(result[0].taskId).toBeTruthy();
      expect(result[0].downloadedFiles).toBeDefined();
      expect(Array.isArray(result[0].downloadedFiles)).toBe(true);

      console.log('✅ Conversion successful!');
      console.log('Task ID:', result[0].taskId);
      console.log('Downloaded files:', result[0].downloadedFiles);

      // Verify downloaded files exist
      if (result[0].downloadedFiles && result[0].downloadedFiles.length > 0) {
        for (const file of result[0].downloadedFiles) {
          console.log(`✅ Downloaded file: ${file}`);

          // Check if it's a local file or S3 URL
          if (file.startsWith('http://') || file.startsWith('https://')) {
            // For S3 URLs, just verify the URL is valid
            expect(file).toContain('aikb-pdf.oss-cn-beijing.aliyuncs.com');
            console.log(`   S3 URL is valid: ${file}`);
          } else {
            // For local files, check existence and size
            expect(fs.existsSync(file)).toBe(true);
            console.log(`   Local file exists: ${file}`);

            const stats = fs.statSync(file);
            console.log(`   File size: ${stats.size} bytes`);
            expect(stats.size).toBeGreaterThan(0);
          }
        }
      }

      // Verify result data structure
      if (result[0].data) {
        console.log('✅ Result data received');
        console.log('Data type:', typeof result[0].data);

        // If data is a JSON object, verify its structure
        if (typeof result[0].data === 'object' && result[0].data !== null) {
          console.log('Data keys:', Object.keys(result[0].data));
        }
      }
    } catch (error) {
      console.error('❌ Conversion failed:', error);
      throw error;
    }
  }, 300000); // 5 minutes timeout for the entire test

  it('should handle task status monitoring', async () => {
    // Skip test if token is not available
    const token = process.env.MINERU_TOKEN;
    if (!token) {
      console.warn('Skipping test - MINERU_TOKEN not available');
      return;
    }

    // First, start a conversion
    const result = await converter.processLocalFile(testPdfPath, {
      data_id: 'ruuskanen-viral-pneumonia-status-test',
      is_ocr: true,
      language: 'en',
      page_ranges: '1-2', // Small range for faster testing
    });

    expect(result.success).toBe(true);
    expect(result.taskId).toBeDefined();

    // Monitor task status
    const status = await converter.getTaskStatus(result.taskId!);
    expect(status).toBeDefined();
    expect(status.task_id).toBe(result.taskId);
    expect(status.state).toBeDefined();

    console.log('Task status:', status.state);

    if (status.extract_progress) {
      console.log('Progress:', {
        extracted_pages: status.extract_progress.extracted_pages,
        total_pages: status.extract_progress.total_pages,
        start_time: status.extract_progress.start_time,
      });
    }
  }, 180000); // 3 minutes timeout

  it('should validate file format before processing', async () => {
    // Test with invalid file format
    const invalidPath = path.join(__dirname, 'test.txt');

    // Create a temporary invalid file
    fs.writeFileSync(invalidPath, 'This is not a PDF file');

    try {
      const result = await converter.processLocalFile(invalidPath);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported file format');
    } finally {
      // Clean up temporary file
      if (fs.existsSync(invalidPath)) {
        fs.unlinkSync(invalidPath);
      }
    }
  });

  it('should handle non-existent file gracefully', async () => {
    const nonExistentPath = path.join(__dirname, 'non-existent-file.pdf');

    const result = await converter.processLocalFile(nonExistentPath);
    expect(result.success).toBe(false);
    expect(result.error).toContain('File not found');
  });

  it('should manage download directory correctly', () => {
    if (!converter) {
      console.warn('Skipping test - converter not initialized');
      return;
    }

    const currentDir = converter.getDownloadDirectory();
    expect(currentDir).toBeDefined();
    expect(typeof currentDir).toBe('string');

    // Set new directory
    const newDir = path.join(__dirname, 'custom-test-downloads');
    converter.setDownloadDirectory(newDir);
    expect(converter.getDownloadDirectory()).toBe(newDir);

    // Restore original directory
    converter.setDownloadDirectory(currentDir);
    expect(converter.getDownloadDirectory()).toBe(currentDir);
  });
});
