# MinerU API Integration Module

This module provides a comprehensive TypeScript/JavaScript client for the MinerU document parsing API, enabling seamless integration of PDF and document conversion capabilities into your applications.

## Overview

The MinerU API integration module consists of:

- **MinerUClient**: Low-level API client with full API coverage
- **MinerUPdfConvertor**: High-level converter extending AbstractPdfConvertor
- **Complete TypeScript support**: Full type definitions and interfaces
- **Error handling**: Comprehensive error handling and retry logic
- **Batch processing**: Support for multiple files and URLs
- **File management**: Automatic download and cleanup utilities

## Features

### ✅ Single File Processing
- Convert PDFs and other documents from URLs
- Support for local file upload
- Configurable OCR, formula, and table recognition
- Multiple output formats (JSON, Markdown, DOCX, HTML, LaTeX)

### ✅ Batch Processing
- Process up to 200 files simultaneously
- Batch URL processing
- Local file batch upload
- Individual task status tracking

### ✅ Advanced Features
- Automatic retry logic with configurable delays
- Progress monitoring and status tracking
- File download and management
- Cleanup utilities for old files
- Comprehensive error handling

### ✅ Supported Formats
- **Input**: PDF, DOC, DOCX, PPT, PPTX, PNG, JPG, JPEG
- **Output**: JSON (default), Markdown, DOCX, HTML, LaTeX

## Installation

