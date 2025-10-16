import { uploadPdfFromPath } from '../S3Service';

/**
 * Example usage of uploadPdfFromPath function
 *
 * This example demonstrates how to upload a PDF file from a local path to S3
 *
 * To run this example:
 * 1. Make sure you have the required environment variables set
 * 2. Update the pdfPath variable to point to a valid PDF file
 * 3. Run: npx tsx knowledgeBase/lib/s3Service/__tests__/uploadPdfFromPath.example.ts
 */

async function example() {
  try {
    // Update this path to point to a PDF file on your system
    const pdfPath = '/path/to/your/pdf/file.pdf';

    // Optional: specify a custom S3 key (object name)
    // If not provided, the filename from the path will be used
    const s3Key = 'uploads/my-document.pdf';

    console.log(`Uploading PDF from path: ${pdfPath}`);

    // Upload the PDF to S3
    const s3Url = await uploadPdfFromPath(pdfPath, s3Key);

    console.log(`PDF uploaded successfully!`);
    console.log(`S3 URL: ${s3Url}`);
  } catch (error) {
    console.error('Error uploading PDF:', error);
  }
}

// Run the example
example();
