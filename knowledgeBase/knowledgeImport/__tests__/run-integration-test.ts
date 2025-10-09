import { MinerUPdfConvertor } from '../MinerU/MinerUPdfConvertor';
import * as path from 'path';
import * as fs from 'fs';
import { config } from 'dotenv';
config();

/**
 * Simple test runner for MinerU integration test
 * Run with: npx tsx knowledgeBase/knowledgeImport/__tests__/run-integration-test.ts
 */

async function runIntegrationTest() {
  console.log('🚀 Starting MinerU Integration Test');
  console.log('=====================================');

  // Check environment
  const token = process.env.MINERU_TOKEN;
  if (!token) {
    console.error('❌ MINERU_TOKEN environment variable is required');
    console.log('Please set your MinerU token:');
    console.log('export MINERU_TOKEN="your-token-here"');
    console.log('');
    console.log('To get a token:');
    console.log('1. Visit https://mineru.net');
    console.log('2. Register/login to your account');
    console.log('3. Go to API settings or user center');
    console.log('4. Copy your API token');
    process.exit(1);
  }

  console.log('✅ Token found (length:', token.length, 'characters)');
  if (token.length < 10) {
    console.warn("⚠️  Token seems too short, please verify it's correct");
  }

  const testPdfPath = path.join(__dirname, 'viral_pneumonia.pdf');
  const downloadDir = path.join(__dirname, 'test-downloads');

  // Verify test PDF exists
  if (!fs.existsSync(testPdfPath)) {
    console.error('❌ Test PDF not found:', testPdfPath);
    process.exit(1);
  }

  console.log('✅ Test PDF found:', testPdfPath);
  console.log('📁 File size:', fs.statSync(testPdfPath).size, 'bytes');

  // Create converter
  const converter = new MinerUPdfConvertor({
    token: token,
    downloadDir: downloadDir,
    defaultOptions: {
      is_ocr: true,
      enable_formula: true,
      enable_table: true,
      language: 'en',
      extra_formats: ['docx', 'html'],
    },
    timeout: 300000, // 5 minutes
    maxRetries: 3,
    retryDelay: 5000,
  });

  // Validate token before proceeding
  console.log('\n🔐 Validating API token...');
  const isTokenValid = await converter.validateToken();
  if (!isTokenValid) {
    console.error(
      '❌ Token validation failed. Please check your token and try again.',
    );
    console.log('');
    console.log('Common issues:');
    console.log('- Token has expired');
    console.log('- Token is incorrect');
    console.log('- Token does not have sufficient permissions');
    console.log('- Account quota exceeded');
    process.exit(1);
  }
  console.log('✅ Token validation passed');

  // Ensure download directory exists
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
    console.log('📁 Created download directory:', downloadDir);
  }

  try {
    console.log('\n🔄 Starting PDF conversion...');
    const startTime = Date.now();

    // Convert the PDF
    const result = await converter.convertPdfToMarkdown(testPdfPath, {
      data_id: 'ruuskanen-viral-pneumonia-2011',
      is_ocr: true,
      enable_formula: true,
      enable_table: true,
      language: 'en',
      page_ranges: '1-5', // Process first 5 pages for testing
      extra_formats: ['docx', 'html'],
    });

    const processingTime = Date.now() - startTime;
    console.log(`⏱️  Processing completed in ${processingTime / 1000}s`);

    if (result.success) {
      console.log('\n✅ Conversion successful!');
      console.log('📋 Task ID:', result.taskId);
      console.log('📁 Downloaded files:', result.downloadedFiles?.length || 0);

      // List downloaded files
      if (result.downloadedFiles && result.downloadedFiles.length > 0) {
        console.log('\n📄 Downloaded files:');
        result.downloadedFiles.forEach((file, index) => {
          if (fs.existsSync(file)) {
            const stats = fs.statSync(file);
            console.log(
              `   ${index + 1}. ${path.basename(file)} (${stats.size} bytes)`,
            );
          } else {
            console.log(`   ${index + 1}. ${file} (file not found)`);
          }
        });
      }

      // Show result data preview
      if (result.data) {
        console.log('\n📊 Result data preview:');
        if (typeof result.data === 'object') {
          console.log('   Type:', typeof result.data);
          console.log(
            '   Keys:',
            Object.keys(result.data).slice(0, 5).join(', '),
          );

          // Try to extract some meaningful content
          if (result.data.zipFilePath) {
            console.log('   ZIP file:', result.data.zipFilePath);
          }
          if (result.data.extractedAt) {
            console.log('   Extracted at:', result.data.extractedAt);
          }
        } else {
          console.log(
            '   Content:',
            JSON.stringify(result.data).substring(0, 200) + '...',
          );
        }
      }

      // Get task status
      if (result.taskId) {
        console.log('\n🔍 Checking task status...');
        const status = await converter.getTaskStatus(result.taskId);
        console.log('   Status:', status.state);
        if (status.extract_progress) {
          console.log(
            '   Progress:',
            `${status.extract_progress.extracted_pages}/${status.extract_progress.total_pages} pages`,
          );
        }
      }
    } else {
      console.error('\n❌ Conversion failed:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
    process.exit(1);
  }

  // Cleanup
  console.log('\n🧹 Cleaning up test files...');
  try {
    await converter.cleanupDownloadedFiles(0);
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.warn('⚠️  Cleanup failed:', error);
  }

  console.log('\n🎉 Integration test completed successfully!');
}

// Run the test
if (require.main === module) {
  runIntegrationTest().catch((error) => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

export { runIntegrationTest };
