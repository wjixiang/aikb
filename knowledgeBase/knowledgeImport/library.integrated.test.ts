import { config } from 'dotenv';
// Load environment variables from .env file
config({ path: '.env' });

import Library, { LibraryItem, S3ElasticSearchLibraryStorage } from './library';
import { S3MongoLibraryStorage } from './library';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MinerUPdfConvertor } from './MinerU/MinerUPdfConvertor';

import { createPdfConversionWorker } from 'knowledgeBase/lib/rabbitmq/pdf-conversion.worker';
import { createPdfAnalysisWorker } from 'knowledgeBase/lib/rabbitmq/pdf-analysis.worker';
import { createPdfProcessingCoordinatorWorker } from 'knowledgeBase/lib/rabbitmq/pdf-processing-coordinator.worker';
import { startMarkdownStorageWorker } from 'knowledgeBase/lib/rabbitmq/markdown-storage.worker';
import {
  getRabbitMQService,
  initializeRabbitMQService,
} from 'knowledgeBase/lib/rabbitmq/rabbitmq.service';

// beforeAll(async () => {
//   // Use MongoDB storage instead of Elasticsearch for more reliable testing
//   console.log('Using MongoDB storage for integration tests');
//   storage = new S3MongoLibraryStorage();
// });

export async function UploadTestPdf() {
  const testMinerUPdfConvertor = new MinerUPdfConvertor({
    token: process.env.MINERU_TOKEN as string,
    downloadDir: 'test/download',
    defaultOptions: {
      is_ocr: true,
      enable_formula: true,
      enable_table: true,
      language: 'en',
      extra_formats: ['docx', 'html'],
    },
    timeout: 120000, // 2 minutes timeout
    maxRetries: 3,
    retryDelay: 5000,
  });
  const storage = new S3ElasticSearchLibraryStorage(
    'http://elasticsearch:9200',
    1024,
  );
  const library = new Library(storage, testMinerUPdfConvertor);
  library;
  // Read the test PDF file
  const pdfPath = 'test/viral_pneumonia.pdf';
  const pdfBuffer = fs.readFileSync(pdfPath);

  // Prepare metadata for the PDF
  const metadata = {
    title: 'viral_pneumonia',
    authors: [{ firstName: 'Test', lastName: 'Author' }],
    abstract: 'This is a test document',
    publicationYear: 2023,
    tags: ['test', 'research'],
    language: 'English',
  };

  // Store the PDF from buffer
  const book = await library.storePdf(pdfBuffer, 'viral_pneumonia', metadata);
  return { book, library };
}

describe.skip(Library, async () => {
  let book;

  // Option 1: With default PDF converter
  beforeAll(async () => {
    try {
      // Initialize the singleton RabbitMQ service that Library will use
      // const rabbitMQService = getRabbitMQService();
      // await rabbitMQService.initialize();
      console.log('✅ RabbitMQ service initialized successfully');

      // Create storage instance for workers
      // const storage = new S3ElasticSearchLibraryStorage('http://elasticsearch:9200', 1024);

      // // Start workers
      // await createPdfAnalysisWorker(storage);
      // console.log('✅ PDF analysis worker started');

      // await createPdfProcessingCoordinatorWorker(storage);
      // console.log('✅ PDF processing coordinator worker started');

      // await createPdfConversionWorker();
      // console.log('✅ PDF conversion worker started');

      // await startMarkdownStorageWorker(storage);
      // console.log('✅ Markdown storage worker started');

      // // Upload test PDF after workers are ready
      book = await UploadTestPdf();
      console.log('✅ Test PDF uploaded');
    } catch (error) {
      console.error('❌ Failed to initialize test environment:', error);
      throw error;
    }
  }, 60000); // Increase timeout for setup

  // afterAll(async()=>{
  //   try {
  //     if (book) {
  //       await book.selfDelete();
  //       console.log('✅ Test cleanup completed');
  //     }
  //   } catch (error) {
  //     console.error('❌ Cleanup failed:', error);
  //   }
  // })
  // Store the PDF from buffer
  it.skip('self delete', async () => {
    const res = await book.selfDelete();
    expect(res).toBe(true);
  });

  it('upload pdf buffer and retrieve s3 download url', async () => {
    // Verify the book was stored correctly
    expect(book).toBeDefined();
    expect(book.metadata.title).toBe('viral_pneumonia');
    expect(book.metadata.s3Key).toBeDefined();
    expect(book.metadata.s3Url).toBeDefined();

    // Retrieve the S3 download URL
    const downloadUrl = await book.getPdfDownloadUrl();

    // Verify the download URL is valid
    expect(downloadUrl).toBeDefined();
    expect(typeof downloadUrl).toBe('string');
    expect(downloadUrl).toContain(book.metadata.s3Key!);

    // Verify the URL matches the stored URL
    // expect(downloadUrl).toBe(book.metadata.s3Url);

    console.log('Test completed successfully!');
    console.log(`PDF uploaded with ID: ${book.metadata.id}`);
    console.log(`S3 Key: ${book.metadata.s3Key}`);
    console.log(`Download URL: ${downloadUrl}`);
  }, 30000); // Increase timeout to 30 seconds for S3 operations

  it.skip('get current md', async () => {
    // Read markdown content from Library storage
    const mdContent = await book.getMarkdown();
    console.log(
      `md content read from Library (1000 length): ${JSON.stringify(mdContent.substring(0, 1000))}`,
    );
  });

  it.skip('re-extract markdown', async () => {
    console.log(`re-extract markdown`);
    await book.extractMarkdown();
    const mdContent2 = await book.getMarkdown();
    console.log(
      `re-extracted md content (100 str): ${JSON.stringify(mdContent2.substring(0, 100))}`,
    );
  }, 99999);

  it.skip('justify existance of embedding', async () => {
    const ceRes = await book.chunkEmbed();
    const exist = await book.hasCompletedChunkEmbed();
    console.log(exist);
    expect(exist).toBe(true);
  });

  it.skip('semantic search', async () => {
    const searchRes = await book.searchInChunks('ACEI', 2);
    console.log(searchRes);
  });
});

describe('pdf process workflow', async () => {
  let { book, library } = await UploadTestPdf();

  it('start pdf async process', async () => {
    const s3Link = await book.getPdfDownloadUrl();
    console.log(`s3Link: ${s3Link}`);
    await library.sendPdfAnalysisRequest(
      book.getItemId(),
      s3Link,
      book.metadata.s3Key as string,
      book.metadata.title,
    );
  });
});
