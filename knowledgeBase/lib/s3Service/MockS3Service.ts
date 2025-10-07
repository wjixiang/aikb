// Mock S3 Service for testing purposes

import { config } from 'dotenv';
config()

export async function uploadToS3(
  buffer: Buffer,
  fileName: string,
  contentType: string,
  acl: string = "private",
): Promise<string> {
  console.log(`[MockS3Service] Mock uploading: bucket=mock-bucket, key=${fileName}, contentType=${contentType}`);
  
  // Simulate upload delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Return a mock URL
  const url = `https://mock-bucket.mock-endpoint.com/${fileName}`;
  console.log(`[MockS3Service] Mock upload successful: ${url}`);
  return url;
}

export async function getSignedUploadUrl(
  s3Key: string,
  contentType: string,
  expiresIn: number = 3600,
  acl: string = "private",
): Promise<string> {
  console.log(`[MockS3Service] Mock generating signed URL: key=${s3Key}, expiresIn=${expiresIn}`);
  
  // Return a mock signed URL
  const url = `https://mock-bucket.mock-endpoint.com/${s3Key}?signature=mock-signature`;
  console.log(`[MockS3Service] Mock signed URL generated: ${url}`);
  return url;
}

export async function uploadPdfFromPath(
  pdfPath: string,
  s3Key?: string,
  acl: string = "private"
): Promise<string> {
  console.log(`[MockS3Service] Mock uploadPdfFromPath: path=${pdfPath}, s3Key=${s3Key}`);
  
  // Simulate upload delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Return a mock URL
  const fileName = s3Key || pdfPath.split('/').pop() || 'mock-file.pdf';
  const url = `https://mock-bucket.mock-endpoint.com/${fileName}`;
  console.log(`[MockS3Service] Mock uploadPdfFromPath successful: ${url}`);
  return url;
}