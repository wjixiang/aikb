import { config } from 'dotenv';
import { S3Service } from './S3Service';
import { S3ServiceConfig } from './types';

/**
 * Creates an S3Service instance from environment variables
 * This provides backward compatibility with the original implementation
 * 
 * Environment variables required:
 * - OSS_ACCESS_KEY_ID: AWS/Aliyun OSS access key ID
 * - OSS_SECRET_ACCESS_KEY: AWS/Aliyun OSS secret access key
 * - PDF_OSS_BUCKET_NAME: Default bucket name for PDF operations
 * - OSS_REGION: S3/OSS region
 * - S3_ENDPOINT: S3/OSS endpoint (without protocol)
 * 
 * @returns Configured S3Service instance
 * @throws Error if required environment variables are missing
 */
export function createS3ServiceFromEnv(): S3Service {
  // Load environment variables
  config();

  // Validate required environment variables
  const requiredEnvVars = [
    'OSS_ACCESS_KEY_ID',
    'OSS_SECRET_ACCESS_KEY',
    'PDF_OSS_BUCKET_NAME',
    'OSS_REGION',
    'S3_ENDPOINT',
  ];
  
  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`,
    );
  }

  const s3Config: S3ServiceConfig = {
    accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.OSS_SECRET_ACCESS_KEY!,
    bucketName: process.env.PDF_OSS_BUCKET_NAME!,
    region: process.env.OSS_REGION!,
    endpoint: process.env.S3_ENDPOINT!,
    forcePathStyle: false, // Use virtual hosted style for Aliyun OSS
    signingRegion: process.env.OSS_REGION || 'us-east-1',
  };

  return new S3Service(s3Config);
}

/**
 * Creates an S3Service instance with custom configuration
 * 
 * @param config - S3Service configuration object
 * @returns Configured S3Service instance
 */
export function createS3Service(config: S3ServiceConfig): S3Service {
  return new S3Service(config);
}

/**
 * Creates an S3Service instance optimized for AWS S3
 * 
 * @param accessKeyId - AWS access key ID
 * @param secretAccessKey - AWS secret access key
 * @param bucketName - S3 bucket name
 * @param region - AWS region
 * @returns Configured S3Service instance for AWS S3
 */
export function createAWSS3Service(
  accessKeyId: string,
  secretAccessKey: string,
  bucketName: string,
  region: string = 'us-east-1'
): S3Service {
  return new S3Service({
    accessKeyId,
    secretAccessKey,
    bucketName,
    region,
    endpoint: 'amazonaws.com',
    forcePathStyle: true, // Use path style for AWS S3
  });
}

/**
 * Creates an S3Service instance optimized for Aliyun OSS
 * 
 * @param accessKeyId - Aliyun OSS access key ID
 * @param secretAccessKey - Aliyun OSS secret access key
 * @param bucketName - OSS bucket name
 * @param region - Aliyun OSS region
 * @returns Configured S3Service instance for Aliyun OSS
 */
export function createAliyunOSSService(
  accessKeyId: string,
  secretAccessKey: string,
  bucketName: string,
  region: string = 'oss-cn-hangzhou'
): S3Service {
  return new S3Service({
    accessKeyId,
    secretAccessKey,
    bucketName,
    region,
    endpoint: 'aliyuncs.com',
    forcePathStyle: false, // Use virtual hosted style for Aliyun OSS
  });
}