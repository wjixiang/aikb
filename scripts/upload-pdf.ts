#!/usr/bin/env npx tsx

/**
 * PDF Upload Script
 *
 * This script handles the complete workflow for uploading a PDF file:
 * 1. Get presigned S3 URL
 * 2. Upload PDF to S3
 * 3. Create Library Item
 * 4. Add the uploaded PDF as an archive to the item
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { S3Service, createS3ServiceFromEnv } from '@aikb/s3-service';
import { S3Utils } from 'utils';
import { HashUtils } from 'bibliography';
import { PDFDocument } from 'pdf-lib';

// Configuration interface
interface UploadConfig {
  pdfPath: string;
  title?: string;
  authors?: Array<{ name: string; affiliation?: string }>;
  abstract?: string;
  publicationYear?: number;
  publisher?: string;
  isbn?: string;
  doi?: string;
  url?: string;
  tags?: string[];
  notes?: string;
  collections?: string[];
  language?: string;
}

// Result interface
interface UploadResult {
  success: boolean;
  itemId?: string;
  s3Key?: string;
  uploadUrl?: string;
  error?: string;
}

/**
 * Calculate page count from PDF buffer using pdf-lib
 */
async function getPageCount(pdfBuffer: Buffer): Promise<number> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    return pdfDoc.getPageCount();
  } catch (error) {
    console.warn(
      'Failed to get page count with pdf-lib, using fallback method:',
      error,
    );

    // Fallback method: simple heuristic to estimate page count
    const pdfString = pdfBuffer.toString('latin1');
    const pageMatches = pdfString.match(/\/Type\s*\/Page[^s]/g);

    if (pageMatches && pageMatches.length > 0) {
      return pageMatches.length;
    }

    // Alternative heuristic: look for endobj patterns
    const endObjMatches = pdfString.match(/endobj/g);
    if (endObjMatches && endObjMatches.length > 0) {
      // Rough estimate: assume every 10 endobj patterns might be a page
      return Math.ceil(endObjMatches.length / 10);
    }

    // Default fallback
    return 1;
  }
}

/**
 * Upload file to S3 using presigned URL
 */
async function uploadFileToS3(
  uploadUrl: string,
  filePath: string,
): Promise<void> {
  const fileBuffer = fs.readFileSync(filePath);

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/pdf',
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to upload file: ${response.statusText} (${response.status})`,
    );
  }
}

/**
 * Create a library item via API
 */
async function createLibraryItem(metadata: any): Promise<any> {
  const apiUrl =
    process.env.BIBLIOGRAPHY_SERVICE_URL || 'http://localhost:3000';

  const response = await fetch(`${apiUrl}/api/library-items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create library item: ${response.statusText} (${response.status}) - ${errorText}`,
    );
  }

  return response.json();
}

/**
 * Add archive to library item via API
 */
async function addArchiveToItem(
  itemId: string,
  archiveData: any,
): Promise<any> {
  const apiUrl =
    process.env.BIBLIOGRAPHY_SERVICE_URL || 'http://localhost:3000';

  const response = await fetch(
    `${apiUrl}/api/library-items/${itemId}/archives`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(archiveData),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to add archive to item: ${response.statusText} (${response.status}) - ${errorText}`,
    );
  }

  return response.json();
}

/**
 * Get presigned upload URL via API
 */
async function getPdfUploadUrl(
  fileName: string,
  expiresIn: number = 3600,
): Promise<any> {
  const apiUrl =
    process.env.BIBLIOGRAPHY_SERVICE_URL || 'http://localhost:3000';

  const response = await fetch(`${apiUrl}/api/library-items/upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName,
      expiresIn,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get upload URL: ${response.statusText} (${response.status}) - ${errorText}`,
    );
  }

  return response.json();
}

/**
 * Main upload function
 */
