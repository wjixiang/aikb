/**
 * Error Handling Example
 * 
 * This example demonstrates comprehensive error handling patterns for S3Service,
 * including custom error types, retry logic, and graceful degradation.
 */

import {
  S3Service,
  S3ServiceError,
  S3ServiceErrorType,
  createS3Service
} from '../src/index';
import { MockS3Service } from '../src/mock';

// Example 1: Basic error handling with try-catch
async function basicErrorHandlingExample() {
  console.log('=== Basic Error Handling Example ===');
  
  // Create service with invalid credentials to trigger errors
  const s3Service = createS3Service({
    accessKeyId: 'invalid-key',
    secretAccessKey: 'invalid-secret',
    bucketName: 'invalid-bucket',
    region: 'invalid-region',
    endpoint: 'invalid-endpoint.com',
  });
  
  try {
    await s3Service.uploadToS3(
      Buffer.from('test content'),
      'test.txt',
      { contentType: 'text/plain' }
    );
  } catch (error) {
    if (error instanceof S3ServiceError) {
      console.log('Caught S3ServiceError:');
      console.log('Type:', error.type);
      console.log('Message:', error.message);
      console.log('Original Error:', error.originalError?.message);
    } else {
      console.log('Caught unexpected error:', error);
    }
  }
}

// Example 2: Error handling with specific error types
async function specificErrorHandlingExample() {
  console.log('\n=== Specific Error Handling Example ===');
  
  const s3Service = createS3Service({
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    bucketName: 'test-bucket',
    region: 'us-east-1',
    endpoint: 'amazonaws.com',
  });
  
  try {
    // Try to upload a non-existent PDF file
    await s3Service.uploadPdfFromPath('/nonexistent/path/file.pdf');
  } catch (error) {
    if (error instanceof S3ServiceError) {
      switch (error.type) {
        case S3ServiceErrorType.FILE_NOT_FOUND:
          console.log('File not found error:', error.message);
          break;
        case S3ServiceErrorType.INVALID_FILE_TYPE:
          console.log('Invalid file type error:', error.message);
          break;
        case S3ServiceErrorType.UPLOAD_ERROR:
          console.log('Upload error:', error.message);
          break;
        default:
          console.log('Other S3ServiceError:', error.message);
      }
    }
  }
}

