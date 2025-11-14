import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { uploadFile, type S3ServiceConfig } from '@aikb/s3-service';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME!;

// Internal S3 configuration for this project
const medquizS3Config: S3ServiceConfig = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION || 'us-east-1',
  bucketName: BUCKET_NAME,
  endpoint: `https://s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`,
  provider: 'aws',
};

/**
 * Internal wrapper function for uploading files to S3
 * Uses the new uploadFile function with project-specific configuration
 */
export async function uploadToS3(
  buffer: Buffer,
  fileName: string,
  contentType: string,
): Promise<string> {
  try {
    const result = await uploadFile(
      medquizS3Config,
      fileName,
      buffer,
      contentType,
      'public-read'
    );
    return result.url;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw new Error('Failed to upload file to S3');
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use uploadToS3 instead
 */
export async function uploadToS3Legacy(
  buffer: Buffer,
  fileName: string,
  contentType: string,
): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
    });

    await s3Client.send(command);

    return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${fileName}`;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw new Error('Failed to upload file to S3');
  }
}

export async function getSignedUploadUrl(
  fileName: string,
  contentType: string,
  expiresIn: number = 3600,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    ContentType: contentType,
    ACL: 'public-read',
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}
