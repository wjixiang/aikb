/**
 * Example demonstrating the image upload functionality of MinerUPdfConvertor
 * This example shows how images are automatically extracted and uploaded to S3
 */

import { MinerUPdfConvertor } from '../MinerU/MinerUPdfConvertor';
import type {
  ConversionResult,
  ImageUploadResult,
} from '../MinerU/MinerUPdfConvertor';
import * as path from 'path';

async function demonstrateImageUpload() {
  console.log('=== MinerU PDF Converter with Image Upload Example ===\n');

  // Create a converter instance
  const converter = new MinerUPdfConvertor({
    token: process.env.MINERU_TOKEN || 'your-token-here',
    baseUrl: process.env.MINERU_BASE_URL || 'https://mineru.net/api/v4',
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    downloadDir: './mineru-downloads',
    defaultOptions: {
      is_ocr: false,
      enable_formula: true,
      enable_table: true,
      language: 'en',
    },
  });

  try {
    console.log('Converting PDF with images...');

    // Convert a PDF that contains images
    const result: ConversionResult = await converter.convertPdfToMarkdown(
      'path/to/your/pdf-with-images.pdf',
    );

    if (result.success) {
      console.log('✅ Conversion successful!');
      console.log(
        `📄 Markdown content length: ${result.data?.length || 0} characters`,
      );

      // Check for uploaded images
      if (result.uploadedImages && result.uploadedImages.length > 0) {
        console.log(`\n🖼️  Images uploaded: ${result.uploadedImages.length}`);

        result.uploadedImages.forEach(
          (image: ImageUploadResult, index: number) => {
            console.log(`\n  Image ${index + 1}:`);
            console.log(`    Original path: ${image.originalPath}`);
            console.log(`    S3 URL: ${image.s3Url}`);
            console.log(`    S3 key: ${image.fileName}`);
            console.log(
              `    Preserved filename: ${path.basename(image.originalPath)}`,
            );
          },
        );

        // Show how the markdown content references the S3 URLs
        console.log('\n📝 Markdown content with S3 image references:');
        console.log('----------------------------------------');

        // Extract a snippet of the markdown showing image references
        if (result.data) {
          const lines = result.data.split('\n');
          const imageLines = lines.filter(
            (line) =>
              line.includes('http') &&
              (line.includes('.jpg') ||
                line.includes('.png') ||
                line.includes('.gif') ||
                line.includes('.svg')),
          );

          if (imageLines.length > 0) {
            imageLines.slice(0, 3).forEach((line) => {
              console.log(line);
            });

            if (imageLines.length > 3) {
              console.log(
                `... and ${imageLines.length - 3} more image references`,
              );
            }
          } else {
            console.log('No image references found in the first few lines');
          }
        }
      } else {
        console.log('\n📷 No images were found or uploaded');
      }
    } else {
      console.error('❌ Conversion failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error during conversion:', error);
  }
}

async function demonstrateS3UrlConversion() {
  console.log('\n=== Converting PDF from S3 URL with Image Upload ===\n');

  const converter = new MinerUPdfConvertor({
    token: process.env.MINERU_TOKEN || 'your-token-here',
    downloadDir: './mineru-downloads',
  });

  try {
    // Convert PDF from S3 URL
    const result: ConversionResult = await converter.convertPdfToMarkdownFromS3(
      'https://your-s3-bucket.s3.amazonaws.com/path/to/pdf-with-images.pdf',
    );

    if (result.success) {
      console.log('✅ S3 URL conversion successful!');

      if (result.uploadedImages && result.uploadedImages.length > 0) {
        console.log(
          `\n🖼️  Images from S3 PDF uploaded to S3: ${result.uploadedImages.length}`,
        );

        // Show the mapping from original to S3 URLs
        result.uploadedImages.forEach((image: ImageUploadResult) => {
          console.log(`  ${image.originalPath} → ${image.s3Url}`);
          console.log(`  S3 key: ${image.fileName}`);
        });
      }
    } else {
      console.error('❌ S3 URL conversion failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error during S3 URL conversion:', error);
  }
}

function explainImageUploadProcess() {
  console.log('\n=== Image Upload Process Explained ===\n');

  console.log('When MinerUPdfConvertor processes a ZIP file containing:');
  console.log('1. A markdown file (.md or .markdown)');
  console.log('2. An /images directory with image files');
  console.log('');
  console.log('The converter automatically:');
  console.log('• Extracts the markdown content');
  console.log('• Identifies all images in the /images directory');
  console.log('• Uploads each image to S3 preserving the original filename');
  console.log('• Organizes images in S3 based on PDF S3 key');
  console.log('• Updates the markdown content to reference S3 URLs');
  console.log('');
  console.log('S3 Key Structure:');
  console.log(
    '• Images stored as: images/documents/example/report.pdf/image1.jpg',
  );
  console.log('• PDF S3 key (without extension) becomes the image directory');
  console.log('• Original image filenames are preserved');
  console.log('');
  console.log('Supported image formats:');
  console.log('• JPEG (.jpg, .jpeg)');
  console.log('• PNG (.png)');
  console.log('• GIF (.gif)');
  console.log('• SVG (.svg)');
  console.log('• WebP (.webp)');
  console.log('');
  console.log('Image URL replacements in markdown:');
  console.log(
    '• images/filename.jpg → https://bucket.s3.amazonaws.com/images/documents/example/report.pdf/filename.jpg',
  );
  console.log(
    '• ./images/filename.jpg → https://bucket.s3.amazonaws.com/images/documents/example/report.pdf/filename.jpg',
  );
  console.log(
    '• /absolute/path/images/filename.jpg → https://bucket.s3.amazonaws.com/images/documents/example/report.pdf/filename.jpg',
  );
}

// Run the examples
export async function runImageUploadExample() {
  console.log('Note: This is a demonstration example.');
  console.log('To run with actual files, update the file paths and ensure:');
  console.log('- MINERU_TOKEN environment variable is set');
  console.log('- S3 credentials are configured');
  console.log('- The PDF files exist and contain images\n');

  // Uncomment the following lines to run with actual files:
  // await demonstrateImageUpload();
  // await demonstrateS3UrlConversion();

  explainImageUploadProcess();
}

// Example of processing the conversion result
export function processConversionResult(result: ConversionResult) {
  if (!result.success) {
    throw new Error(`Conversion failed: ${result.error}`);
  }

  const output = {
    markdown: result.data,
    images: result.uploadedImages || [],
    metadata: {
      taskId: result.taskId,
      downloadedFiles: result.downloadedFiles,
      imageCount: result.uploadedImages?.length || 0,
    },
  };

  // Save the markdown content
  if (result.data) {
    // In a real application, you might save this to a file or database
    console.log(
      `Markdown content ready for storage (${result.data.length} chars)`,
    );
  }

  // Save image information
  if (result.uploadedImages && result.uploadedImages.length > 0) {
    console.log(
      `Image URLs ready for reference: ${result.uploadedImages.length} images`,
    );
    // You might store these URLs in a database alongside the markdown content
  }

  return output;
}
