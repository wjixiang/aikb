/**
 * PDF Processing Example
 * 
 * This example demonstrates how to use the S3Service for PDF-specific operations,
 * including uploading PDFs from local paths and generating download URLs.
 */

import { S3Service, createS3ServiceFromEnv } from '../src/index';
import { uploadPdfFromPath } from '../src/index'; // Legacy function
import * as fs from 'fs';
import * as path from 'path';

// Example 1: Upload PDF from local path using new API
async function uploadPdfExample() {
  console.log('=== Upload PDF Example (New API) ===');
  
  const s3Service = createS3ServiceFromEnv(); // Uses environment variables
  
  try {
    // Note: Update this path to a real PDF file on your system
    const pdfPath = '/path/to/your/document.pdf';
    
    // Check if file exists before attempting upload
    if (!fs.existsSync(pdfPath)) {
      console.log(`PDF file not found at: ${pdfPath}`);
      console.log('Please update the pdfPath variable to point to a real PDF file');
      return;
    }

    // Upload with custom S3 key
    const result = await s3Service.uploadPdfFromPath(pdfPath, 'documents/my-document.pdf');
    
    console.log('PDF upload successful!');
    console.log('URL:', result.url);
    console.log('Bucket:', result.bucket);
    console.log('Key:', result.key);
    
    // Generate download URL
    const downloadUrl = await s3Service.getSignedDownloadUrl(result.key, { expiresIn: 3600 });
    console.log('Download URL (valid for 1 hour):', downloadUrl);
    
  } catch (error) {
    console.error('PDF upload failed:', error);
  }
}

// Example 2: Upload multiple PDFs from a directory
async function uploadMultiplePdfsExample() {
  console.log('\n=== Upload Multiple PDFs Example ===');
  
  const s3Service = createS3ServiceFromEnv();
  
  try {
    // Note: Update this path to a directory containing PDF files
    const pdfDirectory = '/path/to/your/pdf/directory';
    
    if (!fs.existsSync(pdfDirectory)) {
      console.log(`Directory not found: ${pdfDirectory}`);
      console.log('Please update the pdfDirectory variable to point to a real directory');
      return;
    }
    
    const files = fs.readdirSync(pdfDirectory);
    const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');
    
    console.log(`Found ${pdfFiles.length} PDF files`);
    
    for (const pdfFile of pdfFiles) {
      const filePath = path.join(pdfDirectory, pdfFile);
      const s3Key = `bulk-uploads/${pdfFile}`;
      
      try {
        const result = await s3Service.uploadPdfFromPath(filePath, s3Key);
        console.log(`✓ Uploaded ${pdfFile}: ${result.url}`);
      } catch (error) {
        console.error(`✗ Failed to upload ${pdfFile}:`, error);
      }
    }
    
  } catch (error) {
    console.error('Bulk upload failed:', error);
  }
}

