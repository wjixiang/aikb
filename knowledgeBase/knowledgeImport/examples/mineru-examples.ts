import { MinerUPdfConvertor } from '../MinerUPdfConvertor';
import { MinerUClient } from '../MinerUClient';
import fs from 'fs';

/**
 * Examples demonstrating how to use the MinerU API client and PDF converter
 */

// Configuration - replace with your actual token
const MINERU_TOKEN = process.env.MINERU_TOKEN || 'your-token-here';

async function basicSingleFileConversion() {
  console.log('=== Basic Single File Conversion ===');

  const converter = new MinerUPdfConvertor({
    token: MINERU_TOKEN,
    downloadDir: './downloads',
    defaultOptions: {
      is_ocr: true,
      enable_formula: true,
      enable_table: true,
      language: 'ch',
    },
  });

  try {
    // Convert from URL
    const result = await converter.convertPdfToJSON(
      'https://cdn-mineru.openxlab.org.cn/demo/example.pdf',
      {
        data_id: 'example-doc',
        extra_formats: ['docx', 'html'],
      },
    );

    if (result.success) {
      console.log('✅ Conversion successful!');
      console.log('Task ID:', result.taskId);
      console.log('Downloaded files:', result.downloadedFiles);
      console.log(
        'Data preview:',
        JSON.stringify(result.data, null, 2).substring(0, 200) + '...',
      );
    } else {
      console.error('❌ Conversion failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function localFileConversion() {
  console.log('\n=== Local File Conversion ===');

  const converter = new MinerUPdfConvertor({
    token: MINERU_TOKEN,
    downloadDir: './downloads',
  });

  const localFilePath = './sample.pdf'; // Replace with actual file path

  try {
    const result = await converter.processLocalFile(localFilePath, {
      is_ocr: true,
      data_id: 'local-sample',
      page_ranges: '1-5',
    });

    if (result.success) {
      console.log('✅ Local file conversion successful!');
      console.log('Task ID:', result.taskId);
      console.log('Downloaded files:', result.downloadedFiles);
    } else {
      console.error('❌ Local file conversion failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function multipleFilesConversion() {
  console.log('\n=== Multiple Files Conversion ===');

  const converter = new MinerUPdfConvertor({
    token: MINERU_TOKEN,
    downloadDir: './downloads',
  });

  const filePaths = ['./document1.pdf', './document2.pdf', './document3.pdf']; // Replace with actual file paths

  try {
    const results = await converter.processMultipleFiles(filePaths, {
      is_ocr: true,
      enable_formula: false,
      language: 'en',
    });

    results.forEach((result, index) => {
      if (result.success) {
        console.log(`✅ File ${index + 1} conversion successful!`);
        console.log(`   Task ID: ${result.taskId}`);
      } else {
        console.error(`❌ File ${index + 1} conversion failed:`, result.error);
      }
    });
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function batchUrlConversion() {
  console.log('\n=== Batch URL Conversion ===');

  const converter = new MinerUPdfConvertor({
    token: MINERU_TOKEN,
    downloadDir: './downloads',
  });

  const urls = [
    'https://cdn-mineru.openxlab.org.cn/demo/example.pdf',
    'https://cdn-mineru.openxlab.org.cn/demo/example2.pdf',
  ];

  try {
    const results = await converter.processUrls(urls, {
      is_ocr: true,
      enable_table: true,
      language: 'ch',
      extra_formats: ['html'],
    });

    results.forEach((result, index) => {
      if (result.success) {
        console.log(`✅ URL ${index + 1} conversion successful!`);
        console.log(`   Task ID: ${result.taskId}`);
      } else {
        console.error(`❌ URL ${index + 1} conversion failed:`, result.error);
      }
    });
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function taskStatusMonitoring() {
  console.log('\n=== Task Status Monitoring ===');

  const converter = new MinerUPdfConvertor({
    token: MINERU_TOKEN,
  });

  const taskId = 'your-task-id-here'; // Replace with actual task ID

  try {
    const status = await converter.getTaskStatus(taskId);
    console.log('Task Status:', status.state);
    console.log('Progress:', status.extract_progress);

    if (status.state === 'done') {
      console.log('✅ Task completed!');
      console.log('Result URL:', status.full_zip_url);
    } else if (status.state === 'failed') {
      console.error('❌ Task failed:', status.err_msg);
    } else {
      console.log('⏳ Task in progress...');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function advancedClientUsage() {
  console.log('\n=== Advanced Client Usage ===');

  const client = new MinerUClient({
    token: MINERU_TOKEN,
    maxRetries: 5,
    retryDelay: 2000,
    timeout: 60000,
  });

  try {
    // Create single file task
    const taskId = await client.createSingleFileTask({
      url: 'https://cdn-mineru.openxlab.org.cn/demo/example.pdf',
      is_ocr: true,
      enable_formula: true,
      enable_table: true,
      language: 'ch',
      data_id: 'advanced-example',
      extra_formats: ['docx', 'html', 'latex'],
      model_version: 'vlm',
    });

    console.log('Task created:', taskId);

    // Wait for completion with custom options
    const result = await client.waitForTaskCompletion(taskId, {
      pollInterval: 3000,
      timeout: 600000,
      downloadDir: './advanced-downloads',
    });

    console.log('✅ Task completed!');
    console.log('Downloaded files:', result.downloadedFiles);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===');

  const converter = new MinerUPdfConvertor({
    token: 'invalid-token', // This will cause an error
    downloadDir: './downloads',
  });

  try {
    const result = await converter.convertPdfToJSON(
      'https://invalid-url.com/file.pdf',
    );

    if (!result.success) {
      console.log('Expected error caught:', result.error);
    }
  } catch (error) {
    console.log('Unexpected error:', error);
  }
}

async function cleanupExample() {
  console.log('\n=== Cleanup Example ===');

  const converter = new MinerUPdfConvertor({
    token: MINERU_TOKEN,
    downloadDir: './downloads',
  });

  try {
    // Clean up files older than 24 hours
    await converter.cleanupDownloadedFiles(24);
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// Run examples
async function runExamples() {
  console.log('MinerU API Examples\n');

  // Check if token is available
  if (MINERU_TOKEN === 'your-token-here') {
    console.log(
      '⚠️  Please set your MinerU token in the MINERU_TOKEN environment variable',
    );
    console.log('   or replace the placeholder in the code.\n');
    return;
  }

  // Run examples (comment out those you don't want to run)
  await basicSingleFileConversion();
  // await localFileConversion();
  // await multipleFilesConversion();
  // await batchUrlConversion();
  // await taskStatusMonitoring();
  // await advancedClientUsage();
  // await errorHandlingExample();
  // await cleanupExample();

  console.log('\n✅ Examples completed!');
}

// Export functions for individual testing
export {
  basicSingleFileConversion,
  localFileConversion,
  multipleFilesConversion,
  batchUrlConversion,
  taskStatusMonitoring,
  advancedClientUsage,
  errorHandlingExample,
  cleanupExample,
  runExamples,
};

// Run if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}