// Example 3: Retry logic with exponential backoff
async function retryLogicExample() {
  console.log('\n=== Retry Logic Example ===');
  
  const s3Service = createS3Service({
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    bucketName: 'test-bucket',
    region: 'us-east-1',
    endpoint: 'amazonaws.com',
  });
  
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt} of ${maxRetries}`);
      
      const result = await s3Service.uploadToS3(
        Buffer.from('test content with retry'),
        'retry-test.txt',
        { contentType: 'text/plain' }
      );
      
      console.log('✓ Upload successful:', result.url);
      return; // Success, exit retry loop
      
    } catch (error) {
      if (error instanceof S3ServiceError) {
        console.log(`✗ Attempt ${attempt} failed: ${error.message}`);
        
        // Don't retry on configuration errors
        if (error.type === S3ServiceErrorType.CONFIGURATION_ERROR) {
          console.log('Configuration error, not retrying');
          break;
        }
        
        // If this is the last attempt, don't wait
        if (attempt === maxRetries) {
          console.log('Max retries reached, giving up');
          break;
        }
        
        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.log('Unexpected error, not retrying:', error);
        break;
      }
    }
  }
}

// Example 4: Graceful degradation with mock service
async function gracefulDegradationExample() {
  console.log('\n=== Graceful Degradation Example ===');
  
  let s3Service: S3Service | MockS3Service;
  
  try {
    // Try to create real S3 service
    s3Service = createS3Service({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'invalid-key',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'invalid-secret',
      bucketName: process.env.S3_BUCKET_NAME || 'invalid-bucket',
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || 'amazonaws.com',
    });
    
    // Test the connection
    await s3Service.uploadToS3(
      Buffer.from('connection test'),
      'connection-test.txt',
      { contentType: 'text/plain' }
    );
    
    console.log('✓ Real S3 service is working');
    
  } catch (error) {
    console.log('✗ Real S3 service failed, falling back to mock service');
    
    // Fall back to mock service
    s3Service = new MockS3Service({
      bucketName: 'fallback-bucket',
      region: 'fallback-region',
      endpoint: 'mock-endpoint.com',
    });
    
    console.log('✓ Using mock service for development/testing');
  }
  
  // Continue with the service (real or mock)
  try {
    const result = await s3Service.uploadToS3(
      Buffer.from('graceful degradation test'),
      'degradation-test.txt',
      { contentType: 'text/plain' }
    );
    
    console.log('Upload successful with fallback service:', result.url);
  } catch (error) {
    console.error('Even fallback service failed:', error);
  }
}

// Example 5: Comprehensive error logging
async function comprehensiveErrorLoggingExample() {
  console.log('\n=== Comprehensive Error Logging Example ===');
  
  const s3Service = createS3Service({
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    bucketName: 'test-bucket',
    region: 'us-east-1',
    endpoint: 'amazonaws.com',
  });
  
  // Custom error logger
  const logError = (error: S3ServiceError, context: string) => {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      context,
      errorType: error.type,
      message: error.message,
      originalError: error.originalError?.message,
      stack: error.originalError?.stack,
    };
    
    console.log('Error logged:', JSON.stringify(errorInfo, null, 2));
    
    // In a real application, you might send this to a logging service
    // await sendToLoggingService(errorInfo);
  };
  
  try {
    await s3Service.uploadPdfFromPath('/nonexistent/file.pdf');
  } catch (error) {
    if (error instanceof S3ServiceError) {
      logError(error, 'PDF upload from path');
    }
  }
  
  try {
    await s3Service.getSignedUploadUrl('test.txt', { contentType: 'text/plain' });
  } catch (error) {
    if (error instanceof S3ServiceError) {
      logError(error, 'Signed URL generation');
    }
  }
}

// Example 6: Error recovery strategies
async function errorRecoveryExample() {
  console.log('\n=== Error Recovery Example ===');
  
  const s3Service = createS3Service({
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    bucketName: 'test-bucket',
    region: 'us-east-1',
    endpoint: 'amazonaws.com',
  });
  
  const uploadWithRecovery = async (buffer: Buffer, fileName: string, contentType: string) => {
    try {
      // Try primary upload
      return await s3Service.uploadToS3(buffer, fileName, { contentType });
    } catch (error) {
      if (error instanceof S3ServiceError) {
        console.log(`Primary upload failed: ${error.message}`);
        
        // Recovery strategy 1: Try with different filename
        if (error.type === S3ServiceErrorType.UPLOAD_ERROR) {
          const alternativeName = `recovery-${Date.now()}-${fileName}`;
          console.log(`Trying alternative filename: ${alternativeName}`);
          
          try {
            return await s3Service.uploadToS3(buffer, alternativeName, { contentType });
          } catch (retryError) {
            console.log(`Alternative filename also failed: ${retryError}`);
          }
        }
        
        // Recovery strategy 2: Try with different content type
        if (error.type === S3ServiceErrorType.UPLOAD_ERROR && contentType === 'application/pdf') {
          console.log('Trying with generic binary content type');
          
          try {
            return await s3Service.uploadToS3(buffer, fileName, { contentType: 'application/octet-stream' });
          } catch (retryError) {
            console.log(`Generic content type also failed: ${retryError}`);
          }
        }
        
        // Recovery strategy 3: Save to local filesystem as last resort
        console.log('All recovery strategies failed, saving to local filesystem');
        const fs = require('fs');
        const path = require('path');
        
        const localPath = path.join('./failed-uploads', fileName);
        fs.mkdirSync('./failed-uploads', { recursive: true });
        fs.writeFileSync(localPath, buffer);
        
        console.log(`File saved locally to: ${localPath}`);
        
        // Return a mock result
        return {
          url: `file://${localPath}`,
          bucket: 'local-filesystem',
          key: localPath,
        };
      }
      
      throw error;
    }
  };
  
  try {
    const result = await uploadWithRecovery(
      Buffer.from('recovery test content'),
      'recovery-test.txt',
      'text/plain'
    );
    
    console.log('Upload with recovery successful:', result);
  } catch (error) {
    console.error('All recovery strategies failed:', error);
  }
}

// Run all examples
async function runExamples() {
  console.log('S3 Service Error Handling Examples\n');
  
  // Uncomment examples you want to run:
  // await basicErrorHandlingExample();
  // await specificErrorHandlingExample();
  // await retryLogicExample();
  // await gracefulDegradationExample();
  // await comprehensiveErrorLoggingExample();
  // await errorRecoveryExample();
  
  console.log('\nNote: Uncomment examples above to run them');
}

// Run if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

export {
  basicErrorHandlingExample,
  specificErrorHandlingExample,
  retryLogicExample,
  gracefulDegradationExample,
  comprehensiveErrorLoggingExample,
  errorRecoveryExample,
};