import { S3Client, PutObjectCommand, ObjectCannedACL, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as fs from 'fs';
import * as path from 'path';

import { config } from 'dotenv';
config()

// Validate required environment variables
const requiredEnvVars = ['OSS_ACCESS_KEY_ID', 'OSS_SECRET_ACCESS_KEY', 'PDF_OSS_BUCKET_NAME'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

/**
 * S3 client instance configured with environment variables
 */
const s3Client = new S3Client({
  region: process.env.OSS_REGION ,
  endpoint: `https://${process.env.OSS_REGION}.${process.env.S3_ENDPOINT}`,
  credentials: {
    accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.OSS_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: false, // Use virtual hosted style for Aliyun OSS
  // Add custom configuration for Aliyun OSS
  signingRegion: process.env.OSS_REGION || "us-east-1",
});

/**
 * S3 bucket name for PDF storage
 */
const BUCKET_NAME = process.env.PDF_OSS_BUCKET_NAME!;

/**
 * Uploads a buffer to S3 and returns the public URL of the uploaded file
 *
 * @param buffer - The file content to upload as a Buffer
 * @param fileName - The name/key for the file in S3
 * @param contentType - The MIME type of the file (e.g., 'application/pdf')
 * @param acl - The access control level for the uploaded file. Note: ACL is not supported by Aliyun OSS
 * @returns Promise resolving to the URL of the uploaded file
 * @throws Error if upload fails due to AWS S3 issues or invalid parameters
 *
 * @example
 * ```typescript
 * const fileBuffer = fs.readFileSync('./document.pdf');
 * const url = await uploadToS3(fileBuffer, 'documents/doc.pdf', 'application/pdf', 'public-read');
 * console.log('File uploaded to:', url);
 * ```
 */
export async function uploadToS3(
  buffer: Buffer,
  fileName: string,
  contentType: string,
  acl: ObjectCannedACL = "private", // Changed default to private for better security
): Promise<string> {
  try {
    console.log(`[S3Service] Uploading to S3: bucket=${BUCKET_NAME}, key=${fileName}, contentType=${contentType}`);
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
      // Remove ACL parameter for Aliyun OSS compatibility
    });

    console.log(`[S3Service] Sending command to S3...`);
    await s3Client.send(command);
    console.log(`[S3Service] Upload successful`);

    // Use virtual hosted style URL for Aliyun OSS
    const endpoint = `${process.env.OSS_REGION}.${process.env.S3_ENDPOINT}`
    const url = `https://${BUCKET_NAME}.${endpoint}/${fileName}`;
    console.log(`[S3Service] Generated URL: ${url}`);
    return url;
  } catch (error) {
    console.error("[S3Service] Error uploading to S3:", error);
    // Provide more specific error information
    if (error instanceof Error) {
      console.error(`[S3Service] Error details: ${error.name} - ${error.message}`);
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
    console.error("[S3Service] Unknown error type");
    throw new Error("Failed to upload file to S3: Unknown error");
  }
}

/**
 * Generates a presigned URL for direct upload to S3 from client-side applications
 *
 * @param fileName - The name/key for the file in S3
 * @param contentType - The MIME type of the file (e.g., 'application/pdf')
 * @param expiresIn - The expiration time for the signed URL in seconds. Defaults to 3600 (1 hour)
 * @param acl - The access control level for the uploaded file. Note: ACL is not supported by Aliyun OSS
 * @returns Promise resolving to a presigned URL that can be used for direct uploads
 * @throws Error if URL generation fails due to AWS S3 issues or invalid parameters
 *
 * @example
 * ```typescript
 * const signedUrl = await getSignedUploadUrl('uploads/resume.pdf', 'application/pdf', 1800, 'public-read');
 * // Use this URL in a client-side form or fetch request to upload directly to S3
 * ```
 */
export async function getSignedUploadUrl(
  s3Key: string,
  contentType: string,
  expiresIn: number = 3600,
  acl: ObjectCannedACL = "private", // Changed default to private for better security
): Promise<string> {
  try {
    console.log(`[S3Service] Generating signed URL: bucket=${BUCKET_NAME}, key=${s3Key}, expiresIn=${expiresIn}`);
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: contentType,
      // Remove ACL parameter for Aliyun OSS compatibility
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    console.log(`[S3Service] Signed URL generated successfully`);
    return signedUrl;
  } catch (error) {
    console.error("[S3Service] Error generating signed URL:", error);
    // Provide more specific error information
    if (error instanceof Error) {
      console.error(`[S3Service] Error details: ${error.name} - ${error.message}`);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
    console.error("[S3Service] Unknown error type");
    throw new Error("Failed to generate signed URL: Unknown error");
  }
}

/**
 * Uploads a PDF file from a local file path to S3
 *
 * @param pdfPath - The local file system path to the PDF file
 * @param s3Key - Optional custom key/name for the file in S3. If not provided, uses the filename from pdfPath
 * @param acl - The access control level for the uploaded file. Note: ACL is not supported by Aliyun OSS
 * @returns Promise resolving to the URL of the uploaded PDF file
 * @throws Error if file doesn't exist, is not a PDF, or upload fails
 *
 * @example
 * ```typescript
 * // Upload with default filename
 * const url1 = await uploadPdfFromPath('./documents/report.pdf');
 *
 * // Upload with custom S3 key
 * const url2 = await uploadPdfFromPath('./temp/report.pdf', 'reports/annual-2023.pdf', 'public-read');
 * ```
 */
export async function uploadPdfFromPath(
  pdfPath: string,
  s3Key?: string,
  acl: ObjectCannedACL = "private"
): Promise<string> {
  try {
    console.log(`[S3Service] uploadPdfFromPath: path=${pdfPath}, s3Key=${s3Key}`);
    
    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found at path: ${pdfPath}`);
    }

    // Check if file is a PDF
    const fileExtension = path.extname(pdfPath).toLowerCase();
    if (fileExtension !== '.pdf') {
      throw new Error(`File is not a PDF: ${pdfPath}`);
    }

    // Read the PDF file
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log(`[S3Service] Read PDF file: ${pdfBuffer.length} bytes`);
    
    // Use filename from path if s3Key is not provided
    const fileName = s3Key || path.basename(pdfPath);
    console.log(`[S3Service] Using fileName: ${fileName}`);
    
    // Upload to S3 using the existing uploadToS3 function
    const result = await uploadToS3(pdfBuffer, fileName, 'application/pdf', acl);
    console.log(`[S3Service] uploadPdfFromPath successful: ${result}`);
    return result;
  } catch (error) {
    console.error("[S3Service] Error uploading PDF from path:", error);
    if (error instanceof Error) {
      console.error(`[S3Service] Error details: ${error.name} - ${error.message}`);
      throw new Error(`Failed to upload PDF from path: ${error.message}`);
    }
    console.error("[S3Service] Unknown error type");
    throw new Error("Failed to upload PDF from path: Unknown error");
  }
}


export async function getSignedUrlForDownload(bucketName: string, s3Key: string, expiresInSeconds = 3600) {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
  });
  return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}