// Example 3: PDF processing workflow
async function pdfWorkflowExample() {
  console.log('\n=== PDF Processing Workflow Example ===');
  
  const s3Service = createS3ServiceFromEnv();
  
  try {
    // Step 1: Upload PDF
    const pdfPath = '/path/to/your/document.pdf';
    
    if (!fs.existsSync(pdfPath)) {
      console.log(`PDF file not found at: ${pdfPath}`);
      console.log('Please update the pdfPath variable to point to a real PDF file');
      return;
    }
    
    console.log('Step 1: Uploading PDF...');
    const uploadResult = await s3Service.uploadPdfFromPath(pdfPath, 'workflow/document.pdf');
    console.log('✓ PDF uploaded:', uploadResult.url);
    
    // Step 2: Generate download URL for processing
    console.log('Step 2: Generating download URL...');
    const downloadUrl = await s3Service.getSignedDownloadUrl(uploadResult.key, { expiresIn: 1800 });
    console.log('✓ Download URL generated (valid for 30 minutes)');
    
    // Step 3: Simulate processing (in real scenario, you might process the PDF)
    console.log('Step 3: Simulating PDF processing...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing time
    console.log('✓ PDF processing completed');
    
    // Step 4: Upload processed version (if applicable)
    console.log('Step 4: Uploading processed version...');
    const processedBuffer = Buffer.from('Processed PDF content would go here');
    const processedResult = await s3Service.uploadToS3(
      processedBuffer,
      'workflow/document-processed.pdf',
      { contentType: 'application/pdf' }
    );
    console.log('✓ Processed PDF uploaded:', processedResult.url);
    
    // Step 5: Clean up original file (optional)
    console.log('Step 5: Cleaning up original file...');
    const deleted = await s3Service.deleteFromS3(uploadResult.key);
    if (deleted) {
      console.log('✓ Original PDF deleted');
    }
    
    console.log('Workflow completed successfully!');
    
  } catch (error) {
    console.error('Workflow failed:', error);
  }
}

// Example 4: Using legacy function
async function legacyPdfExample() {
  console.log('\n=== Legacy PDF Upload Example ===');
  
  // Note: This requires environment variables to be set
  // OSS_ACCESS_KEY_ID, OSS_SECRET_ACCESS_KEY, PDF_OSS_BUCKET_NAME, OSS_REGION, S3_ENDPOINT
  
  try {
    const pdfPath = '/path/to/your/document.pdf';
    
    if (!fs.existsSync(pdfPath)) {
      console.log(`PDF file not found at: ${pdfPath}`);
      console.log('Please update the pdfPath variable to point to a real PDF file');
      return;
    }
    
    const url = await uploadPdfFromPath(pdfPath, 'legacy/document.pdf');
    console.log('✓ PDF uploaded using legacy API:', url);
    
  } catch (error) {
    console.error('Legacy PDF upload failed:', error);
    console.log('Note: Make sure environment variables are set for legacy API');
  }
}

// Example 5: PDF metadata management
async function pdfMetadataExample() {
  console.log('\n=== PDF Metadata Management Example ===');
  
  const s3Service = createS3ServiceFromEnv();
  
  try {
    // Create a metadata object to store with the PDF
    const pdfMetadata = {
      title: 'Sample Document',
      author: 'John Doe',
      createdAt: new Date().toISOString(),
      tags: ['important', 'contracts', '2023'],
      version: '1.0',
    };
    
    // Upload PDF
    const pdfPath = '/path/to/your/document.pdf';
    
    if (!fs.existsSync(pdfPath)) {
      console.log(`PDF file not found at: ${pdfPath}`);
      console.log('Please update the pdfPath variable to point to a real PDF file');
      return;
    }
    
    const pdfResult = await s3Service.uploadPdfFromPath(pdfPath, 'metadata/document.pdf');
    console.log('✓ PDF uploaded:', pdfResult.url);
    
    // Upload metadata as JSON
    const metadataBuffer = Buffer.from(JSON.stringify(pdfMetadata, null, 2));
    const metadataResult = await s3Service.uploadToS3(
      metadataBuffer,
      'metadata/document.json',
      { contentType: 'application/json' }
    );
    console.log('✓ Metadata uploaded:', metadataResult.url);
    
    // Generate URLs for both files
    const pdfDownloadUrl = await s3Service.getSignedDownloadUrl(pdfResult.key);
    const metadataDownloadUrl = await s3Service.getSignedDownloadUrl(metadataResult.key);
    
    console.log('PDF download URL:', pdfDownloadUrl);
    console.log('Metadata download URL:', metadataDownloadUrl);
    
  } catch (error) {
    console.error('Metadata management failed:', error);
  }
}

// Run all examples
async function runExamples() {
  console.log('S3 Service PDF Processing Examples\n');
  
  // Uncomment examples you want to run:
  // await uploadPdfExample();
  // await uploadMultiplePdfsExample();
  // await pdfWorkflowExample();
  // await legacyPdfExample();
  // await pdfMetadataExample();
  
  console.log('\nNote: Uncomment examples above and update file paths to run them');
}

// Run if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

export {
  uploadPdfExample,
  uploadMultiplePdfsExample,
  pdfWorkflowExample,
  legacyPdfExample,
  pdfMetadataExample,
};