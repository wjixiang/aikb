# Migration Guide: From Legacy API to New S3Service

This guide helps you migrate from the legacy S3Service functions to the new class-based API.

## Overview

The new S3Service module provides:
- ✅ **Backward Compatibility**: All legacy functions still work
- 🚀 **Enhanced Features**: New class-based API with more functionality
- 🔧 **Better Configuration**: Flexible configuration options
- 🧪 **Improved Testing**: Built-in mock service for testing
- 📝 **Type Safety**: Full TypeScript support

## Quick Migration Path

### Option 1: Keep Using Legacy API (No Changes Required)

Your existing code will continue to work without any changes:

```typescript
// This still works exactly as before
import { uploadToS3, getSignedUploadUrl } from '@aikb/s3-service';

const url = await uploadToS3(buffer, 'file.txt', 'text/plain');
const signedUrl = await getSignedUploadUrl('file.txt', 'text/plain');
```

### Option 2: Gradual Migration to New API

You can gradually migrate to the new API while keeping legacy functions for existing code:

```typescript
import { createS3ServiceFromEnv, uploadToS3, uploadFile } from '@aikb/s3-service';

// New code uses class-based API
const s3Service = createS3ServiceFromEnv();
const result = await s3Service.uploadToS3(buffer, 'new-file.txt', { contentType: 'text/plain' });

// Or use the new uploadFile function with flexible parameters
const s3Config = {
  accessKeyId: 'your-access-key',
  secretAccessKey: 'your-secret-key',
  bucketName: 'your-bucket',
  region: 'us-east-1',
  endpoint: 'https://s3.us-east-1.amazonaws.com',
  provider: 'aws' as const,
};
const uploadResult = await uploadFile(s3Config, 'flexible-file.txt', buffer, 'text/plain');

// Existing code continues to work
const legacyUrl = await uploadToS3(buffer, 'old-file.txt', 'text/plain');
```

## Detailed Migration Examples

### 1. Basic Upload

#### Before (Legacy)
```typescript
import { uploadToS3 } from '@aikb/s3-service';

const url = await uploadToS3(buffer, 'file.txt', 'text/plain', 'private');
console.log('Upload URL:', url);
```

#### After (New API)
```typescript
import { createS3ServiceFromEnv } from '@aikb/s3-service';

const s3Service = createS3ServiceFromEnv();
const result = await s3Service.uploadToS3(buffer, 'file.txt', { 
  contentType: 'text/plain',
  acl: 'private' 
});

console.log('Upload URL:', result.url);
console.log('Bucket:', result.bucket); // New: Additional info
console.log('Key:', result.key); // New: Additional info
```

### 2. Signed URL Generation

#### Before (Legacy)
```typescript
import { getSignedUploadUrl } from '@aikb/s3-service';

const signedUrl = await getSignedUploadUrl('file.txt', 'text/plain', 3600, 'private');
```

#### After (New API)
```typescript
import { createS3ServiceFromEnv } from '@aikb/s3-service';

const s3Service = createS3ServiceFromEnv();
const signedUrl = await s3Service.getSignedUploadUrl('file.txt', {
  contentType: 'text/plain',
  expiresIn: 3600,
  acl: 'private'
});
```

### 3. PDF Upload from Path

#### Before (Legacy)
```typescript
import { uploadPdfFromPath } from '@aikb/s3-service';

const url = await uploadPdfFromPath('/path/to/file.pdf', 's3-key.pdf', 'private');
```

#### After (New API)
```typescript
import { createS3ServiceFromEnv } from '@aikb/s3-service';

const s3Service = createS3ServiceFromEnv();
const result = await s3Service.uploadPdfFromPath('/path/to/file.pdf', 's3-key.pdf', {
  acl: 'private'
});

console.log('Upload URL:', result.url);
```

### 4. Download URL Generation

#### Before (Legacy)
```typescript
import { getPdfDownloadUrl, getSignedUrlForDownload } from '@aikb/s3-service';

const pdfUrl = await getPdfDownloadUrl('file.pdf');
const customUrl = await getSignedUrlForDownload('bucket', 'key', 3600);
```

