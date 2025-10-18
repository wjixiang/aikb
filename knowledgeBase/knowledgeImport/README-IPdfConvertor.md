# IPdfConvertor Interface

This document describes the `IPdfConvertor` interface and its implementation in the MinerUPdfConvertor class.

## Overview

The `IPdfConvertor` interface defines a contract for PDF converter implementations. It provides a standardized way to convert PDF files to markdown format, supporting various input sources and processing options.

## Interface Definition

The `IPdfConvertor` interface is defined in [`IPdfConvertor.ts`](./IPdfConvertor.ts) and includes the following methods:

### Core Methods

- `convertPdfToMarkdown(pdfPath: string, options?: any): Promise<ConversionResult>`
  - Convert a local PDF file to markdown
  - Parameters:
    - `pdfPath`: Path to the PDF file
    - `options`: Optional conversion parameters
  - Returns: Promise resolving to a `ConversionResult` object

- `convertPdfToMarkdownFromS3(s3Url: string, options?: any): Promise<ConversionResult>`
  - Convert a PDF file from an S3 URL to markdown
  - Parameters:
    - `s3Url`: The S3 download URL of the PDF
    - `options`: Optional conversion parameters
  - Returns: Promise resolving to a `ConversionResult` object

### Optional Methods

- `processLocalFile(filePath: string, options?: any): Promise<ConversionResult>`
  - Process a local PDF file using batch upload

- `processMultipleFiles(filePaths: string[], options?: any): Promise<ConversionResult[]>`
  - Process multiple local files

- `processUrls(urls: string[], options?: any): Promise<ConversionResult[]>`
  - Process URLs in batch

- `cancelTask(taskId: string): Promise<boolean>`
  - Cancel a running task

- `getTaskStatus(taskId: string): Promise<any>`
  - Get the status of a task

- `validateToken(): Promise<boolean>`
  - Validate the API token (if applicable)

- `cleanupDownloadedFiles(olderThanHours?: number): Promise<void>`
  - Clean up downloaded files older than specified hours

- `getDownloadDirectory(): string`
  - Get the current download directory

- `setDownloadDirectory(directory: string): void`
  - Set the download directory

## Implementation

### MinerUPdfConvertor

The `MinerUPdfConvertor` class in [`MinerUPdfConvertor.ts`](./MinerU/MinerUPdfConvertor.ts) implements the `IPdfConvertor` interface. It provides integration with the MinerU API for PDF conversion.

#### Key Features

- Support for local files and S3 URLs
- Batch processing capabilities
- Task management (cancel, status check)
- Download management
- Token validation
- Configurable processing options
- **Automatic image extraction and S3 upload** from ZIP files

#### Usage Example

```typescript
import { MinerUPdfConvertor } from './MinerU/MinerUPdfConvertor';
import type { IPdfConvertor } from './IPdfConvertor';

// Create a converter instance
const converter = new MinerUPdfConvertor({
  token: 'your-api-token',
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

// Use the converter
const result = await converter.convertPdfToMarkdownFromS3(
  'https://your-s3-bucket.s3.amazonaws.com/file.pdf'
);

if (result.success) {
  console.log('Conversion successful:', result.data);
  
  // Check for uploaded images
  if (result.uploadedImages && result.uploadedImages.length > 0) {
    console.log(`Uploaded ${result.uploadedImages.length} images to S3:`);
    result.uploadedImages.forEach(img => {
      console.log(`  ${img.originalPath} -> ${img.s3Url}`);
      console.log(`  S3 Key: ${img.fileName}`);
    });
  }
} else {
  console.error('Conversion failed:', result.error);
}
```

### AbstractPdfConvertor

The `AbstractPdfConvertor` class in [`AbstractPdfConvertor.ts`](./AbstractPdfConvertor.ts) provides a base implementation that implements the `IPdfConvertor` interface with default error-throwing implementations for optional methods. This allows concrete implementations to focus on the core methods they need.

## Factory Functions

The [`PdfConvertor.ts`](./PdfConvertor.ts) module provides factory functions for creating converter instances:

- `createMinerUConvertor(config)`: Create a MinerU converter with explicit configuration
- `createMinerUConvertorFromEnv(options)`: Create a MinerU converter using environment variables

## Type Definitions

### ConversionResult

The `ConversionResult` type represents the result of a PDF conversion operation:

```typescript
interface ConversionResult {
  success: boolean;
  data?: any;
  error?: string;
  downloadedFiles?: string[];
  taskId?: string;
}
```

### MinerUPdfConvertorConfig

The `MinerUPdfConvertorConfig` type defines the configuration options for the MinerU converter:

```typescript
interface MinerUPdfConvertorConfig {
  token?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  defaultOptions?: Partial<SingleFileRequest>;
  downloadDir?: string;
}
```

## Testing

The interface implementation is tested in [`IPdfConvertor.test.ts`](./__tests__/IPdfConvertor.test.ts). The test verifies that the `MinerUPdfConvertor` class correctly implements the `IPdfConvertor` interface.

## Examples

See [`IPdfConvertor.example.ts`](./examples/IPdfConvertor.example.ts) for comprehensive examples of how to use the interface with different implementations.

## Image Upload Feature

The MinerUPdfConvertor implementation includes automatic image extraction and upload functionality:

### How It Works

1. When processing a ZIP file from MinerU, the converter automatically:
   - Extracts markdown content from the ZIP file
   - Identifies all images in the `/images` directory
   - Uploads each image to S3 with a unique timestamped filename
   - Updates the markdown content to reference the S3 URLs instead of local paths

2. Supported image formats:
   - JPEG (.jpg, .jpeg)
   - PNG (.png)
   - GIF (.gif)
   - SVG (.svg)
   - WebP (.webp)

3. Image URL replacement:
   - Replaces `images/filename.jpg` with S3 URL
   - Replaces `./images/filename.jpg` with S3 URL
   - Replaces absolute paths with S3 URL

### Configuration

Image upload uses the same S3 configuration as PDF uploads:
- `OSS_ACCESS_KEY_ID`: S3 access key
- `OSS_SECRET_ACCESS_KEY`: S3 secret key
- `PDF_OSS_BUCKET_NAME`: S3 bucket name
- `OSS_REGION`: S3 region
- `S3_ENDPOINT`: S3 endpoint

### Error Handling

- If image upload fails, the conversion continues successfully
- Failed uploads are logged but don't stop the process
- The markdown content remains unchanged for failed uploads

## Benefits

1. **Standardization**: Provides a consistent interface for PDF conversion across different implementations
2. **Flexibility**: Allows swapping between different PDF converter implementations without changing client code
3. **Testability**: Makes it easy to mock PDF converters in unit tests
4. **Extensibility**: Optional methods allow implementations to provide additional functionality
5. **Type Safety**: TypeScript interface ensures compile-time checking of method signatures
6. **Automatic Image Management**: Handles image extraction and S3 upload seamlessly

## Future Enhancements

Potential future enhancements to the interface could include:

- Progress reporting callbacks
- Streaming conversion for large files
- Additional output formats (JSON, XML, etc.)
- Caching mechanisms
- Retry policies
- Metrics and monitoring hooks