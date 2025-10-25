# Changelog

All notable changes to the S3 Service module will be documented in this file.

## [1.0.0] - 2024-10-24

### Added
- 🚀 **New Independent Module Structure**: Complete rewrite as independent npm package
- 📦 **Package Configuration**: Full package.json with proper dependencies and exports
- 🔧 **Configurable S3Service**: New class-based API with flexible configuration options
- 🏭 **Factory Functions**: Easy instantiation methods for different S3 providers
- 🧪 **Mock Service**: Built-in mock service for testing and development
- 📝 **TypeScript Support**: Full type definitions and interfaces
- 🔄 **Backward Compatibility**: All legacy functions still work without changes
- 📚 **Comprehensive Documentation**: README, migration guide, and examples
- 🧪 **Test Suite**: Complete test coverage for all functionality

### Features

#### S3Service Class
- Configurable constructor supporting both AWS S3 and Aliyun OSS
- Methods: `uploadToS3()`, `getSignedUploadUrl()`, `uploadPdfFromPath()`, `getSignedDownloadUrl()`, `deleteFromS3()`
- Enhanced error handling with custom error types
- Detailed upload results with URL, bucket, and key information

#### Factory Functions
- `createS3ServiceFromEnv()`: Create from environment variables (backward compatible)
- `createS3Service()`: Create with custom configuration
- `createAWSS3Service()`: AWS S3 optimized configuration
- `createAliyunOSSService()`: Aliyun OSS optimized configuration

#### Error Handling
- `S3ServiceError` class with specific error types
- `S3ServiceErrorType` enum for different error categories
- Detailed error information with original error context

#### Mock Service
- `MockS3Service` class for testing without real S3 connection
- Simulates delays and realistic behavior
- Error simulation capabilities for testing error scenarios

#### Legacy Compatibility
- All existing functions (`uploadToS3`, `getSignedUploadUrl`, `uploadPdfFromPath`, etc.) still work
- Environment variable configuration unchanged
- Drop-in replacement for existing code

### Documentation
- **README.md**: Comprehensive API documentation and usage examples
- **MIGRATION.md**: Step-by-step migration guide from legacy to new API
- **Examples**: Practical examples for common use cases
  - Basic upload operations
  - PDF processing workflows
  - Client-side upload scenarios
  - Error handling patterns

### Testing
- Complete test suite with Vitest
- Mock service for isolated testing
- Factory function testing
- Error handling validation
- TypeScript type checking

### Breaking Changes
None! The module maintains full backward compatibility.

### Migration Path
1. **No changes required**: Existing code continues to work
2. **Gradual migration**: Mix new and old APIs during transition
3. **Complete migration**: Move to new class-based API for enhanced features

### Technical Details
- **Package Name**: `@aikb/s3-service`
- **Main Export**: `S3Service` class and factory functions
- **Mock Export**: Available via `/mock` import path
- **Dependencies**: AWS SDK v3, minimal external dependencies
- **TypeScript**: Full type safety and IntelliSense support

### File Structure
```
libs/s3-service/
├── src/
│   ├── index.ts          # Main exports and legacy compatibility
│   ├── S3Service.ts     # Main S3Service class
│   ├── factory.ts        # Factory functions
│   ├── types.ts          # TypeScript interfaces and types
│   ├── mock.ts           # Mock service for testing
│   └── __tests__/       # Test files
├── examples/             # Usage examples
├── package.json          # Package configuration
├── tsconfig.json        # TypeScript configuration
├── vitest.config.ts     # Test configuration
├── README.md            # Documentation
├── MIGRATION.md         # Migration guide
└── CHANGELOG.md         # This file
```

### Dependencies
- **@aws-sdk/client-s3**: AWS S3 client
- **@aws-sdk/s3-request-presigner**: Signed URL generation
- **dotenv**: Environment variable loading (peer dependency)
- **typescript**: TypeScript support (dev dependency)
- **vitest**: Testing framework (dev dependency)

### Next Steps
- Consider adding support for other S3-compatible providers
- Implement multipart upload for large files
- Add upload progress tracking
- Consider adding file compression options