#### After (New API)
```typescript
import { createS3ServiceFromEnv } from '@aikb/s3Service';

const s3Service = createS3ServiceFromEnv();

// For PDF download (same as any file)
const pdfUrl = await s3Service.getSignedDownloadUrl('file.pdf');

// For custom bucket
const customUrl = await s3Service.getSignedDownloadUrl('key', {
  bucketName: 'bucket',
  expiresIn: 3600
});
```

### 5. File Deletion

#### Before (Legacy)
```typescript
import { deleteFromS3 } from '@aikb/s3-service';

const success = await deleteFromS3('file.txt');
```

#### After (New API)
```typescript
import { createS3ServiceFromEnv } from '@aikb/s3-service';

const s3Service = createS3ServiceFromEnv();
const success = await s3Service.deleteFromS3('file.txt');
```

## Configuration Migration

### Environment Variables (No Changes)

The same environment variables work for both APIs:

```bash
# Required for both legacy and new API
OSS_ACCESS_KEY_ID=your_access_key
OSS_SECRET_ACCESS_KEY=your_secret_key
PDF_OSS_BUCKET_NAME=your_bucket_name
OSS_REGION=your_region
S3_ENDPOINT=your_endpoint
```

### Custom Configuration (New Feature)

The new API allows custom configuration without environment variables:

```typescript
import { createS3Service, createAWSS3Service, createAliyunOSSService } from '@aikb/s3-service';

// Custom configuration
const s3Service = createS3Service({
  accessKeyId: 'your-key',
  secretAccessKey: 'your-secret',
  bucketName: 'your-bucket',
  region: 'us-east-1',
  endpoint: 'amazonaws.com',
  forcePathStyle: true
});

// AWS S3 optimized
const awsService = createAWSS3Service('key', 'secret', 'bucket', 'us-east-1');

// Aliyun OSS optimized
const ossService = createAliyunOSSService('key', 'secret', 'bucket', 'oss-cn-hangzhou');
```

## Error Handling Migration

### Before (Legacy)
```typescript
import { uploadToS3 } from '@aikb/s3-service';

try {
  await uploadToS3(buffer, 'file.txt', 'text/plain');
} catch (error) {
  console.error('Upload failed:', error.message);
}
```

### After (New API)
```typescript
import { createS3ServiceFromEnv, S3ServiceError, S3ServiceErrorType } from '@aikb/s3-service';

const s3Service = createS3ServiceFromEnv();

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

## Testing Migration

### Before (Legacy Testing)
```typescript
// You had to mock AWS SDK manually
vi.mock('@aws-sdk/client-s3', () => {
  // Complex mocking setup...
});
```

### After (New API)
```typescript
import { MockS3Service } from '@aikb/s3-service/mock';

// Simple mock service for testing
const mockService = new MockS3Service();
const result = await mockService.uploadToS3(buffer, 'file.txt', { contentType: 'text/plain' });
```

## Benefits of Migrating

1. **Better Error Handling**: Specific error types with detailed information
2. **More Configuration Options**: Support for different S3 providers
3. **Enhanced Testing**: Built-in mock service
4. **Type Safety**: Full TypeScript support
5. **Future-Proof**: New features will be added to the class-based API
6. **Better Performance**: Reuse service instances instead of creating new connections

## Migration Checklist

- [ ] Identify all S3Service usage in your codebase
- [ ] Decide on migration strategy (gradual vs. complete)
- [ ] Update imports to use new API
- [ ] Replace function calls with method calls
- [ ] Update error handling to use new error types
- [ ] Update tests to use MockS3Service
- [ ] Test thoroughly in development environment
- [ ] Deploy to production

## Common Migration Issues

### Issue: Environment Variables Not Found
**Solution**: Ensure all required environment variables are set when using `createS3ServiceFromEnv()`

### Issue: Import Errors
**Solution**: Update imports from legacy functions to new class-based imports

### Issue: Type Errors
**Solution**: Update parameter objects to match new interface (e.g., `{ contentType, acl }` instead of separate parameters)

### Issue: Error Handling
**Solution**: Update catch blocks to handle `S3ServiceError` instances

## Need Help?

- Check the [README.md](./README.md) for detailed API documentation
- Look at the [examples](./examples/) for practical usage
- Review the [test files](./src/__tests__) for implementation details
- Open an issue for migration-specific questions