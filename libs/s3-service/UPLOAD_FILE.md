# uploadFile Function Guide

The `uploadFile` function provides a flexible and efficient way to upload files to S3-compatible storage services with intelligent caching.

## Overview

`uploadFile` is a standalone function that allows you to upload files using custom S3 configuration without needing to create a service instance. It includes intelligent caching for improved performance in frequent-upload scenarios.

## Function Signature

```typescript
async function uploadFile(
  s3Config: S3ServiceConfig,
  s3Key: string,
  buffer: Buffer,
  contentType: string,
  acl?: ObjectCannedACL
): Promise<UploadResult>
```

## Parameters

### s3Config: S3ServiceConfig

Configuration object for the S3 service:

```typescript
interface S3ServiceConfig {
  accessKeyId: string;        // AWS access key ID or Aliyun access key ID
  secretAccessKey: string;     // AWS secret access key or Aliyun secret access key
  bucketName: string;         // S3 bucket name
  region: string;              // AWS region or Aliyun region
  endpoint: string;            // S3 endpoint URL
  provider: 'aws' | 'aliyun'; // Provider type
}
```

### s3Key: string

The destination key (path) for the file in S3. This is the unique identifier for your file in the bucket.

### buffer: Buffer

The file content as a Buffer.

### contentType: string

MIME type of the file (e.g., 'text/plain', 'image/jpeg', 'application/pdf').

### acl?: ObjectCannedACL

Access Control List for the file. Defaults to 'private'. Common values:
- 'private' (default)
- 'public-read'
- 'public-read-write'
- 'authenticated-read'

## Return Value

```typescript
interface UploadResult {
  url: string;      // Public URL of the uploaded file
  bucket: string;   // Bucket name where file was uploaded
  key: string;      // S3 key of the uploaded file
}
```

## Usage Examples

### Basic Upload

```typescript
import { uploadFile, type S3ServiceConfig } from '@aikb/s3-service';

const s3Config: S3ServiceConfig = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  bucketName: process.env.AWS_BUCKET_NAME!,
  region: 'us-east-1',
  endpoint: 'https://s3.us-east-1.amazonaws.com',
  provider: 'aws',
};

const buffer = Buffer.from('Hello, World!');
const result = await uploadFile(
  s3Config,
  'hello.txt',
  buffer,
  'text/plain'
);

console.log('File uploaded to:', result.url);
```

### Upload with Public Access

```typescript
const result = await uploadFile(
  s3Config,
  'public-file.txt',
  buffer,
  'text/plain',
  'public-read'  // Make file publicly accessible
);
```

### Upload Image File

```typescript
import fs from 'fs';

const imageBuffer = fs.readFileSync('./image.jpg');
const result = await uploadFile(
  s3Config,
  'images/profile.jpg',
  imageBuffer,
  'image/jpeg',
  'private'
);

console.log('Image uploaded to:', result.url);
```

## Performance Optimization

### Intelligent Caching

The `uploadFile` function includes intelligent caching that automatically:

1. **Caches S3 Service Instances**: Reuses service instances for identical configurations
2. **LRU Eviction**: Automatically removes least recently used instances when cache is full
3. **Memory Management**: Limits cache size to prevent memory leaks

### Cache Management

```typescript
import { 
  getS3ServiceCacheStats,
  clearS3ServiceCache,
  preloadS3ServiceCache 
} from '@aikb/s3-service';

// Check cache statistics
const stats = getS3ServiceCacheStats();
console.log('Cache size:', stats.size);
console.log('Cache hit rate:', stats.hitRate);

// Clear cache if needed
await clearS3ServiceCache();

// Preload common configurations
const commonConfigs = [
  getProductionConfig(),
  getStagingConfig(),
  getTestConfig(),
];
await preloadS3ServiceCache(commonConfigs);
```

## Best Practices

### 1. Use Consistent Configuration

For best performance, use the same configuration object for multiple uploads:

```typescript
// ✅ Good: Reuse configuration
const s3Config = { /* config */ };
const results = await Promise.all([
  uploadFile(s3Config, 'file1.txt', buffer1, 'text/plain'),
  uploadFile(s3Config, 'file2.txt', buffer2, 'text/plain'),
  uploadFile(s3Config, 'file3.txt', buffer3, 'text/plain'),
]);

// ❌ Avoid: Creating different configs
const results = await Promise.all([
  uploadFile({ ...config1, bucketName: 'bucket1' }, 'file1.txt', buffer1, 'text/plain'),
  uploadFile({ ...config2, bucketName: 'bucket2' }, 'file2.txt', buffer2, 'text/plain'),
  uploadFile({ ...config3, bucketName: 'bucket3' }, 'file3.txt', buffer3, 'text/plain'),
]);
```

### 2. Handle Errors Appropriately

