# @aikb/s3-service

A configurable and independent S3 service module for file upload, download, and management. Supports both AWS S3 and Aliyun OSS.

## Features

- 🚀 **Configurable**: Works with both AWS S3 and Aliyun OSS
- 📦 **Independent**: Can be used as a standalone npm package
- 🔄 **Backward Compatible**: Maintains compatibility with existing code
- 🧪 **Testable**: Includes comprehensive test suite and mock service
- 📝 **TypeScript**: Full TypeScript support with type definitions
- 🔧 **Flexible**: Multiple factory functions for easy instantiation

## Installation

```bash
npm install @aikb/s3-service
# or
pnpm add @aikb/s3-service
# or
yarn add @aikb/s3-service
```

## Quick Start

### Using Environment Variables (Backward Compatible)

```typescript
import { uploadToS3, getSignedUploadUrl } from '@aikb/s3-service';

// Set environment variables:
// OSS_ACCESS_KEY_ID=your_access_key
// OSS_SECRET_ACCESS_KEY=your_secret_key
// PDF_OSS_BUCKET_NAME=your_bucket_name
// OSS_REGION=your_region
// S3_ENDPOINT=your_endpoint

// Upload a file
const buffer = Buffer.from('Hello, World!');
const url = await uploadToS3(buffer, 'hello.txt', 'text/plain');
console.log('File uploaded to:', url);

// Generate signed URL for client-side upload
const signedUrl = await getSignedUploadUrl('client-upload.txt', 'text/plain');
console.log('Signed URL:', signedUrl);
```

### Using the New Class-based API

```typescript
import { S3Service, createAWSS3Service, createAliyunOSSService } from '@aikb/s3-service';

// For AWS S3
const s3Service = createAWSS3Service(
  'your-access-key',
  'your-secret-key',
  'your-bucket-name',
  'us-east-1'
);

// For Aliyun OSS
const ossService = createAliyunOSSService(
  'your-access-key',
  'your-secret-key',
  'your-bucket-name',
  'oss-cn-hangzhou'
);

// Upload a file
const result = await s3Service.uploadToS3(
  Buffer.from('Hello, World!'),
  'hello.txt',
  { contentType: 'text/plain' }
);

console.log('Upload result:', result);
// Output: { url: 'https://bucket-name.s3.us-east-1.amazonaws.com/hello.txt', bucket: 'bucket-name', key: 'hello.txt' }
```

## API Reference

### S3Service Class

The main class for S3/OSS operations.

#### Constructor

```typescript
new S3Service(config: S3ServiceConfig)
```

#### Configuration

```typescript
interface S3ServiceConfig {
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  region: string;
  endpoint: string;
  forcePathStyle?: boolean; // true for AWS S3, false for Aliyun OSS
  signingRegion?: string;
}
```

#### Methods

##### uploadToS3

Uploads a buffer to S3/OSS.

```typescript
async uploadToS3(
  buffer: Buffer,
  fileName: string,
  options: UploadOptions
): Promise<UploadResult>
```

##### getSignedUploadUrl

Generates a presigned URL for client-side uploads.

```typescript
async getSignedUploadUrl(
  fileName: string,
  options: SignedUrlOptions
): Promise<string>
```

##### uploadPdfFromPath

Uploads a PDF file from local path.

```typescript
async uploadPdfFromPath(
  pdfPath: string,
  s3Key?: string,
  options?: { acl?: ObjectCannedACL }
): Promise<UploadResult>
```

##### getSignedDownloadUrl

Generates a presigned URL for downloads.

```typescript
async getSignedDownloadUrl(
  s3Key: string,
  options?: DownloadUrlOptions & { bucketName?: string }
): Promise<string>
```

##### deleteFromS3

Deletes a file from S3/OSS.

```typescript
async deleteFromS3(s3Key: string): Promise<boolean>
```

### Factory Functions

#### createS3ServiceFromEnv

Creates an S3Service instance from environment variables.

```typescript
import { createS3ServiceFromEnv } from '@aikb/s3-service';

const s3Service = createS3ServiceFromEnv();
```

#### createS3Service

Creates an S3Service instance with custom configuration.

```typescript
import { createS3Service } from '@aikb/s3-service';

const s3Service = createS3Service({
  accessKeyId: 'your-key',
  secretAccessKey: 'your-secret',
  bucketName: 'your-bucket',
  region: 'us-east-1',
  endpoint: 'amazonaws.com',
  forcePathStyle: true,
});
```

#### createAWSS3Service

Creates an S3Service instance optimized for AWS S3.

```typescript
import { createAWSS3Service } from '@aikb/s3-service';

const s3Service = createAWSS3Service(
  'your-access-key',
  'your-secret-key',
  'your-bucket-name',
  'us-east-1'
);
```

#### createAliyunOSSService

Creates an S3Service instance optimized for Aliyun OSS.

```typescript
import { createAliyunOSSService } from '@aikb/s3-service';

const ossService = createAliyunOSSService(
  'your-access-key',
  'your-secret-key',
  'your-bucket-name',
  'oss-cn-hangzhou'
);
```

## Error Handling

The service provides custom error types for better error handling:

```typescript
import { S3ServiceError, S3ServiceErrorType } from '@aikb/s3-service';

try {
  await s3Service.uploadToS3(buffer, 'file.txt', { contentType: 'text/plain' });
} catch (error) {
  if (error instanceof S3ServiceError) {
    switch (error.type) {
      case S3ServiceErrorType.UPLOAD_ERROR:
        console.error('Upload failed:', error.message);
        break;
      case S3ServiceErrorType.CONFIGURATION_ERROR:
        console.error('Configuration error:', error.message);
        break;
      // ... other error types
    }
  }
}
```

## Testing

### Using the Mock Service

For testing purposes, you can use the included mock service:

```typescript
import { MockS3Service } from '@aikb/s3-service/mock';

const mockService = new MockS3Service({
  bucketName: 'test-bucket',
  region: 'test-region',
  endpoint: 'test-endpoint.com',
});

// Use the same API as the real service
const result = await mockService.uploadToS3(
  Buffer.from('test'),
  'test.txt',
  { contentType: 'text/plain' }
);
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Migration from Legacy API

If you're using the legacy API, you can easily migrate to the new class-based API:

### Before (Legacy)

```typescript
import { uploadToS3, uploadPdfFromPath } from '@aikb/s3-service';

const url = await uploadToS3(buffer, 'file.txt', 'text/plain');
const pdfUrl = await uploadPdfFromPath('/path/to/file.pdf');
```

### After (New API)

```typescript
import { createS3ServiceFromEnv } from '@aikb/s3-service';

const s3Service = createS3ServiceFromEnv();

const result = await s3Service.uploadToS3(buffer, 'file.txt', { contentType: 'text/plain' });
const pdfResult = await s3Service.uploadPdfFromPath('/path/to/file.pdf');

// The new API provides more detailed results
console.log(result.url); // Same as before
console.log(result.bucket); // Additional info
console.log(result.key); // Additional info
```

## Examples

See the `examples/` directory for complete usage examples:

- [Basic Upload](examples/basic-upload.ts)
- [PDF Processing](examples/pdf-processing.ts)
- [Client-side Upload](examples/client-side-upload.ts)
- [Error Handling](examples/error-handling.ts)

## License

UNLICENSED

## Contributing

Please read our contributing guidelines before submitting pull requests.