import { describe, it, expect } from 'vitest';
import { ZipProcessor } from './zip-processor';
import * as fs from 'fs';
import * as path from 'path';

describe('ZipProcessor Integration Tests', () => {
  let zipProcessor: ZipProcessor;

  beforeEach(() => {
    zipProcessor = new ZipProcessor();
  });

  it('should extract markdown and images from real zip file', async () => {
    // Read the actual test zip file
    const testZipPath = path.resolve(
      __dirname,
      '../../tests/mineruPdf2MdConversionResult.zip',
    );

    if (!fs.existsSync(testZipPath)) {
      console.warn(
        `Test zip file not found at ${testZipPath}, skipping integration test`,
      );
      return;
    }

    const zipBuffer = fs.readFileSync(testZipPath);

    // Test the processZipBuffer method
    const result = await zipProcessor.processZipBuffer(zipBuffer, {
      extractMarkdown: true,
      extractAllFiles: true,
      extractImages: true,
      itemId: 'test-item-id',
    });

    // Verify the results
    expect(result).toBeDefined();
    expect(result.markdownContent).toBeDefined();
    expect(typeof result.markdownContent).toBe('string');
    expect(result.markdownContent!.length).toBeGreaterThan(0);
    expect(result.extractedFiles).toBe(true);

    // If images were extracted, verify they have the expected structure
    if (result.images && result.images.length > 0) {
      expect(Array.isArray(result.images)).toBe(true);
      result.images.forEach((image) => {
        // According to the interface, images are returned as objects with fileName and buffer
        expect(image).toHaveProperty('fileName');
        expect(image).toHaveProperty('buffer');
        expect(typeof image.fileName).toBe('string');
        expect(Buffer.isBuffer(image.buffer)).toBe(true);
        expect(image.buffer.length).toBeGreaterThan(0);
      });
    }

    console.log(
      `Successfully extracted markdown content (${result.markdownContent?.length} chars) from zip file`,
    );
    if (result.images) {
      console.log(`Extracted ${result.images.length} images from zip file`);
    }
  });

  it('should extract only markdown content', async () => {
    const testZipPath = path.resolve(
      __dirname,
      '../../tests/mineruPdf2MdConversionResult.zip',
    );

    if (!fs.existsSync(testZipPath)) {
      console.warn(
        `Test zip file not found at ${testZipPath}, skipping integration test`,
      );
      return;
    }

    const zipBuffer = fs.readFileSync(testZipPath);

    // Test extracting only markdown
    const result = await zipProcessor.processZipBuffer(zipBuffer, {
      extractMarkdown: true,
      extractAllFiles: false,
      itemId: 'test-item-id',
    });

    expect(result.markdownContent).toBeDefined();
    expect(typeof result.markdownContent).toBe('string');
    expect(result.markdownContent!.length).toBeGreaterThan(0);
    expect(result.extractedFiles).toBe(false);
  });

  it('should handle zip extraction with extractAllFilesAndMarkdownFromZip method', async () => {
    const testZipPath = path.resolve(
      __dirname,
      '../../tests/mineruPdf2MdConversionResult.zip',
    );

    if (!fs.existsSync(testZipPath)) {
      console.warn(
        `Test zip file not found at ${testZipPath}, skipping integration test`,
      );
      return;
    }

    const zipBuffer = fs.readFileSync(testZipPath);

    // Test the convenience method
    const result = await zipProcessor.extractAllFilesAndMarkdownFromZip(
      zipBuffer,
      'test-item-id',
    );

    expect(result).toBeDefined();
    expect(result.markdownContent).toBeDefined();
    expect(typeof result.markdownContent).toBe('string');
    expect(result.markdownContent!.length).toBeGreaterThan(0);
  });
});