```typescript
import { S3ServiceError, S3ServiceErrorType } from '@aikb/s3-service';

try {
  const result = await uploadFile(s3Config, 'file.txt', buffer, 'text/plain');
  console.log('Upload successful:', result.url);
} catch (error) {
  if (error instanceof S3ServiceError) {
    switch (error.type) {
      case S3ServiceErrorType.UPLOAD_ERROR:
        console.error('Upload failed:', error.message);
        break;
      case S3ServiceErrorType.CONFIGURATION_ERROR:
        console.error('Configuration error:', error.message);
        break;
      case S3ServiceErrorType.NETWORK_ERROR:
        console.error('Network error:', error.message);
        break;
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### 3. Use Appropriate Content Types

```typescript
const contentTypes = {
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const getFileContentType = (filename: string): string => {
  const ext = filename.toLowerCase().split('.').pop();
  return contentTypes[`.${ext}`] || 'application/octet-stream';
};
```

## Migration from uploadToS3

If you're migrating from the legacy `uploadToS3` function:

### Before (Legacy)

```typescript
import { uploadToS3 } from '@aikb/s3-service';

// Requires environment variables to be set
const url = await uploadToS3(buffer, fileName, contentType, acl);
```

### After (uploadFile)

```typescript
import { uploadFile, type S3ServiceConfig } from '@aikb/s3-service';

const s3Config: S3ServiceConfig = {
  accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.OSS_SECRET_ACCESS_KEY!,
  bucketName: process.env.PDF_OSS_BUCKET_NAME!,
  region: process.env.OSS_REGION!,
  endpoint: process.env.S3_ENDPOINT!,
  provider: 'aws',
};

const result = await uploadFile(s3Config, fileName, buffer, contentType, acl);
const url = result.url; // Same as legacy function
```

## Comparison with Other Methods

| Feature | uploadFile | uploadToS3 (Legacy) | S3Service.uploadToS3 |
|----------|-------------|----------------------|------------------------|
| Flexible Config | ✅ | ❌ (Env vars only) | ✅ |
| Intelligent Caching | ✅ | ❌ | ✅ (Instance reuse) |
| Type Safety | ✅ | ✅ | ✅ |
| Error Handling | ✅ | ✅ | ✅ |
| Performance | 🚀 Fast | 🐢 Slower | 🚀 Fast |
| Simplicity | ✅ One function | ✅ One function | ❌ Requires instance |

## When to Use uploadFile

### ✅ Use uploadFile when:

- You need flexible S3 configuration
- You want automatic performance optimization
- You're uploading files with different configurations
- You prefer a simple function-based API
- You want intelligent caching without managing instances

### ✅ Use S3Service when:

- You're doing many uploads with the same configuration
- You need other S3 operations (download, delete, etc.)
- You want to reuse service instances manually
- You need advanced service features

### ✅ Use Legacy uploadToS3 when:

- You're maintaining existing code
- You're using environment variables only
- You need a quick migration path

## Troubleshooting

### Common Issues

#### Issue: "Configuration error"
**Cause**: Missing or invalid S3 configuration
**Solution**: Ensure all required fields in `S3ServiceConfig` are provided

#### Issue: "Upload failed"
**Cause**: Network issues, invalid credentials, or S3 service problems
**Solution**: Check credentials, network connectivity, and S3 service status

#### Issue: "Access denied"
**Cause**: Invalid credentials or insufficient permissions
**Solution**: Verify access keys and bucket permissions

#### Issue: Slow performance
**Cause**: Creating new configurations for each upload
**Solution**: Reuse configuration objects or use S3Service instances

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
// Set debug environment variable
process.env.DEBUG = 's3-service';

// Now uploadFile will log detailed information
const result = await uploadFile(s3Config, 'debug.txt', buffer, 'text/plain');
```

## Advanced Usage

### Custom Provider Configuration

```typescript
// AWS S3
const awsConfig: S3ServiceConfig = {
  accessKeyId: 'aws-access-key',
  secretAccessKey: 'aws-secret-key',
  bucketName: 'aws-bucket',
  region: 'us-east-1',
  endpoint: 'https://s3.us-east-1.amazonaws.com',
  provider: 'aws',
};

// Aliyun OSS
const aliyunConfig: S3ServiceConfig = {
  accessKeyId: 'aliyun-access-key',
  secretAccessKey: 'aliyun-secret-key',
  bucketName: 'aliyun-bucket',
  region: 'oss-cn-hangzhou',
  endpoint: 'https://oss-cn-hangzhou.aliyuncs.com',
  provider: 'aliyun',
};
```

### Batch Upload with Progress

```typescript
const files = [
  { name: 'file1.txt', buffer: buffer1 },
  { name: 'file2.txt', buffer: buffer2 },
  { name: 'file3.txt', buffer: buffer3 },
];

const results = [];
for (let i = 0; i < files.length; i++) {
  try {
    const result = await uploadFile(s3Config, files[i].name, files[i].buffer, 'text/plain');
    results.push(result);
    console.log(`Uploaded ${i + 1}/${files.length}: ${result.url}`);
  } catch (error) {
    console.error(`Failed to upload ${files[i].name}:`, error);
  }
}
```

## Conclusion

The `uploadFile` function provides the best balance of simplicity, flexibility, and performance for most use cases. It's ideal for:

- New projects starting with S3 integration
- Applications requiring flexible configuration
- Scenarios with varying S3 configurations
- Developers who prefer function-based APIs

For enterprise applications with high-volume uploads, consider using `S3Service` instances directly for maximum control and performance.