### Prerequisites
- Node.js 16+ 
- TypeScript 4.5+ (for TypeScript projects)
- MinerU API token (get from [MinerU Console](https://mineru.net))

### Dependencies
```bash
# Install required dependencies
pnpm add axios

# For ZIP extraction (optional, for full JSON extraction)
pnpm add yauzl @types/yauzl
```

## Quick Start

### Basic Usage

```typescript
import { MinerUPdfConvertor } from './knowledgeImport/MinerUPdfConvertor';

// Initialize converter
const converter = new MinerUPdfConvertor({
  token: 'your-mineru-token-here',
  downloadDir: './downloads'
});

// Convert a PDF from URL
const result = await converter.convertPdfToJSON(
  'https://example.com/document.pdf',
  {
    is_ocr: true,
    enable_formula: true,
    enable_table: true,
    language: 'ch'
  }
);

if (result.success) {
  console.log('Conversion successful!');
  console.log('Data:', result.data);
  console.log('Files:', result.downloadedFiles);
} else {
  console.error('Conversion failed:', result.error);
}
```

### Environment Setup

```bash
# Set your MinerU token as environment variable
export MINERU_TOKEN="your-token-here"

# Or create a .env file
echo "MINERU_TOKEN=your-token-here" >> .env
```

## API Reference

### MinerUPdfConvertor

#### Constructor

```typescript
new MinerUPdfConvertor(config: MinerUPdfConvertorConfig)
```

**Configuration Options:**
```typescript
interface MinerUPdfConvertorConfig {
  token: string;                    // Required: MinerU API token
  baseUrl?: string;                 // Base URL (default: https://mineru.net/api/v4)
  timeout?: number;                 // Request timeout in ms (default: 30000)
  maxRetries?: number;              // Max retry attempts (default: 3)
  retryDelay?: number;              // Retry delay in ms (default: 1000)
  defaultOptions?: Partial<SingleFileRequest>; // Default processing options
  downloadDir?: string;             // Download directory (default: ./mineru-downloads)
}
```

#### Methods

##### `convertPdfToJSON(pdfPath, options?)`
Convert a PDF file or URL to JSON format.

**Parameters:**
- `pdfPath: string` - URL or local file path
- `options?: Partial<SingleFileRequest>` - Processing options

**Returns:** `Promise<ConversionResult>`

##### `processLocalFile(filePath, options?)`
Process a local file using batch upload.

**Parameters:**
- `filePath: string` - Local file path
- `options?: Partial<SingleFileRequest>` - Processing options

**Returns:** `Promise<ConversionResult>`

##### `processMultipleFiles(filePaths, options?)`
Process multiple local files in batches.

**Parameters:**
- `filePaths: string[]` - Array of local file paths
- `options?: Partial<SingleFileRequest>` - Processing options

**Returns:** `Promise<ConversionResult[]>`

##### `processUrls(urls, options?)`
Process multiple URLs in batches.

**Parameters:**
- `urls: string[]` - Array of URLs
- `options?: Partial<SingleFileRequest>` - Processing options

**Returns:** `Promise<ConversionResult[]>`

##### `getTaskStatus(taskId)`
Get the status of a specific task.

**Parameters:**
- `taskId: string` - Task ID

**Returns:** `Promise<TaskResult>`

##### `cleanupDownloadedFiles(olderThanHours?)`
Clean up downloaded files older than specified hours.

**Parameters:**
- `olderThanHours?: number` - Age in hours (default: 24)

**Returns:** `Promise<void>`

### Processing Options

```typescript
interface SingleFileRequest {
  url?: string;                              // File URL (for URL-based processing)
  is_ocr?: boolean;                          // Enable OCR (default: false)
  enable_formula?: boolean;                  // Enable formula recognition (default: true)
  enable_table?: boolean;                    // Enable table recognition (default: true)
  language?: string;                         // Document language (default: 'ch')
  data_id?: string;                          // Custom data ID
  callback?: string;                         // Callback URL for notifications
  seed?: string;                             // Seed for callback verification
  extra_formats?: ('docx' | 'html' | 'latex')[]; // Additional output formats
  page_ranges?: string;                      // Page ranges (e.g., '1-5,7,9-10')
  model_version?: 'pipeline' | 'vlm';        // Model version (default: 'pipeline')
}
```

### Supported Languages

```typescript
const supportedLanguages = [
  'ch', 'en', 'japan', 'korean', 'fr', 'german', 'spanish', 'russian',
  'arabic', 'italian', 'portuguese', 'romanian', 'bulgarian', 'ukrainian',
  'belarusian', 'tamil', 'telugu', 'kannada', 'thai', 'vietnamese', 'devanagari'
];
```

## Usage Examples

### Example 1: Basic URL Conversion

```typescript
import { MinerUPdfConvertor } from './MinerUPdfConvertor';

const converter = new MinerUPdfConvertor({
  token: process.env.MINERU_TOKEN!,
  defaultOptions: {
    is_ocr: true,
    enable_formula: true,
    enable_table: true,
    language: 'en'
  }
});

const result = await converter.convertPdfToJSON(
  'https://example.com/research-paper.pdf',
  {
    data_id: 'research-paper-2024',
    extra_formats: ['docx', 'html']
  }
);
```

### Example 2: Local File Processing

```typescript
const result = await converter.processLocalFile(
  './documents/contract.pdf',
  {
    is_ocr: false, // Don't use OCR for digital PDFs
    page_ranges: '1-10', // Process only first 10 pages
    data_id: 'contract-v1'
  }
);
```

### Example 3: Batch Processing

```typescript
// Process multiple local files
const files = [
  './docs/document1.pdf',
  './docs/document2.pdf',
  './docs/document3.pdf'
];

const results = await converter.processMultipleFiles(files, {
  is_ocr: true,
  language: 'ch',
  enable_formula: true
});

results.forEach((result, index) => {
  console.log(`File ${index + 1}: ${result.success ? 'Success' : 'Failed'}`);
});
```

### Example 4: URL Batch Processing

```typescript
const urls = [
  'https://arxiv.org/pdf/2301.07041.pdf',
  'https://arxiv.org/pdf/2301.07042.pdf'
];

const results = await converter.processUrls(urls, {
  is_ocr: true,
  enable_table: true,
  extra_formats: ['latex']
});
```

### Example 5: Advanced Client Usage

```typescript
import { MinerUClient } from './MinerUClient';

const client = new MinerUClient({
  token: process.env.MINERU_TOKEN!,
  maxRetries: 5,
  timeout: 120000
});

// Create task
const taskId = await client.createSingleFileTask({
  url: 'https://example.com/document.pdf',
  is_ocr: true,
  enable_formula: true,
  callback: 'https://your-server.com/webhook',
  seed: 'random-seed-123'
});

// Monitor progress
const result = await client.waitForTaskCompletion(taskId, {
  pollInterval: 3000,
  timeout: 600000
});
```

### Example 6: Error Handling

```typescript
try {
  const result = await converter.convertPdfToJSON(
    'https://example.com/document.pdf'
  );
  
  if (!result.success) {
    if (result.error?.includes('Token')) {
      console.error('Authentication error - check your token');
    } else if (result.error?.includes('format')) {
      console.error('Unsupported file format');
    } else {
      console.error('Processing error:', result.error);
    }
    return;
  }
  
  console.log('Success:', result.data);
} catch (error) {
  console.error('Unexpected error:', error);
}
```

### Example 7: File Management

```typescript
// Set custom download directory
converter.setDownloadDirectory('./my-downloads');

// Get current download directory
console.log('Download dir:', converter.getDownloadDirectory());

// Clean up old files
await converter.cleanupDownloadedFiles(48); // Clean files older than 48 hours
```

## Error Handling

The module provides comprehensive error handling with custom error classes:

```typescript
// API errors
class MinerUApiError extends Error {
  constructor(public code: string, message: string, public traceId?: string)
}

// Timeout errors
class MinerUTimeoutError extends Error {
  constructor(message: string)
}
```

### Common Error Codes

| Error Code | Description | Solution |
|------------|-------------|----------|
| A0202 | Token Error | Check if token is correct |
| A0211 | Token Expired | Replace with new token |
| -500 | Parameter Invalid | Check parameters and Content-Type |
| -60001 | Upload URL Generation Failed | Try again later |
| -60002 | File Format Not Supported | Check file extension |
| -60005 | File Size Exceeds Limit | Check file size (max 200MB) |
| -60006 | Page Count Exceeds Limit | Split file (max 600 pages) |

## Best Practices

### 1. Token Management
```typescript
// Use environment variables
const token = process.env.MINERU_TOKEN;
if (!token) {
  throw new Error('MINERU_TOKEN environment variable is required');
}
```

### 2. Retry Configuration
```typescript
const converter = new MinerUPdfConvertor({
  token,
  maxRetries: 5,        // Increase retries for unreliable networks
  retryDelay: 2000,     // Longer delays between retries
  timeout: 120000       // Longer timeout for large files
});
```

### 3. File Validation
```typescript
// Validate file before processing
if (!fs.existsSync(filePath)) {
  throw new Error(`File not found: ${filePath}`);
}

if (!MinerUClient.isValidFileFormat(filePath)) {
  throw new Error(`Unsupported format: ${filePath}`);
}
```

### 4. Memory Management
```typescript
// Clean up files regularly
setInterval(async () => {
  await converter.cleanupDownloadedFiles(24);
}, 60 * 60 * 1000); // Every hour
```

### 5. Progress Monitoring
```typescript
// Monitor task progress
const taskId = await converter.createSingleFileTask(request);

const monitorProgress = async () => {
  const status = await converter.getTaskStatus(taskId);
  
  if (status.extract_progress) {
    const { extracted_pages, total_pages, start_time } = status.extract_progress;
    const progress = (extracted_pages / total_pages) * 100;
    console.log(`Progress: ${progress.toFixed(1)}% (${extracted_pages}/${total_pages})`);
  }
  
  if (status.state === 'done' || status.state === 'failed') {
    clearInterval(intervalId);
  }
};

const intervalId = setInterval(monitorProgress, 5000);
```

## Limitations and Considerations

### API Limitations
- **File size**: Maximum 200MB per file
- **Page count**: Maximum 600 pages per file
- **Daily quota**: 2000 pages at highest priority
- **Batch size**: Maximum 200 files per batch
- **URL timeout**: GitHub, AWS URLs may timeout

### Implementation Notes
- ZIP extraction requires additional library (yauzl) for full JSON parsing
- Local file processing uses batch upload API
- Callback URLs must support POST method with JSON payload
- Downloaded files are stored locally and require manual cleanup

## Testing

Run the example files to test functionality:

```bash
# Run basic examples
npx tsx knowledgeImport/examples/mineru-examples.ts

# Set environment variable first
export MINERU_TOKEN="your-token-here"
```

## Troubleshooting

### Common Issues

1. **Token Authentication Errors**
   ```
   Error: MinerU API Error [A0202]: Token Error
   ```
   - Verify your token is correct
   - Check if token has expired
   - Ensure token has required permissions

2. **File Upload Failures**
   ```
   Error: Failed to upload file.pdf: Request timeout
   ```
   - Check file size (max 200MB)
   - Verify network connectivity
   - Increase timeout configuration

3. **Unsupported File Format**
   ```
   Error: Unsupported file format: document.txt
   ```
   - Check supported formats
   - Convert file to supported format
   - Verify file extension

4. **Rate Limiting**
   ```
   Error: MinerU API Error [-60009]: Task Submission Queue is Full
   ```
   - Wait and retry later
   - Implement exponential backoff
   - Reduce batch size

### Debug Mode

Enable debug logging:

```typescript
const converter = new MinerUPdfConvertor({
  token: process.env.MINERU_TOKEN!,
  // Add debug logging
  defaultOptions: {
    // ... options
  }
});

// Monitor all requests
console.log('Processing with config:', converter.config);
```

## Contributing

When contributing to this module:

1. Follow TypeScript best practices
2. Add comprehensive error handling
3. Include unit tests for new features
4. Update documentation for API changes
5. Maintain backward compatibility

## License

This module is part of the knowledge base project. Please refer to the main project license for usage terms.

## Support

For issues related to:
- **MinerU API**: Contact MinerU support
- **This module**: Create an issue in the project repository
- **Integration questions**: Check examples and documentation

---

*Last updated: 2024-01-20*