async function uploadPdf(config: UploadConfig): Promise<UploadResult> {
  try {
    console.log('Starting PDF upload process...');

    // Validate input
    if (!fs.existsSync(config.pdfPath)) {
      throw new Error(`PDF file not found: ${config.pdfPath}`);
    }

    const fileName = path.basename(config.pdfPath);
    const pdfBuffer = fs.readFileSync(config.pdfPath);
    const fileSize = pdfBuffer.length;
    const fileHash = HashUtils.generateHashFromBuffer(pdfBuffer);
    const pageCount = await getPageCount(pdfBuffer);

    console.log(`File: ${fileName}`);
    console.log(`Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Hash: ${fileHash}`);
    console.log(`Pages: ${pageCount}`);

    // Step 1: Get presigned S3 URL
    console.log('\nStep 1: Getting presigned upload URL...');
    const uploadUrlResponse = await getPdfUploadUrl(fileName);
    const { uploadUrl, s3Key } = uploadUrlResponse;
    console.log(`✓ Got upload URL`);
    console.log(`  S3 Key: ${s3Key}`);

    // Step 2: Upload PDF to S3
    console.log('\nStep 2: Uploading PDF to S3...');
    await uploadFileToS3(uploadUrl, config.pdfPath);
    console.log('✓ PDF uploaded successfully');

    // Step 3: Create Library Item
    console.log('\nStep 3: Creating library item...');
    const itemMetadata = {
      title: config.title || path.basename(config.pdfPath, '.pdf'),
      authors: config.authors || [{ name: 'Unknown Author' }],
      abstract: config.abstract,
      publicationYear: config.publicationYear,
      publisher: config.publisher,
      isbn: config.isbn,
      doi: config.doi,
      url: config.url,
      tags: config.tags || [],
      notes: config.notes,
      collections: config.collections || [],
      language: config.language || 'en',
    };

    const createdItem = await createLibraryItem(itemMetadata);

    // Extract ID from the nested metadata structure
    const itemId =
      createdItem.metadata?.id ||
      createdItem.id ||
      createdItem._id ||
      createdItem.itemId;

    if (!itemId) {
      console.error(
        'Created item response:',
        JSON.stringify(createdItem, null, 2),
      );
      throw new Error('Failed to extract item ID from response');
    }

    console.log(`✓ Library item created`);
    console.log(`  Item ID: ${itemId}`);

    // Step 4: Add PDF as archive to the item
    console.log('\nStep 4: Adding PDF as archive...');
    const archiveData = {
      fileType: 'pdf' as const,
      fileSize,
      fileHash,
      s3Key,
      pageCount,
    };

    const updatedItem = await addArchiveToItem(itemId, archiveData);
    console.log('✓ Archive added to item');

    return {
      success: true,
      itemId,
      s3Key,
      uploadUrl,
    };
  } catch (error) {
    console.error('Upload failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): UploadConfig {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage: npx tsx upload-pdf.ts <pdf-path> [options]

Arguments:
  pdf-path              Path to the PDF file to upload

Options:
  --title <title>       Title of the document
  --author <name>       Author name (can be used multiple times)
  --abstract <text>     Abstract of the document
  --year <year>         Publication year
  --publisher <name>    Publisher name
  --isbn <isbn>         ISBN number
  --doi <doi>           DOI identifier
  --url <url>           URL of the document
  --tags <tags>         Comma-separated tags
  --notes <notes>       Notes about the document
  --collections <cols>  Comma-separated collections
  --language <lang>     Language code (default: en)

Environment Variables:
  BIBLIOGRAPHY_SERVICE_URL    URL of the bibliography service (default: http://localhost:3000)
  
Examples:
  npx tsx upload-pdf.ts ./document.pdf --title "My Document" --author "John Doe"
  npx tsx upload-pdf.ts ./paper.pdf --title "Research Paper" --author "Jane Smith" --year 2023 --tags "research,science"
    `);
    process.exit(1);
  }

  const config: UploadConfig = {
    pdfPath: args[0],
    authors: [],
    tags: [],
    collections: [],
  };

  // Parse options
  for (let i = 1; i < args.length; i += 2) {
    const option = args[i];
    const value = args[i + 1];

    switch (option) {
      case '--title':
        config.title = value;
        break;
      case '--author':
        config.authors!.push({ name: value });
        break;
      case '--abstract':
        config.abstract = value;
        break;
      case '--year':
        config.publicationYear = parseInt(value, 10);
        break;
      case '--publisher':
        config.publisher = value;
        break;
      case '--isbn':
        config.isbn = value;
        break;
      case '--doi':
        config.doi = value;
        break;
      case '--url':
        config.url = value;
        break;
      case '--tags':
        config.tags = value.split(',').map((tag) => tag.trim());
        break;
      case '--notes':
        config.notes = value;
        break;
      case '--collections':
        config.collections = value.split(',').map((col) => col.trim());
        break;
      case '--language':
        config.language = value;
        break;
      default:
        console.warn(`Unknown option: ${option}`);
    }
  }

  return config;
}

/**
 * Main execution
 */
async function main() {
  try {
    const config = parseArgs();
    const result = await uploadPdf(config);

    if (result.success) {
      console.log('\n🎉 Upload completed successfully!');
      console.log(`Item ID: ${result.itemId}`);
      console.log(`S3 Key: ${result.s3Key}`);
      process.exit(0);
    } else {
      console.error('\n❌ Upload failed:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

export { uploadPdf };
export type { UploadConfig, UploadResult };
