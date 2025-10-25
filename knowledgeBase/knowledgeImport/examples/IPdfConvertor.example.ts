/**
 * Example demonstrating how to use the IPdfConvertor interface
 * with the MinerUPdfConvertor implementation
 */

import { MinerUPdfConvertor } from '../../../lib/MinerU/MinerUPdfConvertor';
import type { IPdfConvertor } from '../IPdfConvertor';
import { createMinerUConvertorFromEnv } from '../../../lib/pdfConvertor/PdfConvertor';

async function exampleUsingMinerUConvertor() {
  console.log('=== Example 1: Using MinerUPdfConvertor directly ===');

  // Create a converter with explicit configuration
  const converter = new MinerUPdfConvertor({
    token: 'your-token-here',
    baseUrl: 'https://mineru.net/api/v4',
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    downloadDir: './downloads',
    defaultOptions: {
      is_ocr: false,
      enable_formula: true,
      enable_table: true,
      language: 'en',
    },
  });

  // Use the converter via the interface
  await demonstrateConverterUsage(converter);
}

async function exampleUsingEnvironmentConfig() {
  console.log('\n=== Example 2: Using environment configuration ===');

  // Create a converter using environment variables
  // Make sure to set MINERU_TOKEN in your environment
  const converter = createMinerUConvertorFromEnv({
    downloadDir: './env-downloads',
    defaultOptions: {
      is_ocr: true,
      enable_formula: true,
      enable_table: true,
      language: 'ch',
    },
  });

  // Use the converter via the interface
  await demonstrateConverterUsage(converter);
}

async function exampleWithInterfaceType() {
  console.log('\n=== Example 3: Using IPdfConvertor interface type ===');

  // Create a converter and type it as IPdfConvertor
  const converter: IPdfConvertor = createMinerUConvertorFromEnv();

  // This demonstrates that any implementation of IPdfConvertor can be used
  // interchangeably, making the code more flexible and testable
  await demonstrateConverterUsage(converter);
}

async function demonstrateConverterUsage(converter: IPdfConvertor) {
  try {
    // Example 1: Convert a local PDF file
    console.log('Converting local PDF file...');
    const localResult = await converter.convertPdfToMarkdown(
      '/path/to/local/file.pdf',
      { is_ocr: true }, // Optional parameters
    );
    console.log(
      'Local conversion result:',
      localResult.success ? 'Success' : 'Failed',
    );

    // Example 2: Convert a PDF from S3 URL
    console.log('Converting PDF from S3 URL...');
    const s3Result = await converter.convertPdfToMarkdownFromS3(
      'https://your-s3-bucket.s3.amazonaws.com/file.pdf',
      { enable_formula: true }, // Optional parameters
    );
    console.log(
      'S3 conversion result:',
      s3Result.success ? 'Success' : 'Failed',
    );

    // Example 3: Process multiple files
    console.log('Processing multiple files...');
    const multipleResults = await converter.processMultipleFiles?.([
      '/path/to/file1.pdf',
      '/path/to/file2.pdf',
      '/path/to/file3.pdf',
    ]);
    if (multipleResults) {
      const successCount = multipleResults.filter((r) => r.success).length;
      console.log(
        `Multiple processing: ${successCount}/${multipleResults.length} files processed successfully`,
      );
    }

    // Example 4: Process URLs in batch
    console.log('Processing URLs in batch...');
    const urlResults = await converter.processUrls?.([
      'https://example.com/file1.pdf',
      'https://example.com/file2.pdf',
    ]);
    if (urlResults) {
      const successCount = urlResults.filter((r) => r.success).length;
      console.log(
        `URL processing: ${successCount}/${urlResults.length} URLs processed successfully`,
      );
    }

    // Example 5: Get download directory
    if (converter.getDownloadDirectory) {
      console.log(
        'Current download directory:',
        converter.getDownloadDirectory(),
      );
    }

    // Example 6: Set download directory
    if (converter.setDownloadDirectory) {
      converter.setDownloadDirectory('./custom-downloads');
      console.log('Download directory updated');
    }

    // Example 7: Validate token (if supported)
    if (converter.validateToken) {
      const isValid = await converter.validateToken();
      console.log('Token validation:', isValid ? 'Valid' : 'Invalid');
    }

    // Example 8: Cleanup old downloads
    if (converter.cleanupDownloadedFiles) {
      await converter.cleanupDownloadedFiles(24); // Clean files older than 24 hours
      console.log('Download cleanup completed');
    }
  } catch (error) {
    console.error('Error during conversion:', error);
  }
}

// Example of how to create a custom PDF converter implementation
class CustomPdfConvertor implements IPdfConvertor {
  async convertPdfToMarkdown(pdfPath: string, options?: any): Promise<any> {
    // Custom implementation
    console.log(`Custom converter processing: ${pdfPath}`);
    return {
      success: true,
      data: 'Custom markdown content',
      taskId: 'custom-task-id',
    };
  }

  async convertPdfToMarkdownFromS3(s3Url: string, options?: any): Promise<any> {
    // Custom implementation
    console.log(`Custom converter processing S3 URL: ${s3Url}`);
    return {
      success: true,
      data: 'Custom markdown content from S3',
      taskId: 'custom-s3-task-id',
    };
  }

  // Implement other required methods as needed
  async processLocalFile(filePath: string, options?: any): Promise<any> {
    throw new Error('Not implemented');
  }

  async processMultipleFiles(
    filePaths: string[],
    options?: any,
  ): Promise<any[]> {
    throw new Error('Not implemented');
  }

  async processUrls(urls: string[], options?: any): Promise<any[]> {
    throw new Error('Not implemented');
  }

  async cancelTask(taskId: string): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async getTaskStatus(taskId: string): Promise<any> {
    throw new Error('Not implemented');
  }

  async validateToken(): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async cleanupDownloadedFiles(olderThanHours?: number): Promise<void> {
    throw new Error('Not implemented');
  }

  getDownloadDirectory(): string {
    throw new Error('Not implemented');
  }

  setDownloadDirectory(directory: string): void {
    throw new Error('Not implemented');
  }
}

async function exampleWithCustomConverter() {
  console.log('\n=== Example 4: Using custom PDF converter implementation ===');

  const customConverter = new CustomPdfConvertor();
  await demonstrateConverterUsage(customConverter);
}

// Run all examples
export async function runAllExamples() {
  // Note: These examples are for demonstration purposes only
  // They won't actually run without proper configuration and valid files

  console.log('IPdfConvertor Interface Examples');
  console.log('================================');

  // Uncomment the following lines to run the examples:
  // await exampleUsingMinerUConvertor();
  // await exampleUsingEnvironmentConfig();
  // await exampleWithInterfaceType();
  // await exampleWithCustomConverter();

  console.log(
    '\nExamples completed. Uncomment the function calls above to run them.',
  );
}
