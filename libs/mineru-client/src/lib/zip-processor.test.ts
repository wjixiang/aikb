import { ZipProcessor } from './zip-processor';
import * as fs from 'fs';
import * as path from 'path';

describe('ZipProcessor', () => {
  let zipProcessor: ZipProcessor;
  const testZipPath = path.join(
    __dirname,
    '../../tests/mineruPdf2MdConversionResult.zip',
  );

  beforeEach(() => {
    zipProcessor = new ZipProcessor();
  });

  describe('extractMarkdownFromZip', () => {
    it('should extract markdown content from zip buffer', async () => {
      // Skip test if test file doesn't exist
      if (!fs.existsSync(testZipPath)) {
        console.warn(
          `Test zip file not found at ${testZipPath}, skipping test`,
        );
        return;
      }

      const zipBuffer = fs.readFileSync(testZipPath);
      const result = await zipProcessor.extractMarkdownFromZip(zipBuffer);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.length).toBeGreaterThan(0);
        // Check if it contains expected content from test file
        expect(result).toContain('胰高血糖素的分泌调节');
      }
    });

    it('should return null for zip without markdown', async () => {
      // Create a mock zip buffer without markdown
      const emptyBuffer = Buffer.from('PK\x03\x04'); // Invalid zip header

      // This should handle the error gracefully and return null
      const result = await zipProcessor.extractMarkdownFromZip(emptyBuffer);
      expect(result).toBeNull();
    });
  });

  describe('extractAllFilesFromZip', () => {
    it('should extract all files to specified directory', async () => {
      // Skip test if test file doesn't exist
      if (!fs.existsSync(testZipPath)) {
        console.warn(
          `Test zip file not found at ${testZipPath}, skipping test`,
        );
        return;
      }

      const zipBuffer = fs.readFileSync(testZipPath);
      const extractDir = path.join(process.cwd(), 'temp-test-extraction');

      try {
        const result = await zipProcessor.extractAllFilesFromZip(
          zipBuffer,
          extractDir,
        );

        expect(result).toBe(true);
        expect(fs.existsSync(extractDir)).toBe(true);

        // Check if full.md was extracted
        const fullMdPath = path.join(extractDir, 'full.md');
        if (fs.existsSync(fullMdPath)) {
          const content = fs.readFileSync(fullMdPath, 'utf-8');
          expect(content.length).toBeGreaterThan(0);
        }
      } finally {
        // Clean up
        if (fs.existsSync(extractDir)) {
          fs.rmSync(extractDir, { recursive: true, force: true });
        }
      }
    });
  });

  describe('extractAllFilesAndMarkdownFromZip', () => {
    it('should extract files and markdown', async () => {
      // Skip test if test file doesn't exist
      if (!fs.existsSync(testZipPath)) {
        console.warn(
          `Test zip file not found at ${testZipPath}, skipping test`,
        );
        return;
      }

      const zipBuffer = fs.readFileSync(testZipPath);
      const itemId = 'test-item-id';

      const result = await zipProcessor.extractAllFilesAndMarkdownFromZip(
        zipBuffer,
        itemId,
      );

      expect(result.markdownContent).not.toBeNull();
      if (result.markdownContent) {
        expect(result.markdownContent.length).toBeGreaterThan(0);
      }
    });

    it('should work without image processing function', async () => {
      // Skip test if test file doesn't exist
      if (!fs.existsSync(testZipPath)) {
        console.warn(
          `Test zip file not found at ${testZipPath}, skipping test`,
        );
        return;
      }

      const zipBuffer = fs.readFileSync(testZipPath);
      const itemId = 'test-item-id';

      const result = await zipProcessor.extractAllFilesAndMarkdownFromZip(
        zipBuffer,
        itemId,
      );

      expect(result.markdownContent).not.toBeNull();
      if (result.markdownContent) {
        expect(result.markdownContent.length).toBeGreaterThan(0);
      }
    });
  });

  describe('processZipBuffer', () => {
    it('should process zip with all options enabled', async () => {
      // Skip test if test file doesn't exist
      if (!fs.existsSync(testZipPath)) {
        console.warn(
          `Test zip file not found at ${testZipPath}, skipping test`,
        );
        return;
      }

      const zipBuffer = fs.readFileSync(testZipPath);
      const itemId = 'test-item-id';

      const result = await zipProcessor.processZipBuffer(zipBuffer, {
        extractMarkdown: true,
        extractAllFiles: true,
        itemId,
      });

      expect(result.markdownContent).not.toBeNull();
      expect(result.extractedFiles).toBe(true);
      if (result.markdownContent) {
        expect(result.markdownContent.length).toBeGreaterThan(0);
      }
    });

    it('should process zip with only markdown extraction', async () => {
      // Skip test if test file doesn't exist
      if (!fs.existsSync(testZipPath)) {
        console.warn(
          `Test zip file not found at ${testZipPath}, skipping test`,
        );
        return;
      }

      const zipBuffer = fs.readFileSync(testZipPath);

      const result = await zipProcessor.processZipBuffer(zipBuffer, {
        extractMarkdown: true,
        extractAllFiles: false,
      });

      expect(result.markdownContent).not.toBeNull();
      expect(result.extractedFiles).toBe(false);
      if (result.markdownContent) {
        expect(result.markdownContent.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Practical zip file parsing test', () => {
    it('should successfully parse the actual test zip file and extract content', async () => {
      // Verify the test zip file exists
      expect(fs.existsSync(testZipPath)).toBe(true);

      // Read the zip file
      const zipBuffer = fs.readFileSync(testZipPath);
      expect(zipBuffer.length).toBeGreaterThan(0);

      // Test basic zip processing
      const result = await zipProcessor.processZipBuffer(zipBuffer, {
        extractMarkdown: true,
        extractAllFiles: true,
        itemId: 'test-item-id',
      });

      // Verify the results
      expect(result).toBeDefined();
      expect(result.markdownContent).not.toBeNull();
      expect(result.extractedFiles).toBe(true);

      if (result.markdownContent) {
        // Verify markdown content has expected structure
        expect(result.markdownContent.length).toBeGreaterThan(0);

        // Check for common markdown elements
        expect(result.markdownContent).toMatch(/^#|^##|^\*\*|^\*|^```/m);

        // Verify it contains the expected content from the test file
        expect(result.markdownContent).toContain('胰高血糖素的分泌调节');
      }
    });

    it('should extract markdown content using the dedicated method', async () => {
      const zipBuffer = fs.readFileSync(testZipPath);
      const markdownContent =
        await zipProcessor.extractMarkdownFromZip(zipBuffer);

      expect(markdownContent).not.toBeNull();
      if (markdownContent) {
        expect(markdownContent.length).toBeGreaterThan(0);
        expect(markdownContent).toContain('胰高血糖素的分泌调节');

        // Verify it's valid markdown content
        expect(markdownContent).toMatch(/^[#\*\-\d]/m);
      }
    });

    it('should extract all files to a temporary directory', async () => {
      const zipBuffer = fs.readFileSync(testZipPath);
      const tempDir = path.join(
        process.cwd(),
        'temp-test-extraction-' + Date.now(),
      );

      try {
        const success = await zipProcessor.extractAllFilesFromZip(
          zipBuffer,
          tempDir,
        );

        expect(success).toBe(true);
        expect(fs.existsSync(tempDir)).toBe(true);

        // Check if full.md was extracted
        const fullMdPath = path.join(tempDir, 'full.md');
        expect(fs.existsSync(fullMdPath)).toBe(true);

        // Verify the content of extracted markdown file
        const content = fs.readFileSync(fullMdPath, 'utf-8');
        expect(content.length).toBeGreaterThan(0);
        expect(content).toContain('胰高血糖素的分泌调节');

        // List all extracted files to verify complete extraction
        const extractedFiles = fs.readdirSync(tempDir, { recursive: true });
        expect(extractedFiles.length).toBeGreaterThan(0);
      } finally {
        // Clean up
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      }
    });

    it('should extract markdown content without processing', async () => {
      const zipBuffer = fs.readFileSync(testZipPath);
      const itemId = 'test-item-without-processing';

      const result = await zipProcessor.extractAllFilesAndMarkdownFromZip(
        zipBuffer,
        itemId,
      );

      expect(result.markdownContent).not.toBeNull();
      if (result.markdownContent) {
        expect(result.markdownContent.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Image extraction functionality', () => {
    it('should extract images as buffers when extractImages option is enabled', async () => {
      const zipBuffer = fs.readFileSync(testZipPath);

      const result = await zipProcessor.processZipBuffer(zipBuffer, {
        extractMarkdown: false,
        extractAllFiles: false,
        extractImages: true,
      });

      expect(result.images).toBeDefined();
      expect(Array.isArray(result.images)).toBe(true);

      // The test zip may or may not contain images, but the functionality should work
      if (result.images && result.images.length > 0) {
        expect(result.images[0]).toHaveProperty('fileName');
        expect(result.images[0]).toHaveProperty('buffer');
        expect(Buffer.isBuffer(result.images[0].buffer)).toBe(true);
        expect(result.images[0].buffer.length).toBeGreaterThan(0);
      }
    });

    it('should extract images using the dedicated method', async () => {
      const zipBuffer = fs.readFileSync(testZipPath);
      const images = await zipProcessor.extractImagesFromZip(zipBuffer);

      expect(Array.isArray(images)).toBe(true);

      // Verify each image has the expected structure
      images.forEach((image) => {
        expect(image).toHaveProperty('fileName');
        expect(image).toHaveProperty('buffer');
        expect(typeof image.fileName).toBe('string');
        expect(Buffer.isBuffer(image.buffer)).toBe(true);
        expect(image.buffer.length).toBeGreaterThan(0);
      });
    });

    it('should extract all content including images using the comprehensive method', async () => {
      const zipBuffer = fs.readFileSync(testZipPath);
      const itemId = 'test-comprehensive-extraction';
      const tempDir = path.join(
        process.cwd(),
        'temp-comprehensive-test-' + Date.now(),
      );

      try {
        const result =
          await zipProcessor.extractAllFilesMarkdownAndImagesFromZip(
            zipBuffer,
            itemId,
            tempDir,
          );

        expect(result.markdownContent).not.toBeNull();
        expect(Array.isArray(result.images)).toBe(true);

        if (result.markdownContent) {
          expect(result.markdownContent.length).toBeGreaterThan(0);
          expect(result.markdownContent).toContain('皮层诱发电位');
        }

        // Verify files were extracted to directory
        expect(fs.existsSync(tempDir)).toBe(true);

        // Check that some files were extracted (the exact structure may vary)
        const extractedFiles = fs.readdirSync(tempDir, { recursive: true });
        expect(extractedFiles.length).toBeGreaterThan(0);

        // The main goal is to verify that extraction works, not specific file structure
        // since zip structure may vary
      } finally {
        // Clean up
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      }
    });

    it('should not extract images when extractImages option is false', async () => {
      const zipBuffer = fs.readFileSync(testZipPath);

      const result = await zipProcessor.processZipBuffer(zipBuffer, {
        extractMarkdown: true,
        extractAllFiles: true,
        extractImages: false,
      });

      expect(result.images).toBeUndefined();
    });

    it('should handle image extraction without processing', async () => {
      const zipBuffer = fs.readFileSync(testZipPath);
      const itemId = 'test-image-extraction';

      const result = await zipProcessor.processZipBuffer(zipBuffer, {
        extractMarkdown: true,
        extractAllFiles: true,
        extractImages: true,
        itemId,
      });

      expect(result.markdownContent).not.toBeNull();
      expect(result.images).toBeDefined();
      expect(Array.isArray(result.images)).toBe(true);

      if (result.markdownContent) {
        expect(result.markdownContent.length).toBeGreaterThan(0);
      }
    });
  });
});
