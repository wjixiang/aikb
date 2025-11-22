import { ZipProcessor } from './zip-processor';
import * as fs from 'fs';
import * as path from 'path';

describe('ZipProcessor', () => {
  let zipProcessor: ZipProcessor;
  const testZipPath = path.join(__dirname, '../../tests/mineruPdf2MdConversionResult.zip');

  beforeEach(() => {
    zipProcessor = new ZipProcessor();
  });

  describe('extractMarkdownFromZip', () => {
    it('should extract markdown content from zip buffer', async () => {
      // Skip test if test file doesn't exist
      if (!fs.existsSync(testZipPath)) {
        console.warn(`Test zip file not found at ${testZipPath}, skipping test`);
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
        console.warn(`Test zip file not found at ${testZipPath}, skipping test`);
        return;
      }

      const zipBuffer = fs.readFileSync(testZipPath);
      const extractDir = path.join(process.cwd(), 'temp-test-extraction');
      
      try {
        const result = await zipProcessor.extractAllFilesFromZip(zipBuffer, extractDir);
        
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
    it('should extract files and process markdown with image processing', async () => {
      // Skip test if test file doesn't exist
      if (!fs.existsSync(testZipPath)) {
        console.warn(`Test zip file not found at ${testZipPath}, skipping test`);
        return;
      }

      const zipBuffer = fs.readFileSync(testZipPath);
      const itemId = 'test-item-id';
      
      // Mock image processing function
      const mockImageProcessor = vi.fn().mockImplementation((content) => {
        return content.replace(/!\[([^\]]*)\]\([^)]+\)/g, '![$1](processed-image-url)');
      });
      
      const result = await zipProcessor.extractAllFilesAndMarkdownFromZip(
        zipBuffer,
        itemId,
        mockImageProcessor
      );
      
      expect(result.markdownContent).not.toBeNull();
      if (result.markdownContent) {
        expect(result.markdownContent.length).toBeGreaterThan(0);
        expect(mockImageProcessor).toHaveBeenCalled();
      }
    });

    it('should work without image processing function', async () => {
      // Skip test if test file doesn't exist
      if (!fs.existsSync(testZipPath)) {
        console.warn(`Test zip file not found at ${testZipPath}, skipping test`);
        return;
      }

      const zipBuffer = fs.readFileSync(testZipPath);
      const itemId = 'test-item-id';
      
      const result = await zipProcessor.extractAllFilesAndMarkdownFromZip(
        zipBuffer,
        itemId
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
        console.warn(`Test zip file not found at ${testZipPath}, skipping test`);
        return;
      }

      const zipBuffer = fs.readFileSync(testZipPath);
      const itemId = 'test-item-id';
      
      // Mock image processing function
      const mockImageProcessor = vi.fn().mockImplementation((content) => {
        return content.replace(/!\[([^\]]*)\]\([^)]+\)/g, '![$1](processed-image-url)');
      });
      
      const result = await zipProcessor.processZipBuffer(zipBuffer, {
        extractMarkdown: true,
        extractAllFiles: true,
        itemId,
        processImages: true,
        imageProcessor: mockImageProcessor
      });
      
      expect(result.markdownContent).not.toBeNull();
      expect(result.extractedFiles).toBe(true);
      if (result.markdownContent) {
        expect(result.markdownContent.length).toBeGreaterThan(0);
        expect(mockImageProcessor).toHaveBeenCalled();
      }
    });

    it('should process zip with only markdown extraction', async () => {
      // Skip test if test file doesn't exist
      if (!fs.existsSync(testZipPath)) {
        console.warn(`Test zip file not found at ${testZipPath}, skipping test`);
        return;
      }

      const zipBuffer = fs.readFileSync(testZipPath);
      
      const result = await zipProcessor.processZipBuffer(zipBuffer, {
        extractMarkdown: true,
        extractAllFiles: false
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
        itemId: 'test-item-id'
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
      const markdownContent = await zipProcessor.extractMarkdownFromZip(zipBuffer);
      
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
      const tempDir = path.join(process.cwd(), 'temp-test-extraction-' + Date.now());
      
      try {
        const success = await zipProcessor.extractAllFilesFromZip(zipBuffer, tempDir);
        
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

    it('should handle image processing in markdown content', async () => {
      const zipBuffer = fs.readFileSync(testZipPath);
      const itemId = 'test-item-with-images';
      
      // Mock image processor that replaces image URLs
      const mockImageProcessor = vi.fn().mockImplementation((content: string) => {
        return content.replace(
          /!\[([^\]]*)\]\(([^)]+)\)/g,
          (match, alt, src) => `![${alt}](processed-${src})`
        );
      });
      
      const result = await zipProcessor.extractAllFilesAndMarkdownFromZip(
        zipBuffer,
        itemId,
        mockImageProcessor
      );
      
      expect(result.markdownContent).not.toBeNull();
      if (result.markdownContent) {
        expect(result.markdownContent.length).toBeGreaterThan(0);
        
        // If there are images in the content, they should be processed
        if (result.markdownContent.includes('![')) {
          expect(mockImageProcessor).toHaveBeenCalled();
          expect(result.markdownContent).toContain('processed-');
        }
      }
    });
  });
});