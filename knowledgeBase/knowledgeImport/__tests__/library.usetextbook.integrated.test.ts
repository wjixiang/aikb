import Library, { S3ElasticSearchLibraryStorage } from '../library';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeAll } from 'vitest';
import { MinerUPdfConvertor } from '../MinerU/MinerUPdfConvertor';
import { ChunkingStrategyType } from 'lib/chunking/chunkingStrategy';
import { time } from 'console';
import { delay } from 'rxjs';
import { getRabbitMQService } from '../../../lib/rabbitmq/rabbitmq.service';

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
  const library = new Library(storage);

  // Read the test PDF file
  const pdfPath = 'test/病理生理学_第十版.pdf';
  const pdfBuffer = fs.readFileSync(pdfPath);

  // Prepare metadata for the PDF
  const metadata = {
    title: '病理生理学_人卫十版',
    authors: [{ firstName: 'Test', lastName: 'Author' }],
    abstract: '病理生理学_人卫十版',
    publicationYear: 2025,
    tags: ['test', 'textbook'],
    language: 'zh',
  };

  // Store the PDF from buffer
  const book = await library.storePdf(pdfBuffer, metadata.title, metadata);
  return book;
}

describe(Library, async () => {
  // Store the PDF from buffer
  const book = await UploadTestPdf();

  it.skip('upload pdf buffer and retrieve s3 download url', async () => {
    // Verify the book was stored correctly
    expect(book).toBeDefined();
    expect(book.metadata.title).toBe('病理生理学_人卫十版');
    expect(book.metadata.s3Key).toBeDefined();

    // Retrieve the S3 download URL
    const downloadUrl = await book.getPdfDownloadUrl();

    // Verify the download URL is valid
    expect(downloadUrl).toBeDefined();
    expect(typeof downloadUrl).toBe('string');
    // expect(downloadUrl).toContain(book.metadata.s3Key!);

    // Verify the URL matches the stored URL
    // expect(downloadUrl).toBe(book.metadata.s3Url);

    console.log('Test completed successfully!');
    console.log(`PDF uploaded with ID: ${book.metadata.id}`);
    console.log(`S3 Key: ${book.metadata.s3Key}`);
    console.log(`Download URL: ${downloadUrl}`);

    const s3Link = await book.getPdfDownloadUrl();
    console.log(`s3Link: ${s3Link}`);

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

    const library = new Library(storage);
    await library.sendPdfAnalysisRequest(
      book.getItemId(),
      s3Link,
      book.metadata.s3Key as string,
      book.metadata.title,
    );
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
    const searchRes = await book.semanticSearchWithDenseVector('ACEI', 2);
    console.log(searchRes);
  });

  it.skip('re-process', async () => {
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
    const library = new Library(storage);
    const s3Link = await book.getPdfDownloadUrl();
    console.log(`s3Link: ${s3Link}`);
    await library.sendPdfAnalysisRequest(
      book.getItemId(),
      s3Link,
      book.metadata.s3Key as string,
      book.metadata.title,
    );
  });

  it.skip('re-embed', async () => {
    delay(1000);
    await book.chunkEmbed(ChunkingStrategyType.H1);
  }, 30000); // Increase timeout to 30 seconds

  it.skip('semantic search', async () => {
    const semanticSearchResult = await book.semanticSearchWithDenseVector(
      '期蛋白依赖性激酶抑制因子表达不足和突变：多种肿瘤细胞或组织 CKI 表达不足或突变',
    );
    console.log(semanticSearchResult);
  });

  it('get all chunkEmbedGroupids', async () => {
    const ids = await book.getDenseVectorIndexGroupId();
    console.log(ids);
  });
});
