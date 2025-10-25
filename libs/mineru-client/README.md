# @aikb/mineru-client

An independent TypeScript client for the MinerU API, providing document parsing and conversion capabilities.

## Features

- Single file document parsing
- Batch file processing
- Batch URL processing
- Automatic retry logic with configurable delays
- Comprehensive error handling
- File download management
- Support for multiple output formats (PDF, DOCX, HTML, LaTeX)
- OCR support for scanned documents
- Formula and table extraction
- Multi-language support

## Installation

```bash
npm install @aikb/mineru-client
# or
pnpm add @aikb/mineru-client
# or
yarn add @aikb/mineru-client
```

### Peer Dependencies

This package requires the following peer dependencies:

```bash
npm install @aikb/s3-service dotenv
# or
pnpm add @aikb/s3-service dotenv
# or
yarn add @aikb/s3-service dotenv
```

## Quick Start

```typescript
import { MinerUClient, MinerUDefaultConfig } from '@aikb/mineru-client';

// Initialize the client
const client = new MinerUClient({
  token: 'your-mineru-api-token',
  downloadDir: './downloads',
  defaultOptions: {
    is_ocr: false,
    enable_formula: true,
    enable_table: true,
    language: 'ch',
    model_version: 'pipeline',
  },
});

// Process a single file
const result = await client.processSingleFile({
  url: 'https://example.com/document.pdf',
  is_ocr: true,
  language: 'en'
});

if (result.result.state === 'done') {
  console.log('Processing completed successfully');
  console.log('Downloaded files:', result.downloadedFiles);
}
```

## Configuration

### MinerUConfig

```typescript
interface MinerUConfig {
  token: string;                    // Required: API authentication token
  baseUrl?: string;                 // Optional: API base URL (default: 'https://mineru.net/api/v4')
  timeout?: number;                  // Optional: Request timeout in ms (default: 30000)
  maxRetries?: number;               // Optional: Maximum retry attempts (default: 3)
  retryDelay?: number;               // Optional: Retry delay in ms (default: 1000)
  downloadDir: string;               // Required: Directory for downloaded files
  defaultOptions: {
    is_ocr: boolean;                // Enable OCR for scanned documents
    enable_formula: boolean;         // Extract mathematical formulas
    enable_table: boolean;           // Extract tables
    language: 'en' | 'ch';          // Document language
    model_version: 'pipeline';       // Model version to use
  };
}
```

## API Methods

### Single File Processing

#### `processSingleFile(request, options?)`

Process a single file from start to finish, including task creation, monitoring, and result download.

```typescript
const result = await client.processSingleFile({
  url: 'https://example.com/document.pdf',
  is_ocr: true,
  enable_formula: true,
  enable_table: true,
  language: 'en',
  data_id: 'my-document-001',
  page_ranges: '1-10',
  extra_formats: ['docx', 'html'],
  model_version: 'pipeline'
}, {
  pollInterval: 5000,    // Polling interval in ms
  timeout: 300000,       // Maximum wait time in ms
  downloadDir: './downloads' // Download directory
});
```

#### `createSingleFileTask(request)`

Create a single file parsing task without waiting for completion.

```typescript
const taskId = await client.createSingleFileTask({
  url: 'https://example.com/document.pdf',
  is_ocr: true,
  language: 'en'
});
```

#### `getTaskResult(taskId)`

Get the current status and result of a task.

```typescript
const result = await client.getTaskResult(taskId);
console.log('Task state:', result.state);
```

#### `waitForTaskCompletion(taskId, options?)`

Wait for a task to complete and optionally download results.

```typescript
const { result, downloadedFiles } = await client.waitForTaskCompletion(taskId, {
  pollInterval: 5000,
  timeout: 300000,
  downloadDir: './downloads'
});
```

### Batch Processing

#### `processBatchUrls(request, options?)`

Process multiple URLs in batch.

```typescript
const result = await client.processBatchUrls({
  enable_formula: true,
  enable_table: true,
  language: 'en',
  files: [
    {
      url: 'https://example.com/doc1.pdf',
      is_ocr: false,
      data_id: 'doc-001'
    },
    {
      url: 'https://example.com/doc2.pdf',
      is_ocr: true,
      data_id: 'doc-002'
    }
  ]
});
```

#### `createBatchUrlTask(request)`

Create a batch URL processing task.

```typescript
const batchId = await client.createBatchUrlTask({
  files: [
    { url: 'https://example.com/doc1.pdf' },
    { url: 'https://example.com/doc2.pdf' }
  ]
});
```

#### `getBatchTaskResults(batchId)`

Get results for a batch task.

```typescript
const results = await client.getBatchTaskResults(batchId);
console.log('Batch results:', results.extract_result);
```

### Utility Methods

#### `validateToken()`

Validate if the API token is valid.

```typescript
const isValid = await client.validateToken();
console.log('Token valid:', isValid);
```

#### `cancelTask(taskId)`

Cancel a running task.

```typescript
const cancelled = await client.cancelTask(taskId);
console.log('Task cancelled:', cancelled);
```

#### `getAccountInfo()`

Get account information and quota status.

```typescript
const accountInfo = await client.getAccountInfo();
console.log('Account info:', accountInfo);
```

### Static Methods

#### `MinerUClient.isValidFileFormat(fileName)`

Check if a file format is supported.

```typescript
const isValid = MinerUClient.isValidFileFormat('document.pdf');
console.log('File format valid:', isValid);
```

#### `MinerUClient.getSupportedLanguages()`

Get list of supported languages.

```typescript
const languages = MinerUClient.getSupportedLanguages();
console.log('Supported languages:', languages);
```

## Error Handling

The client provides custom error classes for better error handling:

```typescript
import { MinerUApiError, MinerUTimeoutError } from '@aikb/mineru-client';

try {
  await client.processSingleFile({ url: 'invalid-url' });
} catch (error) {
  if (error instanceof MinerUApiError) {
    console.error('API Error:', error.code, error.message, error.traceId);
  } else if (error instanceof MinerUTimeoutError) {
    console.error('Timeout Error:', error.message);
  } else {
    console.error('Unexpected Error:', error);
  }
}
```

## Environment Variables

You can set the following environment variables:

```bash
MINERU_TOKEN=your-api-token
```

## File Upload Support

For batch file processing with local files, you need to install the S3 service package:

```bash
npm install @aikb/s3-service
```

Then you can use the batch file processing methods:

```typescript
// This requires @aikb/s3-service to be installed
const result = await client.processBatchFiles([
  {
    filePath: './local-document.pdf',
    is_ocr: true,
    data_id: 'local-doc-001'
  }
]);
```

## Supported File Formats

- PDF (.pdf)
- Word documents (.doc, .docx)
- PowerPoint presentations (.ppt, .pptx)
- Images (.png, .jpg, .jpeg)

## Supported Languages

- Chinese (ch)
- English (en)
- Japanese (japan)
- Korean (korean)
- French (fr)
- German (german)
- Spanish (spanish)
- Russian (russian)
- Arabic (arabic)
- Italian (italian)
- Portuguese (portuguese)
- And many more...

## License

UNLICENSED

## Contributing

Please read the contributing guidelines before submitting pull requests.